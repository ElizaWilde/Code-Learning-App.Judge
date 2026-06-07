// 功能：初始化本地 SQLite 数据库，管理用户账号、密码哈希、角色、用户类型和数据库路径选择
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// Node.js 内置 SQLite 用于保存用户、角色、用户类型和学习统计相关数据
import { DatabaseSync } from "node:sqlite";
import { UserRole, isUserRole } from "./roles";



/**app.db 的路径按“候选路径优先级”选择resolveDatabasePathCandidates()
 -> 得到一组候选 app.db 路径
 -> openDatabaseWithFallback()
 -> 依次尝试打开
 -> 哪个能成功创建/打开 SQLite，就用哪个
 -> 全部失败则回退到 :memory:
 */

// 用户类型用于前端展示普通用户或专家用户身份
export const USER_TYPES = [
  "normal",
  "expert"
] as const;

export type UserType = typeof USER_TYPES[number];

type DatabaseBootstrapResult = {
  db: DatabaseSync;
  path: string;
};

// 优先选择用户目录或临时目录，避免 SQLite 强依赖项目目录可写
function resolveDataDirectoryCandidates(): string[] {
  // CODE_LEARNING_APP_DATA_DIR 指定的是数据目录，app.db、quests.json 等文件会放在这个目录下
  const configuredDataDir = process.env.CODE_LEARNING_APP_DATA_DIR?.trim();
  const candidates: string[] = [];

  if (configuredDataDir) {
    //把用户通过环境变量配置的数据目录加入候选目录列表
    candidates.push(configuredDataDir);
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;

    if (localAppData) {
      candidates.push(path.join(localAppData, "CodeLearningApp"));
    }
  }

  candidates.push(path.join(os.tmpdir(), "CodeLearningApp"));
  candidates.push(path.join(os.homedir(), ".code-learning-app"));
  candidates.push(path.join(process.cwd(), ".data"));

  return uniquePaths(candidates);
}

// 支持通过环境变量指定完整数据库文件路径或数据目录
function resolveDatabasePathCandidates(): string[] {
  // CODE_LEARNING_APP_DATABASE_PATH 指定的是完整数据库文件路径，例如 F:\data\app.db
  const configuredDatabasePath = process.env.CODE_LEARNING_APP_DATABASE_PATH?.trim();
  const candidates: string[] = [];

  if (configuredDatabasePath) {
    candidates.push(configuredDatabasePath);
  }

  // 如果只配置了数据目录，就在每个候选目录下面统一使用 app.db 作为 SQLite 文件名
  for (const dataDir of resolveDataDirectoryCandidates()) {
    candidates.push(path.join(dataDir, "app.db"));
  }

  return uniquePaths(candidates);
}

// 去重并规范化路径，避免同一个目录被重复尝试
function uniquePaths(values: string[]): string[] {
  return [...new Set(values.map((value) => path.resolve(value)))];
}

// SQLite 文件所在目录不存在时先创建目录
function ensureDatabaseDirectory(databasePath: string): void {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
}

// 初始化用户表，并兼容旧数据库缺少 role 或 user_type 字段的情况
function initializeDatabaseSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      user_type TEXT NOT NULL DEFAULT 'normal',
      created_at TEXT NOT NULL
    )
  `);

  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const hasRoleColumn = tableInfo.some((column) => column.name === "role");
  const hasUserTypeColumn = tableInfo.some((column) => column.name === "user_type");

  if (!hasRoleColumn) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  if (!hasUserTypeColumn) {
    db.exec("ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'normal'");
  }
}

// 依次尝试候选数据库路径，全部失败时回退到内存数据库
function openDatabaseWithFallback(): DatabaseBootstrapResult {
  const candidates = resolveDatabasePathCandidates();
  const errors: string[] = [];

  for (const candidate of candidates) {
    let nextDb: DatabaseSync | null = null;

    try {
      ensureDatabaseDirectory(candidate);
      nextDb = new DatabaseSync(candidate);
      initializeDatabaseSchema(nextDb);
      return {
        db: nextDb,
        path: candidate
      };
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
      try {
        nextDb?.close();
      } catch {
        // 忽略关闭失败，继续尝试下一个候选路径
      }
    }
  }

  const fallbackDb = new DatabaseSync(":memory:");
  try {
    initializeDatabaseSchema(fallbackDb);
    console.warn("[db] Falling back to in-memory SQLite after all filesystem paths failed.");
    for (const message of errors) {
      console.warn(`[db] ${message}`);
    }
    return {
      db: fallbackDb,
      path: ":memory:"
    };
  } catch (error) {
    try {
      fallbackDb.close();
    } catch {
      // 抛出初始化错误前忽略内存数据库关闭失败
    }
    throw new Error([
      "Unable to initialize SQLite database.",
      ...errors,
      `:memory:: ${error instanceof Error ? error.message : String(error)}`
    ].join("\n"));
  }
}

// 模块加载时打开数据库，其他 store 直接复用同一个 db 实例
const bootstrap = openDatabaseWithFallback();
const databasePath = bootstrap.path;
const db = bootstrap.db;
export { db };

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  user_type: string;
  created_at: string;
};

// 预编译常用 SQL，减少重复构造语句并统一字段选择
const insertUserStatement = db.prepare(`
  INSERT INTO users (username, password_hash, role, user_type, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const findUserByUsernameStatement = db.prepare(`
  SELECT id, username, password_hash, role, user_type, created_at
  FROM users
  WHERE username = ?
`);

const listUsersStatement = db.prepare(`
  SELECT id, username, password_hash, role, user_type, created_at
  FROM users
  ORDER BY username COLLATE NOCASE ASC
`);

// 密码不保存明文，保存格式为 salt:scryptHash
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// 用原 salt 重新计算哈希，并用 timingSafeEqual 做安全比较
function verifyPassword(password: string, storedPasswordHash: string): boolean {
  const [salt, savedHash] = storedPasswordHash.split(":");

  if (!salt || !savedHash) {
    return false;
  }

  const hashedBuffer = crypto.scryptSync(password, salt, 64);
  const savedHashBuffer = Buffer.from(savedHash, "hex");

  if (hashedBuffer.length !== savedHashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashedBuffer, savedHashBuffer);
}

// 数据库里可能有旧值或非法值，统一兜底成 user 角色
function normalizeRole(role: unknown): UserRole {
  return isUserRole(role) ? role : "user";
}

// 用户类型只允许 normal 和 expert
export function isUserType(value: unknown): value is UserType {
  return typeof value === "string" && USER_TYPES.includes(value as UserType);
}

// 数据库里可能有旧值或非法值，统一兜底成 normal
function normalizeUserType(userType: unknown): UserType {
  return isUserType(userType) ? userType : "normal";
}

// 创建用户时先做密码哈希，再只返回 API 需要的公开字段
export function createUser(
  username: string,
  password: string,
  role: UserRole = "user",
  userType: UserType = "normal"
): { id: number; username: string; role: UserRole; userType: UserType } {
  const createdAt = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const result = insertUserStatement.run(username, passwordHash, role, userType, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    username,
    role,
    userType
  };
}

// 读取完整用户行，登录校验需要 password_hash，其他接口会再裁剪敏感字段
export function findUserByUsername(username: string): (Omit<UserRow, "role" | "user_type"> & { role: UserRole; user_type: UserType }) | null {
  const user = (findUserByUsernameStatement.get(username) as UserRow | undefined) ?? null;
  if (!user) {
    return null;
  }

  return {
    ...user,
    role: normalizeRole(user.role),
    user_type: normalizeUserType(user.user_type)
  };
}

// 登录时校验用户名和密码，成功后只返回非敏感用户字段
export function authenticateUser(username: string, password: string): { id: number; username: string; role: UserRole; userType: UserType } | null {
  const user = findUserByUsername(username);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    userType: user.user_type
  };
}

// 管理员后台修改用户角色
export function ensureUserRole(username: string, role: UserRole): void {
  db.prepare("UPDATE users SET role = ? WHERE username = ?").run(role, username);
}

// 管理员后台修改用户类型
export function ensureUserType(username: string, userType: UserType): void {
  db.prepare("UPDATE users SET user_type = ? WHERE username = ?").run(userType, username);
}

// 后台用户管理列表，只返回展示和权限判断需要的字段
export function listUsers(): Array<{ id: number; username: string; role: UserRole; userType: UserType; created_at: string }> {
  const users = listUsersStatement.all() as UserRow[];
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    userType: normalizeUserType(user.user_type),
    created_at: user.created_at
  }));
}

// 把 SQLite 唯一键冲突转换成注册接口可识别的用户名冲突
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

// 对外暴露数据库路径，方便 /api/auth/meta 和排查环境问题
export function getDatabasePath(): string {
  return databasePath;
}
