import { randomUUID } from "node:crypto";
import { HumanWait, Shutdown, terminal } from "./reliability.js";
import { humanFieldSchema } from "./schema.js";

export class DurableExecutor {
  constructor(
    store,
    {
      maxConcurrent = 4,
      runner,
      deterministic,
      timeoutMs = 120000,
      leaseMs = 30000,
      pollMs = 200,
    } = {},
  ) {
    this.store = store;
    this.max = maxConcurrent;
    this.pi = runner;
    this.deterministic = deterministic;
    this.timeout = timeoutMs;
    this.leaseMs = leaseMs;
    this.owner = randomUUID();
    this.active = new Map();
    this.closed = false;
    store.registerRuntime(this.owner);
    store.recoverOrphans();
    this.timer = setInterval(() => this.drain(), pollMs);
    this.timer.unref();
    queueMicrotask(() => this.drain());
  }
  submit(options) {
    if (this.closed) throw new Error("Executor closed");
    const { run } = this.store.createRun(options);
    queueMicrotask(() => this.drain());
    return run;
  }
  drain() {
    if (this.closed) return;
    try {
      this.store.flushWrites();
      if (
        !this.lastHeartbeat ||
        Date.now() - this.lastHeartbeat > this.leaseMs / 3
      ) {
        this.store.heartbeat(this.owner, this.leaseMs);
        this.store.recoverOrphans();
        this.lastHeartbeat = Date.now();
      }
      while (this.active.size < this.max) {
        const claim = this.store.claim(this.owner, this.leaseMs);
        if (!claim) break;
        if (claim.skipped) continue;
        const controller = new AbortController();
        const state = { controller, attemptId: claim.attemptId };
        this.active.set(claim.run.id, state);
        state.promise = this.execute(claim.run, claim.attemptId, controller)
          .catch(() => {
            this.lastError = "执行状态持久化失败，请检查本机存储";
          })
          .finally(() => {
            this.active.delete(claim.run.id);
            this.drain();
          });
      }
    } catch {
      this.lastError = "持久调度失败，请检查本机存储";
    }
  }
  redact(run, value) {
    let output = JSON.stringify(value);
    if (output === undefined) return value;
    for (const name of [
      run.config.model?.apiKeyEnv,
      ...(run.config.mcpServers || []).map((s) => s.tokenEnv),
    ].filter(Boolean)) {
      const secret = process.env[name];
      if (secret)
        output = output.replaceAll(
          JSON.stringify(secret).slice(1, -1),
          "[REDACTED]",
        );
    }
    return JSON.parse(output);
  }
  async execute(run, attemptId, controller) {
    const id = run.id,
      store = this.store;
    const timeout = setTimeout(
      () => controller.abort(new Error("执行超时")),
      this.timeout,
    );
    const event = (type, data) => {
      store.fence(id, attemptId);
      store.event(id, type, this.redact(run, data));
    };
    const requestHuman = ({ question, fields, kind = "information", key }) => {
      if (
        typeof question !== "string" ||
        !question.trim() ||
        question.length > 2000 ||
        !Array.isArray(fields) ||
        fields.length < 1 ||
        fields.length > 12
      )
        throw new Error("人工问题格式无效");
      if (store.run(id).attentions.length >= 20)
        throw new Error("单次请求的人工等待数量达到上限 20");
      const checked = fields.map((f) => humanFieldSchema.parse(f));
      if (new Set(checked.map((f) => f.id)).size !== checked.length)
        throw new Error("人工问题字段 ID 重复");
      const response = store.askHuman(
        id,
        {
          key: key || `question:${question}:${JSON.stringify(checked)}`,
          question,
          fields: checked,
          kind,
        },
        attemptId,
      );
      if (response.answered) return response.answer;
      const reason = new HumanWait();
      controller.abort(reason);
      throw reason;
    };
    try {
      const uncertain = store.db
        .prepare(
          "SELECT * FROM tool_calls WHERE run_id=? AND state IN ('pending','uncertain') ORDER BY rowid LIMIT 1",
        )
        .get(id);
      if (uncertain) {
        store.reconcileAttention(id, uncertain);
        return;
      }
      const gate = run.config.humanGate;
      let gateAnswer = gate
        ? store
            .run(id)
            .attentions.find(
              (a) => a.key === "configured-gate" && a.status === "answered",
            )?.answer
        : null;
      if (gate?.when === "before" && !gateAnswer)
        gateAnswer = requestHuman({ ...gate, key: "configured-gate" });
      const input = { ...run.input };
      if (gateAnswer)
        for (const field of gate.fields)
          if (field.inputField && Object.hasOwn(gateAnswer, field.id))
            input[field.inputField] = gateAnswer[field.id];
      const children = store.ensureChildren(id, attemptId, input);
      if (children === null) return;
      if (
        children.some((c) =>
          ["failed", "cancelled", "interrupted"].includes(c.status),
        )
      ) {
        store.completeRun(
          id,
          "failed",
          {
            executionMode: "composition",
            verdict: "blocked",
            summary: "子任务未完成；可查看各子请求的证据并明确重试。",
            children,
            checks: [],
            limitations: [],
          },
          "子任务执行失败",
          attemptId,
        );
        return;
      }
      const answers = store
        .run(id)
        .attentions.filter((a) => a.status === "answered")
        .map((a) => ({
          id: a.id,
          question: a.question,
          answer: a.answer,
          actor: a.actor,
        }));
      const result = await (
        run.config.runner === "pi" ? this.pi : this.deterministic
      )({
        config: run.config,
        mandate: store.mandate(id),
        input,
        signal: controller.signal,
        event,
        runDir: store.dir(run.task_id, id),
        childResults: children.map((c) => ({
          key: c.child_key,
          runId: c.id,
          taskId: c.task_id,
          status: c.status,
          result: c.result,
        })),
        humanAnswers: answers,
        toolReceipts: () => store.completedReceipts(id),
        checkpoint: (key, value) =>
          store.checkpoint(
            id,
            key,
            value === undefined ? undefined : this.redact(run, value),
            attemptId,
          ),
        authorize: (action, resource) => {
          store.fence(id, attemptId);
          return store.authorize(id, action, resource);
        },
        requestHuman,
        invokeTool: async ({ stage, server, name, args, execute }) => {
          const intent = store.beginTool(
            id,
            attemptId,
            stage,
            server,
            name,
            args,
            this.redact(run, args),
          );
          if (intent.cached) return intent.cached;
          try {
            const result = this.redact(run, await execute());
            store.completeTool(id, attemptId, intent.id, result);
            return result;
          } catch (error) {
            const message = this.redact(run, {
              message: error.message || "工具结果不确定",
            }).message;
            store.uncertainTool(id, attemptId, intent.id, message);
            if (store.run(id).status === "waiting_human") {
              const reason = new HumanWait();
              controller.abort(reason);
              throw reason;
            }
            throw error;
          }
        },
      });
      controller.signal.throwIfAborted();
      store.authorize(id);
      if (
        gate?.when === "on-check-failure" &&
        result.verdict === "needs-attention" &&
        !gateAnswer
      )
        requestHuman({ ...gate, key: "configured-gate" });
      const safe = this.redact(run, {
        ...result,
        ...(children.length
          ? {
              children: children.map((c) => ({
                key: c.child_key,
                runId: c.id,
                taskId: c.task_id,
                status: c.status,
                result: c.result,
              })),
            }
          : {}),
        ...(answers.length ? { humanAnswers: answers } : {}),
      });
      const needsAttention =
        result.verdict === "needs-attention" ||
        children.some((c) => c.status === "needs-attention");
      store.completeRun(
        id,
        needsAttention ? "needs-attention" : "succeeded",
        safe,
        null,
        attemptId,
      );
      this.learn(run);
    } catch (error) {
      const state = store.run(id).status;
      if (controller.signal.reason instanceof Shutdown) {
        store.interruptAttempt(id, attemptId, "服务停止，等待恢复");
        return;
      }
      if (state === "waiting_human" || error instanceof HumanWait) {
        store.endAttempt(id, attemptId, "waiting_human");
        return;
      }
      if (terminal(state)) return;
      let message = this.redact(run, {
        message: error.message || "执行失败",
      }).message;
      try {
        store.completeRun(
          id,
          "failed",
          null,
          message.slice(0, 1000),
          attemptId,
        );
      } catch (e) {
        if (e.status !== 409) throw e;
      }
      this.learn(run);
    } finally {
      clearTimeout(timeout);
    }
  }
  learn(run) {
    if (run.config.learningPolicy !== "review-required") return;
    const finished = this.store.run(run.id);
    for (const rule of run.config.learningRules || []) {
      if (
        rule.when !== finished.status ||
        (rule.checkId &&
          !finished.result?.checks?.some(
            (c) => c.id === rule.checkId && !c.passed,
          ))
      )
        continue;
      if (
        this.store.db
          .prepare(
            "SELECT id FROM proposals WHERE task_id=? AND content=? AND status='pending'",
          )
          .get(run.task_id, rule.proposal)
      )
        continue;
      try {
        const p = this.store.propose({
          taskId: run.task_id,
          runId: run.id,
          content: rule.proposal,
        });
        this.store.event(run.id, "learning.proposed", {
          ruleId: rule.id,
          proposalId: p.id,
        });
      } catch {
        this.store.event(run.id, "learning.skipped", {
          ruleId: rule.id,
          reason: "当前策略不允许提案",
        });
      }
    }
  }
  retry(id, actor = "maintenance") {
    const run = this.store.retryRun(id, actor);
    queueMicrotask(() => this.drain());
    return run;
  }
  answer(id, attentionId, answers, actor = "maintenance") {
    const run = this.store.answerAttention(id, attentionId, answers, actor);
    queueMicrotask(() => this.drain());
    return run;
  }
  cancel(id) {
    const ids = this.store.descendants(id),
      run = this.store.cancelTree(id);
    for (const key of ids)
      this.active.get(key)?.controller.abort(new Error("调用方取消"));
    return run;
  }
  revoke(id, reason) {
    const ids = this.store.descendants(id),
      run = this.store.revokeRun(id, reason);
    for (const key of ids)
      this.active.get(key)?.controller.abort(new Error("授权撤销"));
    return run;
  }
  async idle() {
    const until = Date.now() + this.timeout * 2 + 30000;
    while (
      this.active.size ||
      (!this.closed &&
        this.store.db
          .prepare("SELECT count(*) AS n FROM effects WHERE state='pending'")
          .get().n)
    ) {
      if (this.lastError) throw new Error(this.lastError);
      if (Date.now() > until) throw new Error("等待持久队列超时");
      this.drain();
      await new Promise((r) => setTimeout(r, 10));
    }
    if (this.lastError) throw new Error(this.lastError);
  }
  async close() {
    this.closed = true;
    clearInterval(this.timer);
    for (const { controller } of this.active.values())
      controller.abort(new Shutdown());
    await Promise.allSettled([...this.active.values()].map((a) => a.promise));
    this.store.stopRuntime(this.owner);
  }
}
