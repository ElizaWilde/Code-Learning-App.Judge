// 功能：管理社区投稿审核 JSON 持久化，提供投稿创建、审核状态更新和已通过帖子查询能力
import fs from "node:fs";
import path from "node:path";
import { getDatabasePath } from "./db";
import { findUserByUsername, UserType } from "./db";

/**
 * 社区审核 JSON 存储模块
 * 保存用户投稿、审核状态、审核备注和公开展示所需字段
 */
export type CommunityModerationStatus = "pending" | "approved" | "rejected";

export type CommunityModerationItem = {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  tags: string[];
  submittedAt: string;
  status: CommunityModerationStatus;
  moderationNote: string;
};

export type PublicCommunityPost = {
  id: string;
  title: string;
  summary: string;
  content: string;
  meta: string;
  badge: string;
  tags: string[];
  author: string;
  authorType: UserType;
};

type PersistedCommunityModerationStore = {
  items?: unknown;
};

// 和 SQLite 放在同一个数据目录，便于本地数据统一管理
const moderationStorePath = path.join(path.dirname(getDatabasePath()), "community-moderation.json");

// 没有 JSON 文件时使用默认数据，让社区和后台审核页初次启动也有内容
const defaultItems: CommunityModerationItem[] = [
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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

// 审核状态只允许三种固定值
function isStatus(value: unknown): value is CommunityModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// 读取 JSON 时做结构校验，过滤掉损坏或字段缺失的投稿记录
function isCommunityModerationItem(value: unknown): value is CommunityModerationItem {
  return value != null
    && typeof value === "object"
    && isString((value as Record<string, unknown>).id)
    && isString((value as Record<string, unknown>).title)
    && isString((value as Record<string, unknown>).summary)
    && isString((value as Record<string, unknown>).content)
    && isString((value as Record<string, unknown>).author)
    && isStringArray((value as Record<string, unknown>).tags)
    && isString((value as Record<string, unknown>).submittedAt)
    && isStatus((value as Record<string, unknown>).status)
    && isString((value as Record<string, unknown>).moderationNote);
}

// 返回副本，避免调用方直接修改内存中的审核队列
function cloneItem(item: CommunityModerationItem): CommunityModerationItem {
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
function createSummary(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 110) {
    return trimmed;
  }

  return `${trimmed.substring(0, 110)}...`;
}

// 审核通过的内部记录转换成前端社区页可展示的公开帖子结构
function toPublicPost(item: CommunityModerationItem): PublicCommunityPost {
  const authorRecord = findUserByUsername(item.author);
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
function loadStore(): CommunityModerationItem[] {
  try {
    if (!fs.existsSync(moderationStorePath)) {
      return defaultItems.map(cloneItem);
    }

    const raw = fs.readFileSync(moderationStorePath, "utf8");
    const parsed = JSON.parse(raw) as PersistedCommunityModerationStore | unknown[];
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as PersistedCommunityModerationStore).items)
        ? (parsed as PersistedCommunityModerationStore).items as unknown[]
        : [];

    const normalized = items.filter(isCommunityModerationItem).map(cloneItem);
    return normalized.length > 0 ? normalized : defaultItems.map(cloneItem);
  } catch (_error) {
    return defaultItems.map(cloneItem);
  }
}

// 每次投稿或审核状态变化后，把审核队列写回 JSON 文件
function persistStore(): void {
  fs.mkdirSync(path.dirname(moderationStorePath), { recursive: true });
  fs.writeFileSync(moderationStorePath, JSON.stringify({ items: moderationItems }, null, 2), "utf8");
}

let moderationItems = loadStore();

// 后台审核页查看完整审核队列，按提交时间倒序排列
export function listCommunityModerationItems(): CommunityModerationItem[] {
  return moderationItems
    .map(cloneItem)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

// 用户端社区列表只展示已通过审核的帖子
export function listApprovedCommunityPosts(): PublicCommunityPost[] {
  return moderationItems
    .filter((item) => item.status === "approved")
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
    .map((item) => toPublicPost(cloneItem(item)));
}

// 帖子详情页同样只允许读取已通过审核的帖子
export function getApprovedCommunityPostById(postId: string): PublicCommunityPost | null {
  const normalizedId = postId.trim();
  const item = moderationItems.find((entry) => entry.id === normalizedId && entry.status === "approved");
  return item ? toPublicPost(cloneItem(item)) : null;
}

// 用户投稿先进入 pending 状态，等待管理员在后台审核
export function createCommunityPostSubmission(
  title: string,
  content: string,
  tags: string[],
  author: string
): { ok: true; item: CommunityModerationItem } | { ok: false; message: string } {
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
  const item: CommunityModerationItem = {
    id: `post-${Date.now()}`,
    title: normalizedTitle,
    summary: createSummary(normalizedContent),
    content: normalizedContent,
    author: normalizedAuthor,
    tags: normalizedTags,
    submittedAt: now.toISOString(),
    status: "pending",
    moderationNote: ""
  };

  moderationItems = [item, ...moderationItems];
  persistStore();

  return {
    ok: true,
    item: cloneItem(item)
  };
}

// 管理员更新审核状态和审核备注，保存后会影响用户端是否可见
export function updateCommunityModerationStatus(
  itemId: string,
  status: CommunityModerationStatus,
  moderationNote: string
): { ok: true; item: CommunityModerationItem } | { ok: false; message: string } {
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
