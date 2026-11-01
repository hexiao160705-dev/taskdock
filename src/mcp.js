import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { inputSchema, slug, authorizationSchema } from "./schema.js";

export function createMcpServer(call) {
  const server = new McpServer(
    { name: "taskdock", version: "0.2.0" },
    {
      instructions:
        "Discover task services first. Use a fresh session per parent conversation. Submit only minimal context. Stable only. Never reuse another conversation token.",
    },
  );
  const register = (name, description, schema, fn) =>
    server.registerTool(
      name,
      { description, inputSchema: schema },
      async (args) => {
        try {
          const result = await fn(args);
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (e) {
          return {
            isError: true,
            content: [{ type: "text", text: e.message || "调用失败" }],
          };
        }
      },
    );
  register(
    "taskdock_search",
    "搜索已发布的任务类型；无匹配时在当前会话完成",
    { query: z.string().max(500).default("") },
    ({ query }) =>
      call("GET", `/api/client/search?q=${encodeURIComponent(query)}`),
  );
  register(
    "taskdock_plan",
    "为上层已拆解的目标推荐已有任务；关键词匹配，未知项交还当前会话",
    { goals: z.array(z.string().min(1).max(500)).min(1).max(20) },
    (args) => call("POST", "/api/client/plan", args),
  );
  register(
    "taskdock_open_session",
    "为当前父会话创建独立 capability；不要与其他会话复用",
    { label: z.string().min(1).max(120) },
    (args) => call("POST", "/api/client/sessions", args),
  );
  register(
    "taskdock_submit",
    "向正式版提交独立请求，同一会话内幂等重试",
    {
      taskId: slug,
      input: inputSchema,
      sessionToken: z.string().min(20).max(100),
      idempotencyKey: z.string().min(1).max(160),
      authorization: authorizationSchema.optional(),
    },
    ({ sessionToken, ...body }) =>
      call("POST", "/api/client/runs", body, sessionToken),
  );
  register(
    "taskdock_get_run",
    "获取自己会话的请求结果；其他会话的请求不可访问",
    { runId: z.string().uuid(), sessionToken: z.string().min(20).max(100) },
    ({ runId, sessionToken }) =>
      call("GET", `/api/client/runs/${runId}`, null, sessionToken),
  );
  register(
    "taskdock_list_runs",
    "只列出自己会话的历史请求",
    { sessionToken: z.string().min(20).max(100) },
    ({ sessionToken }) => call("GET", "/api/client/runs", null, sessionToken),
  );
  register(
    "taskdock_cancel_run",
    "取消属于当前会话的请求",
    { runId: z.string().uuid(), sessionToken: z.string().min(20).max(100) },
    ({ runId, sessionToken }) =>
      call("POST", `/api/client/runs/${runId}/cancel`, {}, sessionToken),
  );
  register(
    "taskdock_retry_run",
    "明确重试自己会话的失败请求，保留版本与证据，仍须满足授权和预算",
    { runId: z.string().uuid(), sessionToken: z.string().min(20).max(100) },
    ({ runId, sessionToken }) =>
      call("POST", `/api/client/runs/${runId}/retry`, {}, sessionToken),
  );
  register(
    "taskdock_answer",
    "提交问题对应的结构化回答；只传用户明确提供的回答，不据此扩权",
    {
      runId: z.string().uuid(),
      attentionId: z.string().uuid(),
      answers: z.record(
        z.string(),
        z.union([z.string().max(8000), z.boolean()]),
      ),
      sessionToken: z.string().min(20).max(100),
    },
    ({ runId, attentionId, sessionToken, answers }) =>
      call(
        "POST",
        `/api/client/runs/${runId}/attentions/${attentionId}/answer`,
        { answers },
        sessionToken,
      ),
  );
  register(
    "taskdock_receive",
    "拉取自己会话的持久消息；按消息 ID 去重，处理后 ACK，租约过期会重投",
    {
      sessionToken: z.string().min(20).max(100),
      limit: z.number().int().min(1).max(20).default(10),
      leaseSeconds: z.number().int().min(5).max(120).default(30),
    },
    ({ sessionToken, ...body }) =>
      call("POST", "/api/client/deliveries/receive", body, sessionToken),
  );
  for (const name of ["ack", "nack"])
    register(
      `taskdock_${name}`,
      name === "ack"
        ? "确认已处理的消息；回执持久且幂等"
        : "暂时无法处理消息，退避后重投",
      {
        sessionToken: z.string().min(20).max(100),
        messageId: z.string().uuid(),
        receipt: z.string().min(20).max(100),
      },
      ({ sessionToken, messageId, receipt }) =>
        call(
          "POST",
          `/api/client/deliveries/${messageId}/${name}`,
          { receipt },
          sessionToken,
        ),
    );
  return server;
}

export function httpCaller(base, apiToken = "") {
  return async (method, route, body, sessionToken) => {
    const headers = { "Content-Type": "application/json" };
    if (apiToken) headers["X-TaskDock-Key"] = apiToken;
    if (sessionToken) headers.Authorization = `Session ${sessionToken}`;
    const response = await fetch(`${base}${route}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };
}
