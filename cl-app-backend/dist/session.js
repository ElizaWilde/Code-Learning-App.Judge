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
//用 Node.js 内置的 crypto 模块用于 JWT 签名和校验
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = require("./db");
const roles_1 = require("./roles");
const config_1 = require("./config");
// 默认有效期为 7 天，可通过 CODEBOX_JWT_EXPIRES_IN_SECONDS 调整
const JWT_EXPIRES_IN_SECONDS = Number(process.env.CODEBOX_JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24 * 7);
// JWT 本身是无状态的；为了支持退出登录立即失效，这里记录已吊销的 jti
const revokedTokenIds = new Map();
// 登录/注册成功后签发 JWT，前端会把它保存到 authToken 并放进 Authorization 请求头
function createSession(username) {
    return signJwt({
        // sub 存用户名，后续验证 token 时用它重新查数据库用户
        sub: username,
        // 每个 token 独立生成 jti，退出登录时只吊销当前这一个 token
        jti: node_crypto_1.default.randomUUID(),
        iat: currentUnixTime(),
        exp: currentUnixTime() + getTokenLifetimeSeconds()
    });
}
// 退出登录时把当前 JWT 的 jti 加入吊销表，避免过期前继续使用
function deleteSession(token) {
    const payload = verifyJwt(token);
    if (!payload) {
        return;
    }
    revokedTokenIds.set(payload.jti, payload.exp);
    pruneRevokedTokenIds();
}
// 从 Bearer Token（认证方式--持有token就能访问资源） 请求头中取出 JWT（一种token格式） 字符串
function getRequestToken(req) {
    const header = req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    const token = header.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
}
// 校验 JWT 后再从数据库加载用户，确保用户仍然存在且角色信息是最新的
function resolveSessionUser(token) {
    // 先验签和检查过期，再判断是否已被退出登录流程吊销
    const payload = verifyJwt(token);
    if (!payload || isTokenRevoked(payload)) {
        return null;
    }
    // token 中只存用户名，权限和用户类型每次从数据库取最新值
    const user = (0, db_1.findUserByUsername)(payload.sub);
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
function requireAuth(req, res, next) {
    const token = getRequestToken(req);
    if (!token) {
        // 没有 Bearer token，说明请求没有携带登录凭证
        res.status(401).json({ message: "missing bearer token" });
        return;
    }
    const user = resolveSessionUser(token);
    if (!user) {
        // token 伪造、过期、已吊销或用户不存在都会走这个分支
        res.status(401).json({ message: "invalid or expired token" });
        return;
    }
    // 把当前用户挂到请求对象上，后续路由无需重复解析 token
    req.authUser = user;
    next();
}
function getModulePermissions(role) {
    // 根据角色返回后台模块权限列表，前端用它控制可见菜单
    return roles_1.MODULE_PERMISSIONS[role];
}
// 需要特定后台角色的接口在登录校验后继续判断权限
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
// 生成标准三段式 JWT：base64url(header).base64url(payload).signature
function signJwt(payload) {
    // 这里固定使用 HS256，与 verifyJwt 中的 header 校验保持一致
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
function verifyJwt(token) {
    const parts = token.split(".");
    if (parts.length !== 3) {
        // JWT 必须是 header.payload.signature 三段
        return null;
    }
    const [encodedHeader, encodedPayload, signature] = parts;
    // 用同样的 header.payload 重新计算签名，确认 token 没有被篡改
    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
    if (!timingSafeEqual(signature, expectedSignature)) {
        return null;
    }
    const header = decodeJson(encodedHeader);
    if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
        return null;
    }
    const payload = decodeJson(encodedPayload);
    if (!isJwtPayload(payload)) {
        // payload 字段缺失或类型不对时按无效 token 处理
        return null;
    }
    if (payload.exp <= currentUnixTime()) {
        // 过期 token 不再允许访问受保护接口
        return null;
    }
    return payload;
}
// 使用 HMAC-SHA256 签名，secret 来自环境变量 CODEBOX_JWT_SECRET
function sign(value) {
    return node_crypto_1.default
        .createHmac("sha256", config_1.JWT_SECRET)
        .update(value)
        .digest("base64url");
}
// JWT 的 header 和 payload 都需要 JSON 序列化后再 base64url 编码
function base64UrlEncodeJson(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
// 解码 JWT 中的 JSON 片段，失败时返回 null 让上层按无效 token 处理
function decodeJson(value) {
    try {
        return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    }
    catch {
        return null;
    }
}
// 使用 timingSafeEqual 避免签名比较泄露时间差；长度不同直接失败
function timingSafeEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return node_crypto_1.default.timingSafeEqual(leftBuffer, rightBuffer);
}
// 运行时校验 payload 结构，避免信任任意 JSON 字段
function isJwtPayload(value) {
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
function isTokenRevoked(payload) {
    pruneRevokedTokenIds();
    return revokedTokenIds.has(payload.jti);
}
// 清理已经过期的吊销记录，避免 Map 长期增长
function pruneRevokedTokenIds() {
    const now = currentUnixTime();
    for (const [tokenId, expiresAt] of revokedTokenIds) {
        if (expiresAt <= now) {
            revokedTokenIds.delete(tokenId);
        }
    }
}
// JWT 标准时间字段使用 Unix 秒，不使用毫秒
function currentUnixTime() {
    return Math.floor(Date.now() / 1000);
}
// 允许通过环境变量配置 token 有效期，非法配置时回退到 7 天
function getTokenLifetimeSeconds() {
    return Number.isFinite(JWT_EXPIRES_IN_SECONDS) && JWT_EXPIRES_IN_SECONDS > 0
        ? JWT_EXPIRES_IN_SECONDS
        : 60 * 60 * 24 * 7;
}
