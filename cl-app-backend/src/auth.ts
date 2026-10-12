import { Router, Request, Response } from "express";
import {
  authenticateUser,
  createUser,
  ensureUserPassword,
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
import { ADMIN_PASSWORD, ADMIN_USERNAME } from "./config";

/**
 * 认证和账号权限模块：负责登录注册、JWT 发放、当前用户读取、退出登录和管理员用户管理
 */
//Node.js 处理：/api/auth/register、/login、/me、/logout、/users 等 API 请求。用户登录后，Node.js 后端会生成 JWT 返回给前端
const router = Router();

type AuthBody = {
  // 登录/注册接口只信任运行时校验后的字段，避免直接使用 unknown 请求体
  username?: unknown;
  password?: unknown;
  // role 仅用于受控场景；普通注册时不能直接创建 admin
  role?: unknown;
};

type RoleUpdateBody = {
  role?: unknown;
};

type UserTypeUpdateBody = {
  userType?: unknown;
};

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

// Ensure the configured bootstrap administrator exists and always uses the
// deployment-provided password. There is intentionally no built-in password.
function ensureDefaultAdmin(): void {
  const existing = findUserByUsername(ADMIN_USERNAME);

  if (!existing) {
    createUser(ADMIN_USERNAME, ADMIN_PASSWORD, "admin");
    return;
  }

  if (existing.role !== "admin") {
    ensureUserRole(existing.username, "admin");
  }

  ensureUserPassword(existing.username, ADMIN_PASSWORD);
}

ensureDefaultAdmin();

// 返回认证模块的基础信息，后台登录页可用它展示默认管理员和规则
router.get("/meta", (_req: Request, res: Response) => {
  return res.json({
    databasePath: getDatabasePath(),
    passwordRule: "Password must be at least 6 characters.",
    usernameRule: "Username must be at least 3 characters.",
    roles: ["admin", "question_manager", "judge_manager", "analyst", "user"],
    defaultAdminUsername: ADMIN_USERNAME
  });
});

// 注册普通用户：创建成功后直接签发 JWT，让用户不需要再登录一次
router.post("/register", (req: Request, res: Response) => {
  // 注册和登录共用一套账号密码规则：用户名至少 3 位、密码至少 6 位
  const credentials = parseCredentials(req.body ?? {});

  if (!credentials) {
    return res.status(400).json({
      message: "username must be at least 3 characters and password must be at least 6 characters"
    });
  }

  if (findUserByUsername(credentials.username)) {
    // 提前检查用户名冲突，给前端返回明确的 409 状态码
    return res.status(409).json({
      message: "username already exists"
    });
  }

  // 前端即使传 admin 也会降级为 user，避免普通注册直接创建管理员
  const requestedRole = isUserRole(req.body?.role) ? req.body.role : "user";
  const role = requestedRole === "admin" ? "user" : requestedRole;

  try {
    // createUser 内部负责写入用户和密码哈希，接口层不直接保存明文密码
    const user = createUser(credentials.username, credentials.password, role);
    // 注册成功后立即签发 JWT，实现“注册即登录”
    const token = createSession(user.username);

    return res.status(201).json({
      message: "registration successful",
      token,
      user: buildUserResponse(user)
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // 并发注册同名用户时，数据库唯一约束仍然会兜底拦截
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
  // 先做格式和长度校验，不合规则的请求不会进入密码比对
  const credentials = parseCredentials(req.body ?? {});

  if (!credentials) {
    return res.status(400).json({
      message: "username must be at least 3 characters and password must be at least 6 characters"
    });
  }

  // authenticateUser 会比对数据库中的密码哈希，成功才返回用户对象
  const user = authenticateUser(credentials.username, credentials.password);

  if (!user) {
    return res.status(401).json({
      message: "invalid username or password"
    });
  }

  // 登录成功后签发新的 JWT，前端后续用它访问需要登录的接口
  const token = createSession(user.username);
  // 记录登录行为，供学习数据分析和后台统计使用
  recordUserActivity(user.username, "login");

  return res.json({
    message: "login successful",
    token,
    user: buildUserResponse(user)
  });
});

// 当前用户接口：必须携带 Authorization: Bearer <JWT>
// 也就是说，在访问 /api/auth/me 之前，必须先通过 requireAuth
router.get("/me", requireAuth, (req: AuthedRequest, res: Response) => {
  return res.json({
    // req.authUser 由 requireAuth 中间件注入，这里只返回安全的公开字段
    user: buildUserResponse(req.authUser!)
  });
});

// 公开资料接口：不要求登录，只返回用户名和用户类型，供个人页兜底刷新使用
//：username--路径参数
router.get("/profile/:username", (req: Request, res: Response) => {
  // 个人中心在没有 JWT 时用用户名兜底刷新用户类型
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
      // 公开资料接口只返回个人中心需要的最小字段
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
      // 后台用户管理页用 permissions 展示该角色能访问哪些管理模块
      permissions: getModulePermissions(user.role)
    }))
  });
});

// 管理员修改指定用户的角色，例如 question_manager、judge_manager、analyst
router.patch("/users/:username/role", requireRole(["admin"]), (req: AuthedRequest, res: Response) => {
  // 路径中的 username 决定被修改账号，请求体 role 决定新的后台权限角色
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

  // 角色更新后重新读取用户，确保返回的是数据库中的最终状态
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

  // 管理员修改 normal/expert 后，个人中心和社区专家徽章会在刷新资料时同步
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
