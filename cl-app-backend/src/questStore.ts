import fs from "node:fs";
import path from "node:path";
import { getDatabasePath } from "./db";
import {
  isQuestKind,
  JudgeLanguage,
  JudgeTestCase,
  QuestDefinition,
  questCatalog
} from "./judgeCatalog";

type PersistedQuestPayload = Omit<QuestDefinition, never>;
type PersistedQuestStore = {
  quests?: Record<string, unknown>;
  deletedIds?: unknown[];
};

const questStorePath = path.join(path.dirname(getDatabasePath()), "quests.json");

function cloneQuest(quest: QuestDefinition): QuestDefinition {
  return JSON.parse(JSON.stringify(quest)) as QuestDefinition;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStarterCodes(value: unknown): value is Record<JudgeLanguage, string> {
  return value != null
    && typeof value === "object"
    && isString((value as Record<string, unknown>).python)
    && isString((value as Record<string, unknown>).java);
}

function isJudgeTestCase(value: unknown): value is JudgeTestCase {
  return value != null
    && typeof value === "object"
    && isString((value as Record<string, unknown>).name)
    && Object.prototype.hasOwnProperty.call(value, "input")
    && Object.prototype.hasOwnProperty.call(value, "expected");
}

function isQuestDefinition(value: unknown): value is QuestDefinition {
  return value != null
    && typeof value === "object"
    && isString((value as Record<string, unknown>).id)
    && isString((value as Record<string, unknown>).title)
    && isString((value as Record<string, unknown>).difficulty)
    && isString((value as Record<string, unknown>).difficultyClass)
    && isString((value as Record<string, unknown>).category)
    && isString((value as Record<string, unknown>).acceptance)
    && isString((value as Record<string, unknown>).description)
    && isString((value as Record<string, unknown>).example)
    && isString((value as Record<string, unknown>).constraints)
    && isQuestKind((value as Record<string, unknown>).kind)
    && isStarterCodes((value as Record<string, unknown>).starterCodes)
    && isStarterCodes((value as Record<string, unknown>).referenceSolutions)
    && Array.isArray((value as Record<string, unknown>).visibleTests)
    && ((value as Record<string, unknown>).visibleTests as unknown[]).every(isJudgeTestCase)
    && Array.isArray((value as Record<string, unknown>).hiddenTests)
    && ((value as Record<string, unknown>).hiddenTests as unknown[]).every(isJudgeTestCase)
    && isString((value as Record<string, unknown>).bestApproach)
    && isString((value as Record<string, unknown>).referenceTitle)
    && isString((value as Record<string, unknown>).referenceNote);
}

function normalizeQuest(value: PersistedQuestPayload): QuestDefinition {
  return cloneQuest(value);
}

function loadPersistedQuestStore(): { quests: Record<string, QuestDefinition>; deletedIds: string[] } {
  try {
    if (!fs.existsSync(questStorePath)) {
      return { quests: {}, deletedIds: [] };
    }

    const raw = fs.readFileSync(questStorePath, "utf8");
    const parsed = JSON.parse(raw) as PersistedQuestStore | Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return { quests: {}, deletedIds: [] };
    }

    const questPayload = "quests" in parsed && parsed.quests && typeof parsed.quests === "object"
      ? parsed.quests
      : parsed;
    const deletedIds = Array.isArray((parsed as PersistedQuestStore).deletedIds)
      ? ((parsed as PersistedQuestStore).deletedIds as unknown[])
          .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
          .map((entry) => String(entry))
      : [];

    const entries = Object.entries(questPayload as Record<string, unknown>);
    const result: Record<string, QuestDefinition> = {};

    for (const [id, quest] of entries) {
      if (!isQuestDefinition(quest)) {
        continue;
      }
      result[id] = normalizeQuest(quest);
    }

    return {
      quests: result,
      deletedIds
    };
  } catch (_error) {
    return { quests: {}, deletedIds: [] };
  }
}

function persistQuestMap(): void {
  fs.mkdirSync(path.dirname(questStorePath), { recursive: true });
  fs.writeFileSync(questStorePath, JSON.stringify({
    quests: persistedQuestMap,
    deletedIds: Array.from(deletedQuestIds)
  }, null, 2), "utf8");
}

const loadedQuestStore = loadPersistedQuestStore();
let persistedQuestMap: Record<string, QuestDefinition> = loadedQuestStore.quests;
let deletedQuestIds = new Set<string>(loadedQuestStore.deletedIds);

function mergedQuestMap(): Record<string, QuestDefinition> {
  const merged = {
    ...questCatalog,
    ...persistedQuestMap
  };

  deletedQuestIds.forEach((questId) => {
    delete merged[questId];
  });

  return merged;
}

function validateQuestInput(candidate: unknown): { ok: true; quest: QuestDefinition } | { ok: false; message: string } {
  if (!isQuestDefinition(candidate)) {
    return {
      ok: false,
      message: "Quest payload is invalid. Check strings, kind, starter codes, reference solutions, and test cases."
    };
  }

  if (candidate.id.trim().length === 0) {
    return {
      ok: false,
      message: "Quest id is required."
    };
  }

  return {
    ok: true,
    quest: normalizeQuest(candidate)
  };
}

export function getQuestDefinition(questId: string): QuestDefinition | null {
  return mergedQuestMap()[questId] ?? null;
}

export function listQuestDefinitions(): QuestDefinition[] {
  return Object.values(mergedQuestMap());
}

export function listQuestSummaries(): Array<{
  id: string;
  title: string;
  difficulty: string;
  difficultyClass: string;
  category: string;
  acceptance: string;
  description: string;
}> {
  return listQuestDefinitions().map((quest) => ({
    id: quest.id,
    title: quest.title,
    difficulty: quest.difficulty,
    difficultyClass: quest.difficultyClass,
    category: quest.category,
    acceptance: quest.acceptance,
    description: quest.description
  }));
}

export function upsertQuestDefinition(candidate: unknown): { ok: true; quest: QuestDefinition } | { ok: false; message: string } {
  const validated = validateQuestInput(candidate);
  if (!validated.ok) {
    return validated;
  }

  deletedQuestIds.delete(validated.quest.id);
  persistedQuestMap[validated.quest.id] = validated.quest;
  persistQuestMap();

  return {
    ok: true,
    quest: cloneQuest(validated.quest)
  };
}

export function deleteQuestDefinition(questId: string): { ok: true } | { ok: false; message: string } {
  const normalizedQuestId = questId.trim();
  if (normalizedQuestId.length === 0) {
    return {
      ok: false,
      message: "Quest id is required."
    };
  }

  const existingQuest = mergedQuestMap()[normalizedQuestId];
  if (!existingQuest) {
    return {
      ok: false,
      message: "Quest not found."
    };
  }

  delete persistedQuestMap[normalizedQuestId];
  deletedQuestIds.add(normalizedQuestId);
  persistQuestMap();

  return { ok: true };
}
