"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCommunityModerationItems = listCommunityModerationItems;
exports.listApprovedCommunityPosts = listApprovedCommunityPosts;
exports.getApprovedCommunityPostById = getApprovedCommunityPostById;
exports.createCommunityPostSubmission = createCommunityPostSubmission;
exports.updateCommunityModerationStatus = updateCommunityModerationStatus;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const db_2 = require("./db");
const moderationStorePath = node_path_1.default.join(node_path_1.default.dirname((0, db_1.getDatabasePath)()), "community-moderation.json");
const defaultItems = [
    {
        id: "weekly-showcase",
        title: "Weekly challenge showcase",
        summary: "See what the community built for this week's UI cloning task and compare layout, motion, and polish decisions.",
        content: "This thread collects the strongest submissions from this week's UI cloning challenge. Share what you built, explain your layout choices, and point out one detail you would improve on a second pass.",
        author: "Community",
        tags: ["frontend", "ui", "design", "project"],
        submittedAt: "2026-05-18T09:00:00.000Z",
        status: "approved",
        moderationNote: "Seeded official showcase thread.",
        reportCount: 0
    },
    {
        id: "backend-review",
        title: "Backend code review habits",
        summary: "A thread on API validation, database safety, logging, and the fastest way to review server-side changes.",
        content: "Strong backend reviews usually focus on correctness before style. That means checking API validation, permission boundaries, error handling, logging quality, and database writes.",
        author: "Community",
        tags: ["backend", "api", "database", "review"],
        submittedAt: "2026-05-20T13:30:00.000Z",
        status: "pending",
        moderationNote: "",
        reportCount: 2
    },
    {
        id: "ship-first-app",
        title: "What helped you ship your first app?",
        summary: "A practical discussion on scope control, deployment anxiety, and what to cut so a project actually gets finished.",
        content: "Most first apps stall because scope keeps growing. Share what you cut, how you handled deployment anxiety, and what helped you move from planning to shipping.",
        author: "Community",
        tags: ["app", "project", "deploy", "shipping"],
        submittedAt: "2026-05-21T08:15:00.000Z",
        status: "pending",
        moderationNote: "",
        reportCount: 1
    }
];
function isString(value) {
    return typeof value === "string";
}
function isStatus(value) {
    return value === "pending" || value === "approved" || value === "rejected";
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isCommunityModerationItem(value) {
    return value != null
        && typeof value === "object"
        && isString(value.id)
        && isString(value.title)
        && isString(value.summary)
        && isString(value.content)
        && isString(value.author)
        && isStringArray(value.tags)
        && isString(value.submittedAt)
        && isStatus(value.status)
        && isString(value.moderationNote)
        && typeof value.reportCount === "number";
}
function cloneItem(item) {
    return JSON.parse(JSON.stringify(item));
}
function createSummary(content) {
    const trimmed = content.trim();
    if (trimmed.length <= 110) {
        return trimmed;
    }
    return `${trimmed.substring(0, 110)}...`;
}
function toPublicPost(item) {
    const authorRecord = (0, db_2.findUserByUsername)(item.author);
    return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        content: item.content,
        meta: `Posted by ${item.author}`,
        badge: "Community",
        tags: item.tags,
        author: item.author,
        authorType: authorRecord?.user_type ?? "normal"
    };
}
function loadStore() {
    try {
        if (!node_fs_1.default.existsSync(moderationStorePath)) {
            return defaultItems.map(cloneItem);
        }
        const raw = node_fs_1.default.readFileSync(moderationStorePath, "utf8");
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.items)
                ? parsed.items
                : [];
        const normalized = items.filter(isCommunityModerationItem).map(cloneItem);
        return normalized.length > 0 ? normalized : defaultItems.map(cloneItem);
    }
    catch (_error) {
        return defaultItems.map(cloneItem);
    }
}
function persistStore() {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(moderationStorePath), { recursive: true });
    node_fs_1.default.writeFileSync(moderationStorePath, JSON.stringify({ items: moderationItems }, null, 2), "utf8");
}
let moderationItems = loadStore();
function listCommunityModerationItems() {
    return moderationItems
        .map(cloneItem)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}
function listApprovedCommunityPosts() {
    return moderationItems
        .filter((item) => item.status === "approved")
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
        .map((item) => toPublicPost(cloneItem(item)));
}
function getApprovedCommunityPostById(postId) {
    const normalizedId = postId.trim();
    const item = moderationItems.find((entry) => entry.id === normalizedId && entry.status === "approved");
    return item ? toPublicPost(cloneItem(item)) : null;
}
function createCommunityPostSubmission(title, content, tags, author) {
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    const normalizedAuthor = author.trim().length > 0 ? author.trim() : "Guest";
    const normalizedTags = tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
    if (normalizedTitle.length === 0 || normalizedContent.length === 0) {
        return {
            ok: false,
            message: "title and content are required"
        };
    }
    const now = new Date();
    const item = {
        id: `post-${Date.now()}`,
        title: normalizedTitle,
        summary: createSummary(normalizedContent),
        content: normalizedContent,
        author: normalizedAuthor,
        tags: normalizedTags,
        submittedAt: now.toISOString(),
        status: "pending",
        moderationNote: "",
        reportCount: 0
    };
    moderationItems = [item, ...moderationItems];
    persistStore();
    return {
        ok: true,
        item: cloneItem(item)
    };
}
function updateCommunityModerationStatus(itemId, status, moderationNote) {
    const normalizedId = itemId.trim();
    if (normalizedId.length === 0) {
        return {
            ok: false,
            message: "post id is required"
        };
    }
    const index = moderationItems.findIndex((item) => item.id === normalizedId);
    if (index === -1) {
        return {
            ok: false,
            message: "post not found"
        };
    }
    moderationItems[index] = {
        ...moderationItems[index],
        status,
        moderationNote: moderationNote.trim()
    };
    persistStore();
    return {
        ok: true,
        item: cloneItem(moderationItems[index])
    };
}
