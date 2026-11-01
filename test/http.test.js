import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { createRegistry } from "../src/registry-server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { seeds } from "../src/seeds.js";
import { request as nodeRequest } from "node:http";
import { piRunner, createScopedPiSession } from "../src/runner.js";
import { taskSchema, digest } from "../src/schema.js";
import {
  createAssistantMessageEventStream,
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai";

const listen = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` }),
    );
  });
const stop = (server) => new Promise((resolve) => server.close(resolve));
test("Pi custom tool bridge invokes only configured MCP allowlist (real local MCP, mocked model)", () =>
  fixture(async ({ url }) => {
    const dir = mkdtempSync(path.join(tmpdir(), "taskdock-pi-mcp-"));
    const keyBefore = process.env.TASKDOCK_TEST_MODEL_KEY;
    process.env.TASKDOCK_TEST_MODEL_KEY = "test-only-not-a-real-credential";
    let count = 0;
    const contexts = [],
      events = [];
    try {
      const config = taskSchema.parse({
        ...seeds[0],
        runner: "pi",
        model: {
          provider: "openai",
          name: "gpt-4.1-mini",
          apiKeyEnv: "TASKDOCK_TEST_MODEL_KEY",
        },
        mcpServers: [
          {
            name: "inner",
            url: `${url}/mcp`,
            allowedTools: ["taskdock_search"],
          },
        ],
      });
      const result = await piRunner({
        config,
        input: { request: "列出上线检查任务" },
        signal: new AbortController().signal,
        event: (type, data) => events.push({ type, data }),
        runDir: dir,
        sessionFactory: async (options) => {
          const scoped = await createScopedPiSession(options);
          assert.deepEqual(scoped.session.getActiveToolNames(), [
            "td_inner_taskdock_search",
          ]);
          options.runtime.streamSimple = (_model, context) => {
            contexts.push(JSON.stringify(context));
            const stream = createAssistantMessageEventStream();
            queueMicrotask(() => {
              const message =
                ++count === 1
                  ? fauxAssistantMessage(
                      fauxToolCall("td_inner_taskdock_search", {
                        query: "上线检查",
                      }),
                      { stopReason: "toolUse" },
                    )
                  : fauxAssistantMessage(
                      "Mock model consumed the real local MCP result",
                    );
              stream.push({
                type: "done",
                reason: message.stopReason,
                message,
              });
            });
            return stream;
          };
          return scoped;
        },
      });
      assert.equal(result.executionMode, "pi");
      assert.equal(count, 2);
      assert.ok(contexts[1].includes("release-check"));
      assert.equal(events.filter((e) => e.type === "tool").length, 1);
    } finally {
      if (keyBefore === undefined) delete process.env.TASKDOCK_TEST_MODEL_KEY;
      else process.env.TASKDOCK_TEST_MODEL_KEY = keyBefore;
      rmSync(dir, { recursive: true, force: true });
    }
  }));
async function fixture(fn, opts = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-http-"));
  const service = await createApp({ dataDir: dir, scheduler: false, ...opts });
  const { server, url } = await listen(service.app);
  const request = async (
    route,
    { method = "GET", body, headers = {} } = {},
  ) => {
    const r = await fetch(url + route, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    await fn({ service, url, request });
  } finally {
    await stop(server);
    await service.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
test("HTTP clients use isolated session capabilities and stable-only validated submission", () =>
  fixture(async ({ service, request }) => {
    const a = (
        await request("/api/client/sessions", {
          method: "POST",
          body: { label: "A" },
        })
      ).body,
      b = (
        await request("/api/client/sessions", {
          method: "POST",
          body: { label: "B" },
        })
      ).body;
    const headers = { Authorization: `Session ${a.sessionToken}` };
    const input = {
      ...seeds[0].sampleInput,
      deviceVerified: true,
      private: "A_ONLY",
    };
    const r = await request("/api/client/runs", {
      method: "POST",
      headers,
      body: { taskId: "release-check", input, idempotencyKey: "http" },
    });
    assert.equal(r.status, 202);
    await service.executor.idle();
    assert.equal(
      (
        await request(`/api/client/runs/${r.body.id}`, {
          headers: { Authorization: `Session ${b.sessionToken}` },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request("/api/client/runs", {
          headers: { Authorization: `Session ${b.sessionToken}` },
        })
      ).body.runs.length,
      0,
    );
    assert.equal((await request(`/api/client/runs/${r.body.id}`)).status, 401);
    assert.equal(
      (
        await request("/api/client/runs", {
          method: "POST",
          headers,
          body: {
            taskId: "release-check",
            input,
            idempotencyKey: "bad",
            channel: "test",
          },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await request("/api/client/runs", {
          method: "POST",
          headers,
          body: { taskId: "release-check", input, idempotencyKey: "http" },
        })
      ).body.id,
      r.body.id,
    );
  }));
test("search returns stable services, unmatched plans fall back locally, drafts stay hidden", () =>
  fixture(async ({ service, request }) => {
    service.store.createTask({
      ...seeds[0],
      id: "hidden-draft",
      name: "INVISIBLE",
    });
    const r = await request("/api/client/search?q=上线");
    assert.ok(r.body.tasks.some((t) => t.id === "release-check"));
    assert.ok(!r.body.tasks.some((t) => t.id === "hidden-draft"));
    const p = await request("/api/client/plan", {
      method: "POST",
      body: { goals: ["服务上线检查", "画一幅水彩画XYZ"] },
    });
    assert.equal(p.body.goals[0].action, "delegate-candidate");
    assert.equal(p.body.goals[1].action, "complete-locally");
  }));
test("cross-origin requests, DNS rebinding, malformed schema and oversized input are rejected", () =>
  fixture(async ({ request, url }) => {
    assert.equal(
      (
        await request("/api/tasks", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    const hostStatus = await new Promise((resolve, reject) => {
      const r = nodeRequest(
        `${url}/api/tasks`,
        { headers: { Host: "evil.example" } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      r.on("error", reject);
      r.end();
    });
    assert.equal(hostStatus, 403);
    assert.equal(
      (await request("/api/tasks", { method: "POST", body: { id: "../bad" } }))
        .status,
      422,
    );
    assert.equal(
      (
        await request("/api/client/sessions", {
          method: "POST",
          body: { label: "ok", unexpected: true },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await request("/api/tasks/release-check/test", {
          method: "POST",
          body: { input: { value: "a".repeat(65000) } },
        })
      ).status,
      422,
    );
  }));
test("API authentication is required when configured, with Unicode-safe comparisons", () =>
  fixture(
    async ({ request }) => {
      assert.equal((await request("/api/overview")).status, 401);
      assert.equal(
        (
          await request("/api/overview", {
            headers: { "X-TaskDock-Key": "x".repeat(32) },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/api/overview", {
            headers: { "X-TaskDock-Key": "é".repeat(32) },
          })
        ).status,
        401,
      );
      assert.equal((await request("/health")).body.service, "taskdock");
    },
    { apiToken: "x".repeat(32) },
  ));
test("official MCP Streamable HTTP client discovers, opens, submits and retrieves real results", () =>
  fixture(async ({ service, url }) => {
    const client = new Client({ name: "integration-test", version: "1.0.0" });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${url}/mcp`)),
      );
      const list = await client.listTools();
      assert.equal(list.tools.length, 12);
      const call = async (name, args) => {
        const r = await client.callTool({ name, arguments: args });
        assert.ok(!r.isError, JSON.stringify(r));
        return r.structuredContent;
      };
      const found = await call("taskdock_search", { query: "上线检查" });
      assert.equal(found.tasks[0].id, "release-check");
      const s = await call("taskdock_open_session", { label: "MCP A" }),
        other = await call("taskdock_open_session", { label: "MCP B" });
      const run = await call("taskdock_submit", {
        taskId: "release-check",
        sessionToken: s.sessionToken,
        idempotencyKey: "mcp1",
        input: { ...seeds[0].sampleInput, deviceVerified: true },
      });
      await service.executor.idle();
      const done = await call("taskdock_get_run", {
        runId: run.id,
        sessionToken: s.sessionToken,
      });
      assert.equal(done.status, "succeeded");
      assert.equal(done.result.executionMode, "deterministic");
      const forbidden = await client.callTool({
        name: "taskdock_get_run",
        arguments: { runId: run.id, sessionToken: other.sessionToken },
      });
      assert.equal(forbidden.isError, true);
    } finally {
      await client.close();
    }
  }));
test("official MCP stdio client is a thin client to the same isolation service", () =>
  fixture(async ({ service, url }) => {
    const client = new Client({ name: "stdio-test", version: "1" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["src/mcp-stdio.js"],
      env: { PATH: process.env.PATH, TASKDOCK_URL: url },
      stderr: "pipe",
    });
    try {
      await client.connect(transport);
      const r = await client.callTool({
        name: "taskdock_open_session",
        arguments: { label: "stdio isolated" },
      });
      assert.ok(r.structuredContent.sessionToken);
      const run = await client.callTool({
        name: "taskdock_submit",
        arguments: {
          taskId: "requirement-review",
          input: seeds[1].sampleInput,
          sessionToken: r.structuredContent.sessionToken,
          idempotencyKey: "stdio",
        },
      });
      await service.executor.idle();
      assert.equal(
        service.store.run(run.structuredContent.id).status,
        "succeeded",
      );
    } finally {
      await client.close();
    }
  }));
test("independent registry round-trip validates digest, sanitizes export, and installs draft only", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskdock-registry-"));
  const registry = createRegistry({ dataDir: dir });
  const { server, url } = await listen(registry.app);
  try {
    await fixture(
      async ({ service, request }) => {
        assert.equal(
          (
            await request("/api/tasks/release-check/share", {
              method: "POST",
              body: { reviewed: false },
            })
          ).status,
          422,
        );
        const shared = await request("/api/tasks/release-check/share", {
          method: "POST",
          body: { reviewed: true },
        });
        assert.equal(shared.status, 201);
        const catalog = (await request("/api/registry")).body;
        assert.equal(catalog.packages.length, 1);
        const pkg = catalog.packages[0];
        assert.deepEqual(pkg.task.sampleInput, {});
        assert.deepEqual(pkg.task.mcpServers, []);
        const installed = await request("/api/registry/install", {
          method: "POST",
          body: { digest: pkg.digest, id: "installed-check" },
        });
        assert.equal(installed.status, 201);
        assert.equal(installed.body.stable, null);
        assert.deepEqual(
          service.store.task("installed-check").draft.sampleInput,
          {},
        );
        assert.equal(
          (await request("/api/client/search?q=installed-check")).body.tasks
            .length,
          0,
        );
        const altered = { ...pkg, digest: "0".repeat(64) };
        delete altered.createdAt;
        const bad = await fetch(url + "/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(altered),
        });
        assert.equal(bad.status, 422);
        const legacyTask = { ...pkg.task };
        delete legacyTask.children;
        delete legacyTask.limits;
        legacyTask.model = {
          ...legacyTask.model,
          apiKeyEnv: "UNTRUSTED_CREDENTIAL_REFERENCE",
        };
        const legacy = {
          schemaVersion: "taskdock/0.1",
          version: "0.1.0",
          task: legacyTask,
          digest: digest(legacyTask),
        };
        const posted = await fetch(url + "/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(legacy),
        });
        assert.equal(posted.status, 201);
        const oldInstalled = await request("/api/registry/install", {
          method: "POST",
          body: { digest: legacy.digest, id: "legacy-check" },
        });
        assert.equal(oldInstalled.status, 201);
        assert.equal(
          oldInstalled.body.draft.model.apiKeyEnv,
          "TASKDOCK_IMPORTED_MODEL_KEY",
        );
        assert.equal(oldInstalled.body.stable, null);
      },
      { registryUrl: url },
    );
  } finally {
    await stop(server);
    registry.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("HTTP task composition, fork, typed human answers and durable receipt protocol keep session isolation", () =>
  fixture(async ({ service, request, url }) => {
    const child = service.store.task("requirement-review").stable;
    const task = {
      ...seeds[1],
      id: "approval-parent",
      name: "approval parent",
      children: [
        {
          key: "shared-review",
          taskId: "requirement-review",
          releaseId: child.id,
          digest: child.digest,
          inputMap: {
            goal: "goal",
            audience: "audience",
            constraints: "constraints",
            acceptance: "acceptance",
          },
        },
      ],
      humanGate: {
        question: "provide approval context",
        when: "before",
        fields: [{ id: "note", label: "note", type: "text", required: true }],
      },
    };
    assert.equal(
      (await request("/api/tasks", { method: "POST", body: task })).status,
      201,
    );
    let proof = (
      await request("/api/tasks/approval-parent/test", {
        method: "POST",
        body: { input: task.sampleInput },
      })
    ).body;
    await service.executor.idle();
    proof = service.store.run(proof.id);
    assert.equal(proof.status, "waiting_human");
    assert.deepEqual(proof.children, []);
    assert.equal(
      (
        await request(
          `/api/runs/${proof.id}/attentions/${proof.attentions[0].id}/answer`,
          { method: "POST", body: { answers: { note: "fixture approval" } } },
        )
      ).status,
      202,
    );
    await service.executor.idle();
    assert.equal(
      (
        await request("/api/tasks/approval-parent/promote", {
          method: "POST",
          body: {},
        })
      ).status,
      200,
    );
    const fork = await request("/api/tasks/requirement-review/fork", {
      method: "POST",
      body: {
        id: "forked-review",
        name: "tailored",
        patch: { instructions: "new method" },
      },
    });
    assert.equal(fork.status, 201);
    assert.equal(fork.body.draft.origin.digest, child.digest);
    assert.equal(fork.body.stable, null);
    assert.ok(
      (await request("/api/task-graph")).body.edges.some(
        (e) => e.parentId === "approval-parent",
      ),
    );
    const a = (
        await request("/api/client/sessions", {
          method: "POST",
          body: { label: "A" },
        })
      ).body,
      b = (
        await request("/api/client/sessions", {
          method: "POST",
          body: { label: "B" },
        })
      ).body;
    const ah = { Authorization: `Session ${a.sessionToken}` },
      bh = { Authorization: `Session ${b.sessionToken}` };
    let r = (
      await request("/api/client/runs", {
        method: "POST",
        headers: ah,
        body: {
          taskId: task.id,
          input: { ...task.sampleInput, private: "PARENT_A_ONLY" },
          idempotencyKey: "human-http",
        },
      })
    ).body;
    await service.executor.idle();
    r = service.store.run(r.id);
    const attention = r.attentions[0];
    assert.equal(
      (
        await request(
          `/api/client/runs/${r.id}/attentions/${attention.id}/answer`,
          {
            method: "POST",
            headers: bh,
            body: { answers: { note: "wrong session" } },
          },
        )
      ).status,
      404,
    );
    const mcp = new Client({ name: "reliability-mcp", version: "1" });
    try {
      await mcp.connect(
        new StreamableHTTPClientTransport(new URL(url + "/mcp")),
      );
      const answered = await mcp.callTool({
        name: "taskdock_answer",
        arguments: {
          runId: r.id,
          attentionId: attention.id,
          answers: { note: "explicit fixture answer" },
          sessionToken: a.sessionToken,
        },
      });
      assert.ok(!answered.isError);
      await service.executor.idle();
      assert.equal(service.store.run(r.id).status, "succeeded");
      const result = await mcp.callTool({
        name: "taskdock_receive",
        arguments: { sessionToken: a.sessionToken, leaseSeconds: 5 },
      });
      const messages = result.structuredContent.messages;
      assert.ok(
        messages.some(
          (m) => m.payload.runId === r.id && m.kind === "waiting_human",
        ),
      );
      assert.deepEqual(
        (
          await request("/api/client/deliveries/receive", {
            method: "POST",
            headers: bh,
            body: {},
          })
        ).body.messages,
        [],
      );
      for (const m of messages) {
        assert.equal(
          (
            await request(`/api/client/deliveries/${m.id}/ack`, {
              method: "POST",
              headers: bh,
              body: { receipt: m.receipt },
            })
          ).status,
          404,
        );
        const ack = await mcp.callTool({
          name: "taskdock_ack",
          arguments: {
            sessionToken: a.sessionToken,
            messageId: m.id,
            receipt: m.receipt,
          },
        });
        assert.equal(ack.structuredContent.state, "acked");
      }
      const next = (
        await request("/api/client/deliveries/receive", {
          method: "POST",
          headers: ah,
          body: {},
        })
      ).body.messages;
      assert.ok(
        next.some(
          (m) => m.payload.runId === r.id && m.payload.status === "succeeded",
        ),
      );
      assert.equal(
        (await request(`/api/client/runs/${r.id}`, { headers: bh })).status,
        404,
      );
    } finally {
      await mcp.close();
    }
  }));
