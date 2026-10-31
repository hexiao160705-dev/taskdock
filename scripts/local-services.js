import { spawn } from "node:child_process";
import {
  mkdirSync,
  openSync,
  closeSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { digest } from "../src/schema.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.resolve(root, process.env.TASKDOCK_DATA_DIR || ".data");
const instance = digest(dataDir).slice(0, 16);
const specs = [
  {
    name: "taskdock",
    entry: "src/server.js",
    port: Number(process.env.PORT || 4640),
  },
  {
    name: "taskdock-registry",
    entry: "src/registry-server.js",
    port: Number(process.env.REGISTRY_PORT || 4641),
  },
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function health(spec) {
  try {
    const r = await fetch(`http://127.0.0.1:${spec.port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const pidFile = path.join(dataDir, "services.json");
if (process.argv[2] === "stop") {
  const owned = existsSync(pidFile)
    ? JSON.parse(readFileSync(pidFile, "utf8"))
    : [];
  for (const saved of owned) {
    const spec = specs.find((s) => s.name === saved.name);
    if (!spec) continue;
    const state = await health(spec);
    if (
      state?.service === saved.name &&
      state.pid === saved.pid &&
      state.instance === instance
    ) {
      process.kill(saved.pid, "SIGTERM");
      let stopped = false;
      for (let i = 0; i < 40; i++) {
        await wait(100);
        const latest = await health(spec);
        if (latest?.pid !== saved.pid) {
          stopped = true;
          break;
        }
      }
      if (!stopped) throw new Error(`${saved.name} 尚未停止，未强制结束进程`);
      console.log(`Stopped ${saved.name} PID ${saved.pid}`);
    }
  }
} else {
  const started = [],
    owned = [];
  try {
    for (const spec of specs) {
      const current = await health(spec);
      if (current) {
        if (current.service !== spec.name || current.instance !== instance)
          throw new Error(`端口 ${spec.port} 被其他服务占用，未作修改`);
        owned.push({ name: spec.name, pid: current.pid, port: spec.port });
        continue;
      }
      const log = openSync(path.join(dataDir, `${spec.name}.log`), "a", 0o600);
      const child = spawn(
        process.execPath,
        ["--env-file-if-exists=.env", spec.entry],
        {
          cwd: root,
          env: process.env,
          detached: true,
          stdio: ["ignore", log, log],
        },
      );
      closeSync(log);
      child.unref();
      started.push(child);
      let ready;
      for (let i = 0; i < 40; i++) {
        await wait(150);
        const state = await health(spec);
        if (
          state?.pid === child.pid &&
          state.service === spec.name &&
          state.instance === instance
        ) {
          ready = state;
          break;
        }
        if (child.exitCode !== null) break;
      }
      if (!ready)
        throw new Error(
          `${spec.name} 未通过身份和健康检查，请检查 .data/${spec.name}.log`,
        );
      owned.push({ name: spec.name, pid: ready.pid, port: spec.port });
    }
    writeFileSync(pidFile, JSON.stringify(owned, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(
      owned
        .map((s) => `${s.name}: http://127.0.0.1:${s.port} · PID ${s.pid}`)
        .join("\n"),
    );
    console.log("本机开发服务依赖电脑保持在线。停止：npm run local:stop");
  } catch (error) {
    for (const child of started)
      try {
        process.kill(child.pid, "SIGTERM");
      } catch {}
    throw error;
  }
}
