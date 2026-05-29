import { Request, Response, Router } from "express";
import { getAnalyticsDashboard, upsertWrongAnswerSnapshot } from "./analyticsStore";
import { AuthedRequest, requireRole } from "./session";

const router = Router();

type WrongAnswerSyncBody = {
  username?: unknown;
  pathId?: unknown;
  pathTitle?: unknown;
  moduleId?: unknown;
  moduleTitle?: unknown;
  wrongCount?: unknown;
};

router.get("/dashboard", requireRole(["admin", "analyst"]), (req: AuthedRequest, res: Response) => {
  const daysParam = typeof req.query.days === "string" ? Number(req.query.days) : undefined;
  const days = Number.isFinite(daysParam) ? Number(daysParam) : undefined;
  return res.json(getAnalyticsDashboard(days));
});

router.post("/wrong-answers", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as WrongAnswerSyncBody;

  if (
    typeof body.username !== "string" ||
    typeof body.pathId !== "string" ||
    typeof body.pathTitle !== "string" ||
    typeof body.moduleId !== "string" ||
    typeof body.moduleTitle !== "string"
  ) {
    return res.status(400).json({
      message: "username, pathId, pathTitle, moduleId, and moduleTitle are required"
    });
  }

  upsertWrongAnswerSnapshot({
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

export default router;
