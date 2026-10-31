import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const client = new Client({
  name: "taskdock-two-session-demo",
  version: "0.1.0",
});
const base = process.env.TASKDOCK_URL || "http://127.0.0.1:4640";
const headers = process.env.TASKDOCK_API_TOKEN
  ? { "X-TaskDock-Key": process.env.TASKDOCK_API_TOKEN }
  : {};
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) throw new Error(r.content[0]?.text || "MCP error");
  return r.structuredContent;
};
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers },
    }),
  );
  const found = await call("taskdock_search", { query: "上线检查" });
  assert.ok(found.tasks.some((t) => t.id === "release-check"));
  const a = await call("taskdock_open_session", { label: "MCP 示例 · 项目 A" }),
    b = await call("taskdock_open_session", { label: "MCP 示例 · 项目 B" });
  const input = {
    healthStatus: 200,
    processAlive: true,
    testsPassed: true,
    deviceVerified: false,
    rollbackReady: true,
  };
  const [ra, rb] = await Promise.all([
    call("taskdock_submit", {
      taskId: "release-check",
      input: { ...input, project: "项目 A", context: "A_ONLY_CONTEXT" },
      sessionToken: a.sessionToken,
      idempotencyKey: crypto.randomUUID(),
    }),
    call("taskdock_submit", {
      taskId: "release-check",
      input: { ...input, project: "项目 B", context: "B_ONLY_CONTEXT" },
      sessionToken: b.sessionToken,
      idempotencyKey: crypto.randomUUID(),
    }),
  ]);
  let done = [];
  for (let i = 0; i < 30; i++) {
    done = await Promise.all([
      call("taskdock_get_run", { runId: ra.id, sessionToken: a.sessionToken }),
      call("taskdock_get_run", { runId: rb.id, sessionToken: b.sessionToken }),
    ]);
    if (done.every((r) => !["queued", "running"].includes(r.status))) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(!JSON.stringify(done[0]).includes("B_ONLY_CONTEXT"));
  assert.ok(!JSON.stringify(done[1]).includes("A_ONLY_CONTEXT"));
  const forbidden = await client.callTool({
    name: "taskdock_get_run",
    arguments: { runId: ra.id, sessionToken: b.sessionToken },
  });
  assert.equal(forbidden.isError, true);
  console.log(
    JSON.stringify(
      {
        layer: "real-local-MCP-integration",
        runs: done.map((r) => ({
          id: r.id,
          status: r.status,
          digest: r.digest,
          executionMode: r.result?.executionMode,
        })),
        crossSessionRead: "rejected",
        contextMixing: "not observed in these requests",
        limitation:
          "规则仅核对输入证据，没有检查真实部署；未提供实机证据应返回 needs-attention。",
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
