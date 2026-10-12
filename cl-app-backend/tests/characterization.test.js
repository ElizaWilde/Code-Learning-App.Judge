const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { after, before, test } = require("node:test");

const backendRoot = path.resolve(__dirname, "..");
const fixtureDatabasePath = path.join(backendRoot, "data-runtime-clean", "app.db");
const representativeSubmissions = require("./fixtures/representative-submissions.json");

let runtimeDirectory;
let databasePath;
let server;
let baseUrl;
let db;
let adminToken;
let userToken;
let registeredUsername;
let legacyUsers;
const judgeCalls = [];

function fakeJudgeResponse(mode) {
  const totalCount = mode === "run" ? 2 : 4;
  return {
    status: "accepted",
    errorType: "none",
    errorHint: "All test cases passed.",
    summary: "Accepted",
    logs: [],
    runtimeMs: 1,
    memoryKb: null,
    memoryNote: "Not measured by the characterization stub.",
    score: 100,
    passedCount: totalCount,
    totalCount,
    bestApproach: "Characterization fixture",
    referenceTitle: "Characterization fixture",
    referenceNote: "Execution is covered separately by the Docker integration suite."
  };
}

async function api(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text.length > 0 ? JSON.parse(text) : null
  };
}

before(async () => {
  runtimeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "cl-app-characterization-"));
  databasePath = path.join(runtimeDirectory, "legacy-app.db");
  fs.copyFileSync(fixtureDatabasePath, databasePath);

  const legacyDatabase = new DatabaseSync(databasePath);
  legacyDatabase.prepare(`
    INSERT INTO users (username, password_hash, role, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    "legacy-fixture-user",
    "legacy-password-hash-format",
    "user",
    "2026-01-01T00:00:00.000Z"
  );
  legacyUsers = legacyDatabase.prepare(`
    SELECT username, role, created_at
    FROM users
    ORDER BY username COLLATE NOCASE
  `).all().map((user) => ({ ...user }));
  legacyDatabase.close();

  process.env.CODE_LEARNING_APP_DATABASE_PATH = databasePath;
  process.env.CODEBOX_JWT_SECRET = "characterization-jwt-secret-at-least-32-characters";
  process.env.CODEBOX_ADMIN_USERNAME = "characterization-admin";
  process.env.CODEBOX_ADMIN_PASSWORD = "CharacterizationAdminPassword!";
  process.env.CODEBOX_JUDGE_RATE_LIMIT_MAX_REQUESTS = "100";

  // Stub only the untrusted execution boundary. The real routing, queue,
  // authentication, persistence, and analytics code remains active.
  const judgeService = require("../dist/judgeService");
  judgeService.judgeSubmission = async (questId, language, code, mode) => {
    judgeCalls.push({ questId, language, code, mode });
    return fakeJudgeResponse(mode);
  };

  const databaseModule = require("../dist/db");
  db = databaseModule.db;
  const { app } = require("../dist/server");

  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (db) {
    db.close();
  }
  if (runtimeDirectory) {
    fs.rmSync(runtimeDirectory, { recursive: true, force: true });
  }
});

test("existing SQLite snapshot is upgraded without losing its user schema", () => {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);

  assert.deepEqual(tables, [
    "analytics_activity_events",
    "analytics_submission_events",
    "analytics_wrong_answer_snapshots",
    "users"
  ]);

  const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
  // The checked-in legacy schema receives user_type through ALTER TABLE, so it
  // is intentionally appended after the original created_at column.
  assert.deepEqual(userColumns, ["id", "username", "password_hash", "role", "created_at", "user_type"]);
  assert.equal(legacyUsers.length > 0, true);
  const upgradedUsers = db.prepare(`
    SELECT username, role, created_at
    FROM users
    ORDER BY username COLLATE NOCASE
  `).all().map((user) => ({ ...user }));
  for (const legacyUser of legacyUsers) {
    assert.equal(
      upgradedUsers.some((user) =>
        user.username === legacyUser.username
        && user.role === legacyUser.role
        && user.created_at === legacyUser.created_at
      ),
      true,
      `legacy user ${legacyUser.username} should survive startup migration`
    );
  }
});

test("authentication issues tokens and server-side roles protect admin APIs", async () => {
  const invalidLogin = await api("/api/auth/login", {
    method: "POST",
    body: { username: "characterization-admin", password: "wrong-password" }
  });
  assert.equal(invalidLogin.status, 401);

  const adminLogin = await api("/api/auth/login", {
    method: "POST",
    body: {
      username: "characterization-admin",
      password: "CharacterizationAdminPassword!"
    }
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.user.role, "admin");
  adminToken = adminLogin.body.token;

  registeredUsername = `characterization-user-${Date.now()}`;
  const registration = await api("/api/auth/register", {
    method: "POST",
    body: { username: registeredUsername, password: "user-password-123" }
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.role, "user");
  userToken = registration.body.token;

  const forbiddenUsers = await api("/api/auth/users", { token: userToken });
  assert.equal(forbiddenUsers.status, 403);

  const adminUsers = await api("/api/auth/users", { token: adminToken });
  assert.equal(adminUsers.status, 200);
  assert.equal(adminUsers.body.users.some((user) => user.username === registeredUsername), true);
});

test("public catalog and detail responses do not disclose judge-only data", async () => {
  const catalog = await api("/api/judge/catalog");
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.total > 0, true);
  assert.equal(catalog.body.items.some((item) => item.id === "two-sum"), true);
  assert.equal(Object.hasOwn(catalog.body.items[0], "hiddenTests"), false);
  assert.equal(Object.hasOwn(catalog.body.items[0], "referenceSolutions"), false);

  const detail = await api("/api/judge/quest/two-sum");
  assert.equal(detail.status, 200);
  assert.equal(detail.body.id, "two-sum");
  assert.equal(Array.isArray(detail.body.visibleTests), true);
  assert.equal(Object.hasOwn(detail.body, "hiddenTests"), false);
  assert.equal(Object.hasOwn(detail.body, "referenceSolutions"), false);

  const missing = await api("/api/judge/quest/not-a-real-question");
  assert.equal(missing.status, 404);
});

test("Run is public while Submit is authenticated and uses the token identity", async () => {
  const pythonFixture = representativeSubmissions.find((fixture) => fixture.language === "python");
  const javaFixture = representativeSubmissions.find((fixture) => fixture.language === "java");
  judgeCalls.length = 0;

  const run = await api("/api/judge/run", {
    method: "POST",
    body: {
      questId: pythonFixture.questId,
      language: pythonFixture.language,
      code: pythonFixture.code,
      username: "public-run-label"
    }
  });
  assert.equal(run.status, 200);
  assert.equal(run.body.mode, "run");
  assert.equal(run.body.result.totalCount, 2);
  assert.equal(judgeCalls[0].mode, "run");

  const anonymousSubmit = await api("/api/judge/submit", {
    method: "POST",
    body: {
      questId: javaFixture.questId,
      language: javaFixture.language,
      code: javaFixture.code
    }
  });
  assert.equal(anonymousSubmit.status, 401);
  assert.equal(judgeCalls.length, 1);

  const submit = await api("/api/judge/submit", {
    method: "POST",
    token: userToken,
    body: {
      questId: javaFixture.questId,
      language: javaFixture.language,
      code: javaFixture.code,
      username: "spoofed-user"
    }
  });
  assert.equal(submit.status, 200);
  assert.equal(submit.body.mode, "submit");
  for (const [field, expected] of Object.entries(javaFixture.expected)) {
    assert.equal(submit.body.result[field], expected);
  }
  assert.equal(judgeCalls[1].mode, "submit");
  assert.equal(judgeCalls[1].language, "java");
  assert.equal(judgeCalls[1].code, javaFixture.code);

  const recordedSubmission = db.prepare(`
    SELECT username, quest_id, status
    FROM analytics_submission_events
    ORDER BY id DESC
    LIMIT 1
  `).get();
  assert.deepEqual({ ...recordedSubmission }, {
    username: registeredUsername,
    quest_id: javaFixture.questId,
    status: javaFixture.expected.status
  });
});

test("community posts remain private until an administrator approves them", async () => {
  const title = `Characterization post ${Date.now()}`;
  const created = await api("/api/community/posts", {
    method: "POST",
    body: {
      title,
      content: "A pending post used to characterize the moderation lifecycle.",
      tags: ["Testing", "Moderation"],
      author: registeredUsername
    }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.item.status, "pending");
  const postId = created.body.item.id;

  const publicBeforeApproval = await api("/api/community/posts");
  assert.equal(publicBeforeApproval.body.items.some((post) => post.id === postId), false);

  const forbiddenQueue = await api("/api/community/admin/posts", { token: userToken });
  assert.equal(forbiddenQueue.status, 403);

  const moderationQueue = await api("/api/community/admin/posts", { token: adminToken });
  assert.equal(moderationQueue.status, 200);
  assert.equal(moderationQueue.body.items.some((post) => post.id === postId), true);

  const approved = await api(`/api/community/admin/posts/${postId}/status`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "approved", moderationNote: "Characterization approval" }
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.item.status, "approved");

  const publicAfterApproval = await api("/api/community/posts");
  assert.equal(publicAfterApproval.body.items.some((post) => post.id === postId), true);
  const detail = await api(`/api/community/posts/${postId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.post.title, title);
  assert.equal(Object.hasOwn(detail.body.post, "moderationNote"), false);
});
