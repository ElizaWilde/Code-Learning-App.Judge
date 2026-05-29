import { Router, Request, Response } from "express";
import {
  authenticateUser,
  createUser,
  ensureUserRole,
  ensureUserType,
  findUserByUsername,
  getDatabasePath,
  isUserType,
  isUniqueConstraintError,
  listUsers,
  UserType
} from "./db";
import { createSession, deleteSession, getModulePermissions, getRequestToken, requireAuth, requireRole, AuthedRequest } from "./session";
import { UserRole, isUserRole } from "./roles";
import { recordUserActivity } from "./analyticsStore";

const router = Router();

type AuthBody = {
  username?: unknown;
  password?: unknown;
  role?: unknown;
};

type RoleUpdateBody = {
  role?: unknown;
};

type UserTypeUpdateBody = {
  userType?: unknown;
};

const DEFAULT_ADMIN_USERNAME = process.env.CODEBOX_ADMIN_USERNAME?.trim() || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.CODEBOX_ADMIN_PASSWORD?.trim() || "CodeBox123";

function parseCredentials(body: AuthBody): { username: string; password: string } | null {
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

function buildUserResponse(user: { id: number; username: string; role: UserRole; userType: UserType }) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    userType: user.userType,
    permissions: getModulePermissions(user.role)
  };
}

function ensureDefaultAdmin(): void {
  const existing = findUserByUsername(DEFAULT_ADMIN_USERNAME);

  if (!existing) {
    createUser(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, "admin");
    return;
  }

  if (existing.role !== "admin") {
    ensureUserRole(existing.username, "admin");
  }
}

ensureDefaultAdmin();

router.get("/meta", (_req: Request, res: Response) => {
  return res.json({
    databasePath: getDatabasePath(),
    passwordRule: "Password must be at least 6 characters.",
    usernameRule: "Username must be at least 3 characters.",
    roles: ["admin", "question_manager", "judge_manager", "analyst", "user"],
    defaultAdminUsername: DEFAULT_ADMIN_USERNAME
  });
});

router.post("/register", (req: Request, res: Response) => {
  const credentials = parseCredentials(req.body ?? {});

  if (!credentials) {
    return res.status(400).json({
      message: "username must be at least 3 characters and password must be at least 6 characters"
    });
  }

  if (findUserByUsername(credentials.username)) {
    return res.status(409).json({
      message: "username already exists"
    });
  }

  const requestedRole = isUserRole(req.body?.role) ? req.body.role : "user";
  const role = requestedRole === "admin" ? "user" : requestedRole;

  try {
    const user = createUser(credentials.username, credentials.password, role);
    const token = createSession(user.username);

    return res.status(201).json({
      message: "registration successful",
      token,
      user: buildUserResponse(user)
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        message: "username already exists"
      });
    }

    return res.status(500).json({
      message: "failed to create user"
    });
  }
});

router.post("/login", (req: Request, res: Response) => {
  const credentials = parseCredentials(req.body ?? {});

  if (!credentials) {
    return res.status(400).json({
      message: "username must be at least 3 characters and password must be at least 6 characters"
    });
  }

  const user = authenticateUser(credentials.username, credentials.password);

  if (!user) {
    return res.status(401).json({
      message: "invalid username or password"
    });
  }

  const token = createSession(user.username);
  recordUserActivity(user.username, "login");

  return res.json({
    message: "login successful",
    token,
    user: buildUserResponse(user)
  });
});

router.get("/me", requireAuth, (req: AuthedRequest, res: Response) => {
  return res.json({
    user: buildUserResponse(req.authUser!)
  });
});

router.get("/profile/:username", (req: Request, res: Response) => {
  const username = String(req.params.username || "").trim();
  if (username.length < 3) {
    return res.status(400).json({
      message: "valid username is required"
    });
  }

  const user = findUserByUsername(username);
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

router.post("/logout", requireAuth, (req: AuthedRequest, res: Response) => {
  const token = getRequestToken(req);
  if (token) {
    deleteSession(token);
  }

  return res.json({
    message: "logout successful"
  });
});

router.get("/users", requireRole(["admin"]), (_req: AuthedRequest, res: Response) => {
  return res.json({
    users: listUsers().map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      userType: user.userType,
      createdAt: user.created_at,
      permissions: getModulePermissions(user.role)
    }))
  });
});

router.patch("/users/:username/role", requireRole(["admin"]), (req: AuthedRequest, res: Response) => {
  const username = String(req.params.username || "").trim();
  const role = (req.body as RoleUpdateBody | undefined)?.role;

  if (username.length < 3 || !isUserRole(role)) {
    return res.status(400).json({
      message: "valid username and role are required"
    });
  }

  const user = findUserByUsername(username);
  if (!user) {
    return res.status(404).json({
      message: "user not found"
    });
  }

  ensureUserRole(user.username, role);
  const updatedUser = findUserByUsername(user.username)!;

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

router.patch("/users/:username/type", requireRole(["admin"]), (req: AuthedRequest, res: Response) => {
  const username = String(req.params.username || "").trim();
  const userType = (req.body as UserTypeUpdateBody | undefined)?.userType;

  if (username.length < 3 || !isUserType(userType)) {
    return res.status(400).json({
      message: "valid username and userType are required"
    });
  }

  const user = findUserByUsername(username);
  if (!user) {
    return res.status(404).json({
      message: "user not found"
    });
  }

  ensureUserType(user.username, userType);
  const updatedUser = findUserByUsername(user.username)!;

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

export default router;
