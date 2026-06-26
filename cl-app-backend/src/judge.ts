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

// 后台题库管理接口：返回完整题目，包括参考答案和隐藏测试
router.get("/quests", requireRole(["admin", "question_manager"]), (_req: AuthedRequest, res: Response) => {
  return res.json({
    items: listQuestDefinitions(),
    total: listQuestDefinitions().length
  });
});

// 后台新建题目，只有 admin 和 question_manager 可以调用
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

// 后台更新题目，路径 id 优先覆盖请求体 id，避免编辑错题目
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

// 后台删除题目；内置题目会写入 deletedIds，后台新增题目会从 JSON 中移除
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

// 用户端题目目录接口：只返回摘要，不暴露参考答案和隐藏测试
router.get("/catalog", (_req: Request, res: Response) => {
  return res.json({
    items: listQuestSummaries(),
    total: listQuestSummaries().length
  });
});

// 后台读取判题配置，供评测系统维护页回填表单
router.get("/admin/config", requireRole(["admin", "judge_manager"]), (_req: AuthedRequest, res: Response) => {
  return res.json(getJudgeSystemConfig());
});

// 后台保存判题配置，保存后会影响后续判题任务
router.post("/admin/config", requireRole(["admin", "judge_manager"]), (req: AuthedRequest, res: Response) => {
  return res.json({
    config: updateJudgeSystemConfig(req.body ?? {})
  });
});

// 后台读取实时队列快照，用于轮询展示排队和运行状态
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

  // 1.run/submit 都必须提供题目 ID、语言和代码，语言必须在判题目录支持范围内
  if (typeof body.questId !== "string" || typeof body.code !== "string" || !isJudgeLanguage(body.language)) {
    return res.status(400).json({
      message: "questId, language, and code are required"
    });
  }

  // 2.先确认题目存在，再进入队列，避免无效请求占用判题资源
  const quest = getQuestDefinition(body.questId);
  if (!quest) {
    return res.status(404).json({
      message: "quest not found"
    });
  }

  try {
    // 3.把任务交给 enqueueJudgeJob，执行 judgeSubmission
    // 判题任务统一进入队列，避免并发过高时同时拉起过多执行环境
    //只有队列需要执行时才调用 judgeSubmission，避免每个请求都先执行一次判题逻辑再排队
    const result = await enqueueJudgeJob(body.questId, body.language, mode, () =>
      judgeSubmission(body.questId as string, body.language as JudgeLanguage, body.code as string, mode)
    );

    if (typeof body.username === "string" && body.username.trim().length > 0) {
      // 4.run/submit 都记录用户行为，后台 DAU 和活动统计会用到
      recordUserActivity(body.username, `judge_${mode}`);
      if (mode === "submit") {
        // 只有正式提交参与提交量和通过率统计
        recordQuestSubmission(body.username, body.questId, result.status);
      }
    }

    // 5.返回判题结果
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
