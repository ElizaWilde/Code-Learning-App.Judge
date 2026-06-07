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

/**
 * 认证和账号权限模块：负责登录注册、JWT 发放、当前用户读取、退出登录和管理员用户管理
 */
//Node.js 处理：/api/auth/register、/login、/me、/logout、/users 等 API 请求。用户登录后，Node.js 后端会生成 JWT 返回给前端
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

// 默认管理员用于首次启动时进入后台；正式环境可以用环境变量覆盖
const DEFAULT_ADMIN_USERNAME = process.env.CODEBOX_ADMIN_USERNAME?.trim() || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.CODEBOX_ADMIN_PASSWORD?.trim() || "CodeBox123";

// 统一校验登录/注册凭据，避免每个接口重复判断字段类型和长度规则
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

// 只返回前端需要的公开用户字段，不返回 password_hash 等敏感信息
function buildUserResponse(user: { id: number; username: string; role: UserRole; userType: UserType }) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    userType: user.userType,
    permissions: getModulePermissions(user.role)
  };
}

// 确保系统至少有一个 admin 账号；如果已有同名账号但角色不是 admin，则修正为 admin
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

// 返回认证模块的基础信息，后台登录页可用它展示默认管理员和规则
router.get("/meta", (_req: Request, res: Response) => {
  return res.json({
    databasePath: getDatabasePath(),
    passwordRule: "Password must be at least 6 characters.",
    usernameRule: "Username must be at least 3 characters.",
    roles: ["admin", "question_manager", "judge_manager", "analyst", "user"],
    defaultAdminUsername: DEFAULT_ADMIN_USERNAME
  });
});

// 注册普通用户：创建成功后直接签发 JWT，让用户不需要再登录一次
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

  // 前端即使传 admin 也会降级为 user，避免普通注册直接创建管理员
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

// 登录接口：校验密码成功后签发 JWT，并记录一次登录行为
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

// 当前用户接口：必须携带 Authorization: Bearer <JWT>。访问 /api/auth/me 之前，必须先通过 requireAuth
router.get("/me", requireAuth, (req: AuthedRequest, res: Response) => {
  return res.json({
    user: buildUserResponse(req.authUser!)
  });
});

// 公开资料接口：不要求登录，只返回用户名和用户类型，供个人页兜底刷新使用
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

// 退出登录：把当前 JWT 的 jti 加入吊销列表，前端也会清理本地 authToken
router.post("/logout", requireAuth, (req: AuthedRequest, res: Response) => {
  const token = getRequestToken(req);
  if (token) {
    deleteSession(token);
  }

  return res.json({
    message: "logout successful"
  });
});

// 管理员查看用户列表，包含角色、用户类型和该角色拥有的后台模块权限
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

// 管理员修改指定用户的角色，例如 question_manager、judge_manager、analyst
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

// 管理员修改用户类型；expert 用户在社区等页面可以展示专家标识
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
