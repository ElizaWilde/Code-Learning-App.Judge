"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_1 = require("./session");
const communityModerationStore_1 = require("./communityModerationStore");
function isStatus(value) {
    return value === "pending" || value === "approved" || value === "rejected";
}
const router = (0, express_1.Router)();
router.get("/posts", (_req, res) => {
    return res.json({
        items: (0, communityModerationStore_1.listApprovedCommunityPosts)()
    });
});
router.get("/posts/:id", (req, res) => {
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
router.post("/posts", (req, res) => {
    const body = (req.body ?? {});
    const result = (0, communityModerationStore_1.createCommunityPostSubmission)(typeof body.title === "string" ? body.title : "", typeof body.content === "string" ? body.content : "", Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string") : [], typeof body.author === "string" ? body.author : "Guest");
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
router.get("/admin/posts", (0, session_1.requireRole)(["admin"]), (_req, res) => {
    return res.json({
        items: (0, communityModerationStore_1.listCommunityModerationItems)()
    });
});
router.patch("/admin/posts/:id/status", (0, session_1.requireRole)(["admin"]), (req, res) => {
    const itemId = String(req.params.id || "").trim();
    const body = (req.body ?? {});
    if (!isStatus(body.status)) {
        return res.status(400).json({
            message: "valid status is required"
        });
    }
    const result = (0, communityModerationStore_1.updateCommunityModerationStatus)(itemId, body.status, typeof body.moderationNote === "string" ? body.moderationNote : "");
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
