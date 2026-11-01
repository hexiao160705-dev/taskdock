import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../src/store.js";
import { Executor } from "../src/runner.js";

function worker(dir, mode) {
  const child = fork("test/fixtures/durable-worker.mjs", [], {
    execArgv: [],
    env: {
      PATH: process.env.PATH,
      TASKDOCK_TEST_DIR: dir,
      TASKDOCK_TEST_MODE: mode,
    },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  const messages = [];
  let diagnostics = "";
  child.stderr.on("data", (b) => (diagnostics += b.toString()));
  child.on("message", (m) => messages.push(m));
  const exit = once(child, "exit");
  const until = async (phase) => {
    const stop = Date.now() + 8000;
    while (!messages.some((m) => m.phase === phase)) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`Worker exited before ${phase}: ${diagnostics}`);
      if (Date.now() > stop)
        throw new Error(
          `Worker timeout: ${phase}; ${JSON.stringify(messages)}`,
        );
      await new Promise((r) => setTimeout(r, 10));
    }
    return messages.find((m) => m.phase === phase);
  };
  return { child, until, exit };
}
function config(id) {
  return {
    id,
    name: id,
    description: "process crash fixture",
    runner: "pi",
    mcpServers: [
      {
        name: "evidence",
        url: "http://127.0.0.1:1/mcp",
        allowedTools: ["write"],
      },
    ],
  };
}

test("real restart makes committed tool receipts available to the resumed executor without rerunning the action", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-receipt-resume-"));
  let current;
  try {
    let store = new Store(dir);
    store.createTask(config("receipt-check"));
    const { run } = store.createRun({
      taskId: "receipt-check",
      channel: "test",
      input: { marker: "receipt-own-run" },
    });
    store.close();
    current = worker(dir, "receipt-crash");
    await current.until("receipt-written");
    current.child.kill("SIGKILL");
    await current.exit;
    current = worker(dir, "resume");
    await current.until("idle");
    await current.exit;
    store = new Store(dir);
    try {
      const restored = store.run(run.id);
      assert.equal(restored.status, "succeeded");
      assert.equal(restored.result.summary, "committed tool receipt");
      assert.equal(restored.toolCalls[0].invocations, 1);
      assert.equal(
        readFileSync(path.join(dir, "external-actions.txt"), "utf8")
          .trim()
          .split("\n").length,
        1,
      );
    } finally {
      store.close();
    }
  } finally {
    if (current?.child.exitCode === null && current?.child.signalCode === null)
      current.child.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  }
});

test("real SIGKILL/restart resumes a durable queued/running Run with the original capability and own checkpoint", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-real-restart-"));
  let current;
  try {
    let store = new Store(dir);
    store.createTask(config("process-check"));
    const { run } = store.createRun({
      taskId: "process-check",
      channel: "test",
      input: { marker: "THIS_RUN_CHECKPOINT" },
    });
    store.close();
    current = worker(dir, "checkpoint-crash");
    await current.until("checkpoint-written");
    current.child.kill("SIGKILL");
    const [code, signal] = await current.exit;
    assert.equal(signal, "SIGKILL");
    store = new Store(dir);
    const t = store.task("process-check");
    store.saveDraft(
      t.id,
      { ...t.draft, instructions: "NEW_AMBIENT_DRAFT" },
      t.revision,
    );
    store.close();
    current = worker(dir, "resume");
    await current.until("idle");
    await current.exit;
    store = new Store(dir);
    try {
      const restored = store.run(run.id);
      assert.equal(restored.status, "succeeded");
      assert.equal(restored.digest, run.digest);
      assert.equal(restored.result.summary, "THIS_RUN_CHECKPOINT");
      assert.ok(!JSON.stringify(restored.config).includes("NEW_AMBIENT_DRAFT"));
      assert.equal(restored.attempts.length, 2);
      assert.equal(restored.attempts[0].state, "interrupted");
      assert.equal(restored.attempts[1].state, "succeeded");
      assert.ok(restored.events.some((e) => e.type === "recovery.queued"));
    } finally {
      store.close();
    }
  } finally {
    if (current?.child.exitCode === null && current?.child.signalCode === null)
      current.child.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  }
});

test("real crash after external success before receipt waits for reconciliation and does not repeat the action", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-ambiguous-tool-"));
  let current, store, executor;
  try {
    store = new Store(dir);
    store.createTask(config("ambiguous-check"));
    const { run } = store.createRun({
      taskId: "ambiguous-check",
      channel: "test",
      input: { marker: "same-args" },
    });
    store.close();
    store = null;
    current = worker(dir, "tool-crash");
    await current.until("external-succeeded");
    current.child.kill("SIGKILL");
    await current.exit;
    current = worker(dir, "resume");
    await current.until("idle");
    await current.exit;
    store = new Store(dir);
    let r = store.run(run.id);
    assert.equal(r.status, "waiting_human");
    assert.equal(r.toolCalls[0].state, "uncertain");
    assert.equal(
      readFileSync(path.join(dir, "external-actions.txt"), "utf8")
        .trim()
        .split("\n").length,
      1,
    );
    executor = new Executor(store, {
      runner: async (o) => {
        const receipt = await o.invokeTool({
          stage: 0,
          server: "evidence",
          name: "write",
          args: { value: "same-args" },
          execute: async () => {
            assert.fail("must reuse reconciled receipt, not execute again");
          },
        });
        return {
          executionMode: "fixture-deterministic",
          verdict: "passed",
          summary: receipt.content[0].text,
          checks: [],
          stages: [],
          limitations: [],
        };
      },
    });
    executor.answer(
      r.id,
      r.attentions[0].id,
      {
        resolution: "record-completed",
        result: "verified exactly one external action",
      },
      "fixture-human",
    );
    await executor.idle();
    r = store.run(r.id);
    assert.equal(r.status, "succeeded");
    assert.match(r.result.summary, /verified exactly one/);
    assert.equal(r.toolCalls[0].invocations, 1);
    assert.equal(
      readFileSync(path.join(dir, "external-actions.txt"), "utf8")
        .trim()
        .split("\n").length,
      1,
    );
  } finally {
    if (current?.child.exitCode === null && current?.child.signalCode === null)
      current.child.kill("SIGKILL");
    if (executor) await executor.close();
    if (store) store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
