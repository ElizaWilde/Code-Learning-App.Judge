"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.deleteSession = deleteSession;
exports.getRequestToken = getRequestToken;
exports.requireAuth = requireAuth;
exports.getModulePermissions = getModulePermissions;
exports.requireRole = requireRole;
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = require("./db");
const roles_1 = require("./roles");
const sessions = new Map();
function createSession(username) {
    const token = node_crypto_1.default.randomUUID();
    sessions.set(token, {
        token,
        username,
        createdAt: new Date().toISOString()
    });
    return token;
}
function deleteSession(token) {
    sessions.delete(token);
}
function getRequestToken(req) {
    const header = req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    const token = header.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
}
function resolveSessionUser(token) {
    const session = sessions.get(token);
    if (!session) {
        return null;
    }
    const user = (0, db_1.findUserByUsername)(session.username);
    if (!user) {
        sessions.delete(token);
        return null;
    }
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        userType: user.user_type
    };
}
function requireAuth(req, res, next) {
    const token = getRequestToken(req);
    if (!token) {
        res.status(401).json({ message: "missing bearer token" });
        return;
    }
    const user = resolveSessionUser(token);
    if (!user) {
        res.status(401).json({ message: "invalid or expired token" });
        return;
    }
    req.authUser = user;
    next();
}
function getModulePermissions(role) {
    return roles_1.MODULE_PERMISSIONS[role];
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        requireAuth(req, res, () => {
            if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
                res.status(403).json({
                    message: "forbidden"
                });
                return;
            }
            next();
        });
    };
}
