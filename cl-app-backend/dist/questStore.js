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
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const judgeCatalog_1 = require("./judgeCatalog");
const questStorePath = node_path_1.default.join(node_path_1.default.dirname((0, db_1.getDatabasePath)()), "quests.json");
function cloneQuest(quest) {
    return JSON.parse(JSON.stringify(quest));
}
function isString(value) {
    return typeof value === "string";
}
function isStarterCodes(value) {
    return value != null
        && typeof value === "object"
        && isString(value.python)
        && isString(value.java);
}
function isJudgeTestCase(value) {
    return value != null
        && typeof value === "object"
        && isString(value.name)
        && Object.prototype.hasOwnProperty.call(value, "input")
        && Object.prototype.hasOwnProperty.call(value, "expected");
}
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
function normalizeQuest(value) {
    return cloneQuest(value);
}
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
function getQuestDefinition(questId) {
    return mergedQuestMap()[questId] ?? null;
}
function listQuestDefinitions() {
    return Object.values(mergedQuestMap());
}
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
