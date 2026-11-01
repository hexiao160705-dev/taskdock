# TaskDock 服务契约 v0.2

新增契约详见 [RELIABILITY.md](RELIABILITY.md)。0.1 接口保留；本次新增：

- 任务配置 `children[]`（key/taskId/releaseId/digest/inputMap）、`humanGate`、`limits`；`POST /api/tasks/:id/fork` 创建带来源的独立草稿；`GET /api/task-graph` 返回能力 DAG。
- `POST /api/tasks/:id/authorization` 启用/暂停任务；`POST /api/runs/:id/revoke` 撤销本次及后代授权。客户端提交的 `authorization` 只能缩小服务签发的动作、工具、子任务和预算。
- `POST /api/runs/:id/retry` / `/api/client/runs/:id/retry` 明确重试；`POST /api/runs/:id/attentions/:attentionId/answer` 及对应 client 路由回答结构化问题。client 路由始终要求同一 session capability。
- Run 新增 root/parent/child key、Mandate、Attempt、Attention、子调用及工具回执；`waiting_human`、`waiting_children` 为非终态。已取消或撤权的工作不会自动唤醒。
- `POST /api/client/deliveries/receive` 拉取持久消息及有时限 receipt；`POST /api/client/deliveries/:id/ack`、`/nack` 确认或退避。重复 message ID 必须去重。
- MCP 增加 `taskdock_retry_run`、`taskdock_answer`、`taskdock_receive`、`taskdock_ack`、`taskdock_nack`。Skill 约束调用习惯，服务端负责真正授权校验。

传输：REST JSON + 官方 TypeScript MCP SDK（stdio / Streamable HTTP）。服务默认只监听 127.0.0.1。非 loopback 必须设置强随机 API token。浏览器跨站写入被 Origin 校验阻止。所有输入以 Zod 校验，字段限长，id 仅允许固定 slug / UUID。

## 维护 API（本机管理权限）

- GET /health：进程状态与版本；GET /api/overview：任务、计数、运行环境能力。
- GET/POST /api/tasks；GET /api/tasks/:id；PUT /api/tasks/:id/draft（携带 revision，冲突 409）。
- POST /api/tasks/:id/test：创建 draft 测试；POST /api/tasks/:id/promote：精确摘要已通过测试后发布；POST /api/tasks/:id/rollback：恢复已发布版本。
- GET /api/runs；GET /api/runs/:id；POST /api/runs/:id/cancel；POST /api/runs/:id/archive：归档保留记录，不删除原始证据。
- GET /api/knowledge；POST /api/knowledge；POST /api/knowledge/:id/review：approved/rejected；批准只写 draft。
- GET/POST /api/schedules；POST /api/schedules/:id/toggle；GET /api/schedules/:id：读取持久化 nextRunAt。
- GET /api/registry；POST /api/tasks/:id/share：只提交 stable 能力；POST /api/registry/install：按 package digest 安装为 draft。

## 上层会话（隔离 API / MCP）

1. taskdock_search(query) → 仅已发布任务及版本摘要；无结果时上层自行完成。
2. taskdock_plan(goals[]) → 每个目标的可复用任务建议和 local fallback；这是关键词路由建议，不宣称 LLM 自主拆解。
3. taskdock_open_session(label) → sessionToken（随机 capability，只返回一次）。
4. taskdock_submit(taskId, sessionToken, input, idempotencyKey) → runId；只允许 stable，服务不接受调用方指定草稿。
5. taskdock_get_run(runId, sessionToken) / taskdock_list_runs(sessionToken) / taskdock_cancel_run(runId, sessionToken)。跨 session 访问返回 404。

HTTP 对应 /api/client/search、/plan、/sessions、/runs。sessionToken 放 Authorization: Session <token>；维护 API 的 Bearer token 与它不同。MCP sessionToken 使用工具参数，不在服务日志中记录。提交幂等键作用域为 session + task，重试同一参数返回原 run；同键不同 input 返回 409。

MCP stdio 是 thin client，连接本地 HTTP 服务；不会绕过服务隔离。配置示例：

```toml
[mcp_servers.taskdock]
command = "node"
args = ["/ABSOLUTE/PATH/taskdock/src/mcp-stdio.js"]
```

请将 ABSOLUTE/PATH 替换为项目真实绝对路径。HTTP MCP 地址 http://127.0.0.1:4640/mcp。代理重连后可持有原 session capability，不恢复其他会话的原始上下文。

## 能力包

新导出使用 schemaVersion `taskdock/0.2`，接受旧 `taskdock/0.1` 包；校验原始 task 摘要后才应用默认值，避免旧包被默认字段改变摘要。只允许严格 schema 内配置，不接受命令、任意文件路径、压缩包解压或安装脚本。外来包安装时移除 MCP、示例输入和模型密钥引用；Pi 使用显式待配置的 `TASKDOCK_IMPORTED_MODEL_KEY`，必须由维护者复核并重测发布。复合任务含本机 release 引用时暂拒绝共享，避免错误安装跨实例依赖。Registry 0.2 仍不实现签名信任链、多用户 ACL 或付费市场。

## 任务关系与等待示例

`children` 每项是 `{key, taskId, releaseId, digest, inputMap}`。例如 `inputMap: {service: "project.service"}` 只把父请求的 `project.service` 传为子请求 `service`；它不是代码表达式，也不会自动复制其他字段。只聚合子任务的父任务可省略本地 checks。

`humanGate` 包含 `question`、`when: before | on-check-failure` 和 `fields[]`。字段包含 id/label/type/required，可用 inputField 明确把本次回答映射到执行输入；原始请求保持不变。before 门禁发生在子任务派工之前。多个问题全部回答后才恢复。回答类型是 text/boolean/choice；服务记录实际 session 或维护者身份，不声称识别了真人。

默认每请求最多 3 次失败/中断尝试、全树 24 次外部工具调用、24 小时授权期限。人工等待与子任务等待不耗失败预算。租约默认 30 秒、消费者收件租约 5–120 秒。取消/撤权不自动唤醒；恢复与重试重新检查授权。已完成阶段恢复；未完成模型阶段可重新推理，不保证逐 token 重放。相同阶段、工具和参数复用同一持久回执；需新观测时应拆为新阶段/请求，后续可扩展显式只读工具策略。
