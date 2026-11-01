import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSchema, digest, fail } from "./schema.js";
import { security, errorHandler, loopback } from "./app.js";

export function createRegistry({
  dataDir = ".data",
  apiToken = "",
  allowRemote = false,
} = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, "registry.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS packages(digest TEXT PRIMARY KEY,task_id TEXT NOT NULL,name TEXT NOT NULL,bundle TEXT NOT NULL,created_at TEXT NOT NULL);",
  );
  const app = express();
  app.disable("x-powered-by");
  app.use(security({ apiToken, allowRemote }));
  app.use(express.json({ limit: "128kb", strict: true }));
  app.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      service: "taskdock-registry",
      version: "0.2.0",
      pid: process.pid,
      instance: digest(path.resolve(dataDir)).slice(0, 16),
    }),
  );
  app.get("/api/packages", (_req, res) =>
    res.json({
      packages: db
        .prepare(
          "SELECT bundle,created_at FROM packages ORDER BY created_at DESC",
        )
        .all()
        .map((r) => ({ ...JSON.parse(r.bundle), createdAt: r.created_at })),
      deployment: "self-hosted-demo",
    }),
  );
  app.get("/api/packages/:digest", (req, res) => {
    const r = db
      .prepare("SELECT bundle FROM packages WHERE digest=?")
      .get(req.params.digest);
    if (!r) fail(404, "能力包不存在");
    res.json(JSON.parse(r.bundle));
  });
  app.post("/api/packages", (req, res) => {
    const bundle = bundleSchema.parse(req.body);
    if (digest(bundle.task) !== bundle.digest) fail(422, "能力包摘要不匹配");
    if (
      (bundle.task.mcpServers || []).length ||
      Object.keys(bundle.task.sampleInput || {}).length ||
      (bundle.task.children || []).length
    )
      fail(422, "共享包不可包含 MCP 连接、示例请求或未打包的本机子版本引用");
    db.prepare("INSERT OR IGNORE INTO packages VALUES(?,?,?,?,?)").run(
      bundle.digest,
      bundle.task.id,
      bundle.task.name,
      JSON.stringify(bundle),
      new Date().toISOString(),
    );
    res.status(201).json({
      digest: bundle.digest,
      id: bundle.task.id,
      version: bundle.version,
    });
  });
  const pub = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../public",
  );
  app.use("/assets", express.static(pub, { index: false }));
  app.get("/", (_req, res) => res.sendFile(path.join(pub, "registry.html")));
  app.use((_req, res) => res.status(404).json({ error: "路径不存在" }));
  app.use(errorHandler);
  return { app, db, close: () => db.close() };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.REGISTRY_HOST || "127.0.0.1",
    port = Number(process.env.REGISTRY_PORT || 4641),
    apiToken = process.env.TASKDOCK_REGISTRY_TOKEN || "";
  if (!loopback(host) && apiToken.length < 32)
    throw new Error(
      "公网 registry 必须设置至少 32 字符 TASKDOCK_REGISTRY_TOKEN",
    );
  const registry = createRegistry({
    dataDir: process.env.TASKDOCK_DATA_DIR || ".data",
    apiToken,
    allowRemote: !loopback(host),
  });
  const server = registry.app.listen(port, host, (error) => {
    if (error) {
      console.error(`Registry 启动失败：${error.code}`);
      registry.close();
      process.exitCode = 1;
      return;
    }
    console.log(`TaskDock Registry · http://${host}:${port} · 独立共享服务`);
  });
  const stop = () => server.close(() => registry.close());
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
