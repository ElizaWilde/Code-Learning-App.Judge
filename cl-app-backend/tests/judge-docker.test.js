const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");

const representativeSubmissions = require("./fixtures/representative-submissions.json");
let runtimeDirectory;
let db;
let judgeSubmission;

before(() => {
  runtimeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "cl-app-docker-judge-"));
  process.env.CODE_LEARNING_APP_DATA_DIR = runtimeDirectory;
  process.env.CODEBOX_JWT_SECRET = "docker-judge-test-secret-at-least-32-characters";
  process.env.CODEBOX_ADMIN_PASSWORD = "DockerJudgeTestAdminPassword!";

  db = require("../dist/db").db;
  judgeSubmission = require("../dist/judgeService").judgeSubmission;
});

after(() => {
  if (db) {
    db.close();
  }
  if (runtimeDirectory) {
    fs.rmSync(runtimeDirectory, { recursive: true, force: true });
  }
});

for (const fixture of representativeSubmissions) {
  test(fixture.name, async () => {
    const result = await judgeSubmission(
      fixture.questId,
      fixture.language,
      fixture.code,
      "submit"
    );

    assert.equal(result.status, fixture.expected.status);
    assert.equal(result.errorType, fixture.expected.errorType);
    assert.equal(result.score, fixture.expected.score);
    assert.equal(result.passedCount, fixture.expected.passedCount);
    assert.equal(result.totalCount, fixture.expected.totalCount);
  });
}
