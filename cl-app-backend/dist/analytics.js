"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsStore_1 = require("./analyticsStore");
const session_1 = require("./session");
const router = (0, express_1.Router)();
router.get("/dashboard", (0, session_1.requireRole)(["admin", "analyst"]), (req, res) => {
    const daysParam = typeof req.query.days === "string" ? Number(req.query.days) : undefined;
    const days = Number.isFinite(daysParam) ? Number(daysParam) : undefined;
    return res.json((0, analyticsStore_1.getAnalyticsDashboard)(days));
});
router.post("/wrong-answers", (req, res) => {
    const body = (req.body ?? {});
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
        wrongCount: typeof body.wrongCount === "number" ? body.wrongCount : Number(body.wrongCount || 0)
    });
    return res.json({
        synced: true
    });
});
exports.default = router;
