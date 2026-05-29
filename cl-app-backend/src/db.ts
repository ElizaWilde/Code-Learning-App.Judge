import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { UserRole, isUserRole } from "./roles";

export const USER_TYPES = [
  "normal",
  "expert"
] as const;

export type UserType = typeof USER_TYPES[number];

type DatabaseBootstrapResult = {
  db: DatabaseSync;
  path: string;
};

// Pick writable per-user directories first so SQLite does not rely on the project drive.
function resolveDataDirectoryCandidates(): string[] {
  const configuredDataDir = process.env.CODE_LEARNING_APP_DATA_DIR?.trim();
  const candidates: string[] = [];

  if (configuredDataDir) {
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

function resolveDatabasePathCandidates(): string[] {
  const configuredDatabasePath = process.env.CODE_LEARNING_APP_DATABASE_PATH?.trim();
  const candidates: string[] = [];

  if (configuredDatabasePath) {
    candidates.push(configuredDatabasePath);
  }

  for (const dataDir of resolveDataDirectoryCandidates()) {
    candidates.push(path.join(dataDir, "app.db"));
  }

  return uniquePaths(candidates);
}

function uniquePaths(values: string[]): string[] {
  return [...new Set(values.map((value) => path.resolve(value)))];
}

function ensureDatabaseDirectory(databasePath: string): void {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
}

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
        // Ignore cleanup failures and continue to the next candidate.
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
      // Ignore cleanup failure while surfacing the original bootstrap error.
    }
    throw new Error([
      "Unable to initialize SQLite database.",
      ...errors,
      `:memory:: ${error instanceof Error ? error.message : String(error)}`
    ].join("\n"));
  }
}

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

// Store passwords as salt + scrypt hash instead of plaintext.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Recompute the hash with the original salt and compare safely.
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

// Insert a new user record and return the public fields the API needs.
function normalizeRole(role: unknown): UserRole {
  return isUserRole(role) ? role : "user";
}

export function isUserType(value: unknown): value is UserType {
  return typeof value === "string" && USER_TYPES.includes(value as UserType);
}

function normalizeUserType(userType: unknown): UserType {
  return isUserType(userType) ? userType : "normal";
}

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

// Read the full stored row for username checks and password verification.
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

// Validate credentials and strip the response down to non-sensitive fields.
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

export function ensureUserRole(username: string, role: UserRole): void {
  db.prepare("UPDATE users SET role = ? WHERE username = ?").run(role, username);
}

export function ensureUserType(username: string, userType: UserType): void {
  db.prepare("UPDATE users SET user_type = ? WHERE username = ?").run(userType, username);
}

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

// Surface SQLite unique-key failures as a specific registration conflict.
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

// Exposed for diagnostics so the API can report where the database lives.
export function getDatabasePath(): string {
  return databasePath;
}
