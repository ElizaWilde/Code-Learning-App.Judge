// 功能：管理判题系统配置和判题队列，包括语言 Docker 配置、资源限制、并发控制和队列快照
import fs from "node:fs";
import path from "node:path";
import { getDatabasePath } from "./db";
import type { JudgeLanguage } from "./judgeCatalog";
import type { JudgeResponse } from "./judgeService";

export type JudgeMode = "run" | "submit";
export type QueueJobStatus = "queued" | "running" | "completed" | "failed";

// 后台可编辑的单语言判题配置
export type JudgeLanguageAdminConfig = {
  enabled: boolean;
  label: string;
  dockerImage: string;
  sourceFileName: string;
  entryPoint: string;
  compileCommand: string[];
  runCommand: string[];
  notes: string;
};

// 后台可编辑的判题资源限制和队列参数
export type JudgeResourceLimits = {
  compileTimeoutMs: number;
  runTimeoutMs: number;
  maxOutputBufferKb: number;
  memoryLimitKb: number | null;
  maxConcurrentJobs: number;
  historySize: number;
  queueAlertThreshold: number;
};

// 完整判题系统配置，保存到 judge-config.json
export type JudgeSystemConfig = {
  languages: Record<JudgeLanguage, JudgeLanguageAdminConfig>;
  resourceLimits: JudgeResourceLimits;
  updatedAt: string;
};

// 后台队列面板展示的单个任务快照
export type JudgeQueueJobSnapshot = {
  id: string;
  questId: string;
  language: JudgeLanguage;
  mode: JudgeMode;
  status: QueueJobStatus;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  summary: string;
};

// 后台队列面板展示的整体队列统计
export type JudgeQueueSnapshot = {
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  totalSubmitted: number;
  maxConcurrentJobs: number;
  queueAlertThreshold: number;
  recentJobs: JudgeQueueJobSnapshot[];
};

// 判题配置和数据库放在同一数据目录，便于部署时迁移
const judgeConfigPath = path.join(path.dirname(getDatabasePath()), "judge-config.json");

// 默认判题配置，定义 Python/Java 的 Docker 镜像、编译命令、运行命令和资源限制
function defaultJudgeSystemConfig(): JudgeSystemConfig {
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
function cloneConfig(config: JudgeSystemConfig): JudgeSystemConfig {
  return JSON.parse(JSON.stringify(config)) as JudgeSystemConfig;
}

// 清洗后台传入的命令数组，去掉非字符串和空字符串
function sanitizeCommand(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

// 清洗正数配置项，非法值回退到默认值
function sanitizePositiveNumber(value: unknown, fallback: number, min = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.round(parsed));
}

// 内存限制允许为空，表示不额外设置 Docker memory 参数
function sanitizeNullableNumber(value: unknown): number | null {
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
function sanitizeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

// 后台保存配置前统一清洗，避免无效配置破坏判题流程
function sanitizeConfig(candidate: unknown): JudgeSystemConfig {
  const defaults = defaultJudgeSystemConfig();
  const source = candidate && typeof candidate === "object" ? (candidate as Partial<JudgeSystemConfig>) : {};
  const languages = source.languages && typeof source.languages === "object" ? source.languages : {};
  const limits = source.resourceLimits && typeof source.resourceLimits === "object" ? source.resourceLimits : {};

  return {
    languages: {
      python: {
        // 后台传入的字段逐项清洗，缺失或非法时回退默认配置
        enabled: Boolean((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.enabled ?? defaults.languages.python.enabled),
        label: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.label, defaults.languages.python.label),
        dockerImage: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.dockerImage, defaults.languages.python.dockerImage),
        sourceFileName: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.sourceFileName, defaults.languages.python.sourceFileName),
        entryPoint: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.entryPoint, defaults.languages.python.entryPoint),
        compileCommand: sanitizeCommand((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.compileCommand),
        runCommand: sanitizeCommand((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.runCommand).length > 0
          ? sanitizeCommand((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.runCommand)
          : defaults.languages.python.runCommand,
        notes: typeof (languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.notes === "string"
          ? (languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).python?.notes ?? defaults.languages.python.notes
          : defaults.languages.python.notes
      },
      java: {
        // Java 同样逐项清洗，避免错误配置直接破坏判题流程
        enabled: Boolean((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.enabled ?? defaults.languages.java.enabled),
        label: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.label, defaults.languages.java.label),
        dockerImage: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.dockerImage, defaults.languages.java.dockerImage),
        sourceFileName: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.sourceFileName, defaults.languages.java.sourceFileName),
        entryPoint: sanitizeString((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.entryPoint, defaults.languages.java.entryPoint),
        compileCommand: sanitizeCommand((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.compileCommand),
        runCommand: sanitizeCommand((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.runCommand).length > 0
          ? sanitizeCommand((languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.runCommand)
          : defaults.languages.java.runCommand,
        notes: typeof (languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.notes === "string"
          ? (languages as Partial<Record<JudgeLanguage, JudgeLanguageAdminConfig>>).java?.notes ?? defaults.languages.java.notes
          : defaults.languages.java.notes
      }
    },
    resourceLimits: {
      compileTimeoutMs: sanitizePositiveNumber((limits as Partial<JudgeResourceLimits>).compileTimeoutMs, defaults.resourceLimits.compileTimeoutMs, 100),
      runTimeoutMs: sanitizePositiveNumber((limits as Partial<JudgeResourceLimits>).runTimeoutMs, defaults.resourceLimits.runTimeoutMs, 100),
      maxOutputBufferKb: sanitizePositiveNumber((limits as Partial<JudgeResourceLimits>).maxOutputBufferKb, defaults.resourceLimits.maxOutputBufferKb, 128),
      memoryLimitKb: sanitizeNullableNumber((limits as Partial<JudgeResourceLimits>).memoryLimitKb),
      maxConcurrentJobs: sanitizePositiveNumber((limits as Partial<JudgeResourceLimits>).maxConcurrentJobs, defaults.resourceLimits.maxConcurrentJobs, 1),
      historySize: sanitizePositiveNumber((limits as Partial<JudgeResourceLimits>).historySize, defaults.resourceLimits.historySize, 1),
      queueAlertThreshold: sanitizePositiveNumber((limits as Partial<JudgeResourceLimits>).queueAlertThreshold, defaults.resourceLimits.queueAlertThreshold, 1)
    },
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim().length > 0
      ? source.updatedAt
      : defaults.updatedAt
  };
}

// 启动时读取 judge-config.json，读取失败则使用默认配置
function loadConfigFromDisk(): JudgeSystemConfig {
  try {
    if (!fs.existsSync(judgeConfigPath)) {
      // 首次启动没有配置文件时使用内置默认配置
      return defaultJudgeSystemConfig();
    }

    const raw = fs.readFileSync(judgeConfigPath, "utf8");
    // 读取后仍然走 sanitizeConfig，兼容旧配置或手工修改的文件
    return sanitizeConfig(JSON.parse(raw));
  } catch (_error) {
    // 配置文件损坏时回退默认值，避免后端启动失败
    return defaultJudgeSystemConfig();
  }
}

// 保存后台维护后的判题配置
function persistConfig(config: JudgeSystemConfig): void {
  fs.mkdirSync(path.dirname(judgeConfigPath), { recursive: true });
  fs.writeFileSync(judgeConfigPath, JSON.stringify(config, null, 2), "utf8");
}

// 当前内存中的判题系统配置
let judgeSystemConfig = loadConfigFromDisk();

type QueueRecord = JudgeQueueJobSnapshot;

// 以下状态用于内存队列统计，服务重启后会重新计数
let activeJobs = 0;
let completedCount = 0;
let failedCount = 0;
let totalSubmitted = 0;
let nextJobId = 1;
const queueWaiters: Array<() => void> = [];
const recentJobs: QueueRecord[] = [];

// 控制最近任务历史长度，避免内存列表无限增长
function trimRecentJobs(): void {
  const maxItems = judgeSystemConfig.resourceLimits.historySize;
  while (recentJobs.length > maxItems) {
    recentJobs.pop();
  }
}

// 新任务入队或状态变化时更新最近任务列表
function addOrUpdateRecentJob(job: QueueRecord): void {
  const index = recentJobs.findIndex((entry) => entry.id === job.id);
  if (index >= 0) {
    recentJobs[index] = { ...job };
  } else {
    recentJobs.unshift({ ...job });
  }
  trimRecentJobs();
}

// 有空闲并发名额时唤醒排队中的判题任务
function scheduleQueuedJobs(): void {
  while (queueWaiters.length > 0 && activeJobs < judgeSystemConfig.resourceLimits.maxConcurrentJobs) {
    const waiter = queueWaiters.shift();
    if (waiter) {
      // 唤醒一个等待任务，由任务自身进入 running 状态
      waiter();
    }
  }
}

// 后台读取当前判题配置
export function getJudgeSystemConfig(): JudgeSystemConfig {
  return cloneConfig(judgeSystemConfig);
}

// 后台更新判题配置，保存后立即影响后续判题任务
export function updateJudgeSystemConfig(candidate: unknown): JudgeSystemConfig {
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
export function getLanguageAdminConfig(language: JudgeLanguage): JudgeLanguageAdminConfig {
  return cloneConfig(judgeSystemConfig).languages[language];
}

// 判题服务读取超时、内存、输出和并发限制
export function getResourceLimits(): JudgeResourceLimits {
  return cloneConfig(judgeSystemConfig).resourceLimits;
}

// 把命令模板中的 {source} 和 {entry} 替换为当前语言配置
export function buildCommand(template: string[], language: JudgeLanguage): string[] {
  const config = getLanguageAdminConfig(language);

  // 命令模板由后台维护，运行时替换为当前语言对应的源码文件和入口名
  return template.map((segment) =>
    segment
      .replaceAll("{source}", config.sourceFileName)
      .replaceAll("{entry}", config.entryPoint)
  );
}

// 后台读取判题队列统计和最近任务历史
export function getJudgeQueueSnapshot(): JudgeQueueSnapshot {
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
export async function enqueueJudgeJob(
  questId: string,
  language: JudgeLanguage,
  mode: JudgeMode,
  runJob: () => Promise<JudgeResponse>
): Promise<JudgeResponse> {
  const job: QueueRecord = {
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

  const startJob = async (resolve: (value: JudgeResponse) => void, reject: (reason?: unknown) => void) => {
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
      } else {
        failedCount += 1;
      }

      addOrUpdateRecentJob(job);
      resolve(result);
    } catch (error) {
      job.finishedAt = new Date().toISOString();
      job.durationMs = Date.now() - startedAt;
      job.summary = error instanceof Error ? error.message : "Judge execution failed";
      job.status = "failed";
      failedCount += 1;
      addOrUpdateRecentJob(job);
      reject(error);
    } finally {
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
