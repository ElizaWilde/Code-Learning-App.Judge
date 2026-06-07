// 功能：提供社区帖子 API，包括公开帖子列表、投稿创建和后台审核状态更新
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

// 审核状态只允许待审核、通过、拒绝三种值
function isStatus(value: unknown): value is CommunityModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

const router = Router();

// 用户端社区列表只返回已审核通过的帖子
router.get("/posts", (_req: Request, res: Response) => {
  return res.json({
    items: listApprovedCommunityPosts()
  });
});

// 用户端帖子详情同样只能读取已审核通过的内容
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

// 用户投稿先进入审核队列，不会立即出现在公开社区列表
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

// 管理员后台读取完整审核队列
router.get("/admin/posts", requireRole(["admin"]), (_req: AuthedRequest, res: Response) => {
  return res.json({
    items: listCommunityModerationItems()
  });
});

// 管理员更新帖子审核状态和审核备注
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
