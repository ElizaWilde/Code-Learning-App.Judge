"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordUserActivity = recordUserActivity;
exports.recordQuestSubmission = recordQuestSubmission;
exports.upsertWrongAnswerSnapshot = upsertWrongAnswerSnapshot;
exports.getAnalyticsDashboard = getAnalyticsDashboard;
// 功能：管理学习数据统计表，记录用户行为、判题提交、错题快照，并生成后台分析看板数据
const db_1 = require("./db");
const DEFAULT_ANALYTICS_DAYS = 14;
// 学习模块目录用于补全错题分布，即使某模块暂无错题也能在看板中出现
const learningModuleCatalog = [
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-syntax", moduleTitle: "Syntax and Data Types" },
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-functions", moduleTitle: "Functions and Control Flow" },
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-async", moduleTitle: "Async JavaScript" },
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-dom", moduleTitle: "DOM and Debugging" },
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-syntax-practice", moduleTitle: "Syntax and Data Types Quiz" },
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-functions-practice", moduleTitle: "Functions and Control Flow Quiz" },
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-async-practice", moduleTitle: "Async JavaScript Quiz" },
    { pathId: "javascript", pathTitle: "JavaScript", moduleId: "javascript-dom-practice", moduleTitle: "DOM and Debugging Quiz" },
    { pathId: "java", pathTitle: "Java", moduleId: "java-syntax", moduleTitle: "Java Syntax Fundamentals" },
    { pathId: "java", pathTitle: "Java", moduleId: "java-oop", moduleTitle: "Object-Oriented Programming" },
    { pathId: "java", pathTitle: "Java", moduleId: "java-collections", moduleTitle: "Collections and Exceptions" },
    { pathId: "java", pathTitle: "Java", moduleId: "java-backend", moduleTitle: "Java for Backend Apps" },
    { pathId: "postgresql-redis", pathTitle: "PostgreSQL and Redis", moduleId: "postgres-fundamentals", moduleTitle: "PostgreSQL Fundamentals" },
    { pathId: "postgresql-redis", pathTitle: "PostgreSQL and Redis", moduleId: "postgres-relations", moduleTitle: "Relations and Indexes" },
    { pathId: "postgresql-redis", pathTitle: "PostgreSQL and Redis", moduleId: "redis-basics", moduleTitle: "Redis Basics" },
    { pathId: "postgresql-redis", pathTitle: "PostgreSQL and Redis", moduleId: "postgres-redis", moduleTitle: "PostgreSQL Plus Redis Together" },
    { pathId: "ai-basics", pathTitle: "AI Basic Knowledge", moduleId: "ai-basics", moduleTitle: "AI and Machine Learning Basics" },
    { pathId: "ai-basics", pathTitle: "AI Basic Knowledge", moduleId: "llm-workings", moduleTitle: "How Large Language Models Work" },
    { pathId: "ai-basics", pathTitle: "AI Basic Knowledge", moduleId: "prompting-eval", moduleTitle: "Prompting and Evaluation" },
    { pathId: "ai-basics", pathTitle: "AI Basic Knowledge", moduleId: "ai-safety", moduleTitle: "Safety and Practical Workflows" }
];
// 初始化学习分析相关表：行为事件、判题提交事件、错题快照
db_1.db.exec(`
  CREATE TABLE IF NOT EXISTS analytics_activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analytics_submission_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    status TEXT NOT NULL,
    event_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analytics_wrong_answer_snapshots (
    username TEXT NOT NULL,
    path_id TEXT NOT NULL,
    path_title TEXT NOT NULL,
    module_id TEXT NOT NULL,
    module_title TEXT NOT NULL,
    wrong_count INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (username, module_id)
  );
`);
// 把日期格式化成 YYYY-MM-DD，便于按天聚合统计
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function todayKey() {
    return formatDateKey(new Date());
}
// 未登录或空用户名统一归为 guest，避免统计写入空字符串
function trimUsername(username) {
    const normalized = username.trim();
    return normalized.length > 0 ? normalized : "guest";
}
// 记录用户行为事件，例如 login、judge_run、judge_submit、wrong_answer_sync
function recordUserActivity(username, eventType, eventDate = todayKey()) {
    db_1.db.prepare(`
    INSERT INTO analytics_activity_events (username, event_type, event_date, created_at)
    VALUES (?, ?, ?, ?)
  `).run(trimUsername(username), eventType, eventDate, new Date().toISOString());
}
// 记录代码提交结果，用于计算提交量和通过率
function recordQuestSubmission(username, questId, status, eventDate = todayKey()) {
    db_1.db.prepare(`
    INSERT INTO analytics_submission_events (username, quest_id, status, event_date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(trimUsername(username), questId, status, eventDate, new Date().toISOString());
}
// 同步某个用户在某个学习模块下的错题数量，重复同步时覆盖旧快照
function upsertWrongAnswerSnapshot(input) {
    const username = trimUsername(input.username);
    const wrongCount = Math.max(0, Math.round(input.wrongCount));
    db_1.db.prepare(`
    INSERT INTO analytics_wrong_answer_snapshots (
      username, path_id, path_title, module_id, module_title, wrong_count, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username, module_id) DO UPDATE SET
      path_id = excluded.path_id,
      path_title = excluded.path_title,
      module_title = excluded.module_title,
      wrong_count = excluded.wrong_count,
      updated_at = excluded.updated_at
  `).run(username, input.pathId, input.pathTitle, input.moduleId, input.moduleTitle, wrongCount, new Date().toISOString());
    recordUserActivity(username, "wrong_answer_sync");
}
// 构造最近 N 天的日期窗口，保证没有数据的日期也能返回 0
function buildDateWindow(days) {
    const output = [];
    const today = new Date();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        output.push(formatDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)));
    }
    return output;
}
// 聚合后台学习数据看板，包括 DAU、提交量、通过率和错题分布
function getAnalyticsDashboard(days = DEFAULT_ANALYTICS_DAYS) {
    const normalizedDays = Math.max(1, Math.min(60, Math.round(days)));
    const dateWindow = buildDateWindow(normalizedDays);
    const startDate = dateWindow[0];
    // DAU 按天统计去重用户名
    const dauRows = db_1.db.prepare(`
    SELECT event_date, COUNT(DISTINCT username) AS value
    FROM analytics_activity_events
    WHERE event_date >= ?
    GROUP BY event_date
    ORDER BY event_date ASC
  `).all(startDate);
    // 提交量和 accepted 数量在同一条 SQL 里聚合，后续用于计算通过率
    const submissionRows = db_1.db.prepare(`
    SELECT event_date, COUNT(*) AS total,
           SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted
    FROM analytics_submission_events
    WHERE event_date >= ?
    GROUP BY event_date
    ORDER BY event_date ASC
  `).all(startDate);
    const dauMap = new Map(dauRows.map((row) => [row.event_date, Number(row.value || 0)]));
    const submissionMap = new Map(submissionRows.map((row) => [row.event_date, {
            total: Number(row.total || 0),
            accepted: Number(row.accepted || 0)
        }]));
    const dauSeries = dateWindow.map((date) => ({
        date,
        value: dauMap.get(date) ?? 0
    }));
    const submissionSeries = dateWindow.map((date) => ({
        date,
        value: submissionMap.get(date)?.total ?? 0
    }));
    const passRateSeries = dateWindow.map((date) => {
        const totals = submissionMap.get(date) ?? { total: 0, accepted: 0 };
        return {
            date,
            value: totals.total === 0 ? 0 : Number(((totals.accepted / totals.total) * 100).toFixed(1))
        };
    });
    // 错题快照按模块聚合，再映射回学习路径
    const distributionRows = db_1.db.prepare(`
    SELECT module_id, module_title, path_id, path_title, SUM(wrong_count) AS total
    FROM analytics_wrong_answer_snapshots
    GROUP BY module_id, module_title, path_id, path_title
  `).all();
    const distributionMap = new Map(distributionRows.map((row) => [row.module_id, Number(row.total || 0)]));
    const catalogModuleIds = new Set(learningModuleCatalog.map((module) => module.moduleId));
    const moduleDistribution = learningModuleCatalog.map((module) => ({
        moduleId: module.moduleId,
        moduleTitle: module.moduleTitle,
        pathId: module.pathId,
        pathTitle: module.pathTitle,
        wrongCount: distributionMap.get(module.moduleId) ?? 0
    }));
    // 如果数据库里出现目录外模块，也保留到看板结果中，避免数据被静默丢弃
    distributionRows.forEach((row) => {
        if (catalogModuleIds.has(row.module_id)) {
            return;
        }
        moduleDistribution.push({
            moduleId: row.module_id,
            moduleTitle: row.module_title,
            pathId: row.path_id,
            pathTitle: row.path_title,
            wrongCount: Number(row.total || 0)
        });
    });
    // 把模块级错题数量汇总成学习路径级分布
    const pathTotals = new Map();
    moduleDistribution.forEach((item) => {
        const existing = pathTotals.get(item.pathId);
        if (existing) {
            existing.wrongCount += item.wrongCount;
            return;
        }
        pathTotals.set(item.pathId, {
            pathId: item.pathId,
            pathTitle: item.pathTitle,
            wrongCount: item.wrongCount
        });
    });
    const wrongAnswerDistribution = Array.from(pathTotals.values()).sort((left, right) => left.pathTitle.localeCompare(right.pathTitle));
    return {
        windowDays: normalizedDays,
        dau: dauSeries,
        submissionVolume: submissionSeries,
        passRate: passRateSeries,
        wrongAnswerDistribution
    };
}
