import fs from "node:fs";
import path from "node:path";
import { getDatabasePath } from "./db";
import type { JudgeLanguage } from "./judgeCatalog";
import type { JudgeResponse } from "./judgeService";

export type JudgeMode = "run" | "submit";
export type QueueJobStatus = "queued" | "running" | "completed" | "failed";

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

export type JudgeResourceLimits = {
  compileTimeoutMs: number;
  runTimeoutMs: number;
  maxOutputBufferKb: number;
  memoryLimitKb: number | null;
  maxConcurrentJobs: number;
  historySize: number;
  queueAlertThreshold: number;
};

export type JudgeSystemConfig = {
  languages: Record<JudgeLanguage, JudgeLanguageAdminConfig>;
  resourceLimits: JudgeResourceLimits;
  updatedAt: string;
};

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

const judgeConfigPath = path.join(path.dirname(getDatabasePath()), "judge-config.json");

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

function cloneConfig(config: JudgeSystemConfig): JudgeSystemConfig {
  return JSON.parse(JSON.stringify(config)) as JudgeSystemConfig;
}

function sanitizeCommand(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function sanitizePositiveNumber(value: unknown, fallback: number, min = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.round(parsed));
}

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

function sanitizeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeConfig(candidate: unknown): JudgeSystemConfig {
  const defaults = defaultJudgeSystemConfig();
  const source = candidate && typeof candidate === "object" ? (candidate as Partial<JudgeSystemConfig>) : {};
  const languages = source.languages && typeof source.languages === "object" ? source.languages : {};
  const limits = source.resourceLimits && typeof source.resourceLimits === "object" ? source.resourceLimits : {};

  return {
    languages: {
      python: {
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

function loadConfigFromDisk(): JudgeSystemConfig {
  try {
    if (!fs.existsSync(judgeConfigPath)) {
      return defaultJudgeSystemConfig();
    }

    const raw = fs.readFileSync(judgeConfigPath, "utf8");
    return sanitizeConfig(JSON.parse(raw));
  } catch (_error) {
    return defaultJudgeSystemConfig();
  }
}

function persistConfig(config: JudgeSystemConfig): void {
  fs.mkdirSync(path.dirname(judgeConfigPath), { recursive: true });
  fs.writeFileSync(judgeConfigPath, JSON.stringify(config, null, 2), "utf8");
}

let judgeSystemConfig = loadConfigFromDisk();

type QueueRecord = JudgeQueueJobSnapshot;

let activeJobs = 0;
let completedCount = 0;
let failedCount = 0;
let totalSubmitted = 0;
let nextJobId = 1;
const queueWaiters: Array<() => void> = [];
const recentJobs: QueueRecord[] = [];

function trimRecentJobs(): void {
  const maxItems = judgeSystemConfig.resourceLimits.historySize;
  while (recentJobs.length > maxItems) {
    recentJobs.pop();
  }
}

function addOrUpdateRecentJob(job: QueueRecord): void {
  const index = recentJobs.findIndex((entry) => entry.id === job.id);
  if (index >= 0) {
    recentJobs[index] = { ...job };
  } else {
    recentJobs.unshift({ ...job });
  }
  trimRecentJobs();
}

function scheduleQueuedJobs(): void {
  while (queueWaiters.length > 0 && activeJobs < judgeSystemConfig.resourceLimits.maxConcurrentJobs) {
    const waiter = queueWaiters.shift();
    if (waiter) {
      waiter();
    }
  }
}

export function getJudgeSystemConfig(): JudgeSystemConfig {
  return cloneConfig(judgeSystemConfig);
}

export function updateJudgeSystemConfig(candidate: unknown): JudgeSystemConfig {
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

export function getLanguageAdminConfig(language: JudgeLanguage): JudgeLanguageAdminConfig {
  return cloneConfig(judgeSystemConfig).languages[language];
}

export function getResourceLimits(): JudgeResourceLimits {
  return cloneConfig(judgeSystemConfig).resourceLimits;
}

export function buildCommand(template: string[], language: JudgeLanguage): string[] {
  const config = getLanguageAdminConfig(language);

  return template.map((segment) =>
    segment
      .replaceAll("{source}", config.sourceFileName)
      .replaceAll("{entry}", config.entryPoint)
  );
}

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
