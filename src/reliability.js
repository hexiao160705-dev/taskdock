import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";
import {
  canonical,
  digest,
  fail,
  inputSchema,
  authorizationSchema,
  token,
} from "./schema.js";

export const terminal = (status) =>
  [
    "succeeded",
    "failed",
    "cancelled",
    "needs-attention",
    "interrupted",
  ].includes(status);
const now = () => new Date().toISOString();
const json = (value) => JSON.stringify(value);
const parse = (value, fallback = null) =>
  value ? JSON.parse(value) : fallback;
const actions = ["execute", "delegate", "tool", "request-human"];
const subset = (wanted, allowed, label) => {
  if (wanted.some((v) => !allowed.includes(v)))
    fail(403, `${label}超出固定能力授权`);
  return wanted;
};
export class HumanWait extends Error {
  constructor() {
    super("等待结构化回答");
    this.name = "HumanWait";
  }
}
export class Shutdown extends Error {
  constructor() {
    super("服务停止，保留持久任务");
    this.name = "Shutdown";
  }
}

function capabilityScope(config, graph) {
  const tasks = new Set(),
    tools = new Set();
  function visit(c) {
    tasks.add(c.id);
    for (const server of c.mcpServers || [])
      for (const tool of server.allowedTools)
        tools.add(`${c.id}/${server.name}/${tool}`);
    for (const child of c.children || []) {
      const dep = graph[child.releaseId];
      if (!dep || dep.digest !== child.digest)
        fail(422, "固定子能力快照缺失或摘要不匹配");
      visit(dep.config);
    }
  }
  visit(config);
  return { taskIds: [...tasks], tools: [...tools] };
}

export function initializeReliability(store) {
  const db = store.db;
  const add = (table, column, definition) => {
    if (
      !db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === column)
    )
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  add("releases", "graph", "TEXT NOT NULL DEFAULT '{}'");
  for (const [key, type] of Object.entries({
    root_id: "TEXT",
    parent_id: "TEXT",
    child_key: "TEXT",
    graph: "TEXT NOT NULL DEFAULT '{}'",
    request_authorization: "TEXT",
  }))
    add("runs", key, type);
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_controls(task_id TEXT PRIMARY KEY REFERENCES tasks(id), enabled INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1, reason TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS mandates(run_id TEXT PRIMARY KEY REFERENCES runs(id), grant_json TEXT NOT NULL, revoked_at TEXT, reason TEXT);
    CREATE TABLE IF NOT EXISTS runtime_instances(id TEXT PRIMARY KEY,pid INTEGER NOT NULL,host TEXT NOT NULL,heartbeat_at TEXT NOT NULL,stopped_at TEXT);
    CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),ordinal INTEGER NOT NULL,owner TEXT NOT NULL,state TEXT NOT NULL,lease_until TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,error TEXT,UNIQUE(run_id,ordinal));
    CREATE TABLE IF NOT EXISTS effects(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),kind TEXT NOT NULL,state TEXT NOT NULL,due_at TEXT NOT NULL,attempt_id TEXT);
    CREATE INDEX IF NOT EXISTS effects_ready ON effects(state,due_at);
    CREATE TABLE IF NOT EXISTS checkpoints(run_id TEXT NOT NULL REFERENCES runs(id),key TEXT NOT NULL,value TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(run_id,key));
    CREATE TABLE IF NOT EXISTS tool_calls(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),attempt_id TEXT NOT NULL,tool TEXT NOT NULL,state TEXT NOT NULL,args TEXT NOT NULL,result TEXT,error TEXT,invocations INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attentions(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),key TEXT NOT NULL,kind TEXT NOT NULL,question TEXT NOT NULL,fields TEXT NOT NULL,status TEXT NOT NULL,answer TEXT,actor TEXT,tool_call_id TEXT,created_at TEXT NOT NULL,answered_at TEXT,UNIQUE(run_id,key));
    CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),session_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,available_at TEXT NOT NULL,lease_until TEXT,receipt_hash TEXT,created_at TEXT NOT NULL,acked_at TEXT);
    CREATE INDEX IF NOT EXISTS outbox_ready ON outbox(session_id,state,available_at);
    CREATE UNIQUE INDEX IF NOT EXISTS child_run_key ON runs(parent_id,child_key) WHERE parent_id IS NOT NULL;
  `);
  add("tool_calls", "stage", "INTEGER NOT NULL DEFAULT 0");
  db.prepare("UPDATE runs SET root_id=id WHERE root_id IS NULL").run();
  // Old in-flight work has no durable intent ledger. Do not infer safe replay.
  for (const r of db
    .prepare("SELECT * FROM runs WHERE id NOT IN (SELECT run_id FROM mandates)")
    .all()) {
    const config = parse(r.config),
      scope = capabilityScope(config, {});
    const grant = {
      id: randomUUID(),
      issuedAt: r.created_at,
      issuer: "service:migration",
      caller: r.session_id,
      actions,
      ...scope,
      maxToolCalls: 24,
      maxAttempts: 3,
      deadlineAt: new Date(Date.parse(r.created_at) + 86400000).toISOString(),
      dataScope: [`request:${r.id}`],
    };
    db.prepare("INSERT INTO mandates VALUES(?,?,NULL,NULL)").run(
      r.id,
      json(grant),
    );
    if (r.status === "running")
      db.prepare(
        "UPDATE runs SET status='interrupted',error=?,finished_at=? WHERE id=?",
      ).run("旧版本没有执行回执，需明确重试", now(), r.id);
    if (r.status === "queued")
      db.prepare(
        "INSERT OR IGNORE INTO effects VALUES(?,?,'execute','pending',?,NULL)",
      ).run(`execute:${r.id}`, r.id, now());
  }
  db.prepare(
    "UPDATE runs SET status='interrupted',error=?,finished_at=? WHERE status='running' AND id NOT IN (SELECT run_id FROM attempts)",
  ).run("没有可恢复的执行尝试记录，需明确重试", now());
}

export const reliabilityMethods = {
  graphFor(config) {
    const graph = {};
    let count = 0;
    const visit = (c, stack) => {
      if (stack.includes(c.id))
        fail(422, `任务关系不能成环：${[...stack, c.id].join(" → ")}`);
      if (stack.length >= 8 || ++count > 40)
        fail(422, "任务图超过 8 层或 40 个展开节点");
      for (const child of c.children || []) {
        const release = this.db
          .prepare("SELECT * FROM releases WHERE id=? AND task_id=?")
          .get(child.releaseId, child.taskId);
        if (!release || release.digest !== child.digest)
          fail(422, "子任务引用必须指向摘要匹配的已发布版本");
        const item = {
          taskId: release.task_id,
          releaseId: release.id,
          digest: release.digest,
          config: parse(release.config),
        };
        visit(item.config, [...stack, c.id]);
        graph[release.id] = item;
      }
    };
    visit(config, []);
    if (json(graph).length > 2000000) fail(422, "能力图快照超过 2MB");
    return graph;
  },
  taskGraph() {
    const tasks = this.tasks();
    return {
      kind: "dag",
      maxDepth: 8,
      nodes: tasks.map((t) => ({
        id: t.id,
        name: t.draft.name,
        stable: t.stable
          ? {
              id: t.stable.id,
              version: t.stable.version,
              digest: t.stable.digest,
            }
          : null,
        origin: t.draft.origin || null,
      })),
      edges: tasks.flatMap((t) =>
        (t.draft.children || []).map((c) => ({ parentId: t.id, ...c })),
      ),
    };
  },
  forkTask(sourceId, { id, name, patch = {} }) {
    const source = this.task(sourceId).stable;
    if (!source) fail(409, "派生需要来源正式版");
    const result = this.createTask({
      ...source.config,
      ...patch,
      id,
      name,
      origin: { taskId: sourceId, releaseId: source.id, digest: source.digest },
    });
    this.audit("task.forked", id, {
      sourceTaskId: sourceId,
      releaseId: source.id,
      digest: source.digest,
    });
    return result;
  },
  control(taskId) {
    this.task(taskId);
    const row = this.db
      .prepare("SELECT * FROM task_controls WHERE task_id=?")
      .get(taskId);
    return row
      ? { ...row, enabled: !!row.enabled }
      : { task_id: taskId, enabled: true, revision: 1, reason: "" };
  },
  setControl(taskId, enabled, reason = "") {
    const old = this.control(taskId);
    this.db
      .prepare(
        "INSERT INTO task_controls VALUES(?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,reason=excluded.reason",
      )
      .run(taskId, enabled ? 1 : 0, old.revision + 1, reason);
    this.audit("authorization.task-control", taskId, {
      enabled,
      reason,
      revision: old.revision + 1,
    });
    return this.control(taskId);
  },
  mandate(runId) {
    const row = this.db
      .prepare("SELECT * FROM mandates WHERE run_id=?")
      .get(runId);
    if (!row) fail(409, "授权记录缺失");
    return {
      ...parse(row.grant_json),
      revokedAt: row.revoked_at,
      revocationReason: row.reason,
    };
  },
  issueMandate(id, config, graph, sessionId, requested = {}, inherited = null) {
    const scope = capabilityScope(config, graph),
      limits = config.limits || {
        maxToolCalls: 24,
        maxAttempts: 3,
        deadlineHours: 24,
      };
    const ceiling = inherited || {
      actions,
      ...scope,
      maxToolCalls: limits.maxToolCalls,
      maxAttempts: limits.maxAttempts,
      deadlineAt: new Date(
        Date.now() + (limits.deadlineHours || 24) * 3600000,
      ).toISOString(),
    };
    const available = {
      actions: actions.filter((a) => ceiling.actions.includes(a)),
      taskIds: scope.taskIds.filter((x) => ceiling.taskIds.includes(x)),
      tools: scope.tools.filter((x) => ceiling.tools.includes(x)),
      maxToolCalls: Math.min(limits.maxToolCalls, ceiling.maxToolCalls),
      maxAttempts: Math.min(limits.maxAttempts, ceiling.maxAttempts),
      deadlineAt: new Date(
        Math.min(
          Date.parse(ceiling.deadlineAt),
          Date.now() + (limits.deadlineHours || 24) * 3600000,
        ),
      ).toISOString(),
    };
    const r = authorizationSchema.parse(requested || {});
    const grant = {
      ...available,
      actions: subset(
        r.actions || available.actions,
        available.actions,
        "动作",
      ),
      tools: subset(r.tools || available.tools, available.tools, "工具"),
      taskIds: subset(
        r.taskIds || available.taskIds,
        available.taskIds,
        "任务",
      ),
      maxToolCalls: r.maxToolCalls ?? available.maxToolCalls,
      maxAttempts: r.maxAttempts ?? available.maxAttempts,
      deadlineAt: r.deadlineAt || available.deadlineAt,
    };
    if (
      grant.maxToolCalls > available.maxToolCalls ||
      grant.maxAttempts > available.maxAttempts ||
      Date.parse(grant.deadlineAt) > Date.parse(available.deadlineAt)
    )
      fail(403, "调用预算或截止时间超出服务授权");
    if (
      Date.parse(grant.deadlineAt) <= Date.now() ||
      !grant.actions.includes("execute") ||
      !grant.taskIds.includes(config.id)
    )
      fail(403, "执行授权无效或已过期");
    return {
      id: randomUUID(),
      issuer: "taskdock-service",
      issuedAt: now(),
      caller: sessionId,
      ...grant,
      dataScope: [
        `request:${id}`,
        `approved-knowledge:${digest(config.knowledge || [])}`,
        `declared-child-results:${id}`,
        `tool-receipts:${id}`,
        `human-answers:${id}`,
      ],
    };
  },
  createDurableRun(options) {
    const {
      taskId,
      input,
      sessionId = "maintenance",
      source = "console",
      channel = "stable",
      idempotencyKey = randomUUID(),
      authorization,
      pinned,
      parentId = null,
      childKey = null,
      rootId = null,
      inherited = null,
    } = options;
    inputSchema.parse(input);
    return this.transaction(() => {
      const prior = this.db
        .prepare(
          "SELECT * FROM runs WHERE session_id=? AND task_id=? AND idem_key=?",
        )
        .get(sessionId, taskId, idempotencyKey);
      if (prior) {
        if (
          canonical(parse(prior.input)) !== canonical(input) ||
          prior.channel !== channel ||
          canonical(parse(prior.request_authorization, {})) !==
            canonical(authorization || {})
        )
          fail(409, "幂等键已用于不同请求或授权");
        return { run: this.run(prior.id), created: false };
      }
      const task = this.task(taskId),
        release = task.stable;
      const config =
        pinned?.config || (channel === "test" ? task.draft : release?.config);
      if (!config) fail(409, "该任务尚未发布正式版");
      const control = this.control(taskId);
      if (!control.enabled) fail(403, "任务授权已暂停");
      const graph =
        pinned?.graph ||
        (channel === "test" ? this.graphFor(config) : parse(release.graph, {}));
      const id = randomUUID(),
        hash = digest(config),
        createdAt = now();
      const grant = this.issueMandate(
        id,
        config,
        graph,
        sessionId,
        authorization,
        inherited,
      );
      this.db
        .prepare(
          "INSERT INTO runs(id,task_id,session_id,source,channel,release_id,digest,config,input,status,idem_key,created_at,root_id,parent_id,child_key,graph,request_authorization) VALUES(?,?,?,?,?,?,?,?,?,'queued',?,?,?,?,?,?,?)",
        )
        .run(
          id,
          taskId,
          sessionId,
          source,
          channel,
          channel === "test" ? null : pinned?.releaseId || release.id,
          hash,
          json(config),
          json(input),
          idempotencyKey,
          createdAt,
          rootId || id,
          parentId,
          childKey,
          json(graph),
          json(authorization || {}),
        );
      this.db
        .prepare("INSERT INTO mandates VALUES(?,?,NULL,NULL)")
        .run(id, json({ ...grant, policyRevision: control.revision }));
      this.enqueue(id);
      this.event(id, "queued", {
        channel,
        digest: hash,
        parentId,
        mandateId: grant.id,
      });
      this.write(path.join(this.dir(taskId, id), "request.json"), {
        id,
        taskId,
        input,
        source,
        channel,
        createdAt,
        parentId,
        rootId: rootId || id,
      });
      this.write(path.join(this.dir(taskId, id), "capability.json"), {
        config,
        digest: hash,
        graph,
        releaseId: channel === "test" ? null : pinned?.releaseId || release.id,
      });
      this.write(path.join(this.dir(taskId, id), "mandate.json"), grant);
      return { run: this.run(id), created: true };
    });
  },
  runDetails(id) {
    const row = this.db
      .prepare("SELECT graph,request_authorization FROM runs WHERE id=?")
      .get(id);
    const attempts = this.db
      .prepare("SELECT * FROM attempts WHERE run_id=? ORDER BY ordinal")
      .all(id);
    const attentions = this.db
      .prepare(
        "SELECT * FROM attentions WHERE run_id=? ORDER BY created_at,rowid",
      )
      .all(id)
      .map((a) => ({
        ...a,
        fields: parse(a.fields, []),
        answer: parse(a.answer),
      }));
    const children = this.db
      .prepare(
        "SELECT id,task_id,child_key,status,digest,result,error FROM runs WHERE parent_id=? ORDER BY created_at,rowid",
      )
      .all(id)
      .map((c) => ({ ...c, result: parse(c.result) }));
    const calls = this.db
      .prepare(
        "SELECT id,tool,state,invocations,created_at,updated_at FROM tool_calls WHERE run_id=? ORDER BY created_at,rowid",
      )
      .all(id);
    return {
      graph: parse(row.graph, {}),
      request_authorization: parse(row.request_authorization, {}),
      mandate: this.mandate(id),
      attempts,
      attentions,
      children,
      toolCalls: calls,
    };
  },
  authorize(runId, action = "execute", resource = null) {
    const run = this.db.prepare("SELECT * FROM runs WHERE id=?").get(runId);
    if (!run) fail(404, "请求不存在");
    const grant = this.mandate(runId),
      root = this.mandate(run.root_id);
    if (grant.revokedAt || root.revokedAt) fail(403, "请求授权已撤销");
    if (Date.parse(grant.deadlineAt) <= Date.now()) fail(403, "请求授权已过期");
    const ancestors = this.db
      .prepare(
        "WITH RECURSIVE chain(id,task_id,parent_id) AS (SELECT id,task_id,parent_id FROM runs WHERE id=? UNION ALL SELECT r.id,r.task_id,r.parent_id FROM runs r JOIN chain ON r.id=chain.parent_id) SELECT task_id FROM chain",
      )
      .all(runId);
    if (ancestors.some((r) => !this.control(r.task_id).enabled))
      fail(403, "任务或祖先任务的授权已暂停");
    if (!grant.actions.includes(action)) fail(403, `动作未授权：${action}`);
    if (action === "tool" && !grant.tools.includes(resource))
      fail(403, "工具不在请求授权范围");
    if (action === "delegate" && !grant.taskIds.includes(resource))
      fail(403, "子任务不在请求授权范围");
    return grant;
  },
  enqueue(id, delayMs = 0) {
    this.db
      .prepare(
        "INSERT INTO effects VALUES(?,?,'execute','pending',?,NULL) ON CONFLICT(id) DO UPDATE SET state='pending',due_at=excluded.due_at,attempt_id=NULL",
      )
      .run(`execute:${id}`, id, new Date(Date.now() + delayMs).toISOString());
  },
  registerRuntime(owner) {
    this.db
      .prepare("INSERT INTO runtime_instances VALUES(?,?,?,?,NULL)")
      .run(owner, process.pid, hostname(), now());
  },
  heartbeat(owner, leaseMs) {
    this.db
      .prepare(
        "UPDATE runtime_instances SET heartbeat_at=? WHERE id=? AND stopped_at IS NULL",
      )
      .run(now(), owner);
    this.db
      .prepare(
        "UPDATE attempts SET lease_until=? WHERE owner=? AND state='running'",
      )
      .run(new Date(Date.now() + leaseMs).toISOString(), owner);
  },
  stopRuntime(owner) {
    this.db
      .prepare("UPDATE runtime_instances SET stopped_at=? WHERE id=?")
      .run(now(), owner);
  },
  fence(runId, attemptId) {
    const a = this.db
      .prepare(
        "SELECT * FROM attempts WHERE id=? AND run_id=? AND state='running'",
      )
      .get(attemptId, runId);
    const r = this.db.prepare("SELECT status FROM runs WHERE id=?").get(runId);
    if (!a || r?.status !== "running" || a.lease_until <= now())
      fail(409, "执行尝试已失去租约或请求已暂停");
    return a;
  },
  recoverOrphans() {
    const rows = this.db
      .prepare(
        "SELECT a.*,i.pid,i.host,i.stopped_at FROM attempts a LEFT JOIN runtime_instances i ON i.id=a.owner WHERE a.state='running'",
      )
      .all();
    for (const a of rows) {
      let dead = !!a.stopped_at;
      if (a.host === hostname() && a.pid) {
        try {
          process.kill(a.pid, 0);
        } catch (e) {
          if (e.code === "ESRCH") dead = true;
        }
      }
      if (!dead && a.lease_until > now()) continue;
      this.interruptAttempt(a.run_id, a.id, "执行器停止或租约过期");
    }
  },
  claim(owner, leaseMs) {
    return this.transaction(() => {
      const e = this.db
        .prepare(
          "SELECT e.* FROM effects e JOIN runs r ON r.id=e.run_id WHERE e.state='pending' AND e.due_at<=? AND r.status='queued' ORDER BY e.due_at,e.rowid LIMIT 1",
        )
        .get(now());
      if (!e) return null;
      const run = this.run(e.run_id);
      try {
        this.authorize(run.id);
        this.checkAttemptBudget(run.id);
      } catch (error) {
        this.completeRun(run.id, "failed", null, error.message);
        return { skipped: true };
      }
      const id = randomUUID(),
        ordinal = run.attempts.length + 1,
        at = now();
      this.db
        .prepare(
          "INSERT INTO attempts VALUES(?,?,?,?, 'running',?,?,NULL,NULL)",
        )
        .run(
          id,
          run.id,
          ordinal,
          owner,
          new Date(Date.now() + leaseMs).toISOString(),
          at,
        );
      this.db
        .prepare(
          "UPDATE runs SET status='running',finished_at=NULL,error=NULL WHERE id=?",
        )
        .run(run.id);
      this.db
        .prepare("UPDATE effects SET state='working',attempt_id=? WHERE id=?")
        .run(id, e.id);
      this.event(run.id, "attempt.started", {
        attemptId: id,
        ordinal,
        owner,
        policyRevision: this.control(run.task_id).revision,
      });
      return { run: this.run(run.id), attemptId: id };
    });
  },
  checkAttemptBudget(id) {
    const count = this.db
      .prepare(
        "SELECT count(*) AS n FROM attempts WHERE run_id=? AND state IN ('failed','interrupted')",
      )
      .get(id).n;
    if (count >= this.mandate(id).maxAttempts)
      fail(409, "执行尝试预算已耗尽，请检查失败原因后创建新请求");
  },
  interruptAttempt(id, attemptId, reason) {
    return this.transaction(() => {
      const a = this.db
        .prepare("SELECT * FROM attempts WHERE id=? AND state='running'")
        .get(attemptId);
      if (!a) return;
      this.db
        .prepare(
          "UPDATE attempts SET state='interrupted',finished_at=?,error=? WHERE id=?",
        )
        .run(now(), reason, attemptId);
      this.db
        .prepare(
          "UPDATE tool_calls SET state='uncertain',error=?,updated_at=? WHERE run_id=? AND state='pending'",
        )
        .run("执行器中止，外部结果待核对", now(), id);
      this.event(id, "attempt.interrupted", { attemptId, reason });
      const uncertain = this.db
        .prepare(
          "SELECT * FROM tool_calls WHERE run_id=? AND state='uncertain' ORDER BY rowid LIMIT 1",
        )
        .get(id);
      if (uncertain) {
        this.reconcileAttention(id, uncertain);
        return;
      }
      try {
        this.authorize(id);
        this.checkAttemptBudget(id);
      } catch (error) {
        this.completeRun(id, "failed", null, error.message);
        return;
      }
      this.db
        .prepare(
          "UPDATE runs SET status='queued',error=NULL,finished_at=NULL WHERE id=? AND status='running'",
        )
        .run(id);
      this.enqueue(id);
      this.event(id, "recovery.queued", { previousAttemptId: attemptId });
    });
  },
  checkpoint(id, key, value, attemptId) {
    if (value === undefined)
      return parse(
        this.db
          .prepare("SELECT value FROM checkpoints WHERE run_id=? AND key=?")
          .get(id, key)?.value,
      );
    this.fence(id, attemptId);
    this.db
      .prepare(
        "INSERT INTO checkpoints VALUES(?,?,?,?) ON CONFLICT(run_id,key) DO UPDATE SET value=excluded.value,created_at=excluded.created_at",
      )
      .run(id, key, json(value), now());
    this.write(
      path.join(
        this.dir(
          this.db.prepare("SELECT task_id FROM runs WHERE id=?").get(id)
            .task_id,
          id,
        ),
        "checkpoints.json",
      ),
      this.db
        .prepare("SELECT key,value FROM checkpoints WHERE run_id=?")
        .all(id)
        .map((c) => ({ key: c.key, value: parse(c.value) })),
    );
    return value;
  },
  ensureChildren(id, attemptId, effectiveInput) {
    return this.transaction(() => {
      this.fence(id, attemptId);
      const run = this.run(id),
        refs = run.config.children || [];
      if (!refs.length) return [];
      for (const ref of refs) {
        this.authorize(id, "delegate", ref.taskId);
        const previous = this.db
          .prepare(
            "SELECT id,status FROM runs WHERE parent_id=? AND child_key=?",
          )
          .get(id, ref.key);
        if (previous) continue;
        const selected = run.graph[ref.releaseId];
        if (!selected || selected.digest !== ref.digest)
          fail(422, "子能力快照不完整");
        const input = {};
        for (const [target, source] of Object.entries(ref.inputMap)) {
          let value = effectiveInput || run.input;
          for (const segment of source.split("."))
            value =
              value && Object.hasOwn(value, segment)
                ? value[segment]
                : undefined;
          if (value !== undefined) input[target] = value;
        }
        this.createDurableRun({
          taskId: ref.taskId,
          input,
          sessionId: run.session_id,
          source: "delegate",
          channel: "stable",
          idempotencyKey: `child:${id}:${ref.key}`,
          pinned: { ...selected, graph: run.graph },
          parentId: id,
          childKey: ref.key,
          rootId: run.root_id,
          inherited: this.mandate(id),
        });
      }
      const children = this.run(id).children;
      if (children.some((c) => !terminal(c.status))) {
        this.db
          .prepare("UPDATE runs SET status='waiting_children' WHERE id=?")
          .run(id);
        this.endAttempt(id, attemptId, "waiting_children");
        this.event(id, "children.waiting", {
          children: children.map((c) => ({ id: c.id, key: c.child_key })),
        });
        return null;
      }
      return children;
    });
  },
  endAttempt(id, attemptId, state, error = null) {
    if (attemptId)
      this.db
        .prepare(
          "UPDATE attempts SET state=?,finished_at=?,error=? WHERE id=? AND state='running'",
        )
        .run(state, now(), error, attemptId);
    else
      this.db
        .prepare(
          "UPDATE attempts SET state=?,finished_at=?,error=? WHERE run_id=? AND state='running'",
        )
        .run(state, now(), error, id);
    this.db
      .prepare("UPDATE effects SET state='done' WHERE id=?")
      .run(`execute:${id}`);
  },
  completeRun(id, status, result, error = null, attemptId = null) {
    return this.transaction(() => {
      if (attemptId) this.fence(id, attemptId);
      const row = this.db.prepare("SELECT * FROM runs WHERE id=?").get(id);
      if (!row || terminal(row.status)) return false;
      this.db
        .prepare(
          "UPDATE runs SET status=?,result=?,error=?,finished_at=? WHERE id=?",
        )
        .run(status, result ? json(result) : null, error, now(), id);
      this.endAttempt(id, attemptId, status, error);
      this.event(
        id,
        status,
        result
          ? { verdict: result.verdict, executionMode: result.executionMode }
          : { error },
      );
      this.db
        .prepare(
          "UPDATE attentions SET status='cancelled' WHERE run_id=? AND status='open'",
        )
        .run(id);
      this.notify(id, status, { status, result, error });
      const run = this.run(id);
      this.write(path.join(this.dir(run.task_id, id), "result.json"), {
        status,
        result,
        error,
        finishedAt: run.finished_at,
      });
      this.summary(run.task_id);
      if (row.parent_id) this.wakeParent(row.parent_id);
      return true;
    });
  },
  wakeParent(id) {
    const row = this.db.prepare("SELECT status FROM runs WHERE id=?").get(id);
    if (row?.status !== "waiting_children") return;
    const children = this.db
      .prepare("SELECT status FROM runs WHERE parent_id=?")
      .all(id);
    if (children.length && children.every((c) => terminal(c.status))) {
      this.db.prepare("UPDATE runs SET status='queued' WHERE id=?").run(id);
      this.enqueue(id);
      this.event(id, "children.completed", {});
    }
  },
  askHuman(
    id,
    { key, question, fields, kind = "information", toolCallId = null },
    attemptId = null,
  ) {
    return this.transaction(() => {
      if (attemptId) {
        this.fence(id, attemptId);
        this.authorize(id, "request-human");
      }
      const existing = this.db
        .prepare("SELECT * FROM attentions WHERE run_id=? AND key=?")
        .get(id, key);
      if (existing?.status === "answered")
        return { answered: true, answer: parse(existing.answer) };
      const attentionId = existing?.id || randomUUID();
      if (!existing)
        this.db
          .prepare(
            "INSERT INTO attentions VALUES(?,?,?,?,?,?, 'open',NULL,NULL,?,?,NULL)",
          )
          .run(
            attentionId,
            id,
            key,
            kind,
            question,
            json(fields),
            toolCallId,
            now(),
          );
      else if (existing.status === "cancelled")
        this.db
          .prepare(
            "UPDATE attentions SET status='open',answer=NULL,actor=NULL,answered_at=NULL WHERE id=?",
          )
          .run(attentionId);
      this.db
        .prepare(
          "UPDATE runs SET status='waiting_human',finished_at=NULL WHERE id=?",
        )
        .run(id);
      this.endAttempt(id, attemptId, "waiting_human");
      this.event(id, "attention.opened", { attentionId, kind });
      if (!existing || existing.status === "cancelled")
        this.notify(id, "waiting_human", {
          status: "waiting_human",
          attention: { id: attentionId, kind, question, fields },
        });
      const run = this.db
        .prepare("SELECT task_id FROM runs WHERE id=?")
        .get(id);
      this.write(
        path.join(this.dir(run.task_id, id), "attentions.json"),
        this.run(id).attentions,
      );
      return { answered: false, id: attentionId };
    });
  },
  reconcileAttention(id, call) {
    return this.askHuman(id, {
      key: `reconcile:${call.id}:${call.attempt_id}`,
      kind: "reconciliation",
      toolCallId: call.id,
      question: `工具 ${call.tool} 的外部执行结果不确定。请核对后再恢复；系统不会盲目重试。`,
      fields: [
        {
          id: "resolution",
          label: "核对结果",
          type: "choice",
          required: true,
          options: ["confirmed-not-performed", "record-completed"],
        },
        {
          id: "result",
          label: "若已执行，填写核实的工具结果",
          type: "text",
          required: false,
        },
      ],
    });
  },
  answerAttention(id, attentionId, answers, actor) {
    return this.transaction(() => {
      this.authorize(id);
      const a = this.db
        .prepare("SELECT * FROM attentions WHERE id=? AND run_id=?")
        .get(attentionId, id);
      if (!a) fail(404, "待回答事项不存在");
      if (a.status === "answered") {
        if (canonical(parse(a.answer)) !== canonical(answers))
          fail(409, "该问题已收到不同回答");
        return this.run(id);
      }
      if (
        a.status !== "open" ||
        this.db.prepare("SELECT status FROM runs WHERE id=?").get(id).status !==
          "waiting_human"
      )
        fail(409, "问题或请求已关闭");
      const fields = parse(a.fields, []);
      if (
        !answers ||
        typeof answers !== "object" ||
        Array.isArray(answers) ||
        json(answers).length > 16000 ||
        Object.keys(answers).some((key) => !fields.some((f) => f.id === key))
      )
        fail(422, "回答字段无效");
      for (const f of fields) {
        const v = answers[f.id];
        if (f.required && (v === undefined || v === ""))
          fail(422, `请回答：${f.label}`);
        if (
          v !== undefined &&
          ((f.type === "boolean" && typeof v !== "boolean") ||
            (f.type !== "boolean" &&
              (typeof v !== "string" || v.length > 8000)) ||
            (f.type === "choice" && !f.options.includes(v)))
        )
          fail(422, `回答类型无效：${f.label}`);
      }
      if (a.kind === "reconciliation") {
        if (
          answers.resolution === "record-completed" &&
          !answers.result?.trim()
        )
          fail(422, "已执行的工具需要可核实的结果");
        const completed = answers.resolution === "record-completed";
        this.db
          .prepare(
            "UPDATE tool_calls SET state=?,result=?,updated_at=? WHERE id=? AND state='uncertain'",
          )
          .run(
            completed ? "completed" : "retryable",
            completed
              ? json({
                  content: [{ type: "text", text: answers.result }],
                  details: { reconciled: true, actor },
                })
              : null,
            now(),
            a.tool_call_id,
          );
      }
      this.db
        .prepare(
          "UPDATE attentions SET status='answered',answer=?,actor=?,answered_at=? WHERE id=?",
        )
        .run(json(answers), actor, now(), attentionId);
      const remaining = this.db
        .prepare(
          "SELECT count(*) AS n FROM attentions WHERE run_id=? AND status='open'",
        )
        .get(id).n;
      if (!remaining) {
        this.db
          .prepare("UPDATE runs SET status='queued',error=NULL WHERE id=?")
          .run(id);
        this.enqueue(id);
      }
      this.event(id, "attention.answered", { attentionId, actor });
      this.write(
        path.join(
          this.dir(
            this.db.prepare("SELECT task_id FROM runs WHERE id=?").get(id)
              .task_id,
            id,
          ),
          "attentions.json",
        ),
        this.run(id).attentions,
      );
      return this.run(id);
    });
  },
  retryRun(id, actor) {
    return this.transaction(() => {
      const run = this.run(id);
      if (
        !["failed", "interrupted", "cancelled", "needs-attention"].includes(
          run.status,
        )
      )
        fail(409, "当前状态不允许重试");
      this.authorize(id);
      this.checkAttemptBudget(id);
      for (const child of run.children)
        if (["failed", "interrupted", "cancelled"].includes(child.status))
          this.retryRun(child.id, actor);
      this.db
        .prepare(
          "UPDATE runs SET status='queued',result=NULL,error=NULL,finished_at=NULL,archived=0 WHERE id=?",
        )
        .run(id);
      this.enqueue(id);
      this.event(id, "retry.requested", { actor });
      return this.run(id);
    });
  },
  revokeRun(id, reason) {
    return this.transaction(() => {
      const ids = this.descendants(id);
      for (const runId of ids) {
        this.db
          .prepare(
            "UPDATE mandates SET revoked_at=COALESCE(revoked_at,?),reason=? WHERE run_id=?",
          )
          .run(now(), reason, runId);
        this.completeRun(runId, "cancelled", null, `授权撤销：${reason}`);
      }
      this.audit("authorization.revoked", this.run(id).task_id, {
        runId: id,
        reason,
      });
      return this.run(id);
    });
  },
  descendants(id) {
    if (!this.db.prepare("SELECT id FROM runs WHERE id=?").get(id))
      fail(404, "请求不存在");
    return this.db
      .prepare(
        "WITH RECURSIVE tree(id) AS (SELECT id FROM runs WHERE id=? UNION ALL SELECT r.id FROM runs r JOIN tree ON r.parent_id=tree.id) SELECT id FROM tree",
      )
      .all(id)
      .map((r) => r.id);
  },
  cancelTree(id) {
    return this.transaction(() => {
      for (const runId of this.descendants(id))
        this.completeRun(runId, "cancelled", null, "调用方明确取消");
      return this.run(id);
    });
  },
  beginTool(id, attemptId, stage, server, name, args, safeArgs = args) {
    return this.transaction(() => {
      this.fence(id, attemptId);
      const run = this.db
          .prepare("SELECT task_id,root_id FROM runs WHERE id=?")
          .get(id),
        qualified = `${run.task_id}/${server}/${name}`;
      this.authorize(id, "tool", qualified);
      const callId = digest({ runId: id, stage, tool: qualified, args });
      const previous = this.db
        .prepare("SELECT * FROM tool_calls WHERE id=?")
        .get(callId);
      if (previous?.state === "completed")
        return { id: callId, cached: parse(previous.result) };
      if (previous && ["pending", "uncertain"].includes(previous.state))
        fail(409, "工具结果尚未核对，不能重复调用");
      const used = this.db
        .prepare(
          "SELECT COALESCE(SUM(t.invocations),0) AS n FROM tool_calls t JOIN runs r ON r.id=t.run_id WHERE r.root_id=?",
        )
        .get(run.root_id).n;
      if (used >= this.mandate(run.root_id).maxToolCalls)
        fail(403, "根请求的共享工具预算已耗尽");
      const ownUsed = this.db
        .prepare(
          "SELECT COALESCE(SUM(invocations),0) AS n FROM tool_calls WHERE run_id=?",
        )
        .get(id).n;
      if (ownUsed >= this.mandate(id).maxToolCalls)
        fail(403, "当前子请求的工具预算已耗尽");
      this.db
        .prepare(
          "INSERT INTO tool_calls(id,run_id,attempt_id,tool,state,args,result,error,invocations,created_at,updated_at,stage) VALUES(?,?,?,?,'pending',?,NULL,NULL,1,?,?,?) ON CONFLICT(id) DO UPDATE SET state='pending',attempt_id=excluded.attempt_id,invocations=tool_calls.invocations+1,result=NULL,error=NULL,updated_at=excluded.updated_at",
        )
        .run(
          callId,
          id,
          attemptId,
          qualified,
          json(safeArgs),
          now(),
          now(),
          stage,
        );
      this.event(id, "tool.intent", { callId, tool: qualified });
      return { id: callId };
    });
  },
  completeTool(id, attemptId, callId, result) {
    return this.transaction(() => {
      this.fence(id, attemptId);
      this.db
        .prepare(
          "UPDATE tool_calls SET state='completed',result=?,updated_at=? WHERE id=? AND run_id=? AND attempt_id=? AND state='pending'",
        )
        .run(json(result), now(), callId, id, attemptId);
      this.event(id, "tool.receipt", { callId });
    });
  },
  completedReceipts(id) {
    return this.db
      .prepare(
        "SELECT id,stage,tool,args,result,updated_at FROM tool_calls WHERE run_id=? AND state='completed' ORDER BY created_at,rowid",
      )
      .all(id)
      .map((r) => ({ ...r, args: parse(r.args), result: parse(r.result) }));
  },
  uncertainTool(id, attemptId, callId, error) {
    const changed = this.db
      .prepare(
        "UPDATE tool_calls SET state='uncertain',error=?,updated_at=? WHERE id=? AND run_id=? AND attempt_id=? AND state='pending'",
      )
      .run(String(error).slice(0, 1000), now(), callId, id, attemptId);
    if (
      changed.changes &&
      !terminal(
        this.db.prepare("SELECT status FROM runs WHERE id=?").get(id).status,
      )
    )
      this.reconcileAttention(
        id,
        this.db.prepare("SELECT * FROM tool_calls WHERE id=?").get(callId),
      );
  },
  notify(id, kind, payload) {
    const run = this.db
      .prepare("SELECT session_id,parent_id FROM runs WHERE id=?")
      .get(id);
    const messageId = randomUUID();
    this.db
      .prepare(
        "INSERT INTO outbox(id,run_id,session_id,kind,payload,state,available_at,created_at) VALUES(?,?,?,?,?,'pending',?,?)",
      )
      .run(
        messageId,
        id,
        run.session_id,
        kind,
        json({ messageId, runId: id, parentRunId: run.parent_id, ...payload }),
        now(),
        now(),
      );
    return messageId;
  },
  receive(sessionId, { limit = 10, leaseSeconds = 30 } = {}) {
    return this.transaction(() => {
      const rows = this.db
        .prepare(
          "SELECT o.* FROM outbox o WHERE o.session_id=? AND o.available_at<=? AND (o.state='pending' OR (o.state='inflight' AND o.lease_until<=?)) AND NOT EXISTS (SELECT 1 FROM outbox prior WHERE prior.run_id=o.run_id AND prior.rowid<o.rowid AND prior.state!='acked') ORDER BY o.created_at,o.rowid LIMIT ?",
        )
        .all(sessionId, now(), now(), limit);
      return rows.map((r) => {
        const receipt = token(),
          until = new Date(Date.now() + leaseSeconds * 1000).toISOString();
        this.db
          .prepare(
            "UPDATE outbox SET state='inflight',attempts=attempts+1,lease_until=?,receipt_hash=? WHERE id=?",
          )
          .run(until, digest(receipt), r.id);
        return {
          id: r.id,
          kind: r.kind,
          payload: parse(r.payload),
          attempt: r.attempts + 1,
          receipt,
          leaseUntil: until,
        };
      });
    });
  },
  settleDelivery(sessionId, id, receipt, nack = false) {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM outbox WHERE id=? AND session_id=?")
        .get(id, sessionId);
      if (!row) fail(404, "投递消息不存在");
      if (row.receipt_hash !== digest(receipt))
        fail(409, "投递回执已过期或不匹配");
      if (row.state === "acked") return { id, state: "acked" };
      if (row.state !== "inflight" || row.lease_until <= now())
        fail(409, "投递租约已过期，请重新接收");
      const delay = nack
        ? Math.min(60000, 1000 * 2 ** Math.min(row.attempts - 1, 6))
        : 0;
      this.db
        .prepare(
          "UPDATE outbox SET state=?,available_at=?,lease_until=NULL,acked_at=? WHERE id=?",
        )
        .run(
          nack ? "pending" : "acked",
          new Date(Date.now() + delay).toISOString(),
          nack ? null : now(),
          id,
        );
      return { id, state: nack ? "pending" : "acked", retryAfterMs: delay };
    });
  },
};
