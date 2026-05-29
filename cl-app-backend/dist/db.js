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
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_sqlite_1 = require("node:sqlite");
const roles_1 = require("./roles");
exports.USER_TYPES = [
    "normal",
    "expert"
];
// Pick writable per-user directories first so SQLite does not rely on the project drive.
function resolveDataDirectoryCandidates() {
    const configuredDataDir = process.env.CODE_LEARNING_APP_DATA_DIR?.trim();
    const candidates = [];
    if (configuredDataDir) {
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
function resolveDatabasePathCandidates() {
    const configuredDatabasePath = process.env.CODE_LEARNING_APP_DATABASE_PATH?.trim();
    const candidates = [];
    if (configuredDatabasePath) {
        candidates.push(configuredDatabasePath);
    }
    for (const dataDir of resolveDataDirectoryCandidates()) {
        candidates.push(node_path_1.default.join(dataDir, "app.db"));
    }
    return uniquePaths(candidates);
}
function uniquePaths(values) {
    return [...new Set(values.map((value) => node_path_1.default.resolve(value)))];
}
function ensureDatabaseDirectory(databasePath) {
    if (databasePath !== ":memory:") {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(databasePath), { recursive: true });
    }
}
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
                // Ignore cleanup failures and continue to the next candidate.
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
exports.db = db;
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
function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(16).toString("hex");
    const hash = node_crypto_1.default.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}
// Recompute the hash with the original salt and compare safely.
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
// Insert a new user record and return the public fields the API needs.
function normalizeRole(role) {
    return (0, roles_1.isUserRole)(role) ? role : "user";
}
function isUserType(value) {
    return typeof value === "string" && exports.USER_TYPES.includes(value);
}
function normalizeUserType(userType) {
    return isUserType(userType) ? userType : "normal";
}
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
// Read the full stored row for username checks and password verification.
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
// Validate credentials and strip the response down to non-sensitive fields.
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
function ensureUserRole(username, role) {
    db.prepare("UPDATE users SET role = ? WHERE username = ?").run(role, username);
}
function ensureUserType(username, userType) {
    db.prepare("UPDATE users SET user_type = ? WHERE username = ?").run(userType, username);
}
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
// Surface SQLite unique-key failures as a specific registration conflict.
function isUniqueConstraintError(error) {
    return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
// Exposed for diagnostics so the API can report where the database lives.
function getDatabasePath() {
    return databasePath;
}
