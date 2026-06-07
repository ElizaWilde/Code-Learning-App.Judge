// 功能：提供判题相关 API，包括题库目录、题目详情、运行代码、提交代码和后台判题配置管理
import { Request, Response, Router } from "express";
import { JudgeLanguage } from "./judgeCatalog";
import { judgeSubmission } from "./judgeService";
import { AuthedRequest, requireRole } from "./session";
import { enqueueJudgeJob, getJudgeQueueSnapshot, getJudgeSystemConfig, updateJudgeSystemConfig } from "./judgeAdmin";
import { deleteQuestDefinition, getQuestDefinition, listQuestDefinitions, listQuestSummaries, upsertQuestDefinition } from "./questStore";
import { recordQuestSubmission, recordUserActivity } from "./analyticsStore";

const router = Router();

type JudgeBody = {
  questId?: unknown;
  language?: unknown;
  code?: unknown;
  username?: unknown;
};

// 目前判题服务只允许 Python 和 Java 两种语言
function isJudgeLanguage(value: unknown): value is JudgeLanguage {
  return value === "python" || value === "java";
}

router.get("/quests", requireRole(["admin", "question_manager"]), (_req: AuthedRequest, res: Response) => {
  return res.json({
    items: listQuestDefinitions(),
    total: listQuestDefinitions().length
  });
});

router.post("/admin/quests", requireRole(["admin", "question_manager"]), (req: AuthedRequest, res: Response) => {
  const result = upsertQuestDefinition(req.body ?? {});
  if (!result.ok) {
    return res.status(400).json({
      message: result.message
    });
  }

  return res.json({
    quest: result.quest
  });
});

router.put("/admin/quests/:id", requireRole(["admin", "question_manager"]), (req: AuthedRequest, res: Response) => {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const payload = {
    ...body,
    id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  };
  const result = upsertQuestDefinition(payload);
  if (!result.ok) {
    return res.status(400).json({
      message: result.message
    });
  }

  return res.json({
    quest: result.quest
  });
});

router.delete("/admin/quests/:id", requireRole(["admin", "question_manager"]), (req: AuthedRequest, res: Response) => {
  const questId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = deleteQuestDefinition(questId);
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

router.get("/catalog", (_req: Request, res: Response) => {
  return res.json({
    items: listQuestSummaries(),
    total: listQuestSummaries().length
  });
});

router.get("/admin/config", requireRole(["admin", "judge_manager"]), (_req: AuthedRequest, res: Response) => {
  return res.json(getJudgeSystemConfig());
});

router.post("/admin/config", requireRole(["admin", "judge_manager"]), (req: AuthedRequest, res: Response) => {
  return res.json({
    config: updateJudgeSystemConfig(req.body ?? {})
  });
});

router.get("/admin/queue", requireRole(["admin", "judge_manager"]), (_req: AuthedRequest, res: Response) => {
  return res.json(getJudgeQueueSnapshot());
});

router.get("/quest/:id", (req: Request, res: Response) => {
  const questId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const quest = getQuestDefinition(questId);

  if (!quest) {
    return res.status(404).json({
      message: "quest not found"
    });
  }

  return res.json(quest);
});

// run 和 submit 共用同一套请求校验、排队执行、结果记录逻辑
async function handleJudge(req: Request, res: Response, mode: "run" | "submit") {
  const body = (req.body ?? {}) as JudgeBody;

  if (typeof body.questId !== "string" || typeof body.code !== "string" || !isJudgeLanguage(body.language)) {
    return res.status(400).json({
      message: "questId, language, and code are required"
    });
  }

  const quest = getQuestDefinition(body.questId);
  if (!quest) {
    return res.status(404).json({
      message: "quest not found"
    });
  }

  try {
    const result = await enqueueJudgeJob(body.questId, body.language, mode, () =>
      judgeSubmission(body.questId as string, body.language as JudgeLanguage, body.code as string, mode)
    );

    if (typeof body.username === "string" && body.username.trim().length > 0) {
      recordUserActivity(body.username, `judge_${mode}`);
      if (mode === "submit") {
        recordQuestSubmission(body.username, body.questId, result.status);
      }
    }

    return res.json({
      questId: body.questId,
      language: body.language,
      mode,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "judge execution failed";
    return res.status(500).json({
      message: "judge execution failed",
      detail: message
    });
  }
}

router.post("/run", async (req: Request, res: Response) => {
  return handleJudge(req, res, "run");
});

router.post("/submit", async (req: Request, res: Response) => {
  return handleJudge(req, res, "submit");
});

export default router;
