"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const session_1 = require("./session");
const roles_1 = require("./roles");
const analyticsStore_1 = require("./analyticsStore");
const router = (0, express_1.Router)();
const DEFAULT_ADMIN_USERNAME = process.env.CODEBOX_ADMIN_USERNAME?.trim() || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.CODEBOX_ADMIN_PASSWORD?.trim() || "CodeBox123";
function parseCredentials(body) {
    if (typeof body.username !== "string" || typeof body.password !== "string") {
        return null;
    }
    const username = body.username.trim();
    const password = body.password;
    if (username.length < 3 || password.length < 6) {
        return null;
    }
    return { username, password };
}
function buildUserResponse(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        userType: user.userType,
        permissions: (0, session_1.getModulePermissions)(user.role)
    };
}
function ensureDefaultAdmin() {
    const existing = (0, db_1.findUserByUsername)(DEFAULT_ADMIN_USERNAME);
    if (!existing) {
        (0, db_1.createUser)(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, "admin");
        return;
    }
    if (existing.role !== "admin") {
        (0, db_1.ensureUserRole)(existing.username, "admin");
    }
}
ensureDefaultAdmin();
router.get("/meta", (_req, res) => {
    return res.json({
        databasePath: (0, db_1.getDatabasePath)(),
        passwordRule: "Password must be at least 6 characters.",
        usernameRule: "Username must be at least 3 characters.",
        roles: ["admin", "question_manager", "judge_manager", "analyst", "user"],
        defaultAdminUsername: DEFAULT_ADMIN_USERNAME
    });
});
router.post("/register", (req, res) => {
    const credentials = parseCredentials(req.body ?? {});
    if (!credentials) {
        return res.status(400).json({
            message: "username must be at least 3 characters and password must be at least 6 characters"
        });
    }
    if ((0, db_1.findUserByUsername)(credentials.username)) {
        return res.status(409).json({
            message: "username already exists"
        });
    }
    const requestedRole = (0, roles_1.isUserRole)(req.body?.role) ? req.body.role : "user";
    const role = requestedRole === "admin" ? "user" : requestedRole;
    try {
        const user = (0, db_1.createUser)(credentials.username, credentials.password, role);
        const token = (0, session_1.createSession)(user.username);
        return res.status(201).json({
            message: "registration successful",
            token,
            user: buildUserResponse(user)
        });
    }
    catch (error) {
        if ((0, db_1.isUniqueConstraintError)(error)) {
            return res.status(409).json({
                message: "username already exists"
            });
        }
        return res.status(500).json({
            message: "failed to create user"
        });
    }
});
router.post("/login", (req, res) => {
    const credentials = parseCredentials(req.body ?? {});
    if (!credentials) {
        return res.status(400).json({
            message: "username must be at least 3 characters and password must be at least 6 characters"
        });
    }
    const user = (0, db_1.authenticateUser)(credentials.username, credentials.password);
    if (!user) {
        return res.status(401).json({
            message: "invalid username or password"
        });
    }
    const token = (0, session_1.createSession)(user.username);
    (0, analyticsStore_1.recordUserActivity)(user.username, "login");
    return res.json({
        message: "login successful",
        token,
        user: buildUserResponse(user)
    });
});
router.get("/me", session_1.requireAuth, (req, res) => {
    return res.json({
        user: buildUserResponse(req.authUser)
    });
});
router.get("/profile/:username", (req, res) => {
    const username = String(req.params.username || "").trim();
    if (username.length < 3) {
        return res.status(400).json({
            message: "valid username is required"
        });
    }
    const user = (0, db_1.findUserByUsername)(username);
    if (!user) {
        return res.status(404).json({
            message: "user not found"
        });
    }
    return res.json({
        user: {
            username: user.username,
            userType: user.user_type
        }
    });
});
router.post("/logout", session_1.requireAuth, (req, res) => {
    const token = (0, session_1.getRequestToken)(req);
    if (token) {
        (0, session_1.deleteSession)(token);
    }
    return res.json({
        message: "logout successful"
    });
});
router.get("/users", (0, session_1.requireRole)(["admin"]), (_req, res) => {
    return res.json({
        users: (0, db_1.listUsers)().map((user) => ({
            id: user.id,
            username: user.username,
            role: user.role,
            userType: user.userType,
            createdAt: user.created_at,
            permissions: (0, session_1.getModulePermissions)(user.role)
        }))
    });
});
router.patch("/users/:username/role", (0, session_1.requireRole)(["admin"]), (req, res) => {
    const username = String(req.params.username || "").trim();
    const role = req.body?.role;
    if (username.length < 3 || !(0, roles_1.isUserRole)(role)) {
        return res.status(400).json({
            message: "valid username and role are required"
        });
    }
    const user = (0, db_1.findUserByUsername)(username);
    if (!user) {
        return res.status(404).json({
            message: "user not found"
        });
    }
    (0, db_1.ensureUserRole)(user.username, role);
    const updatedUser = (0, db_1.findUserByUsername)(user.username);
    return res.json({
        message: "role updated",
        user: buildUserResponse({
            id: updatedUser.id,
            username: updatedUser.username,
            role: updatedUser.role,
            userType: updatedUser.user_type
        })
    });
});
router.patch("/users/:username/type", (0, session_1.requireRole)(["admin"]), (req, res) => {
    const username = String(req.params.username || "").trim();
    const userType = req.body?.userType;
    if (username.length < 3 || !(0, db_1.isUserType)(userType)) {
        return res.status(400).json({
            message: "valid username and userType are required"
        });
    }
    const user = (0, db_1.findUserByUsername)(username);
    if (!user) {
        return res.status(404).json({
            message: "user not found"
        });
    }
    (0, db_1.ensureUserType)(user.username, userType);
    const updatedUser = (0, db_1.findUserByUsername)(user.username);
    return res.json({
        message: "user type updated",
        user: buildUserResponse({
            id: updatedUser.id,
            username: updatedUser.username,
            role: updatedUser.role,
            userType: updatedUser.user_type
        })
    });
});
exports.default = router;
