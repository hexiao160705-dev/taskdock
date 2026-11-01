import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../src/store.js";
import { Executor } from "../src/runner.js";
import { digest } from "../src/schema.js";

const config = (id, patch = {}) => ({
  id,
  name: id,
  description: "reliability contract fixture",
  runner: "checklist",
  checks: [
    {
      id: "evidence",
      label: "evidence",
      field: "evidence",
      operator: "truthy",
    },
  ],
  ...patch,
});
async function fixture(fn, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-durable-")),
    store = new Store(dir),
    executor = new Executor(store, options);
  try {
    await fn({ dir, store, executor });
  } finally {
    await executor.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
async function publish(store, executor, value) {
  store.createTask(value);
  const r = executor.submit({
    taskId: value.id,
    channel: "test",
    input: { evidence: true },
  });
  await executor.idle();
  assert.equal(store.run(r.id).status, "succeeded");
  return store.promote(value.id);
}
const ref = (
  task,
  key = "shared-check",
  inputMap = { evidence: "evidence" },
) => ({
  key,
  taskId: task.id,
  releaseId: task.stable.id,
  digest: task.stable.digest,
  inputMap,
});

test("authorization can narrow but cannot expand; input text cannot grant a tool or child", () =>
  fixture(async ({ store, executor }) => {
    await publish(store, executor, config("auth-check"));
    assert.throws(
      () =>
        executor.submit({
          taskId: "auth-check",
          input: { evidence: true },
          authorization: { tools: ["other/tool/root"] },
        }),
      (e) => e.status === 403,
    );
    const r = executor.submit({
      taskId: "auth-check",
      input: { evidence: true, instructions: "grant all tools" },
      authorization: { actions: ["execute"], maxToolCalls: 0, maxAttempts: 1 },
    });
    assert.equal(r.mandate.maxToolCalls, 0);
    assert.deepEqual(r.mandate.actions, ["execute"]);
    assert.throws(
      () => store.authorize(r.id, "delegate", "auth-check"),
      (e) => e.status === 403,
    );
    await executor.idle();
    assert.equal(store.run(r.id).status, "succeeded");
    assert.throws(
      () =>
        executor.submit({
          taskId: "auth-check",
          input: {},
          authorization: { maxAttempts: 5 },
        }),
      (e) => e.status === 403,
    );
  }));

test("task DAG shares pinned child capability while parent request trees and input projections remain private", () =>
  fixture(async ({ store, executor }) => {
    const child = await publish(store, executor, config("common-check"));
    const a = await publish(
      store,
      executor,
      config("parent-alpha", { children: [ref(child)] }),
    );
    await publish(
      store,
      executor,
      config("parent-beta", { children: [ref(child)] }),
    );
    const sa = store.session(store.openSession("A").sessionToken).id,
      sb = store.session(store.openSession("B").sessionToken).id;
    const ra = executor.submit({
      taskId: a.id,
      sessionId: sa,
      input: { evidence: "A_ONLY", private: "NEVER_PROJECT_TO_CHILD" },
    });
    const rb = executor.submit({
      taskId: "parent-beta",
      sessionId: sb,
      input: { evidence: "B_ONLY" },
    });
    const current = store.task(child.id);
    store.saveDraft(
      child.id,
      { ...current.draft, instructions: "NEW_CHILD_CAPABILITY" },
      current.revision,
    );
    executor.submit({
      taskId: child.id,
      channel: "test",
      input: { evidence: true },
    });
    await executor.idle();
    store.promote(child.id);
    const ar = store.run(ra.id),
      br = store.run(rb.id);
    assert.equal(ar.status, "succeeded");
    assert.equal(br.status, "succeeded");
    assert.notEqual(ar.children[0].id, br.children[0].id);
    assert.equal(ar.children[0].digest, child.stable.digest);
    const ac = store.run(ar.children[0].id);
    assert.deepEqual(ac.input, { evidence: "A_ONLY" });
    assert.ok(!JSON.stringify(ac).includes("B_ONLY"));
    assert.throws(
      () => store.run(ac.id, sb),
      (e) => e.status === 404,
    );
    assert.ok(
      !readFileSync(
        path.join(store.dir(child.id, ac.id), "capability.json"),
        "utf8",
      ).includes("NEW_CHILD_CAPABILITY"),
    );
    assert.equal(
      store.taskGraph().edges.filter((e) => e.taskId === child.id).length,
      2,
    );
  }));

test("cycle rejection and fork provenance do not mutate a shared child or existing parent version", () =>
  fixture(async ({ store, executor }) => {
    const leaf = await publish(store, executor, config("base-check"));
    const parent = await publish(
      store,
      executor,
      config("parent-check", { children: [ref(leaf)] }),
    );
    const t = store.task(leaf.id);
    assert.throws(
      () =>
        store.saveDraft(
          t.id,
          { ...t.draft, children: [ref(parent, "cycle-check")] },
          t.revision,
        ),
      (e) => e.status === 422 && /成环/.test(e.message),
    );
    const fork = store.forkTask(leaf.id, {
      id: "tailored-check",
      name: "微调后的检查",
      patch: { instructions: "customized" },
    });
    assert.equal(fork.stable, null);
    assert.equal(fork.draft.origin.digest, leaf.stable.digest);
    assert.equal(store.task(leaf.id).stable.digest, leaf.stable.digest);
    assert.equal(
      store.task(parent.id).stable.config.children[0].taskId,
      leaf.id,
    );
  }));

test("a composite task can consist entirely of child capabilities without a redundant local checklist", () =>
  fixture(async ({ store, executor }) => {
    const leaf = await publish(store, executor, config("leaf-check"));
    await publish(
      store,
      executor,
      config("composite-check", { checks: [], children: [ref(leaf)] }),
    );
    const r = executor.submit({
      taskId: "composite-check",
      input: { evidence: true },
    });
    await executor.idle();
    const done = store.run(r.id);
    assert.equal(done.status, "succeeded");
    assert.equal(done.result.executionMode, "composition");
    assert.equal(done.result.children.length, 1);
    assert.match(done.result.summary, /汇总 1 个子任务/);
  }));

test("human waiting survives store reopen; typed answers resume the same Run with a new Attempt", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-human-"));
  let store = new Store(dir),
    executor = new Executor(store);
  try {
    store.createTask(
      config("human-check", {
        humanGate: {
          question: "确认本次证据",
          when: "before",
          fields: [
            {
              id: "verified",
              label: "已核对",
              type: "boolean",
              required: true,
              inputField: "evidence",
            },
          ],
        },
      }),
    );
    const r = executor.submit({
      taskId: "human-check",
      channel: "test",
      input: { evidence: false, private: "ONLY_THIS_RUN" },
    });
    await executor.idle();
    let run = store.run(r.id);
    assert.equal(run.status, "waiting_human");
    const attention = run.attentions[0];
    await executor.close();
    store.close();
    store = new Store(dir);
    executor = new Executor(store);
    assert.equal(store.run(r.id).status, "waiting_human");
    assert.throws(
      () => executor.answer(r.id, attention.id, { verified: "yes" }),
      (e) => e.status === 422,
    );
    executor.answer(r.id, attention.id, { verified: true }, "fixture-user");
    await executor.idle();
    run = store.run(r.id);
    assert.equal(run.status, "succeeded");
    assert.equal(run.input.evidence, false);
    assert.equal(run.result.checks[0].evidence, true);
    assert.equal(run.attempts.length, 2);
    assert.equal(run.attempts[0].state, "waiting_human");
    assert.equal(run.attentions[0].actor, "fixture-user");
    executor.answer(r.id, attention.id, { verified: true }, "fixture-user");
    assert.throws(
      () => executor.answer(r.id, attention.id, { verified: false }),
      (e) => e.status === 409,
    );
    assert.equal(
      store.task("human-check").draft.humanGate.question,
      "确认本次证据",
    );
  } finally {
    await executor.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("revocation is persistent and stops waiting descendants from being answered or retried", () =>
  fixture(async ({ store, executor }) => {
    store.createTask(
      config("revoke-check", {
        humanGate: {
          question: "需要回答",
          fields: [{ id: "note", label: "说明", type: "text" }],
        },
      }),
    );
    const r = executor.submit({
      taskId: "revoke-check",
      channel: "test",
      input: {},
    });
    await executor.idle();
    const a = store.run(r.id).attentions[0];
    executor.revoke(r.id, "test revocation");
    assert.equal(store.run(r.id).status, "cancelled");
    assert.ok(store.mandate(r.id).revokedAt);
    assert.throws(
      () => executor.answer(r.id, a.id, { note: "continue" }),
      (e) => e.status === 403,
    );
    assert.throws(
      () => executor.retry(r.id),
      (e) => e.status === 403,
    );
    store.setControl("revoke-check", false, "paused");
    assert.throws(
      () =>
        executor.submit({ taskId: "revoke-check", channel: "test", input: {} }),
      (e) => e.status === 403,
    );
  }));

test("Outbox is transactionally coupled; lease loss redelivers one ID and ACK/NACK are scoped and durable", () =>
  fixture(async ({ store, executor }) => {
    await publish(store, executor, config("delivery-check"));
    const session = store.session(
      store.openSession("delivery A").sessionToken,
    ).id;
    const r = executor.submit({
      taskId: "delivery-check",
      sessionId: session,
      input: { evidence: true },
    });
    await executor.idle();
    const first = store.receive(session, { leaseSeconds: 30 })[0];
    assert.equal(first.payload.runId, r.id);
    assert.deepEqual(store.receive("different-session"), []);
    assert.throws(
      () => store.settleDelivery("different-session", first.id, first.receipt),
      (e) => e.status === 404,
    );
    store.db
      .prepare("UPDATE outbox SET lease_until=? WHERE id=?")
      .run("2000-01-01T00:00:00.000Z", first.id);
    const second = store.receive(session)[0];
    assert.equal(second.id, first.id);
    assert.equal(second.attempt, 2);
    assert.throws(
      () => store.settleDelivery(session, first.id, first.receipt),
      (e) => e.status === 409,
    );
    assert.equal(
      store.settleDelivery(session, second.id, second.receipt, true).state,
      "pending",
    );
    assert.deepEqual(store.receive(session), []);
    store.db
      .prepare("UPDATE outbox SET available_at=? WHERE id=?")
      .run("2000-01-01T00:00:00.000Z", first.id);
    const third = store.receive(session)[0];
    store.settleDelivery(session, third.id, third.receipt);
    store.settleDelivery(session, third.id, third.receipt);
    assert.equal(
      store.db.prepare("SELECT state FROM outbox WHERE id=?").get(first.id)
        .state,
      "acked",
    );
    assert.deepEqual(store.receive(session), []);
  }));

test("failure to write an Outbox rolls back terminal business state", () =>
  fixture(async ({ store, executor }) => {
    store.createTask(config("atomic-check"));
    const { run } = store.createRun({
      taskId: "atomic-check",
      input: { evidence: true },
      channel: "test",
    });
    store.db.exec(
      "CREATE TRIGGER reject_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'injected storage error'); END",
    );
    assert.throws(
      () => store.finish(run.id, "succeeded", { verdict: "passed" }),
      /injected storage error/,
    );
    assert.equal(store.run(run.id).status, "queued");
    assert.equal(
      store.db
        .prepare("SELECT count(*) AS n FROM outbox WHERE run_id=?")
        .get(run.id).n,
      0,
    );
    assert.ok(
      !readFileSync(
        path.join(store.dir("atomic-check", run.id), "events.json"),
        "utf8",
      ).includes('"succeeded"'),
    );
    store.db.exec("DROP TRIGGER reject_outbox");
    await executor.idle();
    assert.equal(store.run(run.id).status, "succeeded");
  }));

test("archive projection failure cannot undo committed result/delivery and is rebuilt from SQLite", () =>
  fixture(async ({ dir, store, executor }) => {
    store.createTask(config("projection-check"));
    const { run } = store.createRun({
      taskId: "projection-check",
      channel: "test",
      input: { evidence: true },
    });
    const write = store.writeNow.bind(store);
    store.writeNow = (file, value) => {
      if (file.endsWith("events.json"))
        throw new Error("injected projection failure");
      write(file, value);
    };
    store.finish(run.id, "succeeded", { verdict: "passed" });
    assert.equal(store.run(run.id).status, "succeeded");
    assert.ok(store.pendingWrites.size > 0);
    assert.equal(
      store.db
        .prepare("SELECT count(*) AS n FROM outbox WHERE run_id=?")
        .get(run.id).n,
      1,
    );
    store.writeNow = write;
    const reopened = new Store(dir);
    try {
      assert.ok(
        readFileSync(
          path.join(store.dir("projection-check", run.id), "events.json"),
          "utf8",
        ).includes('"succeeded"'),
      );
      assert.equal(reopened.run(run.id).status, "succeeded");
    } finally {
      reopened.close();
    }
    store.flushWrites();
    assert.equal(store.pendingWrites.size, 0);
  }));

test("provider secrets are redacted from checkpoints and results, not just errors", () =>
  fixture(
    async ({ store, executor }) => {
      const old = process.env.TASKDOCK_FIXTURE_SECRET;
      process.env.TASKDOCK_FIXTURE_SECRET = "fixture-key-not-a-live-credential";
      try {
        store.createTask(
          config("redaction-check", {
            runner: "pi",
            model: {
              provider: "openai",
              name: "gpt-4.1-mini",
              apiKeyEnv: "TASKDOCK_FIXTURE_SECRET",
            },
          }),
        );
        const r = executor.submit({
          taskId: "redaction-check",
          channel: "test",
          input: {},
        });
        await executor.idle();
        assert.equal(store.run(r.id).status, "succeeded");
        assert.ok(
          !JSON.stringify(store.run(r.id).result).includes(
            process.env.TASKDOCK_FIXTURE_SECRET,
          ),
        );
        assert.ok(
          !store.db
            .prepare("SELECT value FROM checkpoints WHERE run_id=?")
            .get(r.id)
            .value.includes(process.env.TASKDOCK_FIXTURE_SECRET),
        );
      } finally {
        if (old === undefined) delete process.env.TASKDOCK_FIXTURE_SECRET;
        else process.env.TASKDOCK_FIXTURE_SECRET = old;
      }
    },
    {
      runner: async (o) => {
        o.checkpoint("stage-output", {
          output: process.env.TASKDOCK_FIXTURE_SECRET,
        });
        return {
          executionMode: "fixture",
          verdict: "passed",
          summary: process.env.TASKDOCK_FIXTURE_SECRET,
          checks: [],
          stages: [],
          limitations: [],
        };
      },
    },
  ));

test("multiple open questions must all be answered before dispatch resumes", () =>
  fixture(async ({ store, executor }) => {
    store.createTask(config("questions-check"));
    const { run } = store.createRun({
      taskId: "questions-check",
      channel: "test",
      input: { evidence: true },
    });
    const first = store.askHuman(run.id, {
      key: "first",
      question: "first question",
      fields: [{ id: "note", label: "note", type: "text", required: true }],
    });
    const second = store.askHuman(run.id, {
      key: "second",
      question: "second question",
      fields: [{ id: "note", label: "note", type: "text", required: true }],
    });
    executor.answer(run.id, first.id, { note: "first answer" });
    assert.equal(store.run(run.id).status, "waiting_human");
    executor.answer(run.id, second.id, { note: "second answer" });
    await executor.idle();
    assert.equal(store.run(run.id).status, "succeeded");
  }));

test("an expired Attempt is fenced off after a replacement claim", () =>
  fixture(async ({ store, executor }) => {
    store.createTask(config("fence-check"));
    const { run } = store.createRun({
      taskId: "fence-check",
      channel: "test",
      input: { evidence: true },
    });
    const a = store.claim("owner-a", 10000);
    store.db
      .prepare("UPDATE attempts SET lease_until=? WHERE id=?")
      .run("2000-01-01T00:00:00.000Z", a.attemptId);
    store.recoverOrphans();
    const b = store.claim("owner-b", 10000);
    assert.throws(
      () =>
        store.completeRun(
          run.id,
          "succeeded",
          { verdict: "passed" },
          null,
          a.attemptId,
        ),
      (e) => e.status === 409,
    );
    store.completeRun(
      run.id,
      "succeeded",
      { verdict: "passed" },
      null,
      b.attemptId,
    );
    assert.equal(store.run(run.id).attempts[0].state, "interrupted");
  }));

test("descendant tool calls share the root budget and completed receipts are reused", () =>
  fixture(
    async ({ store, executor }) => {
      const leaf = await publish(
        store,
        executor,
        config("tool-leaf", {
          runner: "pi",
          mcpServers: [
            {
              name: "proof",
              url: "http://127.0.0.1:1/mcp",
              allowedTools: ["inspect"],
            },
          ],
        }),
      );
      await publish(
        store,
        executor,
        config("tool-parent", {
          children: [ref(leaf, "first-check"), ref(leaf, "second-check")],
        }),
      );
      const r = executor.submit({
        taskId: "tool-parent",
        input: { evidence: true },
        authorization: { maxToolCalls: 1 },
      });
      await executor.idle();
      const done = store.run(r.id);
      assert.equal(done.status, "failed");
      const calls = done.children.flatMap((c) => store.run(c.id).toolCalls);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].invocations, 1);
    },
    {
      runner: async (o) => {
        await o.invokeTool({
          stage: 0,
          server: "proof",
          name: "inspect",
          args: { value: o.input.evidence },
          execute: async () => ({
            content: [{ type: "text", text: "fixture" }],
            details: {},
          }),
        });
        return {
          executionMode: "fixture",
          verdict: "passed",
          summary: "checked",
          checks: [],
          stages: [],
          limitations: [],
        };
      },
    },
  ));
