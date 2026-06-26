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
// 功能：管理社区投稿审核 JSON 持久化，提供投稿创建、审核状态更新和已通过帖子查询能力
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const db_2 = require("./db");
// 和 SQLite 放在同一个数据目录，便于本地数据统一管理
const moderationStorePath = node_path_1.default.join(node_path_1.default.dirname((0, db_1.getDatabasePath)()), "community-moderation.json");
// 没有 JSON 文件时使用默认数据，让社区和后台审核页初次启动也有内容
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
        moderationNote: "Seeded official showcase thread."
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
        moderationNote: ""
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
        moderationNote: ""
    }
];
function isString(value) {
    return typeof value === "string";
}
// 审核状态只允许三种固定值
function isStatus(value) {
    return value === "pending" || value === "approved" || value === "rejected";
}
function isStringArray(value) {
    // tags 必须是字符串数组，防止损坏 JSON 或旧数据污染前端渲染
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
// 读取 JSON 时做结构校验，过滤掉损坏或字段缺失的投稿记录
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
        && isString(value.moderationNote);
}
// 返回副本，避免调用方直接修改内存中的审核队列
function cloneItem(item) {
    return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        content: item.content,
        author: item.author,
        tags: [...item.tags],
        submittedAt: item.submittedAt,
        status: item.status,
        moderationNote: item.moderationNote
    };
}
// 自动生成帖子摘要，社区列表页不需要展示完整正文
function createSummary(content) {
    const trimmed = content.trim();
    if (trimmed.length <= 110) {
        // 内容较短时直接作为摘要
        return trimmed;
    }
    // 长正文截断成列表页摘要，详情页仍展示完整 content
    return `${trimmed.substring(0, 110)}...`;
}
// 审核通过的内部记录转换成前端社区页可展示的公开帖子结构
function toPublicPost(item) {
    // 作者类型从用户表实时读取，让管理员修改 expert 身份后社区标识能更新
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
// 启动时读取 community-moderation.json，兼容数组旧格式和 { items } 新格式
function loadStore() {
    try {
        if (!node_fs_1.default.existsSync(moderationStorePath)) {
            // 首次启动没有持久化文件时使用种子数据
            return defaultItems.map(cloneItem);
        }
        const raw = node_fs_1.default.readFileSync(moderationStorePath, "utf8");
        const parsed = JSON.parse(raw);
        // 兼容旧版直接保存数组和新版保存 { items } 两种格式
        const items = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.items)
                ? parsed.items
                : [];
        const normalized = items.filter(isCommunityModerationItem).map(cloneItem);
        // 文件存在但数据全部无效时回退种子数据，避免社区空白
        return normalized.length > 0 ? normalized : defaultItems.map(cloneItem);
    }
    catch (_error) {
        // JSON 损坏或读取失败时回退种子数据，不阻塞后端启动
        return defaultItems.map(cloneItem);
    }
}
// 每次投稿或审核状态变化后，把审核队列写回 JSON 文件
function persistStore() {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(moderationStorePath), { recursive: true });
    node_fs_1.default.writeFileSync(moderationStorePath, JSON.stringify({ items: moderationItems }, null, 2), "utf8");
}
let moderationItems = loadStore();
// 后台审核页查看完整审核队列，按提交时间倒序排列
function listCommunityModerationItems() {
    return moderationItems
        // 返回副本并倒序排列，最新投稿在后台审核页最上方
        .map(cloneItem)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}
// 用户端社区列表只展示已通过审核的帖子
function listApprovedCommunityPosts() {
    return moderationItems
        // 用户端只展示审核通过的帖子
        .filter((item) => item.status === "approved")
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
        .map((item) => toPublicPost(cloneItem(item)));
}
// 帖子详情页同样只允许读取已通过审核的帖子
function getApprovedCommunityPostById(postId) {
    const normalizedId = postId.trim();
    // 即使知道 pending/rejected 的 id，也不能通过详情接口读取
    const item = moderationItems.find((entry) => entry.id === normalizedId && entry.status === "approved");
    return item ? toPublicPost(cloneItem(item)) : null;
}
// 用户投稿先进入 pending 状态，等待管理员在后台审核
function createCommunityPostSubmission(title, content, tags, author) {
    // 投稿字段统一 trim，避免把纯空格标题或正文写入审核队列
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    const normalizedAuthor = author.trim().length > 0 ? author.trim() : "Guest";
    const normalizedTags = tags
        // 标签统一小写，便于社区列表页趋势统计和搜索匹配
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
        // 使用时间戳生成帖子 id，用户端详情和后台审核都以它定位记录
        id: `post-${Date.now()}`,
        title: normalizedTitle,
        summary: createSummary(normalizedContent),
        content: normalizedContent,
        author: normalizedAuthor,
        tags: normalizedTags,
        submittedAt: now.toISOString(),
        // 新投稿默认 pending，管理员审核通过后才会出现在公开列表
        status: "pending",
        moderationNote: ""
    };
    // 新投稿放到队列头部，后台审核页优先看到最新内容
    moderationItems = [item, ...moderationItems];
    persistStore();
    return {
        ok: true,
        item: cloneItem(item)
    };
}
// 管理员更新审核状态和审核备注，保存后会影响用户端是否可见
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
        // 状态变为 approved 后用户端可见；rejected/pending 时用户端不可见
        status,
        moderationNote: moderationNote.trim()
    };
    persistStore();
    return {
        ok: true,
        item: cloneItem(moderationItems[index])
    };
}
