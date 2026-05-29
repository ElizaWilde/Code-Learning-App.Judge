import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JudgeLanguage, JudgeTestCase, QuestDefinition, QuestKind } from "./judgeCatalog";
import { buildCommand, getLanguageAdminConfig, getResourceLimits } from "./judgeAdmin";
import { getQuestDefinition } from "./questStore";

type JudgeMode = "run" | "submit";
type ErrorType = "none" | "compile_error" | "runtime_error" | "wrong_answer" | "time_limit";
type JudgeStatus = "accepted" | "failed";

export type JudgeLog = {
  testName: string;
  passed: boolean;
  expected: string;
  actual: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  errorType: ErrorType;
};

export type JudgeResponse = {
  status: JudgeStatus;
  errorType: ErrorType;
  errorHint: string;
  summary: string;
  logs: JudgeLog[];
  runtimeMs: number;
  memoryKb: number | null;
  memoryNote: string;
  score: number;
  passedCount: number;
  totalCount: number;
  bestApproach: string;
  referenceTitle: string;
  referenceNote: string;
};

type ExecutionResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

type PhaseExecutionResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

type DockerJudgeExecutionResult = {
  compile: PhaseExecutionResult;
  run: PhaseExecutionResult | null;
  durationMs: number;
  launcherError: string | null;
};

export async function judgeSubmission(
  questId: string,
  language: JudgeLanguage,
  code: string,
  mode: JudgeMode
): Promise<JudgeResponse> {
  const quest = getQuestDefinition(questId);

  if (!quest) {
    return {
      status: "failed",
      errorType: "runtime_error",
      errorHint: "Unknown quest id.",
      summary: "Quest not found.",
      logs: [],
      runtimeMs: 0,
      memoryKb: null,
      memoryNote: "Peak memory is not available in this local judge.",
      score: 0,
      passedCount: 0,
      totalCount: 0,
      bestApproach: "",
      referenceTitle: "",
      referenceNote: ""
    };
  }

  const languageConfig = getLanguageAdminConfig(language);
  if (!languageConfig.enabled) {
    return {
      status: "failed",
      errorType: "runtime_error",
      errorHint: `${languageConfig.label} submissions are disabled by judge maintenance settings.`,
      summary: "Language disabled",
      logs: [],
      runtimeMs: 0,
      memoryKb: null,
      memoryNote: "Peak memory is not available in this local judge.",
      score: 0,
      passedCount: 0,
      totalCount: 0,
      bestApproach: quest.bestApproach,
      referenceTitle: quest.referenceTitle,
      referenceNote: quest.referenceNote
    };
  }

  const tests = mode === "run" ? quest.visibleTests : [...quest.visibleTests, ...quest.hiddenTests];
  const logs: JudgeLog[] = [];
  let passedCount = 0;
  let totalRuntimeMs = 0;

  for (const testCase of tests) {
    const result = await runSingleTest(quest, language, code, testCase);
    logs.push(result.log);
    totalRuntimeMs += result.log.durationMs;

    if (result.kind === "compile_error") {
      return finalizeJudgeResponse(quest, logs, passedCount, tests.length, "compile_error", "Compilation failed. Check syntax, class names, or missing returns.", totalRuntimeMs);
    }

    if (result.kind === "time_limit") {
      return finalizeJudgeResponse(quest, logs, passedCount, tests.length, "time_limit", "The program exceeded the time limit. Look for slower-than-expected logic.", totalRuntimeMs);
    }

    if (result.kind === "runtime_error") {
      return finalizeJudgeResponse(quest, logs, passedCount, tests.length, "runtime_error", "The program crashed while running. Check index bounds, null handling, or invalid operations.", totalRuntimeMs);
    }

    if (result.kind === "wrong_answer") {
      return finalizeJudgeResponse(quest, logs, passedCount, tests.length, "wrong_answer", "The output format is valid, but at least one test case produced the wrong result.", totalRuntimeMs);
    }

    passedCount += 1;
  }

  return finalizeJudgeResponse(quest, logs, passedCount, tests.length, "none", "All test cases passed.", totalRuntimeMs);
}

function finalizeJudgeResponse(
  quest: QuestDefinition,
  logs: JudgeLog[],
  passedCount: number,
  totalCount: number,
  errorType: ErrorType,
  errorHint: string,
  runtimeMs: number
): JudgeResponse {
  const score = totalCount === 0 ? 0 : Math.round((passedCount / totalCount) * 100);
  const status: JudgeStatus = passedCount === totalCount ? "accepted" : "failed";
  const summary = status === "accepted" ? "Accepted" : logs.length > 0 ? logs[logs.length - 1].errorType.replace("_", " ") : "Failed";

  return {
    status,
    errorType,
    errorHint,
    summary,
    logs,
    runtimeMs,
    memoryKb: null,
    memoryNote: "Peak memory is not available in this local Windows local judge.",
    score,
    passedCount,
    totalCount,
    bestApproach: quest.bestApproach,
    referenceTitle: quest.referenceTitle,
    referenceNote: quest.referenceNote
  };
}

async function runSingleTest(
  quest: QuestDefinition,
  language: JudgeLanguage,
  code: string,
  testCase: JudgeTestCase
): Promise<{ kind: ErrorType | "passed"; log: JudgeLog }> {
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "cl-judge-"));

  try {
    const source = buildWrappedSource(quest, language, code, testCase);
    const fileMap = getSourceFiles(language, source);
    for (const entry of fileMap) {
      await fs.writeFile(path.join(workdir, entry.name), entry.content, "utf8");
    }

    const execution = await executeInDocker(language, workdir);
    if (execution.launcherError) {
      return {
        kind: "runtime_error",
        log: {
          testName: testCase.name,
          passed: false,
          expected: stringifyValue(testCase.expected),
          actual: "",
          stdout: execution.compile.stdout,
          stderr: execution.launcherError,
          durationMs: execution.durationMs,
          errorType: "runtime_error"
        }
      };
    }

    if (execution.compile.timedOut) {
      return {
        kind: "time_limit",
        log: {
          testName: testCase.name,
          passed: false,
          expected: stringifyValue(testCase.expected),
          actual: "",
          stdout: execution.compile.stdout,
          stderr: execution.compile.stderr,
          durationMs: execution.durationMs,
          errorType: "time_limit"
        }
      };
    }

    if (execution.compile.exitCode !== 0) {
      return {
        kind: "compile_error",
        log: {
          testName: testCase.name,
          passed: false,
          expected: stringifyValue(testCase.expected),
          actual: "",
          stdout: execution.compile.stdout,
          stderr: execution.compile.stderr,
          durationMs: execution.durationMs,
          errorType: "compile_error"
        }
      };
    }

    const runResult = execution.run ?? {
      exitCode: -1,
      stdout: "",
      stderr: "Judge run phase did not produce any output.",
      timedOut: false
    };
    if (runResult.timedOut) {
      return {
        kind: "time_limit",
        log: {
          testName: testCase.name,
          passed: false,
          expected: stringifyValue(testCase.expected),
          actual: "",
          stdout: runResult.stdout,
          stderr: runResult.stderr,
          durationMs: execution.durationMs,
          errorType: "time_limit"
        }
      };
    }

    if (runResult.exitCode !== 0) {
      return {
        kind: "runtime_error",
        log: {
          testName: testCase.name,
          passed: false,
          expected: stringifyValue(testCase.expected),
          actual: safeTrim(runResult.stdout),
          stdout: runResult.stdout,
          stderr: runResult.stderr,
          durationMs: execution.durationMs,
          errorType: "runtime_error"
        }
      };
    }

    const actualValue = parseProgramOutput(runResult.stdout);
    const expectedValue = normalizeValue(testCase.expected);
    const passed = actualValue.ok && deepEqual(actualValue.value, expectedValue);

    return {
      kind: passed ? "passed" : "wrong_answer",
      log: {
        testName: testCase.name,
        passed,
        expected: stringifyValue(expectedValue),
        actual: actualValue.ok ? stringifyValue(actualValue.value) : safeTrim(runResult.stdout),
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        durationMs: execution.durationMs,
        errorType: passed ? "none" : "wrong_answer"
      }
    };
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}

function getSourceFiles(language: JudgeLanguage, source: string): Array<{ name: string; content: string }> {
  const languageConfig = getLanguageAdminConfig(language);
  return [{ name: languageConfig.sourceFileName, content: source }];
}

async function executeInDocker(language: JudgeLanguage, workdir: string): Promise<DockerJudgeExecutionResult> {
  const languageConfig = getLanguageAdminConfig(language);
  const limits = getResourceLimits();
  const artifactsDir = path.join(workdir, ".judge-artifacts");
  const scriptPath = path.join(workdir, "judge.sh");
  const compileCommand = buildCommand(languageConfig.compileCommand, language);
  const runCommand = buildCommand(languageConfig.runCommand, language);
  const outerTimeoutMs = limits.compileTimeoutMs + limits.runTimeoutMs + 5000;

  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.writeFile(
    scriptPath,
    buildDockerJudgeScript(compileCommand, runCommand, limits.compileTimeoutMs, limits.runTimeoutMs),
    "utf8"
  );

  const containerName = `cl-judge-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const dockerArgs = buildDockerRunArgs(languageConfig.dockerImage, workdir, containerName, limits.memoryLimitKb);
  const launcherResult = await execDockerCommand(dockerArgs, workdir, outerTimeoutMs, limits.maxOutputBufferKb, containerName);
  const compile = await readPhaseResult(artifactsDir, "compile");
  const run = await readPhaseResult(artifactsDir, "run");

  if (!compile) {
    const launcherError = safeTrim(`${launcherResult.stderr}\n${launcherResult.stdout}`) || "Docker judge failed before the container started.";
    return {
      compile: {
        exitCode: -1,
        stdout: "",
        stderr: launcherError,
        timedOut: launcherResult.timedOut
      },
      run: null,
      durationMs: launcherResult.durationMs,
      launcherError
    };
  }

  const launcherError = launcherResult.exitCode === 0
    ? null
    : safeTrim(`${launcherResult.stderr}\n${launcherResult.stdout}`) || "Docker judge exited unexpectedly.";

  return {
    compile,
    run,
    durationMs: launcherResult.durationMs,
    launcherError: launcherError && !run && compile.exitCode === 0 ? launcherError : null
  };
}

function buildDockerJudgeScript(
  compileCommand: string[],
  runCommand: string[],
  compileTimeoutMs: number,
  runTimeoutMs: number
): string {
  const compileStep = compileCommand.length === 0
    ? "printf '0' > \"$ARTIFACT_DIR/compile.status\"\n: > \"$ARTIFACT_DIR/compile.stdout\"\n: > \"$ARTIFACT_DIR/compile.stderr\""
    : `run_phase compile ${formatTimeoutSeconds(compileTimeoutMs)} ${toShellCommand(compileCommand)}
compile_status=$?
if [ "$compile_status" -ne 0 ]; then
  exit 0
fi`;

  return `#!/bin/sh
set +e
ARTIFACT_DIR="/workspace/.judge-artifacts"
mkdir -p "$ARTIFACT_DIR"

run_phase() {
  phase="$1"
  timeout_seconds="$2"
  shift 2
  stdout_file="$ARTIFACT_DIR/$phase.stdout"
  stderr_file="$ARTIFACT_DIR/$phase.stderr"
  status_file="$ARTIFACT_DIR/$phase.status"
  timeout_file="$ARTIFACT_DIR/$phase.timeout"

  rm -f "$stdout_file" "$stderr_file" "$status_file" "$timeout_file"

  "$@" >"$stdout_file" 2>"$stderr_file" &
  pid=$!

  (
    sleep "$timeout_seconds"
    echo timeout >"$timeout_file"
    kill -KILL "$pid" 2>/dev/null
  ) &
  watchdog=$!

  wait "$pid"
  exit_code=$?

  kill "$watchdog" 2>/dev/null
  wait "$watchdog" 2>/dev/null

  if [ -f "$timeout_file" ]; then
    rm -f "$timeout_file"
    echo timeout >"$status_file"
    return 124
  fi

  printf '%s' "$exit_code" >"$status_file"
  return "$exit_code"
}

${compileStep}
run_phase run ${formatTimeoutSeconds(runTimeoutMs)} ${toShellCommand(runCommand)}
exit 0
`;
}

function buildDockerRunArgs(
  image: string,
  workdir: string,
  containerName: string,
  memoryLimitKb: number | null
): string[] {
  const args = [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network",
    "none",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "128",
    "--cpus",
    "1",
    "-v",
    `${path.resolve(workdir)}:/workspace`,
    "-w",
    "/workspace"
  ];

  if (memoryLimitKb !== null) {
    args.push("--memory", `${memoryLimitKb}k`, "--memory-swap", `${memoryLimitKb}k`);
  }

  args.push(image, "/bin/sh", "/workspace/judge.sh");
  return args;
}

function execDockerCommand(
  args: string[],
  cwd: string,
  timeoutMs: number,
  maxOutputBufferKb: number,
  containerName: string
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const command = process.env.JUDGE_DOCKER_BIN?.trim() || "docker";
    const startedAt = Date.now();
    const maxBytes = maxOutputBufferKb * 1024;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(command, args, { cwd, windowsHide: true });

    const appendOutput = (current: string, chunk: Buffer): string => {
      const next = current + chunk.toString("utf8");
      return next.length > maxBytes ? next.slice(next.length - maxBytes) : next;
    };

    const finish = (result: ExecutionResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      void forceRemoveDockerContainer(command, containerName);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk);
    });

    child.on("error", (error) => {
      void forceRemoveDockerContainer(command, containerName);
      finish({
        exitCode: -1,
        stdout,
        stderr: safeTrim(`${stderr}\n${error.message}`),
        durationMs: Date.now() - startedAt,
        timedOut
      });
    });

    child.on("close", (exitCode) => {
      if (timedOut) {
        stderr = safeTrim(`${stderr}\nDocker execution timed out.`);
      }

      finish({
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        timedOut
      });
    });
  });
}

function forceRemoveDockerContainer(command: string, containerName: string): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = spawn(command, ["rm", "-f", containerName], { windowsHide: true });
    cleanup.on("error", () => resolve());
    cleanup.on("close", () => resolve());
  });
}

async function readPhaseResult(artifactsDir: string, phase: "compile" | "run"): Promise<PhaseExecutionResult | null> {
  const statusText = await readOptionalFile(path.join(artifactsDir, `${phase}.status`));
  if (statusText === null) {
    return null;
  }

  const stdout = (await readOptionalFile(path.join(artifactsDir, `${phase}.stdout`))) ?? "";
  const stderr = (await readOptionalFile(path.join(artifactsDir, `${phase}.stderr`))) ?? "";
  const trimmedStatus = safeTrim(statusText);

  if (trimmedStatus === "timeout") {
    return {
      exitCode: -1,
      stdout,
      stderr,
      timedOut: true
    };
  }

  const parsedExitCode = Number(trimmedStatus);
  return {
    exitCode: Number.isFinite(parsedExitCode) ? parsedExitCode : -1,
    stdout,
    stderr,
    timedOut: false
  };
}

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function toShellCommand(command: string[]): string {
  return command.map((segment) => shellQuote(segment)).join(" ");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatTimeoutSeconds(timeoutMs: number): string {
  return (timeoutMs / 1000).toFixed(3);
}

function parseProgramOutput(output: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = safeTrim(output);
  if (!trimmed) {
    return { ok: false };
  }

  try {
    return { ok: true, value: normalizeValue(JSON.parse(trimmed)) };
  } catch {
    if (trimmed === "true" || trimmed === "false") {
      return { ok: true, value: trimmed === "true" };
    }
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      return { ok: true, value: asNumber };
    }
    return { ok: true, value: trimmed };
  }
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = normalizeValue(item);
    }
    return result;
  }
  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right));
}

function stringifyValue(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

function safeTrim(value: string): string {
  return value.replace(/\r/g, "").trim();
}

function buildWrappedSource(quest: QuestDefinition, language: JudgeLanguage, code: string, testCase: JudgeTestCase): string {
  if (language === "python") {
    return buildPythonSource(quest.kind, code, testCase.input);
  }
  return buildJavaSource(quest.kind, code, testCase.input);
}

function pyLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => pyLiteral(item)).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${JSON.stringify(key)}: ${pyLiteral(item)}`).join(", ")}}`;
  }
  return "None";
}

function javaIntArray(values: number[]): string {
  return `new int[]{${values.join(", ")}}`;
}

function javaStringArray(values: Array<string | null>): string {
  return `new String[]{${values.map((item) => item === null ? "null" : `"${item}"`).join(", ")}}`;
}

function javaCharGrid(grid: string[][]): string {
  return `new char[][]{${grid.map((row) => `{${row.map((cell) => `'${cell}'`).join(", ")}}`).join(", ")}}`;
}

function buildPythonSource(kind: QuestKind, code: string, input: unknown): string {
  const helpers = `
import json
from collections import deque

def _build_tree(values):
    if not values:
        return None
    nodes = [None if v is None else TreeNode(v) for v in values]
    kids = deque(nodes[1:])
    for node in nodes:
        if node is not None:
            if kids:
                node.left = kids.popleft()
            if kids:
                node.right = kids.popleft()
    return nodes[0]

def _tree_to_list(root):
    if root is None:
        return []
    result = []
    queue = deque([root])
    while queue:
        node = queue.popleft()
        if node is None:
            result.append(None)
            continue
        result.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while result and result[-1] is None:
        result.pop()
    return result
`;

  let runner = "";
  const data = input as Record<string, unknown>;
  switch (kind) {
    case "two_sum":
      runner = `result = solve(${pyLiteral(data.nums)}, ${pyLiteral(data.target)})\nprint(json.dumps(result))\n`;
      break;
    case "valid_parentheses":
      runner = `result = solve(${pyLiteral(data.s)})\nprint(json.dumps(result))\n`;
      break;
    case "merge_strings":
      runner = `result = solve(${pyLiteral(data.word1)}, ${pyLiteral(data.word2)})\nprint(json.dumps(result))\n`;
      break;
    case "contains_duplicate":
      runner = `result = solve(${pyLiteral(data.nums)})\nprint(json.dumps(result))\n`;
      break;
    case "product_except_self":
      runner = `result = solve(${pyLiteral(data.nums)})\nprint(json.dumps(result))\n`;
      break;
    case "best_time_stock":
      runner = `result = solve(${pyLiteral(data.prices)})\nprint(json.dumps(result))\n`;
      break;
    case "longest_substring":
      runner = `result = solve(${pyLiteral(data.s)})\nprint(json.dumps(result))\n`;
      break;
    case "min_stack":
      runner = `
ops = ${pyLiteral(data.ops)}
values = ${pyLiteral(data.values)}
result = []
stack = None
for index, op in enumerate(ops):
    if op == "MinStack":
        stack = MinStack()
        result.append(None)
    elif op == "push":
        stack.push(values[index])
        result.append(None)
    elif op == "pop":
        stack.pop()
        result.append(None)
    elif op == "top":
        result.append(stack.top())
    elif op == "getMin":
        result.append(stack.getMin())
print(json.dumps(result))
`;
      break;
    case "daily_temperatures":
      runner = `result = solve(${pyLiteral(data.temperatures)})\nprint(json.dumps(result))\n`;
      break;
    case "invert_binary_tree":
      runner = `root = _build_tree(${pyLiteral(data.root)})\nresult = solve(root)\nprint(json.dumps(_tree_to_list(result)))\n`;
      break;
    case "binary_level_order":
      runner = `root = _build_tree(${pyLiteral(data.root)})\nresult = solve(root)\nprint(json.dumps(result))\n`;
      break;
    case "number_of_islands":
      runner = `result = solve(${pyLiteral(data.grid)})\nprint(json.dumps(result))\n`;
      break;
  }

  return `${helpers}\n${code}\n${runner}`;
}

function buildJavaSource(kind: QuestKind, code: string, input: unknown): string {
  const header = `import java.util.*;\n\n`;
  const helpers = `
class MainSupport {
    static String intArrayToJson(int[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        return sb.append("]").toString();
    }

    static String nestedListToJson(List<List<Integer>> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("[");
            List<Integer> row = values.get(i);
            for (int j = 0; j < row.size(); j++) {
                if (j > 0) sb.append(",");
                sb.append(row.get(j));
            }
            sb.append("]");
        }
        return sb.append("]").toString();
    }

    static TreeNode buildTree(String[] values) {
        if (values.length == 0) return null;
        if (values[0] == null) return null;
        TreeNode root = new TreeNode(Integer.parseInt(values[0]));
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        int index = 1;
        while (!queue.isEmpty() && index < values.length) {
            TreeNode node = queue.poll();
            if (index < values.length && values[index] != null) {
                node.left = new TreeNode(Integer.parseInt(values[index]));
                queue.offer(node.left);
            }
            index++;
            if (index < values.length && values[index] != null) {
                node.right = new TreeNode(Integer.parseInt(values[index]));
                queue.offer(node.right);
            }
            index++;
        }
        return root;
    }

    static String treeToJson(TreeNode root) {
        if (root == null) return "[]";
        List<String> result = new ArrayList<>();
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            if (node == null) {
                result.add("null");
            } else {
                result.add(String.valueOf(node.val));
                queue.offer(node.left);
                queue.offer(node.right);
            }
        }
        while (!result.isEmpty() && "null".equals(result.get(result.size() - 1))) {
            result.remove(result.size() - 1);
        }
        return "[" + String.join(",", result) + "]";
    }
}
`;

  const data = input as Record<string, unknown>;
  let mainBody = "";
  switch (kind) {
    case "two_sum":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(MainSupport.intArrayToJson(solution.solve(${javaIntArray(data.nums as number[])}, ${data.target})));`;
      break;
    case "valid_parentheses":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(solution.solve(${JSON.stringify(data.s)}) ? "true" : "false");`;
      break;
    case "merge_strings":
      mainBody = `Solution solution = new Solution();\nSystem.out.print("\\"" + solution.solve(${JSON.stringify(data.word1)}, ${JSON.stringify(data.word2)}).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"");`;
      break;
    case "contains_duplicate":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(solution.solve(${javaIntArray(data.nums as number[])}) ? "true" : "false");`;
      break;
    case "product_except_self":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(MainSupport.intArrayToJson(solution.solve(${javaIntArray(data.nums as number[])})));`;
      break;
    case "best_time_stock":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(solution.solve(${javaIntArray(data.prices as number[])}));`;
      break;
    case "longest_substring":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(solution.solve(${JSON.stringify(data.s)}));`;
      break;
    case "min_stack":
      mainBody = `
String[] ops = ${javaStringArray((data.ops as Array<string | null>))};
Integer[] values = new Integer[]{${(data.values as Array<number | null>).map((item) => item === null ? "null" : String(item)).join(", ")}};
List<String> result = new ArrayList<>();
MinStack stack = null;
for (int i = 0; i < ops.length; i++) {
    String op = ops[i];
    if ("MinStack".equals(op)) {
        stack = new MinStack();
        result.add("null");
    } else if ("push".equals(op)) {
        stack.push(values[i]);
        result.add("null");
    } else if ("pop".equals(op)) {
        stack.pop();
        result.add("null");
    } else if ("top".equals(op)) {
        result.add(String.valueOf(stack.top()));
    } else if ("getMin".equals(op)) {
        result.add(String.valueOf(stack.getMin()));
    }
}
System.out.print("[" + String.join(",", result) + "]");
`;
      break;
    case "daily_temperatures":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(MainSupport.intArrayToJson(solution.solve(${javaIntArray(data.temperatures as number[])})));`;
      break;
    case "invert_binary_tree":
      mainBody = `Solution solution = new Solution();\nTreeNode root = MainSupport.buildTree(${javaStringArray(data.root as Array<string | null>)});\nSystem.out.print(MainSupport.treeToJson(solution.solve(root)));`;
      break;
    case "binary_level_order":
      mainBody = `Solution solution = new Solution();\nTreeNode root = MainSupport.buildTree(${javaStringArray(data.root as Array<string | null>)});\nSystem.out.print(MainSupport.nestedListToJson(solution.solve(root)));`;
      break;
    case "number_of_islands":
      mainBody = `Solution solution = new Solution();\nSystem.out.print(solution.solve(${javaCharGrid(data.grid as string[][])}));`;
      break;
  }

  return `${header}${code}\n${helpers}\npublic class Main {\n    public static void main(String[] args) {\n        ${mainBody}\n    }\n}\n`;
}

function indentLines(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .trim()
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
