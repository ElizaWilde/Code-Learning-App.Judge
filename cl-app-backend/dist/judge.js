"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const judgeService_1 = require("./judgeService");
const session_1 = require("./session");
const judgeAdmin_1 = require("./judgeAdmin");
const questStore_1 = require("./questStore");
const analyticsStore_1 = require("./analyticsStore");
const router = (0, express_1.Router)();
function isJudgeLanguage(value) {
    return value === "python" || value === "java";
}
router.get("/quests", (0, session_1.requireRole)(["admin", "question_manager"]), (_req, res) => {
    return res.json({
        items: (0, questStore_1.listQuestDefinitions)(),
        total: (0, questStore_1.listQuestDefinitions)().length
    });
});
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
router.get("/catalog", (_req, res) => {
    return res.json({
        items: (0, questStore_1.listQuestSummaries)(),
        total: (0, questStore_1.listQuestSummaries)().length
    });
});
router.get("/admin/config", (0, session_1.requireRole)(["admin", "judge_manager"]), (_req, res) => {
    return res.json((0, judgeAdmin_1.getJudgeSystemConfig)());
});
router.post("/admin/config", (0, session_1.requireRole)(["admin", "judge_manager"]), (req, res) => {
    return res.json({
        config: (0, judgeAdmin_1.updateJudgeSystemConfig)(req.body ?? {})
    });
});
router.get("/admin/queue", (0, session_1.requireRole)(["admin", "judge_manager"]), (_req, res) => {
    return res.json((0, judgeAdmin_1.getJudgeQueueSnapshot)());
});
router.get("/quest/:id", (req, res) => {
    const questId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const quest = (0, questStore_1.getQuestDefinition)(questId);
    if (!quest) {
        return res.status(404).json({
            message: "quest not found"
        });
    }
    return res.json(quest);
});
async function handleJudge(req, res, mode) {
    const body = (req.body ?? {});
    if (typeof body.questId !== "string" || typeof body.code !== "string" || !isJudgeLanguage(body.language)) {
        return res.status(400).json({
            message: "questId, language, and code are required"
        });
    }
    const quest = (0, questStore_1.getQuestDefinition)(body.questId);
    if (!quest) {
        return res.status(404).json({
            message: "quest not found"
        });
    }
    try {
        const result = await (0, judgeAdmin_1.enqueueJudgeJob)(body.questId, body.language, mode, () => (0, judgeService_1.judgeSubmission)(body.questId, body.language, body.code, mode));
        if (typeof body.username === "string" && body.username.trim().length > 0) {
            (0, analyticsStore_1.recordUserActivity)(body.username, `judge_${mode}`);
            if (mode === "submit") {
                (0, analyticsStore_1.recordQuestSubmission)(body.username, body.questId, result.status);
            }
        }
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
router.post("/run", async (req, res) => {
    return handleJudge(req, res, "run");
});
router.post("/submit", async (req, res) => {
    return handleJudge(req, res, "submit");
});
exports.default = router;
