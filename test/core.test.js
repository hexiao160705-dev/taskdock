import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../src/store.js";
import { Executor } from "../src/runner.js";
import { taskSchema, digest, publicBundle } from "../src/schema.js";
import { seeds } from "../src/seeds.js";
import { Scheduler } from "../src/scheduler.js";

async function fixture(fn, opts = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-test-"));
  const store = new Store(dir),
    executor = new Executor(store, opts);
  try {
    await fn({ store, executor, dir });
  } finally {
    await executor.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
const passInput = { ...seeds[0].sampleInput, deviceVerified: true };
async function publish(store, executor, config = seeds[0]) {
  store.createTask(config);
  const r = executor.submit({
    taskId: config.id,
    input: config.id === "release-check" ? passInput : config.sampleInput,
    channel: "test",
  });
  await executor.idle();
  assert.equal(store.run(r.id).status, "succeeded");
  return store.promote(config.id);
}

test("A/B concurrent requests pin the same capability but cannot read each other", () =>
  fixture(async ({ store, executor, dir }) => {
    await publish(store, executor);
    const a = store.openSession("A"),
      b = store.openSession("B");
    const sa = store.session(a.sessionToken),
      sb = store.session(b.sessionToken);
    const ra = executor.submit({
        taskId: "release-check",
        input: { ...passInput, privateContext: "ONLY_A_中文" },
        sessionId: sa.id,
        idempotencyKey: "one",
      }),
      rb = executor.submit({
        taskId: "release-check",
        input: { ...passInput, privateContext: "ONLY_B" },
        sessionId: sb.id,
        idempotencyKey: "one",
      });
    await executor.idle();
    assert.equal(ra.digest, rb.digest);
    assert.throws(
      () => store.run(ra.id, sb.id),
      (e) => e.status === 404,
    );
    assert.equal(store.runs({ sessionId: sb.id }).length, 1);
    const afile = readFileSync(
      path.join(store.dir("release-check", ra.id), "request.json"),
      "utf8",
    );
    assert.ok(afile.includes("ONLY_A_中文"));
    assert.ok(!afile.includes("ONLY_B"));
    assert.ok(!JSON.stringify(store.run(rb.id)).includes("ONLY_A_中文"));
    assert.ok(
      !readFileSync(
        path.join(dir, "tasks/release-check/summary.json"),
        "utf8",
      ).includes("ONLY_A"),
    );
    assert.ok(!JSON.stringify(store.tasks()).includes("ONLY_A"));
  }));
test("idempotent retry returns one request; different input or channel conflicts", () =>
  fixture(async ({ store, executor }) => {
    await publish(store, executor);
    const s = store.openSession("A"),
      id = store.session(s.sessionToken).id;
    const r = executor.submit({
      taskId: "release-check",
      input: passInput,
      sessionId: id,
      idempotencyKey: "same",
    });
    assert.equal(
      executor.submit({
        taskId: "release-check",
        input: passInput,
        sessionId: id,
        idempotencyKey: "same",
      }).id,
      r.id,
    );
    assert.throws(
      () =>
        executor.submit({
          taskId: "release-check",
          input: { changed: true },
          sessionId: id,
          idempotencyKey: "same",
        }),
      (e) => e.status === 409,
    );
    assert.throws(
      () =>
        executor.submit({
          taskId: "release-check",
          input: passInput,
          channel: "test",
          sessionId: id,
          idempotencyKey: "same",
        }),
      (e) => e.status === 409,
    );
    await executor.idle();
    assert.equal(store.runs({ sessionId: id }).length, 1);
  }));
test("stable publication requires successful test of the exact draft digest", () =>
  fixture(async ({ store, executor }) => {
    store.createTask(seeds[0]);
    assert.throws(
      () => store.promote("release-check"),
      (e) => e.status === 409,
    );
    executor.submit({
      taskId: "release-check",
      input: seeds[0].sampleInput,
      channel: "test",
    });
    await executor.idle();
    assert.throws(
      () => store.promote("release-check"),
      (e) => e.status === 409,
    );
    executor.submit({
      taskId: "release-check",
      input: passInput,
      channel: "test",
    });
    await executor.idle();
    const old = store.task("release-check");
    store.saveDraft(
      old.id,
      { ...old.draft, instructions: "new rule" },
      old.revision,
    );
    assert.throws(
      () => store.promote(old.id),
      (e) => e.status === 409,
    );
    executor.submit({ taskId: old.id, input: passInput, channel: "test" });
    await executor.idle();
    const t = store.promote(old.id);
    assert.equal(t.stable.digest, digest(t.draft));
    assert.equal(
      store.git(t.id, ["show", `${t.stable.git_sha}:task.json`]),
      JSON.stringify(t.draft, null, 2),
    );
    assert.equal(store.git(t.id, ["tag", "--list"]), "v0.1.0");
  }));
test("draft changes cannot mutate queued stable requests; real Git rollback", () =>
  fixture(async ({ store, executor }) => {
    let t = await publish(store, executor);
    const original = t.stable,
      run = executor.submit({ taskId: t.id, input: passInput });
    t = store.saveDraft(
      t.id,
      { ...t.draft, name: "更新的上线检查" },
      t.revision,
    );
    assert.equal(store.task(t.id).stable.digest, original.digest);
    executor.submit({ taskId: t.id, input: passInput, channel: "test" });
    await executor.idle();
    t = store.promote(t.id);
    assert.equal(t.stable.version, "0.1.1");
    assert.equal(store.run(run.id).config.name, seeds[0].name);
    assert.equal(store.run(run.id).digest, original.digest);
    t = store.rollback(t.id, original.id);
    assert.equal(t.stable.git_sha, original.git_sha);
    assert.ok(store.git(t.id, ["tag", "--list"]).includes("rollback-"));
  }));
test("revision conflict prevents lost updates", () =>
  fixture(async ({ store }) => {
    let t = store.createTask(seeds[0]);
    store.saveDraft(t.id, { ...t.draft, name: "A" }, t.revision);
    assert.throws(
      () => store.saveDraft(t.id, { ...t.draft, name: "B" }, t.revision),
      (e) => e.status === 409,
    );
    assert.equal(store.task(t.id).draft.name, "A");
  }));
test("knowledge is reviewed into draft only; stable and prior snapshots remain unchanged", () =>
  fixture(async ({ store, executor }) => {
    let t = await publish(store, executor);
    const stableHash = t.stable.digest;
    const r = executor.submit({ taskId: t.id, input: passInput });
    await executor.idle();
    const p = store.propose({
      taskId: t.id,
      runId: r.id,
      content: "每次发布检查回滚方案与最近一次备份证据。",
    });
    assert.equal(store.task(t.id).draft.knowledge.length, 0);
    store.reviewProposal(p.id, "approved");
    t = store.task(t.id);
    assert.equal(t.draft.knowledge.length, 1);
    assert.equal(t.stable.config.knowledge.length, 0);
    assert.equal(t.stable.digest, stableHash);
    assert.equal(store.run(r.id).config.knowledge.length, 0);
    assert.throws(
      () => store.promote(t.id),
      (e) => e.status === 409,
    );
    assert.throws(
      () => store.reviewProposal(p.id, "approved"),
      (e) => e.status === 409,
    );
  }));
test("disabled learning and cross-task source are rejected", () =>
  fixture(async ({ store, executor }) => {
    await publish(store, executor);
    store.createTask({ ...seeds[1], learningPolicy: "disabled" });
    assert.throws(
      () => store.propose({ taskId: seeds[1].id, content: "not allowed" }),
      (e) => e.status === 409,
    );
    store.createTask({ ...seeds[1], id: "other-task" });
    const run = store.runs()[0];
    assert.throws(
      () =>
        store.propose({
          taskId: "other-task",
          runId: run.id,
          content: "bad source",
        }),
      (e) => e.status === 422,
    );
  }));
test("schedules persist the scheduler computed next instant in Shanghai time and fire once", () =>
  fixture(async ({ store, executor }) => {
    await publish(store, executor);
    const expected = store.nextTime(
      "0 9 * * 1-5",
      "Asia/Shanghai",
      new Date("2026-11-01T01:00:00Z"),
    );
    assert.equal(expected, "2026-11-02T01:00:00.000Z");
    const s = store.createSchedule({
      taskId: "release-check",
      name: "test",
      cron: "0 9 * * 1-5",
      timezone: "Asia/Shanghai",
      input: passInput,
      enabled: true,
    });
    assert.equal(store.schedule(s.id).next_run_at, s.next_run_at);
    assert.equal(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: s.timezone,
        hour: "2-digit",
        hour12: false,
      }).format(new Date(s.next_run_at)),
      "09",
    );
    store.db
      .prepare("UPDATE schedules SET next_run_at=? WHERE id=?")
      .run("2026-11-02T01:00:00.000Z", s.id);
    const scheduler = new Scheduler(store, executor);
    try {
      scheduler.tick(new Date("2026-11-02T01:00:01Z"));
      scheduler.tick(new Date("2026-11-02T01:00:01Z"));
      await executor.idle();
      assert.equal(store.runs({ sessionId: `schedule:${s.id}` }).length, 1);
      assert.equal(
        store.schedule(s.id).next_run_at,
        "2026-11-03T01:00:00.000Z",
      );
    } finally {
      scheduler.close();
    }
    assert.throws(
      () => store.nextTime("* * * * *", "Fake/Zone"),
      (e) => e.status === 422,
    );
  }));
test("export excludes run history, example input, MCP connections and custom key env", () =>
  fixture(async ({ store, executor }) => {
    const t = await publish(store, executor);
    const config = {
      ...t.draft,
      mcpServers: [
        {
          name: "private-mcp",
          url: "https://internal.example/mcp",
          tokenEnv: "PRIVATE_SECRET",
          allowedTools: ["check"],
        },
      ],
      model: {
        provider: "openai",
        name: "gpt-4.1-mini",
        apiKeyEnv: "MY_PERSONAL_KEY",
      },
    };
    const b = publicBundle(config, "0.1.0");
    assert.equal(b.task.mcpServers.length, 0);
    assert.deepEqual(b.task.sampleInput, {});
    assert.equal(b.digest, digest(b.task));
    const text = JSON.stringify(b);
    assert.ok(!text.includes("internal.example"));
    assert.ok(!text.includes("MY_PERSONAL_KEY"));
    assert.ok(!text.includes("privateContext"));
    assert.throws(
      () =>
        publicBundle(
          {
            ...config,
            instructions: "Bearer abcdefghijklmnopqrstuvwxyz123456",
          },
          "0.1.0",
        ),
      (e) => e.status === 422,
    );
  }));
test("invalid paths, shell fields and MCP credentials in URLs are rejected", () => {
  assert.throws(() => taskSchema.parse({ ...seeds[0], id: "../../outside" }));
  assert.throws(() => taskSchema.parse({ ...seeds[0], command: "rm -rf" }));
  assert.throws(() =>
    taskSchema.parse({
      ...seeds[0],
      mcpServers: [
        {
          name: "unsafe",
          url: "https://user:secret@example.com/mcp",
          allowedTools: ["x"],
        },
      ],
    }),
  );
  assert.throws(() => taskSchema.parse({ ...seeds[0], checks: [] }));
});
test("queued cancellation and failure produce distinct persisted status", () =>
  fixture(async ({ store, executor }) => {
    store.createTask({ ...seeds[0], runner: "pi" });
    const r = executor.submit({
      taskId: "release-check",
      channel: "test",
      input: {},
    });
    executor.cancel(r.id);
    await executor.idle();
    assert.equal(store.run(r.id).status, "cancelled");
    const r2 = executor.submit({
      taskId: "release-check",
      channel: "test",
      input: {},
    });
    await executor.idle();
    assert.equal(store.run(r2.id).status, "failed");
    assert.ok(store.run(r2.id).error.includes("模型未配置"));
    assert.ok(
      existsSync(path.join(store.dir("release-check", r2.id), "result.json")),
    );
  }));
test("timeout is enforced and sensitive error text is redacted", () =>
  fixture(
    async ({ store, executor }) => {
      store.createTask({ ...seeds[0], runner: "pi" });
      const r = executor.submit({
        taskId: "release-check",
        channel: "test",
        input: {},
      });
      await executor.idle();
      assert.equal(store.run(r.id).status, "cancelled");
      assert.ok(store.run(r.id).error.includes("超时"));
    },
    {
      timeoutMs: 20,
      runner: async ({ signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        ),
    },
  ));
test("restart interrupts unfinished runs without replaying side effects", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-restart-"));
  let store = new Store(dir);
  try {
    store.createTask(seeds[0]);
    const { run } = store.createRun({
      taskId: "release-check",
      channel: "test",
      input: passInput,
    });
    store.start(run.id);
    store.close();
    store = new Store(dir);
    assert.equal(store.run(run.id).status, "interrupted");
    assert.ok(store.run(run.id).error.includes("未自动重放"));
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("archiving preserves evidence and explicitly includes archived history", () =>
  fixture(async ({ store, executor }) => {
    await publish(store, executor);
    const id = store.runs()[0].id;
    store.archive(id);
    assert.equal(store.runs().length, 0);
    assert.equal(store.runs({ includeArchived: true }).length, 1);
    assert.ok(store.run(id).result);
  }));
test("user-defined learning rules create deduplicated proposals without copying request context", () =>
  fixture(async ({ store, executor }) => {
    await publish(store, executor);
    for (let i = 0; i < 2; i++) {
      executor.submit({
        taskId: "release-check",
        input: { ...seeds[0].sampleInput, private: "NEVER_LEARN_THIS_CONTEXT" },
      });
      await executor.idle();
    }
    const proposals = store.proposals();
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].status, "pending");
    assert.ok(!JSON.stringify(proposals).includes("NEVER_LEARN_THIS_CONTEXT"));
    assert.equal(store.task("release-check").stable.config.knowledge.length, 0);
    assert.equal(store.task("release-check").draft.knowledge.length, 0);
  }));
