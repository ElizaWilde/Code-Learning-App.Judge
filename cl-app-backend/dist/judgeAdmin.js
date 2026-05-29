"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJudgeSystemConfig = getJudgeSystemConfig;
exports.updateJudgeSystemConfig = updateJudgeSystemConfig;
exports.getLanguageAdminConfig = getLanguageAdminConfig;
exports.getResourceLimits = getResourceLimits;
exports.buildCommand = buildCommand;
exports.getJudgeQueueSnapshot = getJudgeQueueSnapshot;
exports.enqueueJudgeJob = enqueueJudgeJob;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const judgeConfigPath = node_path_1.default.join(node_path_1.default.dirname((0, db_1.getDatabasePath)()), "judge-config.json");
function defaultJudgeSystemConfig() {
    return {
        languages: {
            python: {
                enabled: true,
                label: "Python",
                dockerImage: "python:3.12-alpine",
                sourceFileName: "main.py",
                entryPoint: "main.py",
                compileCommand: [],
                runCommand: ["python3", "{source}"],
                notes: "Run each submission in an isolated Docker container."
            },
            java: {
                enabled: true,
                label: "Java",
                dockerImage: "eclipse-temurin:21-jdk-alpine",
                sourceFileName: "Main.java",
                entryPoint: "Main",
                compileCommand: ["javac", "{source}"],
                runCommand: ["java", "{entry}"],
                notes: "Compile and run each submission in an isolated Docker container."
            }
        },
        resourceLimits: {
            compileTimeoutMs: 8000,
            runTimeoutMs: 3000,
            maxOutputBufferKb: 10240,
            memoryLimitKb: 524288,
            maxConcurrentJobs: 2,
            historySize: 20,
            queueAlertThreshold: 3
        },
        updatedAt: new Date().toISOString()
    };
}
function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config));
}
function sanitizeCommand(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0);
}
function sanitizePositiveNumber(value, fallback, min = 1) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.round(parsed));
}
function sanitizeNullableNumber(value) {
    if (value === null || value === "" || value === undefined) {
        return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return Math.max(1, Math.round(parsed));
}
function sanitizeString(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}
function sanitizeConfig(candidate) {
    const defaults = defaultJudgeSystemConfig();
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const languages = source.languages && typeof source.languages === "object" ? source.languages : {};
    const limits = source.resourceLimits && typeof source.resourceLimits === "object" ? source.resourceLimits : {};
    return {
        languages: {
            python: {
                enabled: Boolean(languages.python?.enabled ?? defaults.languages.python.enabled),
                label: sanitizeString(languages.python?.label, defaults.languages.python.label),
                dockerImage: sanitizeString(languages.python?.dockerImage, defaults.languages.python.dockerImage),
                sourceFileName: sanitizeString(languages.python?.sourceFileName, defaults.languages.python.sourceFileName),
                entryPoint: sanitizeString(languages.python?.entryPoint, defaults.languages.python.entryPoint),
                compileCommand: sanitizeCommand(languages.python?.compileCommand),
                runCommand: sanitizeCommand(languages.python?.runCommand).length > 0
                    ? sanitizeCommand(languages.python?.runCommand)
                    : defaults.languages.python.runCommand,
                notes: typeof languages.python?.notes === "string"
                    ? languages.python?.notes ?? defaults.languages.python.notes
                    : defaults.languages.python.notes
            },
            java: {
                enabled: Boolean(languages.java?.enabled ?? defaults.languages.java.enabled),
                label: sanitizeString(languages.java?.label, defaults.languages.java.label),
                dockerImage: sanitizeString(languages.java?.dockerImage, defaults.languages.java.dockerImage),
                sourceFileName: sanitizeString(languages.java?.sourceFileName, defaults.languages.java.sourceFileName),
                entryPoint: sanitizeString(languages.java?.entryPoint, defaults.languages.java.entryPoint),
                compileCommand: sanitizeCommand(languages.java?.compileCommand),
                runCommand: sanitizeCommand(languages.java?.runCommand).length > 0
                    ? sanitizeCommand(languages.java?.runCommand)
                    : defaults.languages.java.runCommand,
                notes: typeof languages.java?.notes === "string"
                    ? languages.java?.notes ?? defaults.languages.java.notes
                    : defaults.languages.java.notes
            }
        },
        resourceLimits: {
            compileTimeoutMs: sanitizePositiveNumber(limits.compileTimeoutMs, defaults.resourceLimits.compileTimeoutMs, 100),
            runTimeoutMs: sanitizePositiveNumber(limits.runTimeoutMs, defaults.resourceLimits.runTimeoutMs, 100),
            maxOutputBufferKb: sanitizePositiveNumber(limits.maxOutputBufferKb, defaults.resourceLimits.maxOutputBufferKb, 128),
            memoryLimitKb: sanitizeNullableNumber(limits.memoryLimitKb),
            maxConcurrentJobs: sanitizePositiveNumber(limits.maxConcurrentJobs, defaults.resourceLimits.maxConcurrentJobs, 1),
            historySize: sanitizePositiveNumber(limits.historySize, defaults.resourceLimits.historySize, 1),
            queueAlertThreshold: sanitizePositiveNumber(limits.queueAlertThreshold, defaults.resourceLimits.queueAlertThreshold, 1)
        },
        updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim().length > 0
            ? source.updatedAt
            : defaults.updatedAt
    };
}
function loadConfigFromDisk() {
    try {
        if (!node_fs_1.default.existsSync(judgeConfigPath)) {
            return defaultJudgeSystemConfig();
        }
        const raw = node_fs_1.default.readFileSync(judgeConfigPath, "utf8");
        return sanitizeConfig(JSON.parse(raw));
    }
    catch (_error) {
        return defaultJudgeSystemConfig();
    }
}
function persistConfig(config) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(judgeConfigPath), { recursive: true });
    node_fs_1.default.writeFileSync(judgeConfigPath, JSON.stringify(config, null, 2), "utf8");
}
let judgeSystemConfig = loadConfigFromDisk();
let activeJobs = 0;
let completedCount = 0;
let failedCount = 0;
let totalSubmitted = 0;
let nextJobId = 1;
const queueWaiters = [];
const recentJobs = [];
function trimRecentJobs() {
    const maxItems = judgeSystemConfig.resourceLimits.historySize;
    while (recentJobs.length > maxItems) {
        recentJobs.pop();
    }
}
function addOrUpdateRecentJob(job) {
    const index = recentJobs.findIndex((entry) => entry.id === job.id);
    if (index >= 0) {
        recentJobs[index] = { ...job };
    }
    else {
        recentJobs.unshift({ ...job });
    }
    trimRecentJobs();
}
function scheduleQueuedJobs() {
    while (queueWaiters.length > 0 && activeJobs < judgeSystemConfig.resourceLimits.maxConcurrentJobs) {
        const waiter = queueWaiters.shift();
        if (waiter) {
            waiter();
        }
    }
}
function getJudgeSystemConfig() {
    return cloneConfig(judgeSystemConfig);
}
function updateJudgeSystemConfig(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    judgeSystemConfig = sanitizeConfig({
        ...source,
        updatedAt: new Date().toISOString()
    });
    persistConfig(judgeSystemConfig);
    trimRecentJobs();
    scheduleQueuedJobs();
    return getJudgeSystemConfig();
}
function getLanguageAdminConfig(language) {
    return cloneConfig(judgeSystemConfig).languages[language];
}
function getResourceLimits() {
    return cloneConfig(judgeSystemConfig).resourceLimits;
}
function buildCommand(template, language) {
    const config = getLanguageAdminConfig(language);
    return template.map((segment) => segment
        .replaceAll("{source}", config.sourceFileName)
        .replaceAll("{entry}", config.entryPoint));
}
function getJudgeQueueSnapshot() {
    return {
        activeCount: activeJobs,
        queuedCount: queueWaiters.length,
        completedCount,
        failedCount,
        totalSubmitted,
        maxConcurrentJobs: judgeSystemConfig.resourceLimits.maxConcurrentJobs,
        queueAlertThreshold: judgeSystemConfig.resourceLimits.queueAlertThreshold,
        recentJobs: recentJobs.map((job) => ({ ...job }))
    };
}
async function enqueueJudgeJob(questId, language, mode, runJob) {
    const job = {
        id: `job-${nextJobId++}`,
        questId,
        language,
        mode,
        status: "queued",
        queuedAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        summary: "Queued"
    };
    totalSubmitted += 1;
    addOrUpdateRecentJob(job);
    const startJob = async (resolve, reject) => {
        activeJobs += 1;
        job.status = "running";
        job.startedAt = new Date().toISOString();
        job.summary = "Running";
        addOrUpdateRecentJob(job);
        const startedAt = Date.now();
        try {
            const result = await runJob();
            job.finishedAt = new Date().toISOString();
            job.durationMs = Date.now() - startedAt;
            job.summary = result.summary;
            job.status = result.status === "accepted" ? "completed" : "failed";
            if (job.status === "completed") {
                completedCount += 1;
            }
            else {
                failedCount += 1;
            }
            addOrUpdateRecentJob(job);
            resolve(result);
        }
        catch (error) {
            job.finishedAt = new Date().toISOString();
            job.durationMs = Date.now() - startedAt;
            job.summary = error instanceof Error ? error.message : "Judge execution failed";
            job.status = "failed";
            failedCount += 1;
            addOrUpdateRecentJob(job);
            reject(error);
        }
        finally {
            activeJobs -= 1;
            scheduleQueuedJobs();
        }
    };
    return new Promise((resolve, reject) => {
        const runner = () => {
            void startJob(resolve, reject);
        };
        if (activeJobs < judgeSystemConfig.resourceLimits.maxConcurrentJobs) {
            runner();
            return;
        }
        queueWaiters.push(runner);
        addOrUpdateRecentJob(job);
    });
}
