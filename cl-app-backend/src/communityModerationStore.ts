import fs from "node:fs";
import path from "node:path";
import { getDatabasePath } from "./db";
import { findUserByUsername, UserType } from "./db";

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
  reportCount: number;
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

const moderationStorePath = path.join(path.dirname(getDatabasePath()), "community-moderation.json");

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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStatus(value: unknown): value is CommunityModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

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
    && isString((value as Record<string, unknown>).moderationNote)
    && typeof (value as Record<string, unknown>).reportCount === "number";
}

function cloneItem(item: CommunityModerationItem): CommunityModerationItem {
  return JSON.parse(JSON.stringify(item)) as CommunityModerationItem;
}

function createSummary(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 110) {
    return trimmed;
  }

  return `${trimmed.substring(0, 110)}...`;
}

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

function persistStore(): void {
  fs.mkdirSync(path.dirname(moderationStorePath), { recursive: true });
  fs.writeFileSync(moderationStorePath, JSON.stringify({ items: moderationItems }, null, 2), "utf8");
}

let moderationItems = loadStore();

export function listCommunityModerationItems(): CommunityModerationItem[] {
  return moderationItems
    .map(cloneItem)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export function listApprovedCommunityPosts(): PublicCommunityPost[] {
  return moderationItems
    .filter((item) => item.status === "approved")
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
    .map((item) => toPublicPost(cloneItem(item)));
}

export function getApprovedCommunityPostById(postId: string): PublicCommunityPost | null {
  const normalizedId = postId.trim();
  const item = moderationItems.find((entry) => entry.id === normalizedId && entry.status === "approved");
  return item ? toPublicPost(cloneItem(item)) : null;
}

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
