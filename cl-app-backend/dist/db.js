"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.USER_TYPES = void 0;
exports.isUserType = isUserType;
exports.createUser = createUser;
exports.findUserByUsername = findUserByUsername;
exports.authenticateUser = authenticateUser;
exports.ensureUserRole = ensureUserRole;
exports.ensureUserType = ensureUserType;
exports.listUsers = listUsers;
exports.isUniqueConstraintError = isUniqueConstraintError;
exports.getDatabasePath = getDatabasePath;
// 功能：初始化本地 SQLite 数据库，管理用户账号、密码哈希、角色、用户类型和数据库路径选择
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
// Node.js 内置 SQLite 用于保存用户、角色、用户类型和学习统计相关数据
const node_sqlite_1 = require("node:sqlite");
const roles_1 = require("./roles");
/**app.db 的路径按“候选路径优先级”选择resolveDatabasePathCandidates()
 -> 得到一组候选 app.db 路径
 -> openDatabaseWithFallback()
 -> 依次尝试打开
 -> 哪个能成功创建/打开 SQLite，就用哪个
 -> 全部失败则回退到 :memory:
 */
// 用户类型用于前端展示普通用户或专家用户身份
exports.USER_TYPES = [
    "normal",
    "expert"
];
// 优先选择用户目录或临时目录，避免 SQLite 强依赖项目目录可写
function resolveDataDirectoryCandidates() {
    // CODE_LEARNING_APP_DATA_DIR 指定的是数据目录，app.db、quests.json 等文件会放在这个目录下
    const configuredDataDir = process.env.CODE_LEARNING_APP_DATA_DIR?.trim();
    const candidates = [];
    if (configuredDataDir) {
        //把用户通过环境变量配置的数据目录加入候选目录列表
        candidates.push(configuredDataDir);
    }
    if (process.platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData) {
            candidates.push(node_path_1.default.join(localAppData, "CodeLearningApp"));
        }
    }
    candidates.push(node_path_1.default.join(node_os_1.default.tmpdir(), "CodeLearningApp"));
    candidates.push(node_path_1.default.join(node_os_1.default.homedir(), ".code-learning-app"));
    candidates.push(node_path_1.default.join(process.cwd(), ".data"));
    return uniquePaths(candidates);
}
// 支持通过环境变量指定完整数据库文件路径或数据目录
function resolveDatabasePathCandidates() {
    // CODE_LEARNING_APP_DATABASE_PATH 指定的是完整数据库文件路径，例如 F:\data\app.db
    const configuredDatabasePath = process.env.CODE_LEARNING_APP_DATABASE_PATH?.trim();
    const candidates = [];
    if (configuredDatabasePath) {
        candidates.push(configuredDatabasePath);
    }
    // 如果只配置了数据目录，就在每个候选目录下面统一使用 app.db 作为 SQLite 文件名
    for (const dataDir of resolveDataDirectoryCandidates()) {
        candidates.push(node_path_1.default.join(dataDir, "app.db"));
    }
    return uniquePaths(candidates);
}
// 去重并规范化路径，避免同一个目录被重复尝试
function uniquePaths(values) {
    return [...new Set(values.map((value) => node_path_1.default.resolve(value)))];
}
// SQLite 文件所在目录不存在时先创建目录
function ensureDatabaseDirectory(databasePath) {
    if (databasePath !== ":memory:") {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(databasePath), { recursive: true });
    }
}
// 初始化用户表，并兼容旧数据库缺少 role 或 user_type 字段的情况
function initializeDatabaseSchema(db) {
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
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
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
function openDatabaseWithFallback() {
    const candidates = resolveDatabasePathCandidates();
    const errors = [];
    for (const candidate of candidates) {
        let nextDb = null;
        try {
            ensureDatabaseDirectory(candidate);
            nextDb = new node_sqlite_1.DatabaseSync(candidate);
            initializeDatabaseSchema(nextDb);
            return {
                db: nextDb,
                path: candidate
            };
        }
        catch (error) {
            errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
            try {
                nextDb?.close();
            }
            catch {
                // 忽略关闭失败，继续尝试下一个候选路径
            }
        }
    }
    const fallbackDb = new node_sqlite_1.DatabaseSync(":memory:");
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
    }
    catch (error) {
        try {
            fallbackDb.close();
        }
        catch {
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
exports.db = db;
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
function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(16).toString("hex");
    const hash = node_crypto_1.default.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}
// 用原 salt 重新计算哈希，并用 timingSafeEqual 做安全比较
function verifyPassword(password, storedPasswordHash) {
    const [salt, savedHash] = storedPasswordHash.split(":");
    if (!salt || !savedHash) {
        return false;
    }
    const hashedBuffer = node_crypto_1.default.scryptSync(password, salt, 64);
    const savedHashBuffer = Buffer.from(savedHash, "hex");
    if (hashedBuffer.length !== savedHashBuffer.length) {
        return false;
    }
    return node_crypto_1.default.timingSafeEqual(hashedBuffer, savedHashBuffer);
}
// 数据库里可能有旧值或非法值，统一兜底成 user 角色
function normalizeRole(role) {
    return (0, roles_1.isUserRole)(role) ? role : "user";
}
// 用户类型只允许 normal 和 expert
function isUserType(value) {
    return typeof value === "string" && exports.USER_TYPES.includes(value);
}
// 数据库里可能有旧值或非法值，统一兜底成 normal
function normalizeUserType(userType) {
    return isUserType(userType) ? userType : "normal";
}
// 创建用户时先做密码哈希，再只返回 API 需要的公开字段
function createUser(username, password, role = "user", userType = "normal") {
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
function findUserByUsername(username) {
    const user = findUserByUsernameStatement.get(username) ?? null;
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
function authenticateUser(username, password) {
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
function ensureUserRole(username, role) {
    db.prepare("UPDATE users SET role = ? WHERE username = ?").run(role, username);
}
// 管理员后台修改用户类型
function ensureUserType(username, userType) {
    db.prepare("UPDATE users SET user_type = ? WHERE username = ?").run(userType, username);
}
// 后台用户管理列表，只返回展示和权限判断需要的字段
function listUsers() {
    const users = listUsersStatement.all();
    return users.map((user) => ({
        id: user.id,
        username: user.username,
        role: normalizeRole(user.role),
        userType: normalizeUserType(user.user_type),
        created_at: user.created_at
    }));
}
// 把 SQLite 唯一键冲突转换成注册接口可识别的用户名冲突
function isUniqueConstraintError(error) {
    return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
// 对外暴露数据库路径，方便 /api/auth/meta 和排查环境问题
function getDatabasePath() {
    return databasePath;
}
