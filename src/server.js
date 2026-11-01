import { createApp, loopback } from "./app.js";
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 4640),
  apiToken = process.env.TASKDOCK_API_TOKEN || "";
if (!loopback(host) && apiToken.length < 32)
  throw new Error("非 loopback 监听必须设置至少 32 字符 TASKDOCK_API_TOKEN");
const service = await createApp({
  dataDir: process.env.TASKDOCK_DATA_DIR || ".data",
  apiToken,
  allowRemote: !loopback(host),
  registryUrl: process.env.TASKDOCK_REGISTRY_URL || "http://127.0.0.1:4641",
  registryToken: process.env.TASKDOCK_REGISTRY_TOKEN || "",
});
const server = service.app.listen(port, host, (error) => {
  if (error) {
    console.error(`TaskDock 启动失败：${error.code}`);
    void service.close().then(() => {
      process.exitCode = 1;
    });
    return;
  }
  console.log(`TaskDock 0.2.0 · http://${host}:${port} · 本机开发服务`);
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  await service.close();
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
