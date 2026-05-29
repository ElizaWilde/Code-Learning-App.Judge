import { Request, Response, Router } from "express";
import { AuthedRequest, requireRole } from "./session";
import {
  CommunityModerationStatus,
  createCommunityPostSubmission,
  getApprovedCommunityPostById,
  listCommunityModerationItems,
  listApprovedCommunityPosts,
  updateCommunityModerationStatus
} from "./communityModerationStore";

type ModerationUpdateBody = {
  status?: unknown;
  moderationNote?: unknown;
};

type CommunityPostCreateBody = {
  title?: unknown;
  content?: unknown;
  tags?: unknown;
  author?: unknown;
};

function isStatus(value: unknown): value is CommunityModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

const router = Router();

router.get("/posts", (_req: Request, res: Response) => {
  return res.json({
    items: listApprovedCommunityPosts()
  });
});

router.get("/posts/:id", (req: Request, res: Response) => {
  const post = getApprovedCommunityPostById(String(req.params.id || ""));

  if (!post) {
    return res.status(404).json({
      message: "post not found"
    });
  }

  return res.json({
    post
  });
});

router.post("/posts", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as CommunityPostCreateBody;
  const result = createCommunityPostSubmission(
    typeof body.title === "string" ? body.title : "",
    typeof body.content === "string" ? body.content : "",
    Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [],
    typeof body.author === "string" ? body.author : "Guest"
  );

  if (!result.ok) {
    return res.status(400).json({
      message: result.message
    });
  }

  return res.status(201).json({
    message: "post submitted for moderation",
    item: result.item
  });
});

router.get("/admin/posts", requireRole(["admin"]), (_req: AuthedRequest, res: Response) => {
  return res.json({
    items: listCommunityModerationItems()
  });
});

router.patch("/admin/posts/:id/status", requireRole(["admin"]), (req: AuthedRequest, res: Response) => {
  const itemId = String(req.params.id || "").trim();
  const body = (req.body ?? {}) as ModerationUpdateBody;

  if (!isStatus(body.status)) {
    return res.status(400).json({
      message: "valid status is required"
    });
  }

  const result = updateCommunityModerationStatus(
    itemId,
    body.status,
    typeof body.moderationNote === "string" ? body.moderationNote : ""
  );

  if (!result.ok) {
    return res.status(result.message === "post not found" ? 404 : 400).json({
      message: result.message
    });
  }

  return res.json({
    message: "moderation status updated",
    item: result.item
  });
});

export default router;
