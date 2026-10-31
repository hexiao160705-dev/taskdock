# TaskDock 服务契约 v0.1

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

schemaVersion、task 配置、版本信息、SHA-256 digest。只允许严格 schema 内的内容；不接受命令、任意文件路径、压缩包解压、安装脚本。外来包安装时 MCP 默认移除、Pi runner 改为待配置，必须由维护者复核后重新测试发布。Registry 0.1 不实现签名信任链、多用户 ACL 或付费市场，公网部署前必须补齐。
