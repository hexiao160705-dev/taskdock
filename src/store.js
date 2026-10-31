import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync, renameSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { taskSchema, digest, fail, token, canonical } from "./schema.js";
import { CronExpressionParser } from "cron-parser";

const now = () => new Date().toISOString();
export class Store {
  constructor(dataDir) {
    this.root = path.resolve(dataDir);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(this.root, "local.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, draft TEXT NOT NULL, revision INTEGER NOT NULL, stable_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS releases(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), version TEXT NOT NULL, config TEXT NOT NULL, digest TEXT NOT NULL, git_sha TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), session_id TEXT NOT NULL, source TEXT NOT NULL, channel TEXT NOT NULL, release_id TEXT, digest TEXT NOT NULL, config TEXT NOT NULL, input TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT, idem_key TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, finished_at TEXT, UNIQUE(session_id,task_id,idem_key));
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), type TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),run_id TEXT REFERENCES runs(id),content TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,reviewed_at TEXT);
      CREATE TABLE IF NOT EXISTS schedules(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),name TEXT NOT NULL,cron TEXT NOT NULL,timezone TEXT NOT NULL,input TEXT NOT NULL,enabled INTEGER NOT NULL,next_run_at TEXT NOT NULL,last_run_at TEXT,last_run_id TEXT);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,task_id TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL);`);
    for (const row of this.db
      .prepare("SELECT id FROM runs WHERE status IN ('queued','running')")
      .all())
      this.finish(row.id, "interrupted", null, "服务重启，未自动重放请求");
    const schedules = this.db
      .prepare("SELECT * FROM schedules WHERE enabled=1")
      .all();
    for (const s of schedules)
      if (s.next_run_at < now()) {
        this.db
          .prepare("UPDATE schedules SET next_run_at=? WHERE id=?")
          .run(this.nextTime(s.cron, s.timezone), s.id);
        this.audit("schedule.missed", s.task_id, {
          id: s.id,
          missedAt: s.next_run_at,
        });
      }
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(type, taskId, data) {
    this.db
      .prepare(
        "INSERT INTO audit(type,task_id,data,created_at) VALUES(?,?,?,?)",
      )
      .run(type, taskId, JSON.stringify(data), now());
  }
  repo(id) {
    return path.join(this.root, "tasks", id, "repo");
  }
  dir(taskId, runId) {
    return path.join(this.root, "tasks", taskId, "runs", runId);
  }
  write(file, value) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    renameSync(temp, file);
  }
  git(id, args) {
    return execFileSync("git", ["-C", this.repo(id), ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "TaskDock",
        GIT_AUTHOR_EMAIL: "taskdock@localhost",
        GIT_COMMITTER_NAME: "TaskDock",
        GIT_COMMITTER_EMAIL: "taskdock@localhost",
      },
    }).trim();
  }
  createTask(value) {
    const t = taskSchema.parse(value);
    if (this.db.prepare("SELECT id FROM tasks WHERE id=?").get(t.id))
      fail(409, "任务 ID 已存在");
    mkdirSync(this.repo(t.id), { recursive: true, mode: 0o700 });
    this.git(t.id, ["init", "-b", "main"]);
    this.write(path.join(this.repo(t.id), "task.json"), t);
    this.db
      .prepare("INSERT INTO tasks VALUES(?,?,1,NULL,?,?)")
      .run(t.id, JSON.stringify(t), now(), now());
    this.audit("task.created", t.id, {});
    return this.task(t.id);
  }
  task(id) {
    const t = this.db.prepare("SELECT * FROM tasks WHERE id=?").get(id);
    if (!t) fail(404, "任务不存在");
    const releases = this.db
      .prepare(
        "SELECT * FROM releases WHERE task_id=? ORDER BY created_at DESC,rowid DESC",
      )
      .all(id)
      .map((r) => ({ ...r, config: JSON.parse(r.config) }));
    return {
      id: t.id,
      draft: JSON.parse(t.draft),
      revision: t.revision,
      stable: releases.find((r) => r.id === t.stable_id) || null,
      releases,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  }
  tasks() {
    return this.db
      .prepare("SELECT id FROM tasks ORDER BY created_at,id")
      .all()
      .map((t) => this.task(t.id));
  }
  saveDraft(id, value, revision) {
    const t = this.task(id);
    if (t.revision !== revision) fail(409, "草稿已被其他操作更新，请重新加载");
    const config = taskSchema.parse(value);
    if (config.id !== id) fail(422, "任务 ID 不可修改");
    this.write(path.join(this.repo(id), "task.json"), config);
    const r = this.db
      .prepare(
        "UPDATE tasks SET draft=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      )
      .run(JSON.stringify(config), now(), id, revision);
    if (!r.changes) fail(409, "草稿更新冲突");
    this.audit("draft.saved", id, { digest: digest(config) });
    return this.task(id);
  }
  promote(id) {
    const t = this.task(id),
      hash = digest(t.draft);
    const proof = this.db
      .prepare(
        "SELECT id FROM runs WHERE task_id=? AND channel='test' AND digest=? AND status='succeeded' ORDER BY created_at DESC LIMIT 1",
      )
      .get(id, hash);
    if (!proof)
      fail(409, "当前草稿没有通过测试。请使用完整证据测试当前版本后晋级");
    if (t.stable?.digest === hash) fail(409, "当前草稿已是正式版");
    const version = `0.1.${t.releases.length}`,
      releaseId = randomUUID();
    this.write(path.join(this.repo(id), "task.json"), t.draft);
    this.git(id, ["add", "task.json"]);
    this.git(id, [
      "commit",
      "--allow-empty",
      "-m",
      `Release ${version} (${hash.slice(0, 12)})`,
    ]);
    const gitSha = this.git(id, ["rev-parse", "HEAD"]);
    this.git(id, ["tag", `v${version}`]);
    this.transaction(() => {
      this.db
        .prepare("INSERT INTO releases VALUES(?,?,?,?,?,?,?)")
        .run(
          releaseId,
          id,
          version,
          JSON.stringify(t.draft),
          hash,
          gitSha,
          now(),
        );
      this.db
        .prepare("UPDATE tasks SET stable_id=?,updated_at=? WHERE id=?")
        .run(releaseId, now(), id);
      this.audit("release.promoted", id, {
        version,
        digest: hash,
        gitSha,
        testRunId: proof.id,
      });
    });
    return this.task(id);
  }
  rollback(id, releaseId) {
    const t = this.task(id),
      release = t.releases.find((r) => r.id === releaseId);
    if (!release) fail(404, "正式版本不存在");
    if (releaseId === t.stable?.id) fail(409, "该版本已在提供服务");
    this.git(id, [
      "tag",
      `rollback-${Date.now()}-${randomUUID().slice(0, 8)}`,
      release.git_sha,
    ]);
    this.db
      .prepare("UPDATE tasks SET stable_id=?,updated_at=? WHERE id=?")
      .run(releaseId, now(), id);
    this.audit("release.rolled-back", id, {
      releaseId,
      version: release.version,
    });
    return this.task(id);
  }
  openSession(label) {
    const sessionToken = token(),
      id = randomUUID();
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run(id, digest(sessionToken), label, now());
    return { sessionId: id, sessionToken };
  }
  session(sessionToken) {
    const s = this.db
      .prepare("SELECT id,label FROM sessions WHERE token_hash=?")
      .get(digest(sessionToken || ""));
    if (!s) fail(401, "无效的会话凭证");
    return s;
  }
  createRun({
    taskId,
    input,
    sessionId = "maintenance",
    source = "console",
    channel = "stable",
    idempotencyKey = randomUUID(),
  }) {
    const t = this.task(taskId),
      config = channel === "test" ? t.draft : t.stable?.config;
    if (!config) fail(409, "该任务尚未发布正式版");
    const existing = this.db
      .prepare(
        "SELECT id,input,channel FROM runs WHERE session_id=? AND task_id=? AND idem_key=?",
      )
      .get(sessionId, taskId, idempotencyKey);
    if (existing) {
      if (
        canonical(JSON.parse(existing.input)) !== canonical(input) ||
        existing.channel !== channel
      )
        fail(409, "幂等键已用于不同请求");
      return { run: this.run(existing.id), created: false };
    }
    const id = randomUUID(),
      hash = digest(config);
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO runs(id,task_id,session_id,source,channel,release_id,digest,config,input,status,idem_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        taskId,
        sessionId,
        source,
        channel,
        channel === "test" ? null : t.stable.id,
        hash,
        JSON.stringify(config),
        JSON.stringify(input),
        "queued",
        idempotencyKey,
        createdAt,
      );
    const dir = this.dir(taskId, id);
    this.write(path.join(dir, "request.json"), {
      id,
      taskId,
      input,
      source,
      channel,
      createdAt,
    });
    this.write(path.join(dir, "capability.json"), {
      config,
      digest: hash,
      releaseId: channel === "test" ? null : t.stable.id,
    });
    this.event(id, "queued", { channel, digest: hash });
    return { run: this.run(id), created: true };
  }
  run(id, sessionId) {
    const row = this.db.prepare("SELECT * FROM runs WHERE id=?").get(id);
    if (!row || (sessionId && row.session_id !== sessionId))
      fail(404, "请求不存在");
    return {
      ...row,
      input: JSON.parse(row.input),
      config: JSON.parse(row.config),
      result: row.result ? JSON.parse(row.result) : null,
      events: this.db
        .prepare(
          "SELECT seq,type,data,created_at FROM events WHERE run_id=? ORDER BY seq",
        )
        .all(id)
        .map((e) => ({ ...e, data: JSON.parse(e.data) })),
    };
  }
  runs({ sessionId, includeArchived = false } = {}) {
    return this.db
      .prepare(
        `SELECT id,task_id,session_id,source,channel,digest,status,error,archived,created_at,finished_at FROM runs WHERE (? IS NULL OR session_id=?) AND (?=1 OR archived=0) ORDER BY created_at DESC,rowid DESC LIMIT 250`,
      )
      .all(sessionId || null, sessionId || null, includeArchived ? 1 : 0);
  }
  event(runId, type, data) {
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO events(run_id,type,data,created_at) VALUES(?,?,?,?)",
      )
      .run(runId, type, JSON.stringify(data), createdAt);
    const run = this.db
      .prepare("SELECT task_id FROM runs WHERE id=?")
      .get(runId);
    this.write(
      path.join(this.dir(run.task_id, runId), "events.json"),
      this.db
        .prepare(
          "SELECT type,data,created_at FROM events WHERE run_id=? ORDER BY seq",
        )
        .all(runId)
        .map((e) => ({ ...e, data: JSON.parse(e.data) })),
    );
  }
  start(id) {
    const r = this.db
      .prepare(
        "UPDATE runs SET status='running' WHERE id=? AND status='queued'",
      )
      .run(id);
    if (r.changes) this.event(id, "started", {});
    return !!r.changes;
  }
  finish(id, status, result, error = null) {
    const r = this.db
      .prepare(
        "UPDATE runs SET status=?,result=?,error=?,finished_at=? WHERE id=? AND status IN ('queued','running')",
      )
      .run(status, result ? JSON.stringify(result) : null, error, now(), id);
    if (!r.changes) return;
    this.event(
      id,
      status,
      result
        ? { verdict: result.verdict, executionMode: result.executionMode }
        : { error },
    );
    const run = this.run(id);
    this.write(path.join(this.dir(run.task_id, id), "result.json"), {
      status,
      result,
      error,
      finishedAt: run.finished_at,
    });
    this.summary(run.task_id);
  }
  summary(id) {
    const rows = this.db
      .prepare(
        "SELECT status,count(*) AS count FROM runs WHERE task_id=? GROUP BY status",
      )
      .all(id);
    const result = {
      taskId: id,
      counts: Object.fromEntries(rows.map((r) => [r.status, r.count])),
      updatedAt: now(),
      policy: "仅统计；不包含请求上下文",
    };
    this.write(path.join(this.root, "tasks", id, "summary.json"), result);
    return result;
  }
  archive(id) {
    const r = this.run(id);
    if (["queued", "running"].includes(r.status))
      fail(409, "先取消或等待请求结束");
    this.db.prepare("UPDATE runs SET archived=1 WHERE id=?").run(id);
    this.audit("run.archived", r.task_id, { runId: id });
  }
  propose({ taskId, runId, content }) {
    const t = this.task(taskId);
    if (t.draft.learningPolicy === "disabled")
      fail(409, "该任务已关闭经验学习");
    if (runId && this.run(runId).task_id !== taskId)
      fail(422, "来源请求不属于该任务");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO proposals VALUES(?,?,?,?,?,?,NULL)")
      .run(id, taskId, runId || null, content, "pending", now());
    this.audit("knowledge.proposed", taskId, { id, runId: runId || null });
    return { id };
  }
  proposals() {
    return this.db
      .prepare("SELECT * FROM proposals ORDER BY created_at DESC")
      .all();
  }
  reviewProposal(id, decision) {
    const p = this.db.prepare("SELECT * FROM proposals WHERE id=?").get(id);
    if (!p) fail(404, "提案不存在");
    if (p.status !== "pending") fail(409, "提案已审核");
    const t = this.task(p.task_id);
    this.transaction(() => {
      if (decision === "approved")
        this.saveDraft(
          t.id,
          {
            ...t.draft,
            knowledge: [
              ...t.draft.knowledge,
              {
                id: p.id,
                content: p.content,
                source: p.run_id || "maintainer",
              },
            ],
          },
          t.revision,
        );
      this.db
        .prepare("UPDATE proposals SET status=?,reviewed_at=? WHERE id=?")
        .run(decision, now(), id);
      this.audit("knowledge.reviewed", p.task_id, { id, decision });
    });
    return { id, status: decision };
  }
  nextTime(cron, timezone, from = new Date()) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
      return CronExpressionParser.parse(cron, {
        tz: timezone,
        currentDate: from,
      })
        .next()
        .toISOString();
    } catch {
      fail(422, "Cron 或 IANA 时区不合法");
    }
  }
  createSchedule(value) {
    this.task(value.taskId);
    const next = this.nextTime(value.cron, value.timezone),
      id = randomUUID();
    this.db
      .prepare("INSERT INTO schedules VALUES(?,?,?,?,?,?,?,?,NULL,NULL)")
      .run(
        id,
        value.taskId,
        value.name,
        value.cron,
        value.timezone,
        JSON.stringify(value.input),
        value.enabled ? 1 : 0,
        next,
      );
    this.audit("schedule.created", value.taskId, {
      id,
      nextRunAt: next,
      timezone: value.timezone,
    });
    return this.schedule(id);
  }
  schedule(id) {
    const s = this.db.prepare("SELECT * FROM schedules WHERE id=?").get(id);
    if (!s) fail(404, "定时任务不存在");
    return { ...s, input: JSON.parse(s.input), enabled: !!s.enabled };
  }
  schedules() {
    return this.db
      .prepare("SELECT id FROM schedules ORDER BY rowid DESC")
      .all()
      .map((s) => this.schedule(s.id));
  }
  toggleSchedule(id, enabled) {
    const s = this.schedule(id),
      next = this.nextTime(s.cron, s.timezone);
    this.db
      .prepare("UPDATE schedules SET enabled=?,next_run_at=? WHERE id=?")
      .run(enabled ? 1 : 0, next, id);
    this.audit("schedule.toggled", s.task_id, { id, enabled, nextRunAt: next });
    return this.schedule(id);
  }
  close() {
    this.db.close();
  }
}
