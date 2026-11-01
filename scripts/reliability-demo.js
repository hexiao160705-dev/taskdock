// Creates explicit deterministic demo capabilities through the public maintenance API.
// It never injects a model key or infers real service/device readiness.
const base = process.env.TASKDOCK_URL || "http://127.0.0.1:4640";
async function api(route, body, method = body === undefined ? "GET" : "POST") {
  const headers = { "Content-Type": "application/json" };
  if (process.env.TASKDOCK_API_TOKEN)
    headers["X-TaskDock-Key"] = process.env.TASKDOCK_API_TOKEN;
  const r = await fetch(base + route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
  return result;
}
async function wait(id) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    const r = await api(`/api/runs/${id}`);
    if (!["queued", "running", "waiting_children"].includes(r.status)) return r;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Demo queue timeout");
}
const existing = (await api("/api/tasks")).tasks;
async function install(c) {
  if (existing.some((t) => t.id === c.id)) return api(`/api/tasks/${c.id}`);
  await api("/api/tasks", c);
  let r = await api(`/api/tasks/${c.id}/test`, { input: c.sampleInput });
  r = await wait(r.id);
  if (r.status === "waiting_human") {
    const a = r.attentions.find((a) => a.status === "open");
    await api(`/api/runs/${r.id}/attentions/${a.id}/answer`, {
      answers: {
        confirmed: true,
        note: "仅用于确定性演示能力的测试，不代表真实上线验收。",
      },
    });
    r = await wait(r.id);
  }
  if (r.status !== "succeeded")
    throw new Error(`${c.id} demo proof failed: ${r.status}`);
  return api(`/api/tasks/${c.id}/promote`, {});
}
const child = await install({
  id: "shared-evidence",
  name: "共享证据检查",
  description: "两个父流程共用的确定性子能力。仅检查提交材料，不探测真实服务。",
  category: "engineering",
  runner: "checklist",
  checks: [
    {
      id: "evidence",
      label: "本次材料已提交",
      field: "evidence",
      operator: "truthy",
    },
  ],
  sampleInput: { evidence: "DEMO · submitted material" },
});
const reference = {
  key: "evidence-check",
  taskId: child.id,
  releaseId: child.stable.id,
  digest: child.stable.digest,
  inputMap: { evidence: "evidence" },
};
for (const [id, name] of [
  ["launch-flow", "项目上线流程"],
  ["change-flow", "变更评审流程"],
])
  await install({
    id,
    name,
    description: "引用共享证据子任务，保留独立请求树和最小字段映射。",
    category: "engineering",
    children: [reference],
    checks: [
      {
        id: "project",
        label: "项目名称已说明",
        field: "project",
        operator: "truthy",
      },
    ],
    sampleInput: {
      project: id === "launch-flow" ? "项目 A" : "项目 B",
      evidence: "DEMO · 本次提交的材料",
      privateNote: "这段不会传入共享子任务",
    },
  });
await install({
  id: "human-confirm",
  name: "人工等待与恢复演示",
  description:
    "提交后先等待结构化回答，再派工子任务，恢复同一请求并保留执行尝试。",
  category: "operations",
  children: [reference],
  humanGate: {
    question: "请确认这份演示材料，并补充说明。回答只用于本次请求。",
    when: "before",
    fields: [
      {
        id: "confirmed",
        label: "确认演示材料",
        type: "boolean",
        required: true,
        inputField: "confirmed",
      },
      { id: "note", label: "补充说明", type: "text", required: true },
    ],
  },
  checks: [
    {
      id: "confirmation",
      label: "本次材料已确认",
      field: "confirmed",
      operator: "equals",
      expected: true,
    },
  ],
  sampleInput: { evidence: "DEMO · material", confirmed: false },
});
console.log(
  "Deterministic demo capabilities ready: shared-evidence ← launch-flow / change-flow; human-confirm. No live model claim.",
);
