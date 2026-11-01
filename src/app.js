import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Store } from "./store.js";
import { Executor } from "./runner.js";
import { Scheduler } from "./scheduler.js";
import { createMcpServer, httpCaller } from "./mcp.js";
import {
  taskSchema,
  inputSchema,
  submitSchema,
  scheduleSchema,
  bundleSchema,
  digest,
  publicBundle,
  fail,
  slug,
} from "./schema.js";
import { seeds } from "./seeds.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_VERSION = "0.3.0";
const same = (a, b) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export const loopback = (host) =>
  ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
export function security({ apiToken = "", allowRemote = false } = {}) {
  return (req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    if (!allowRemote && !loopback(req.hostname))
      return res.status(403).json({ error: "Host 不在本地允许列表" });
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return res.status(403).json({ error: "跨来源访问已阻止" });
      } catch {
        return res.status(403).json({ error: "无效 Origin" });
      }
    }
    if (
      req.path === "/health" ||
      req.path === "/" ||
      req.path.startsWith("/assets/")
    )
      return next();
    if (apiToken) {
      const bearer = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : "";
      const key = String(req.headers["x-taskdock-key"] || bearer);
      if (!same(apiToken, key))
        return res.status(401).json({ error: "需要中台 API 凭证" });
    }
    next();
  };
}
export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  const validation = error instanceof ZodError;
  const status = validation ? 422 : error.status || 400;
  res.status(status).json({
    error: validation
      ? error.issues
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .slice(0, 6)
          .join("；")
      : status >= 500
        ? "服务内部错误；请查看本机诊断"
        : error.message,
  });
}

export async function createApp({
  dataDir = ".data",
  seed = true,
  apiToken = "",
  registryUrl = "http://127.0.0.1:4641",
  registryToken = "",
  allowRemote = false,
  executorOptions = {},
  scheduler = true,
} = {}) {
  const store = new Store(dataDir),
    executor = new Executor(store, executorOptions);
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(security({ apiToken, allowRemote }));
  app.use(express.json({ limit: "128kb", strict: true }));
  const schedule = scheduler ? new Scheduler(store, executor) : null;
  if (seed && store.tasks().length === 0) {
    for (const config of seeds) {
      store.createTask(config);
      const input = {
        ...config.sampleInput,
        ...(config.id === "release-check" ? { deviceVerified: true } : {}),
      };
      const run = executor.submit({
        taskId: config.id,
        input,
        channel: "test",
        source: "bundled-validation",
      });
      await executor.idle();
      if (store.run(run.id).status === "succeeded") store.promote(config.id);
    }
    store.createSchedule({
      taskId: "release-check",
      name: "上线清单每日回顾",
      cron: "0 9 * * 1-5",
      timezone: "Asia/Shanghai",
      input: seeds[0].sampleInput,
      enabled: false,
    });
  }
  function search(query = "") {
    const q = String(query).trim().toLowerCase();
    return store
      .tasks()
      .filter((t) => t.stable)
      .map((t) => {
        const c = t.stable.config;
        const hay =
          `${c.id} ${c.name} ${c.tags.join(" ")} ${c.description}`.toLowerCase();
        const pieces = q.split(/[\s，。；、,;]+/).filter(Boolean);
        let score = !q
          ? 1
          : pieces.reduce(
              (n, p) => n + (hay.includes(p) ? p.length + 2 : 0),
              0,
            );
        for (const tag of c.tags)
          if (q.includes(tag.toLowerCase())) score += tag.length + 4;
        return {
          id: t.id,
          name: c.name,
          description: c.description,
          tags: c.tags,
          runner: c.runner,
          mode: c.mode,
          version: t.stable.version,
          digest: t.stable.digest,
          score,
        };
      })
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score);
  }
  const session = (req) =>
    store.session(
      (req.headers.authorization || "").startsWith("Session ")
        ? req.headers.authorization.slice(8)
        : "",
    );
  const clientRun = (run) => {
    const { session_id, idem_key, ...safe } = run;
    return safe;
  };
  const answerBody = z
    .object({
      answers: z.record(
        z.string(),
        z.union([z.string().max(8000), z.boolean()]),
      ),
    })
    .strict();
  const runId = (req) => z.string().uuid().parse(req.params.id);
  const ownedRun = (req) => store.run(runId(req), session(req).id);
  const attentionId = (req) => z.string().uuid().parse(req.params.attentionId);
  app.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      version: APP_VERSION,
      service: "taskdock",
      pid: process.pid,
      instance: digest(store.root).slice(0, 16),
      archivePending: store.pendingWrites.size,
    }),
  );
  app.get("/api/client/search", (req, res) =>
    res.json({
      tasks: search(
        z
          .string()
          .max(500)
          .parse(req.query.q || ""),
      ),
      matching: "lexical",
      fallback: "没有匹配的任务请在当前会话完成",
    }),
  );
  app.post("/api/client/plan", (req, res) => {
    const { goals } = z
      .object({ goals: z.array(z.string().min(1).max(500)).min(1).max(20) })
      .strict()
      .parse(req.body);
    res.json({
      goals: goals.map((goal) => {
        const matches = search(goal).slice(0, 3);
        return {
          goal,
          matches,
          action: matches.length ? "delegate-candidate" : "complete-locally",
        };
      }),
      method: "关键词建议；由上层会话确认任务匹配",
    });
  });
  app.post("/api/client/sessions", (req, res) => {
    const { label } = z
      .object({ label: z.string().min(1).max(120) })
      .strict()
      .parse(req.body);
    res.status(201).json(store.openSession(label));
  });
  app.post("/api/client/runs", (req, res) => {
    const s = session(req),
      body = submitSchema.parse(req.body);
    res.status(202).json(
      clientRun(
        executor.submit({
          ...body,
          sessionId: s.id,
          source: "client",
          channel: "stable",
        }),
      ),
    );
  });
  app.get("/api/client/runs", (req, res) =>
    res.json({
      runs: store
        .runs({ sessionId: session(req).id, includeArchived: true })
        .map(clientRun),
    }),
  );
  app.get("/api/client/runs/:id", (req, res) =>
    res.json(
      clientRun(
        store.run(z.string().uuid().parse(req.params.id), session(req).id),
      ),
    ),
  );
  app.post("/api/client/runs/:id/cancel", (req, res) => {
    const run = store.run(
      z.string().uuid().parse(req.params.id),
      session(req).id,
    );
    res.json(clientRun(executor.cancel(run.id)));
  });
  app.post("/api/client/runs/:id/retry", (req, res) => {
    const r = ownedRun(req);
    res
      .status(202)
      .json(clientRun(executor.retry(r.id, `session:${r.session_id}`)));
  });
  app.post(
    "/api/client/runs/:id/attentions/:attentionId/answer",
    (req, res) => {
      const r = ownedRun(req);
      res
        .status(202)
        .json(
          clientRun(
            executor.answer(
              r.id,
              attentionId(req),
              answerBody.parse(req.body).answers,
              `session:${r.session_id}`,
            ),
          ),
        );
    },
  );
  app.post("/api/client/deliveries/receive", (req, res) => {
    const options = z
      .object({
        limit: z.number().int().min(1).max(20).default(10),
        leaseSeconds: z.number().int().min(5).max(120).default(30),
      })
      .strict()
      .parse(req.body || {});
    res.json({
      messages: store.receive(session(req).id, options),
      semantics: "at-least-once; deduplicate by message ID",
    });
  });
  for (const action of ["ack", "nack"])
    app.post(`/api/client/deliveries/:id/${action}`, (req, res) => {
      const { receipt } = z
        .object({ receipt: z.string().min(20).max(100) })
        .strict()
        .parse(req.body);
      res.json(
        store.settleDelivery(
          session(req).id,
          runId(req),
          receipt,
          action === "nack",
        ),
      );
    });
  app.get("/api/overview", (_req, res) => {
    const tasks = store.tasks(),
      runs = store.runs(),
      proposals = store.proposals();
    res.json({
      version: APP_VERSION,
      tasks: tasks.map((t) => ({
        id: t.id,
        ...t.draft,
        revision: t.revision,
        stable: t.stable
          ? {
              id: t.stable.id,
              version: t.stable.version,
              digest: t.stable.digest,
              gitSha: t.stable.git_sha,
            }
          : null,
        hasChanges: t.stable?.digest !== digest(t.draft),
        authorization: store.control(t.id),
        runs: runs.filter((r) => r.task_id === t.id).length,
      })),
      runs: runs.slice(0, 8),
      stats: {
        tasks: tasks.length,
        published: tasks.filter((t) => t.stable).length,
        runs: runs.length,
        active: runs.filter((r) =>
          ["queued", "running", "waiting_children"].includes(r.status),
        ).length,
        waitingHuman: runs.filter((r) => r.status === "waiting_human").length,
        deliveries: store.db
          .prepare("SELECT state,count(*) AS count FROM outbox GROUP BY state")
          .all(),
        pending: proposals.filter((p) => p.status === "pending").length,
      },
      runtime: {
        piInstalled: true,
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
        registryUrl,
        localOnly: !allowRemote,
      },
      dataDir: store.root,
      projectRoot: path.resolve(here, ".."),
    });
  });
  app.get("/api/tasks", (_req, res) => res.json({ tasks: store.tasks() }));
  app.get("/api/task-graph", (_req, res) => res.json(store.taskGraph()));
  app.post("/api/tasks/:id/fork", (req, res) => {
    const body = z
      .object({
        id: slug,
        name: z.string().min(1).max(80),
        patch: z.record(z.string(), z.unknown()).default({}),
      })
      .strict()
      .parse(req.body);
    res.status(201).json(store.forkTask(req.params.id, body));
  });
  app.post("/api/tasks/:id/authorization", (req, res) => {
    const { enabled, reason } = z
      .object({
        enabled: z.boolean(),
        reason: z.string().max(1000).default(""),
      })
      .strict()
      .parse(req.body);
    res.json(store.setControl(req.params.id, enabled, reason));
  });
  app.post("/api/tasks", (req, res) =>
    res.status(201).json(store.createTask(taskSchema.parse(req.body))),
  );
  app.get("/api/tasks/:id", (req, res) =>
    res.json({
      ...store.task(req.params.id),
      summary: store.summary(req.params.id),
      authorization: store.control(req.params.id),
    }),
  );
  app.put("/api/tasks/:id/draft", (req, res) => {
    const body = z
      .object({ config: taskSchema, revision: z.number().int().positive() })
      .strict()
      .parse(req.body);
    res.json(store.saveDraft(req.params.id, body.config, body.revision));
  });
  app.post("/api/tasks/:id/test", (req, res) => {
    const { input } = z.object({ input: inputSchema }).strict().parse(req.body);
    res.status(202).json(
      executor.submit({
        taskId: req.params.id,
        input,
        channel: "test",
        source: "console",
      }),
    );
  });
  app.post("/api/tasks/:id/promote", (req, res) =>
    res.json(store.promote(req.params.id)),
  );
  app.post("/api/tasks/:id/rollback", (req, res) => {
    const { releaseId } = z
      .object({ releaseId: z.string().uuid() })
      .strict()
      .parse(req.body);
    res.json(store.rollback(req.params.id, releaseId));
  });
  app.get("/api/runs", (req, res) =>
    res.json({
      runs: store.runs({ includeArchived: req.query.archived === "true" }),
    }),
  );
  app.get("/api/runs/:id", (req, res) =>
    res.json(store.run(z.string().uuid().parse(req.params.id))),
  );
  app.post("/api/runs/:id/cancel", (req, res) =>
    res.json(executor.cancel(z.string().uuid().parse(req.params.id))),
  );
  app.post("/api/runs/:id/retry", (req, res) =>
    res.status(202).json(executor.retry(runId(req))),
  );
  app.post("/api/runs/:id/revoke", (req, res) => {
    const { reason } = z
      .object({ reason: z.string().min(1).max(1000) })
      .strict()
      .parse(req.body);
    res.json(executor.revoke(runId(req), reason));
  });
  app.post("/api/runs/:id/attentions/:attentionId/answer", (req, res) =>
    res
      .status(202)
      .json(
        executor.answer(
          runId(req),
          attentionId(req),
          answerBody.parse(req.body).answers,
        ),
      ),
  );
  app.get("/api/deliveries", (_req, res) =>
    res.json({
      messages: store.db
        .prepare(
          "SELECT id,run_id,session_id,kind,state,attempts,created_at,lease_until,acked_at FROM outbox ORDER BY created_at DESC,rowid DESC LIMIT 250",
        )
        .all(),
    }),
  );
  app.get("/api/attentions", (_req, res) =>
    res.json({
      attentions: store.db
        .prepare(
          "SELECT a.*,t.draft FROM attentions a JOIN runs r ON r.id=a.run_id JOIN tasks t ON t.id=r.task_id WHERE a.status='open' AND r.status='waiting_human' ORDER BY a.created_at LIMIT 200",
        )
        .all()
        .map(({ draft, ...a }) => ({
          ...a,
          fields: JSON.parse(a.fields),
          taskName: JSON.parse(draft).name,
        })),
    }),
  );
  app.post("/api/runs/:id/archive", (req, res) => {
    store.archive(z.string().uuid().parse(req.params.id));
    res.json({ archived: true });
  });
  app.get("/api/knowledge", (_req, res) =>
    res.json({ proposals: store.proposals() }),
  );
  app.post("/api/knowledge", (req, res) =>
    res.status(201).json(
      store.propose(
        z
          .object({
            taskId: z.string(),
            runId: z.string().uuid().optional(),
            content: z.string().trim().min(4).max(4000),
          })
          .strict()
          .parse(req.body),
      ),
    ),
  );
  app.post("/api/knowledge/:id/review", (req, res) => {
    const { decision } = z
      .object({ decision: z.enum(["approved", "rejected"]) })
      .strict()
      .parse(req.body);
    res.json(store.reviewProposal(req.params.id, decision));
  });
  app.get("/api/schedules", (_req, res) =>
    res.json({ schedules: store.schedules() }),
  );
  app.post("/api/schedules", (req, res) =>
    res.status(201).json(store.createSchedule(scheduleSchema.parse(req.body))),
  );
  app.get("/api/schedules/:id", (req, res) =>
    res.json(store.schedule(req.params.id)),
  );
  app.post("/api/schedules/:id/toggle", (req, res) => {
    const { enabled } = z
      .object({ enabled: z.boolean() })
      .strict()
      .parse(req.body);
    res.json(store.toggleSchedule(req.params.id, enabled));
  });
  const registryRequest = async (route, options = {}) => {
    let response;
    try {
      response = await fetch(`${registryUrl}${route}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(registryToken
            ? { Authorization: `Bearer ${registryToken}` }
            : {}),
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      fail(503, "共享服务未连接。请运行 npm run registry 后重试");
    }
    const result = await response.json();
    if (!response.ok) fail(response.status, result.error || "共享服务错误");
    return result;
  };
  app.get("/api/registry", async (_req, res) =>
    res.json(await registryRequest("/api/packages")),
  );
  app.get("/api/tasks/:id/export", (req, res) => {
    const t = store.task(req.params.id);
    if (!t.stable) fail(409, "先发布正式版");
    res.json(publicBundle(t.stable.config, t.stable.version));
  });
  app.post("/api/tasks/:id/share", async (req, res) => {
    z.object({ reviewed: z.literal(true) })
      .strict()
      .parse(req.body);
    const t = store.task(req.params.id);
    if (!t.stable) fail(409, "先发布正式版");
    const bundle = publicBundle(t.stable.config, t.stable.version);
    const result = await registryRequest("/api/packages", {
      method: "POST",
      body: JSON.stringify(bundle),
    });
    store.audit("registry.shared", t.id, { digest: bundle.digest });
    res.status(201).json(result);
  });
  app.post("/api/registry/install", async (req, res) => {
    const { digest: hash, id } = z
      .object({
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        id: z.string().regex(/^[a-z][a-z0-9-]{1,62}$/),
      })
      .strict()
      .parse(req.body);
    const bundle = bundleSchema.parse(
      await registryRequest(`/api/packages/${hash}`),
    );
    if (bundle.digest !== hash || digest(bundle.task) !== hash)
      fail(422, "能力包摘要校验失败");
    const task = taskSchema.parse({
      ...bundle.task,
      id,
      mcpServers: [],
      sampleInput: {},
      model: {
        provider: "openai",
        name: "gpt-4.1-mini",
        apiKeyEnv: "TASKDOCK_IMPORTED_MODEL_KEY",
      },
    });
    const result = store.createTask(task);
    store.audit("registry.installed", id, {
      digest: hash,
      sourceTaskId: bundle.task.id,
    });
    res.status(201).json({
      ...result,
      notice:
        "已安装为草稿；外部 MCP 与模型密钥引用已移除。Pi 需显式配置本机模型。请复核并测试后发布。",
    });
  });
  app.get("/api/audit", (_req, res) =>
    res.json({
      events: store.db
        .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 100")
        .all()
        .map((e) => ({ ...e, data: JSON.parse(e.data) })),
    }),
  );
  app.post("/mcp", async (req, res) => {
    const server = createMcpServer(
      httpCaller(`http://127.0.0.1:${req.socket.localPort}`, apiToken),
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.get("/mcp", (_req, res) =>
    res.status(405).json({ error: "Stateless MCP requires POST" }),
  );
  app.use(
    "/assets",
    express.static(path.join(here, "../public"), { index: false }),
  );
  app.get("/", (_req, res) =>
    res.sendFile(path.join(here, "../public/index.html")),
  );
  app.use((_req, res) => res.status(404).json({ error: "路径不存在" }));
  app.use(errorHandler);
  return {
    app,
    store,
    executor,
    scheduler: schedule,
    close: async () => {
      schedule?.close();
      await executor.close();
      store.close();
    },
  };
}
