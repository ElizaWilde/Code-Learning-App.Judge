"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestDefinition = getQuestDefinition;
exports.listQuestDefinitions = listQuestDefinitions;
exports.listQuestSummaries = listQuestSummaries;
exports.upsertQuestDefinition = upsertQuestDefinition;
exports.deleteQuestDefinition = deleteQuestDefinition;
// 功能：管理题库 JSON 持久化，合并内置题库和后台维护题库，并提供题目查询、新增、修改、删除能力
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const judgeCatalog_1 = require("./judgeCatalog");
// 运行时生成的数据文件quests.json与SQLite 放在同一个数据目录：dirname(app.db)/quests.json，方便部署时整体迁移数据
//app.db 的路径由 db.ts选择
const questStorePath = node_path_1.default.join(node_path_1.default.dirname((0, db_1.getDatabasePath)()), "quests.json");
// 对题目对象做深拷贝，避免外部调用者直接修改内存中的题库数据
function cloneQuest(quest) {
    return JSON.parse(JSON.stringify(quest));
}
function isString(value) {
    return typeof value === "string";
}
// 判断 Python 和 Java 两份代码模板是否都存在：返回true 代表合法的value，后续可以直接断言为 Record<JudgeLanguage, string> 使用
function isStarterCodes(value) {
    return value != null
        && typeof value === "object"
        && isString(value.python)
        && isString(value.java);
}
// 判题用例必须包含名称、输入和期望输出
function isJudgeTestCase(value) {
    return value != null
        && typeof value === "object"
        && isString(value.name)
        && Object.prototype.hasOwnProperty.call(value, "input")
        && Object.prototype.hasOwnProperty.call(value, "expected");
}
// 运行时校验题目完整结构，防止损坏的 JSON 进入判题流程
function isQuestDefinition(value) {
    return value != null
        && typeof value === "object"
        && isString(value.id)
        && isString(value.title)
        && isString(value.difficulty)
        && isString(value.difficultyClass)
        && isString(value.category)
        && isString(value.acceptance)
        && isString(value.description)
        && isString(value.example)
        && isString(value.constraints)
        && (0, judgeCatalog_1.isQuestKind)(value.kind)
        && isStarterCodes(value.starterCodes)
        && isStarterCodes(value.referenceSolutions)
        && Array.isArray(value.visibleTests)
        && value.visibleTests.every(isJudgeTestCase)
        && Array.isArray(value.hiddenTests)
        && value.hiddenTests.every(isJudgeTestCase)
        && isString(value.bestApproach)
        && isString(value.referenceTitle)
        && isString(value.referenceNote);
}
//持久化题目进入系统前统一标准化
function normalizeQuest(value) {
    return cloneQuest(value);
}
// 启动时读取 quests.json，兼容旧格式和当前 { quests, deletedIds } 格式
function loadPersistedQuestStore() {
    try {
        if (!node_fs_1.default.existsSync(questStorePath)) {
            return { quests: {}, deletedIds: [] };
        }
        const raw = node_fs_1.default.readFileSync(questStorePath, "utf8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return { quests: {}, deletedIds: [] };
        }
        const questPayload = "quests" in parsed && parsed.quests && typeof parsed.quests === "object"
            ? parsed.quests
            : parsed;
        const deletedIds = Array.isArray(parsed.deletedIds)
            ? parsed.deletedIds
                .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
                .map((entry) => String(entry))
            : [];
        const entries = Object.entries(questPayload);
        const result = {};
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
    }
    catch (_error) {
        return { quests: {}, deletedIds: [] };
    }
}
// 每次新增、修改或删除题目后，把内存状态写回 quests.json
function persistQuestMap() {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(questStorePath), { recursive: true });
    node_fs_1.default.writeFileSync(questStorePath, JSON.stringify({
        quests: persistedQuestMap,
        deletedIds: Array.from(deletedQuestIds)
    }, null, 2), "utf8");
}
const loadedQuestStore = loadPersistedQuestStore();
let persistedQuestMap = loadedQuestStore.quests;
let deletedQuestIds = new Set(loadedQuestStore.deletedIds);
// 最终题库等于内置题库加后台覆盖题库，再移除后台删除标记
function mergedQuestMap() {
    const merged = {
        ...judgeCatalog_1.questCatalog,
        ...persistedQuestMap
    };
    deletedQuestIds.forEach((questId) => {
        delete merged[questId];
    });
    return merged;
}
// 后台保存题目前先做完整校验，避免无效题目破坏用户端和判题端
function validateQuestInput(candidate) {
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
function getQuestDefinition(questId) {
    return mergedQuestMap()[questId] ?? null;
}
// 后台题库管理使用完整题目列表
function listQuestDefinitions() {
    return Object.values(mergedQuestMap());
}
// 用户端目录只需要摘要字段，避免把参考答案和隐藏测试用例暴露出去
function listQuestSummaries() {
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
function upsertQuestDefinition(candidate) {
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
function deleteQuestDefinition(questId) {
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
