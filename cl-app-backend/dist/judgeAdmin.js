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
// 功能：管理判题系统配置和判题队列，包括语言 Docker 配置、资源限制、并发控制和队列快照
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
// 判题配置和数据库放在同一数据目录，便于部署时迁移
const judgeConfigPath = node_path_1.default.join(node_path_1.default.dirname((0, db_1.getDatabasePath)()), "judge-config.json");
// 默认判题配置，定义 Python/Java 的 Docker 镜像、编译命令、运行命令和资源限制
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
// 返回配置副本，避免调用方直接修改内存中的全局配置
function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config));
}
// 清洗后台传入的命令数组，去掉非字符串和空字符串
function sanitizeCommand(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0);
}
// 清洗正数配置项，非法值回退到默认值
function sanitizePositiveNumber(value, fallback, min = 1) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.round(parsed));
}
// 内存限制允许为空，表示不额外设置 Docker memory 参数
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
// 字符串配置为空或非法时回退到默认值
function sanitizeString(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}
// 后台保存配置前统一清洗，避免无效配置破坏判题流程
function sanitizeConfig(candidate) {
    const defaults = defaultJudgeSystemConfig();
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const languages = source.languages && typeof source.languages === "object" ? source.languages : {};
    const limits = source.resourceLimits && typeof source.resourceLimits === "object" ? source.resourceLimits : {};
    return {
        languages: {
            python: {
                // 后台传入的字段逐项清洗，缺失或非法时回退默认配置
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
                // Java 同样逐项清洗，避免错误配置直接破坏判题流程
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
// 启动时读取 judge-config.json，读取失败则使用默认配置
function loadConfigFromDisk() {
    try {
        if (!node_fs_1.default.existsSync(judgeConfigPath)) {
            // 首次启动没有配置文件时使用内置默认配置
            return defaultJudgeSystemConfig();
        }
        const raw = node_fs_1.default.readFileSync(judgeConfigPath, "utf8");
        // 读取后仍然走 sanitizeConfig，兼容旧配置或手工修改的文件
        return sanitizeConfig(JSON.parse(raw));
    }
    catch (_error) {
        // 配置文件损坏时回退默认值，避免后端启动失败
        return defaultJudgeSystemConfig();
    }
}
// 保存后台维护后的判题配置
function persistConfig(config) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(judgeConfigPath), { recursive: true });
    node_fs_1.default.writeFileSync(judgeConfigPath, JSON.stringify(config, null, 2), "utf8");
}
// 当前内存中的判题系统配置
let judgeSystemConfig = loadConfigFromDisk();
// 以下状态用于内存队列统计，服务重启后会重新计数
let activeJobs = 0;
let completedCount = 0;
let failedCount = 0;
let totalSubmitted = 0;
let nextJobId = 1;
const queueWaiters = [];
const recentJobs = [];
// 控制最近任务历史长度，避免内存列表无限增长
function trimRecentJobs() {
    const maxItems = judgeSystemConfig.resourceLimits.historySize;
    while (recentJobs.length > maxItems) {
        recentJobs.pop();
    }
}
// 新任务入队或状态变化时更新最近任务列表
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
// 有空闲并发名额时唤醒排队中的判题任务
function scheduleQueuedJobs() {
    while (queueWaiters.length > 0 && activeJobs < judgeSystemConfig.resourceLimits.maxConcurrentJobs) {
        const waiter = queueWaiters.shift();
        if (waiter) {
            // 唤醒一个等待任务，由任务自身进入 running 状态
            waiter();
        }
    }
}
// 后台读取当前判题配置
function getJudgeSystemConfig() {
    return cloneConfig(judgeSystemConfig);
}
// 后台更新判题配置，保存后立即影响后续判题任务
function updateJudgeSystemConfig(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    judgeSystemConfig = sanitizeConfig({
        ...source,
        // 每次后台保存配置都会刷新更新时间，前端用它提示当前配置版本
        updatedAt: new Date().toISOString()
    });
    persistConfig(judgeSystemConfig);
    // historySize 或并发数变化后立即修剪历史并尝试释放排队任务
    trimRecentJobs();
    scheduleQueuedJobs();
    return getJudgeSystemConfig();
}
// 判题服务按语言读取 Docker 镜像和命令配置
function getLanguageAdminConfig(language) {
    return cloneConfig(judgeSystemConfig).languages[language];
}
// 判题服务读取超时、内存、输出和并发限制
function getResourceLimits() {
    return cloneConfig(judgeSystemConfig).resourceLimits;
}
// 把命令模板中的 {source} 和 {entry} 替换为当前语言配置
function buildCommand(template, language) {
    const config = getLanguageAdminConfig(language);
    // 命令模板由后台维护，运行时替换为当前语言对应的源码文件和入口名
    return template.map((segment) => segment
        .replaceAll("{source}", config.sourceFileName)
        .replaceAll("{entry}", config.entryPoint));
}
// 后台读取判题队列统计和最近任务历史
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
// 判题任务统一进入队列，按照 maxConcurrentJobs 控制并发执行
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
        // 真正开始执行时才占用并发名额
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
                // accepted 计入 completed，否则进入 failed，供后台队列面板统计
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
            // 任务结束释放并发名额，并尝试唤醒下一个排队任务
            activeJobs -= 1;
            scheduleQueuedJobs();
        }
    };
    return new Promise((resolve, reject) => {
        const runner = () => {
            void startJob(resolve, reject);
        };
        if (activeJobs < judgeSystemConfig.resourceLimits.maxConcurrentJobs) {
            // 有空闲并发名额时立即执行
            runner();
            return;
        }
        // 并发已满时进入等待队列，后台可看到 queued 状态
        queueWaiters.push(runner);
        addOrUpdateRecentJob(job);
    });
}
