"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 功能：提供判题相关 API，包括题库目录、题目详情、运行代码、提交代码和后台判题配置管理
const express_1 = require("express");
const judgeService_1 = require("./judgeService");
const session_1 = require("./session");
const judgeAdmin_1 = require("./judgeAdmin");
const questStore_1 = require("./questStore");
const analyticsStore_1 = require("./analyticsStore");
const config_1 = require("./config");
const rateLimit_1 = require("./rateLimit");
const router = (0, express_1.Router)();
// 目前判题服务只允许 Python 和 Java 两种语言
function isJudgeLanguage(value) {
    return value === "python" || value === "java";
}
const judgeRateLimit = (0, rateLimit_1.createRateLimit)({
    windowMs: config_1.JUDGE_RATE_LIMIT_WINDOW_MS,
    maxRequests: config_1.JUDGE_RATE_LIMIT_MAX_REQUESTS,
    keyGenerator: (req) => {
        const userId = req.authUser?.id;
        if (userId !== undefined) {
            return `user:${userId}`;
        }
        return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
    }
});
// 后台题库管理接口：返回完整题目，包括参考答案和隐藏测试
router.get("/quests", (0, session_1.requireRole)(["admin", "question_manager"]), (_req, res) => {
    return res.json({
        items: (0, questStore_1.listQuestDefinitions)(),
        total: (0, questStore_1.listQuestDefinitions)().length
    });
});
// 后台新建题目，只有 admin 和 question_manager 可以调用
router.post("/admin/quests", (0, session_1.requireRole)(["admin", "question_manager"]), (req, res) => {
    const result = (0, questStore_1.upsertQuestDefinition)(req.body ?? {});
    if (!result.ok) {
        return res.status(400).json({
            message: result.message
        });
    }
    return res.json({
        quest: result.quest
    });
});
// 后台更新题目，路径 id 优先覆盖请求体 id，避免编辑错题目
router.put("/admin/quests/:id", (0, session_1.requireRole)(["admin", "question_manager"]), (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const payload = {
        ...body,
        id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    };
    const result = (0, questStore_1.upsertQuestDefinition)(payload);
    if (!result.ok) {
        return res.status(400).json({
            message: result.message
        });
    }
    return res.json({
        quest: result.quest
    });
});
// 后台删除题目；内置题目会写入 deletedIds，后台新增题目会从 JSON 中移除
router.delete("/admin/quests/:id", (0, session_1.requireRole)(["admin", "question_manager"]), (req, res) => {
    const questId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = (0, questStore_1.deleteQuestDefinition)(questId);
    if (!result.ok) {
        return res.status(404).json({
            message: result.message
        });
    }
    return res.json({
        deleted: true,
        questId
    });
});
// 用户端题目目录接口：只返回摘要，不暴露参考答案和隐藏测试
router.get("/catalog", (_req, res) => {
    return res.json({
        items: (0, questStore_1.listQuestSummaries)(),
        total: (0, questStore_1.listQuestSummaries)().length
    });
});
// 后台读取判题配置，供评测系统维护页回填表单
router.get("/admin/config", (0, session_1.requireRole)(["admin", "judge_manager"]), (_req, res) => {
    return res.json((0, judgeAdmin_1.getJudgeSystemConfig)());
});
// 后台保存判题配置，保存后会影响后续判题任务
router.post("/admin/config", (0, session_1.requireRole)(["admin", "judge_manager"]), (req, res) => {
    return res.json({
        config: (0, judgeAdmin_1.updateJudgeSystemConfig)(req.body ?? {})
    });
});
// 后台读取实时队列快照，用于轮询展示排队和运行状态
router.get("/admin/queue", (0, session_1.requireRole)(["admin", "judge_manager"]), (_req, res) => {
    return res.json((0, judgeAdmin_1.getJudgeQueueSnapshot)());
});
router.get("/quest/:id", (req, res) => {
    const questId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const quest = (0, questStore_1.getPublicQuestDefinition)(questId);
    if (!quest) {
        return res.status(404).json({
            message: "quest not found"
        });
    }
    return res.json(quest);
});
// run 和 submit 共用同一套请求校验、排队执行、结果记录逻辑
async function handleJudge(req, res, mode) {
    const body = (req.body ?? {});
    // 1.run/submit 都必须提供题目 ID、语言和代码，语言必须在判题目录支持范围内
    if (typeof body.questId !== "string" || typeof body.code !== "string" || !isJudgeLanguage(body.language)) {
        return res.status(400).json({
            message: "questId, language, and code are required"
        });
    }
    const sourceBytes = Buffer.byteLength(body.code, "utf8");
    if (sourceBytes > config_1.JUDGE_MAX_SOURCE_BYTES) {
        return res.status(413).json({
            message: `code exceeds the ${config_1.JUDGE_MAX_SOURCE_BYTES}-byte limit`
        });
    }
    // 2.先确认题目存在，再进入队列，避免无效请求占用判题资源
    const quest = (0, questStore_1.getQuestDefinition)(body.questId);
    if (!quest) {
        return res.status(404).json({
            message: "quest not found"
        });
    }
    try {
        // 3.把任务交给 enqueueJudgeJob，执行 judgeSubmission
        // 判题任务统一进入队列，避免并发过高时同时拉起过多执行环境
        //只有队列需要执行时才调用 judgeSubmission，避免每个请求都先执行一次判题逻辑再排队
        const result = await (0, judgeAdmin_1.enqueueJudgeJob)(body.questId, body.language, mode, () => (0, judgeService_1.judgeSubmission)(body.questId, body.language, body.code, mode));
        // A protected submission is always attributed to the authenticated user.
        // Public run requests retain their existing optional analytics identity for
        // compatibility until that endpoint is migrated to authenticated access.
        const analyticsUsername = mode === "submit"
            ? req.authUser?.username
            : typeof body.username === "string" && body.username.trim().length > 0
                ? body.username.trim()
                : undefined;
        if (analyticsUsername) {
            // 4.run/submit 都记录用户行为，后台 DAU 和活动统计会用到
            (0, analyticsStore_1.recordUserActivity)(analyticsUsername, `judge_${mode}`);
            if (mode === "submit") {
                // 只有正式提交参与提交量和通过率统计
                (0, analyticsStore_1.recordQuestSubmission)(analyticsUsername, body.questId, result.status);
            }
        }
        // 5.返回判题结果
        return res.json({
            questId: body.questId,
            language: body.language,
            mode,
            result
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "judge execution failed";
        return res.status(500).json({
            message: "judge execution failed",
            detail: message
        });
    }
}
router.post("/run", judgeRateLimit, async (req, res) => {
    return handleJudge(req, res, "run");
});
router.post("/submit", session_1.requireAuth, judgeRateLimit, async (req, res) => {
    return handleJudge(req, res, "submit");
});
exports.default = router;
