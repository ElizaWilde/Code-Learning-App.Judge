"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const auth_1 = __importDefault(require("./auth"));
const judge_1 = __importDefault(require("./judge"));
const analytics_1 = __importDefault(require("./analytics"));
const communityModeration_1 = __importDefault(require("./communityModeration"));
const config_1 = require("./config");
/**
 * 后端总入口：启动 Express 服务，并把认证、判题、统计、社区等业务模块挂到对应 API 地址
 */
//用 Node.js 运行 Express，启动后端 API 服务
exports.app = (0, express_1.default)();
// 默认监听 8080，也允许通过 PORT 环境变量覆盖。
const port = Number(process.env.PORT) || 8080;
// admin-web 是纯静态后台页面，由后端直接托管在 /admin 路径下
const adminWebDirectory = node_path_1.default.resolve(__dirname, "../../code-learning-app/admin-web");
//配置跨域 CORS：这是Express 中间件，允许 uni-app Web 端从不同本地端口跨域访问 API，并允许携带 Authorization 头
exports.app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});
// Express 会自动解析 JSON 请求体到req.body，登录、判题、后台管理接口都会依赖 req.body
exports.app.use(express_1.default.json({ limit: config_1.JSON_BODY_LIMIT_BYTES }));
// Express托管后台管理静态资源code-learning-app/admin-web
exports.app.use("/admin", express_1.default.static(adminWebDirectory));
// 根路径用于手动检查服务是否启动
exports.app.get("/", (req, res) => {
    res.json({
        service: "cl-app-backend",
        status: "ok",
        message: "Node.js + Express container is running."
    });
});
// 健康检查接口，前端或脚本可以用它确认 API 进程是否可达
exports.app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        uptime: process.uptime()
    });
});
// 访问 /admin 时返回后台首页，其他静态文件由上面的 express.static 处理
exports.app.get("/admin", (_req, res) => {
    res.sendFile(node_path_1.default.join(adminWebDirectory, "index.html"));
});
// Express 做了一个“总路由分发”：不同模块只关心自己的子路由，server.ts 负责统一拼接前缀
exports.app.use("/api/auth", auth_1.default);
exports.app.use("/api/judge", judge_1.default);
exports.app.use("/api/analytics", analytics_1.default);
exports.app.use("/api/community", communityModeration_1.default);
// Return a stable JSON error for bodies rejected by the parser's size limit.
exports.app.use((error, _req, res, next) => {
    const requestError = error;
    if (requestError?.type === "entity.too.large" || requestError?.status === 413) {
        return res.status(413).json({
            message: `request body exceeds the ${config_1.JSON_BODY_LIMIT_BYTES}-byte limit`
        });
    }
    next(error);
});
// 未命中的接口统一返回 404，避免 Express 默认返回 HTML
exports.app.use((req, res) => {
    res.status(404).json({
        error: "Not found"
    });
});
// 监听 0.0.0.0，方便容器或局域网环境访问。启动后，前端可以请求http://127.0.0.1:8080/api/...
function startServer(listenPort = port) {
    return exports.app.listen(listenPort, "0.0.0.0", () => {
        console.log(`Server listening on port ${listenPort}`);
    });
}
if (require.main === module) {
    startServer();
}
