"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const auth_1 = __importDefault(require("./auth"));
const judge_1 = __importDefault(require("./judge"));
const analytics_1 = __importDefault(require("./analytics"));
const communityModeration_1 = __importDefault(require("./communityModeration"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 8080;
const adminWebDirectory = node_path_1.default.resolve(__dirname, "../../code-learning-app/admin-web");
// Allow the uni-app web client to call the API from a different local origin.
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});
app.use(express_1.default.json());
app.use("/admin", express_1.default.static(adminWebDirectory));
// Basic service probe for manual checks.
app.get("/", (req, res) => {
    res.json({
        service: "cl-app-backend",
        status: "ok",
        message: "Node.js + Express container is running."
    });
});
// Health endpoint used to verify the API process is reachable.
app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        uptime: process.uptime()
    });
});
app.get("/admin", (_req, res) => {
    res.sendFile(node_path_1.default.join(adminWebDirectory, "index.html"));
});
app.use("/api/auth", auth_1.default);
app.use("/api/judge", judge_1.default);
app.use("/api/analytics", analytics_1.default);
app.use("/api/community", communityModeration_1.default);
// Final fallback for unknown routes.
app.use((req, res) => {
    res.status(404).json({
        error: "Not found"
    });
});
app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port}`);
});
