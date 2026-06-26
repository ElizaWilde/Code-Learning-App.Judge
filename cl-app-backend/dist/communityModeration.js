"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 功能：提供社区帖子 API，包括公开帖子列表、投稿创建和后台审核状态更新
const express_1 = require("express");
const session_1 = require("./session");
const communityModerationStore_1 = require("./communityModerationStore");
// 审核状态只允许待审核、通过、拒绝三种值
function isStatus(value) {
    return value === "pending" || value === "approved" || value === "rejected";
}
const router = (0, express_1.Router)();
// 用户端社区列表只返回已审核通过的帖子
router.get("/posts", (_req, res) => {
    return res.json({
        // 只返回 approved 帖子，pending/rejected 不进入用户端列表
        items: (0, communityModerationStore_1.listApprovedCommunityPosts)()
    });
});
// 用户端帖子详情同样只能读取已审核通过的内容
router.get("/posts/:id", (req, res) => {
    // 详情接口同样通过 store 层限制只能读取 approved 内容
    const post = (0, communityModerationStore_1.getApprovedCommunityPostById)(String(req.params.id || ""));
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
router.post("/posts", (req, res) => {
    const body = (req.body ?? {});
    const result = (0, communityModerationStore_1.createCommunityPostSubmission)(
    // 非字符串字段统一传空值，让 store 层返回明确的校验错误
    typeof body.title === "string" ? body.title : "", typeof body.content === "string" ? body.content : "", 
    // 只保留字符串标签，避免把对象或数字写入审核 JSON
    Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string") : [], typeof body.author === "string" ? body.author : "Guest");
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
router.get("/admin/posts", (0, session_1.requireRole)(["admin"]), (_req, res) => {
    return res.json({
        // 管理后台需要看到 pending/approved/rejected 全部状态
        items: (0, communityModerationStore_1.listCommunityModerationItems)()
    });
});
// 管理员更新帖子审核状态和审核备注
router.patch("/admin/posts/:id/status", (0, session_1.requireRole)(["admin"]), (req, res) => {
    const itemId = String(req.params.id || "").trim();
    const body = (req.body ?? {});
    if (!isStatus(body.status)) {
        // 状态值必须是 pending、approved 或 rejected
        return res.status(400).json({
            message: "valid status is required"
        });
    }
    const result = (0, communityModerationStore_1.updateCommunityModerationStatus)(itemId, body.status, 
    // 审核备注可选，非字符串按空备注处理
    typeof body.moderationNote === "string" ? body.moderationNote : "");
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
exports.default = router;
