// 功能：管理题库 JSON 持久化，合并内置题库和后台维护题库，并提供题目查询、新增、修改、删除能力
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

/**
 * 题库 JSON 存储模块
 * quests 保存后台新增或修改过的题目
 * deletedIds 保存后台删除过的内置题目 ID
 */
//预留扩展空间:当前持久化结构和运行时题目结构一致，后续如有运行时字段可在这里Omit<QuestDefinition, xxx>排除
type PersistedQuestPayload = QuestDefinition;
type PersistedQuestStore = {
  quests?: Record<string, unknown>;
  deletedIds?: unknown[];
};

// 运行时生成的数据文件quests.json与SQLite 放在同一个数据目录：dirname(app.db)/quests.json，方便部署时整体迁移数据
  //app.db 的路径由 db.ts选择
const questStorePath = path.join(path.dirname(getDatabasePath()), "quests.json");

// 对题目对象做深拷贝，避免外部调用者直接修改内存中的题库数据
function cloneQuest(quest: QuestDefinition): QuestDefinition {
  return JSON.parse(JSON.stringify(quest)) as QuestDefinition;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

// 判断 Python 和 Java 两份代码模板是否都存在：返回true 代表合法的value，后续可以直接断言为 Record<JudgeLanguage, string> 使用
function isStarterCodes(value: unknown): value is Record<JudgeLanguage, string> {
  return value != null
    && typeof value === "object"
    && isString((value as Record<string, unknown>).python)
    && isString((value as Record<string, unknown>).java);
}

// 判题用例必须包含名称、输入和期望输出
function isJudgeTestCase(value: unknown): value is JudgeTestCase {
  return value != null
    && typeof value === "object"
    && isString((value as Record<string, unknown>).name)
    && Object.prototype.hasOwnProperty.call(value, "input")
    && Object.prototype.hasOwnProperty.call(value, "expected");
}

// 运行时校验题目完整结构，防止损坏的 JSON 进入判题流程
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

//持久化题目进入系统前统一标准化
function normalizeQuest(value: PersistedQuestPayload): QuestDefinition {
  return cloneQuest(value);
}

// 启动时读取 quests.json，兼容旧格式和当前 { quests, deletedIds } 格式
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

// 每次新增、修改或删除题目后，把内存状态写回 quests.json
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

// 最终题库等于内置题库加后台覆盖题库，再移除后台删除标记
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

// 后台保存题目前先做完整校验，避免无效题目破坏用户端和判题端
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

// 按 ID 获取完整题目，判题和题目详情页都会用到
export function getQuestDefinition(questId: string): QuestDefinition | null {
  return mergedQuestMap()[questId] ?? null;
}

// 后台题库管理使用完整题目列表
export function listQuestDefinitions(): QuestDefinition[] {
  return Object.values(mergedQuestMap());
}

// 用户端目录只需要摘要字段，避免把参考答案和隐藏测试用例暴露出去
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

// 新增或更新题目，并解除同 ID 的删除标记
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

// 删除题目时记录 deletedIds，内置题目不会改源码，只在合并题库时被隐藏
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
