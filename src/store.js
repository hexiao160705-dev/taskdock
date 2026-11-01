import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  writeFileSync,
  renameSync,
  readFileSync,
  chmodSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { taskSchema, digest, fail, token, canonical } from "./schema.js";
import { CronExpressionParser } from "cron-parser";
import {
  initializeReliability,
  reliabilityMethods,
  terminal,
} from "./reliability.js";

const now = () => new Date().toISOString();
export class Store {
  constructor(dataDir) {
    this.root = path.resolve(dataDir);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(this.root, "local.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, draft TEXT NOT NULL, revision INTEGER NOT NULL, stable_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS releases(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), version TEXT NOT NULL, config TEXT NOT NULL, digest TEXT NOT NULL, git_sha TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), session_id TEXT NOT NULL, source TEXT NOT NULL, channel TEXT NOT NULL, release_id TEXT, digest TEXT NOT NULL, config TEXT NOT NULL, input TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT, idem_key TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, finished_at TEXT, UNIQUE(session_id,task_id,idem_key));
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), type TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),run_id TEXT REFERENCES runs(id),content TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,reviewed_at TEXT);
      CREATE TABLE IF NOT EXISTS schedules(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),name TEXT NOT NULL,cron TEXT NOT NULL,timezone TEXT NOT NULL,input TEXT NOT NULL,enabled INTEGER NOT NULL,next_run_at TEXT NOT NULL,last_run_at TEXT,last_run_id TEXT);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,task_id TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL);`);
    chmodSync(path.join(this.root, "local.sqlite"), 0o600);
    initializeReliability(this);
    this.pendingWrites = new Map();
    for (const row of this.db.prepare("SELECT id FROM runs").all())
      this.materializeRun(row.id);
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
    const level = this.transactionDepth || 0;
    this.transactionDepth = level + 1;
    const savepoint = `td_${level}`;
    this.writeStack ||= [];
    const writes = new Map();
    this.writeStack.push(writes);
    let started = false,
      r;
    try {
      this.db.exec(level ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
      started = true;
      r = fn();
      this.db.exec(level ? `RELEASE ${savepoint}` : "COMMIT");
    } catch (e) {
      if (started) {
        if (level) {
          this.db.exec(`ROLLBACK TO ${savepoint}`);
          this.db.exec(`RELEASE ${savepoint}`);
        } else this.db.exec("ROLLBACK");
      }
      throw e;
    } finally {
      this.transactionDepth = level;
      this.writeStack.pop();
    }
    if (level)
      for (const [file, value] of writes)
        this.writeStack.at(-1).set(file, value);
    else {
      this.pendingWrites ||= new Map();
      for (const [file, value] of writes) this.pendingWrites.set(file, value);
      this.flushWrites();
    }
    return r;
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
    if (this.writeStack?.length) {
      this.writeStack.at(-1).set(file, structuredClone(value));
      return;
    }
    try {
      this.writeNow(file, value);
      this.pendingWrites?.delete(file);
    } catch (error) {
      this.pendingWrites?.set(file, structuredClone(value));
      throw error;
    }
  }
  writeNow(file, value) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    renameSync(temp, file);
  }
  flushWrites() {
    for (const [file, value] of this.pendingWrites || [])
      try {
        this.writeNow(file, value);
        this.pendingWrites.delete(file);
      } catch {
        /* DB remains authoritative; retry and rebuild after restart. */
      }
  }
  materializeRun(id) {
    const r = this.run(id),
      dir = this.dir(r.task_id, id);
    const values = {
      "request.json": {
        id,
        taskId: r.task_id,
        input: r.input,
        source: r.source,
        channel: r.channel,
        createdAt: r.created_at,
        parentId: r.parent_id,
        rootId: r.root_id,
      },
      "capability.json": {
        config: r.config,
        digest: r.digest,
        graph: r.graph,
        releaseId: r.release_id,
      },
      "mandate.json": r.mandate,
      "events.json": r.events,
      "attentions.json": r.attentions,
      "result.json": {
        status: r.status,
        result: r.result,
        error: r.error,
        finishedAt: r.finished_at,
      },
    };
    for (const [file, value] of Object.entries(values)) {
      try {
        this.writeNow(path.join(dir, file), value);
      } catch {
        this.pendingWrites.set(path.join(dir, file), value);
      }
    }
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
    this.graphFor(t);
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
      authorization: (() => {
        const c = this.db
          .prepare("SELECT * FROM task_controls WHERE task_id=?")
          .get(id);
        return c
          ? { ...c, enabled: !!c.enabled }
          : { enabled: true, revision: 1, reason: "" };
      })(),
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
    this.graphFor(config);
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
    const graph = this.graphFor(t.draft);
    const version = `0.2.${t.releases.length}`,
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
        .prepare(
          "INSERT INTO releases(id,task_id,version,config,digest,git_sha,created_at,graph) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          releaseId,
          id,
          version,
          JSON.stringify(t.draft),
          hash,
          gitSha,
          now(),
          JSON.stringify(graph),
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
  createRun(options) {
    return this.createDurableRun(options);
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
      ...this.runDetails(id),
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
        `SELECT id,task_id,session_id,source,channel,digest,status,error,archived,created_at,finished_at,parent_id,root_id,child_key FROM runs WHERE (? IS NULL OR session_id=?) AND (?=1 OR archived=0) ORDER BY created_at DESC,rowid DESC LIMIT 250`,
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
    return this.completeRun(id, status, result, error);
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
    if (!terminal(r.status)) fail(409, "先取消或等待请求结束");
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
Object.assign(Store.prototype, reliabilityMethods);
