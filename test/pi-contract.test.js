import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
  createScopedPiSession,
  memoryCredentials,
  piRunner,
} from "../src/runner.js";
import { Type } from "@sinclair/typebox";
import {
  createAssistantMessageEventStream,
  fauxAssistantMessage,
} from "@earendil-works/pi-ai";
import { taskSchema } from "../src/schema.js";
import { seeds } from "../src/seeds.js";

test("Pi runner completes serial Team stages using actual SDK with mocked model responses; no live model claim", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-pi-team-"));
  const previous = process.env.TASKDOCK_TEST_MODEL_KEY;
  process.env.TASKDOCK_TEST_MODEL_KEY = "test-only-not-a-real-credential";
  const captured = [],
    events = [];
  try {
    const config = taskSchema.parse({
      ...seeds[2],
      runner: "pi",
      model: {
        provider: "openai",
        name: "gpt-4.1-mini",
        apiKeyEnv: "TASKDOCK_TEST_MODEL_KEY",
      },
    });
    const result = await piRunner({
      config,
      input: { context: "CURRENT_REQUEST_ONLY" },
      signal: new AbortController().signal,
      event: (type, data) => events.push({ type, data }),
      runDir: dir,
      sessionFactory: async (options) => {
        const scoped = await createScopedPiSession(options);
        options.runtime.streamSimple = (_model, context) => {
          captured.push(JSON.stringify(context));
          const stream = createAssistantMessageEventStream();
          queueMicrotask(() => {
            const message = fauxAssistantMessage(
              `Mock stage ${captured.length}`,
            );
            stream.push({ type: "done", reason: "stop", message });
          });
          return stream;
        };
        return scoped;
      },
    });
    assert.equal(result.executionMode, "pi");
    assert.equal(result.stages.length, 3);
    assert.equal(captured.length, 3);
    assert.ok(captured.every((c) => c.includes("CURRENT_REQUEST_ONLY")));
    assert.ok(captured[1].includes("Mock stage 1"));
    assert.ok(
      captured.every((c) => !c.includes("test-only-not-a-real-credential")),
    );
    assert.equal(events.filter((e) => e.type === "stage.completed").length, 3);
  } finally {
    if (previous === undefined) delete process.env.TASKDOCK_TEST_MODEL_KEY;
    else process.env.TASKDOCK_TEST_MODEL_KEY = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("actual Pi SDK initializes fresh sessions without ambient AGENTS, tools, skills or history (offline contract)", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "taskdock-pi-"));
  const runtime = await ModelRuntime.create({
    credentials: memoryCredentials(),
    modelsPath: null,
    refreshOnCreate: false,
    allowModelNetwork: false,
  });
  const sessions = [];
  try {
    writeFileSync(
      path.join(root, "AGENTS.md"),
      "FORBIDDEN_OTHER_PROJECT_CONTEXT",
    );
    const model = runtime.getModel("openai", "gpt-4.1-mini");
    assert.ok(model);
    for (const id of ["A", "B"]) {
      const cwd = path.join(root, id),
        agentDir = path.join(root, id, "runtime");
      mkdirSync(agentDir, { recursive: true });
      const { session, loader } = await createScopedPiSession({
        cwd,
        agentDir,
        runtime,
        model,
        systemPrompt: `ONLY_${id}_CAPABILITY`,
      });
      sessions.push(session);
      assert.equal(session.messages.length, 0);
      assert.deepEqual(session.getActiveToolNames(), []);
      assert.equal(loader.getAgentsFiles().agentsFiles.length, 0);
      assert.equal(loader.getSkills().skills.length, 0);
      assert.ok(session.systemPrompt.includes(`ONLY_${id}_CAPABILITY`));
      assert.ok(
        !session.systemPrompt.includes("FORBIDDEN_OTHER_PROJECT_CONTEXT"),
      );
    }
    assert.notEqual(sessions[0], sessions[1]);
    assert.ok(!sessions[1].systemPrompt.includes("ONLY_A_CAPABILITY"));
  } finally {
    sessions.forEach((s) => s.dispose());
    rmSync(root, { recursive: true, force: true });
  }
});
test("actual Pi tool allowlist contains only explicitly passed tools, no read/bash/write", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "taskdock-pi-tools-"));
  const runtime = await ModelRuntime.create({
    credentials: memoryCredentials(),
    modelsPath: null,
    refreshOnCreate: false,
    allowModelNetwork: false,
  });
  let session;
  try {
    ({ session } = await createScopedPiSession({
      cwd,
      agentDir: cwd,
      runtime,
      model: runtime.getModel("openai", "gpt-4.1-mini"),
      systemPrompt: "only approved tool",
      tools: [
        {
          name: "td_allowed_check",
          label: "check",
          description: "test approved tool",
          parameters: Type.Object({}),
          execute: async () => ({
            content: [{ type: "text", text: "ok" }],
            details: {},
          }),
        },
      ],
    }));
    assert.deepEqual(session.getActiveToolNames(), ["td_allowed_check"]);
  } finally {
    session?.dispose();
    rmSync(cwd, { recursive: true, force: true });
  }
});
