//用 Node.js 内置的 crypto 模块用于 JWT 签名和校验
import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { findUserByUsername } from "./db";
import { MODULE_PERMISSIONS, UserRole } from "./roles";
import { UserType } from "./db";

type JwtPayload = {
  // sub 表示 JWT 的主体，这里存登录用户名
  sub: string;
  // jti 是 token 的唯一编号，用于退出登录后的吊销判断
  jti: string;
  // iat/exp 使用 Unix 秒级时间戳，分别表示签发时间和过期时间
  iat: number;
  exp: number;
};

type AuthenticatedUser = {
  id: number;
  username: string;
  role: UserRole;
  userType: UserType;
};

const JWT_SECRET = process.env.CODEBOX_JWT_SECRET?.trim() || "codebox-local-dev-secret";
const JWT_EXPIRES_IN_SECONDS = Number(process.env.CODEBOX_JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24 * 7);
// JWT 本身是无状态的；为了支持退出登录立即失效，这里记录已吊销的 jti
const revokedTokenIds = new Map<string, number>();

export type AuthedRequest = Request & {
  authUser?: AuthenticatedUser;
};

// 登录/注册成功后签发 JWT，前端会把它保存到 authToken 并放进 Authorization 请求头
export function createSession(username: string): string {
  return signJwt({
    sub: username,
    jti: crypto.randomUUID(),
    iat: currentUnixTime(),
    exp: currentUnixTime() + getTokenLifetimeSeconds()
  });
}

// 退出登录时把当前 JWT 的 jti 加入吊销表，避免过期前继续使用
export function deleteSession(token: string): void {
  const payload = verifyJwt(token);
  if (!payload) {
    return;
  }

  revokedTokenIds.set(payload.jti, payload.exp);
  pruneRevokedTokenIds();
}

// 从 Bearer Token（认证方式--持有token就能访问资源） 请求头中取出 JWT（一种token格式） 字符串
export function getRequestToken(req: Request): string | null {
  const header = req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

// 校验 JWT 后再从数据库加载用户，确保用户仍然存在且角色信息是最新的
function resolveSessionUser(token: string): AuthenticatedUser | null {
  const payload = verifyJwt(token);
  if (!payload || isTokenRevoked(payload)) {
    return null;
  }

  const user = findUserByUsername(payload.sub);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    userType: user.user_type
  };
}

// 需要登录的接口统一使用这个Express中间件
// 作用：读取Authorization 请求头-> 校验 JWT-> 查用户-> 把用户挂到 req.authUser-> 放行到真正接口(e.g./api/auth/me)
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
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

export function getModulePermissions(role: UserRole): string[] {
  return MODULE_PERMISSIONS[role];
}

// 需要特定后台角色的接口在登录校验后继续判断权限
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
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

// 生成标准三段式 JWT：base64url(header).base64url(payload).signature
function signJwt(payload: JwtPayload): string {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson(payload);
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// 校验 JWT 的格式、签名、header、payload 和过期时间
function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const header = decodeJson<Record<string, unknown>>(encodedHeader);
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    return null;
  }

  const payload = decodeJson<Record<string, unknown>>(encodedPayload);
  if (!isJwtPayload(payload)) {
    return null;
  }

  if (payload.exp <= currentUnixTime()) {
    return null;
  }

  return payload;
}

// 使用 HMAC-SHA256 签名，secret 来自环境变量 CODEBOX_JWT_SECRET
function sign(value: string): string {
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(value)
    .digest("base64url");
}

// JWT 的 header 和 payload 都需要 JSON 序列化后再 base64url 编码
function base64UrlEncodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

// 解码 JWT 中的 JSON 片段，失败时返回 null 让上层按无效 token 处理
function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

// 使用 timingSafeEqual 避免签名比较泄露时间差；长度不同直接失败
function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// 运行时校验 payload 结构，避免信任任意 JSON 字段
function isJwtPayload(value: Record<string, unknown> | null): value is JwtPayload {
  return value !== null
    && typeof value.sub === "string"
    && value.sub.trim().length > 0
    && typeof value.jti === "string"
    && value.jti.trim().length > 0
    && typeof value.iat === "number"
    && Number.isFinite(value.iat)
    && typeof value.exp === "number"
    && Number.isFinite(value.exp);
}

// 判断 token 是否已经被退出登录流程吊销
function isTokenRevoked(payload: JwtPayload): boolean {
  pruneRevokedTokenIds();
  return revokedTokenIds.has(payload.jti);
}

// 清理已经过期的吊销记录，避免 Map 长期增长
function pruneRevokedTokenIds(): void {
  const now = currentUnixTime();
  for (const [tokenId, expiresAt] of revokedTokenIds) {
    if (expiresAt <= now) {
      revokedTokenIds.delete(tokenId);
    }
  }
}

// JWT 标准时间字段使用 Unix 秒，不使用毫秒
function currentUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

// 允许通过环境变量配置 token 有效期，非法配置时回退到 7 天
function getTokenLifetimeSeconds(): number {
  return Number.isFinite(JWT_EXPIRES_IN_SECONDS) && JWT_EXPIRES_IN_SECONDS > 0
    ? JWT_EXPIRES_IN_SECONDS
    : 60 * 60 * 24 * 7;
}
