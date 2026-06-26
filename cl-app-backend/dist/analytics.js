"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 功能：提供学习数据统计 API，包括后台看板数据读取和前端错题数量同步
const express_1 = require("express");
const analyticsStore_1 = require("./analyticsStore");
const session_1 = require("./session");
const router = (0, express_1.Router)();
// 后台学习分析看板接口，仅管理员和分析员可访问
router.get("/dashboard", (0, session_1.requireRole)(["admin", "analyst"]), (req, res) => {
    // days 控制统计窗口长度，analyticsStore 内部会限制在合理范围
    const daysParam = typeof req.query.days === "string" ? Number(req.query.days) : undefined;
    const days = Number.isFinite(daysParam) ? Number(daysParam) : undefined;
    return res.json((0, analyticsStore_1.getAnalyticsDashboard)(days));
});
// 前端练习页提交错题快照，用于统计各学习模块错题分布
router.post("/wrong-answers", (req, res) => {
    const body = (req.body ?? {});
    // 这些字段决定错题快照归属到哪个用户、学习路径和具体模块
    if (typeof body.username !== "string" ||
        typeof body.pathId !== "string" ||
        typeof body.pathTitle !== "string" ||
        typeof body.moduleId !== "string" ||
        typeof body.moduleTitle !== "string") {
        return res.status(400).json({
            message: "username, pathId, pathTitle, moduleId, and moduleTitle are required"
        });
    }
    (0, analyticsStore_1.upsertWrongAnswerSnapshot)({
        username: body.username,
        pathId: body.pathId,
        pathTitle: body.pathTitle,
        moduleId: body.moduleId,
        moduleTitle: body.moduleTitle,
        // wrongCount 允许前端以字符串或数字传入，落库前统一转成数字
        wrongCount: typeof body.wrongCount === "number" ? body.wrongCount : Number(body.wrongCount || 0)
    });
    return res.json({
        synced: true
    });
});
exports.default = router;
