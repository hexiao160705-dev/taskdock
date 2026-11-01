# TaskDock · 任务 Agent 中台

[English](README.md) · **简体中文**

以**任务类型**组织可复用 AI 能力。上层会话先发现服务，提交独立请求，再取回带版本与证据的结果。能力可以共享，请求上下文与原始历史留在各自目录。

0.3.0 是本地优先的开发 DEMO，新增任务 DAG、派生来源、Mandate 授权、持久执行尝试与恢复、人工等待、持久收件箱与回执。内置规则任务无需模型 key，明确标注 deterministic；Pi 模型适配器需自行配置 key。共享端是独立、自托管的 Registry 网站，没有公开部署。

界面默认英文，顶部可切换简体中文；任务配置与请求内容始终保留原文。

## 启动

需要 Node.js 24+、npm、Git。

```sh
npm ci
npm start
```

本地控制台：[http://127.0.0.1:4640](http://127.0.0.1:4640)。另开终端启动共享服务：

```sh
npm run registry
```

Registry：[http://127.0.0.1:4641](http://127.0.0.1:4641)。这两个端口被占用时服务会明确报错；使用 PORT / REGISTRY_PORT 和 TASKDOCK_REGISTRY_URL 配置其他端口。

也可使用 `npm run local:start` 在后台启动两个本机服务并核对身份与 health，使用 `npm run local:stop` 只停止本项目记录的服务。它不是系统开机自启或生产部署。

## 先体验这条路径

先运行 `npm run demo:reliability`，再打开 [任务关系](http://127.0.0.1:4640/#graph)。演示提供共享子能力、两个父流程与人工等待任务；已有同 ID 任务不会被覆盖。完整步骤与本版默认选择见 [0.2 DEMO](docs/DEMO-0.2.md)。

能力目录是 DAG，界面按树展开；一次调用产生独立 Run 树。父任务固定引用子任务的正式 releaseId/digest；派生新任务后必须明确换绑，不会改写其他调用者。

1. 打开“服务上线检查”→“调试请求”。默认缺少实机证据，应返回“待补证据”；它只核对输入，不会探测真实服务。
2. 新建一个任务，填入证据执行草稿测试，再到“版本与 Git”晋级。未经当前摘要测试不能发布。
3. 发起两次正式调用；分别创建 session、目录与事件，不向另一个请求加载上下文。运行 `npm run demo` 可以验证两个 MCP 调用者间的访问隔离。
4. 提交并审核经验。经验只进入 draft，正式版不变；要重新测试和晋级。learningRules 可根据状态/缺失检查项自动生成预定义提案，去重且不复制原始输入。
5. 从版本页预览并分享正式版，去“共享广场”安装为一个新任务草稿。连接、示例请求、历史记录与凭据不进入导出。
6. 创建定时任务，核对数据库读回的 next_run_at 和时区；默认暂停。调度只在本地进程在线时执行。

## 接入 Codex / MCP 客户端

先启动本地服务。stdio MCP：

```toml
[mcp_servers.taskdock]
command = "node"
args = ["/absolute/path/taskdock/src/mcp-stdio.js"]
```

将路径替换为真实绝对路径。本机端口非默认值时，通过 MCP 的 env.TASKDOCK_URL 指定服务 URL。HTTP MCP 入口为 `http://127.0.0.1:4640/mcp`。

提供 12 个 MCP 工具：`search`、`plan`、`open_session`、`submit`、`get_run`、`list_runs`、`cancel_run`、`retry_run`、`answer`、`receive`、`ack`、`nack`，完整名称带 `taskdock_` 前缀。上层调用规则见 [skills/taskdock-client/SKILL.md](skills/taskdock-client/SKILL.md)。未自动改动你的全局 Codex 配置。

## 真实模型、MCP 与 Team

复制 .env.example 为 .env 并设文件权限 600，填自己的 OPENAI_API_KEY 或 ANTHROPIC_API_KEY。然后在任务“能力与工具”中设置 runner 为 pi，指定模型、apiKeyEnv、单 Agent 或 Team stages。Skills 为版本化的文本能力，MCP 只连接明确配置的 HTTP endpoint 和 allowedTools。环境变量名可以入配置；凭据值只留在本地环境。

Pi 每阶段创建新 session，只传当前请求、自己的前序阶段、人工回答、已完成工具回执、声明的子结果、固定规则与审核知识。Mandate 可缩小工具范围并持续复核，未授权的 MCP 不建立连接。没有默认 shell、文件工具或主目录记忆；未实现恶意代码 OS 沙箱。

## 数据与维护

默认 .data/local.sqlite；每任务目录 .data/tasks/&lt;id&gt;/repo 是真实 Git 仓库，runs/&lt;run-id&gt; 是独立请求历史。归档不删除证据。SQLite 事务保存派工、尝试、问题和 Outbox，文件是提交后可重建的归档投影；`/health.archivePending` 表示尚待补写的文件数。

重启后恢复持久队列和阶段 checkpoint；已知成功的工具回执可复用，不确定结果必须核对，不能盲目重放。人工等待跨重启保留。0.1 没有执行日志的旧中断任务仍需明确重试。消息至少一次投递，按 message ID 去重并 ACK；此版采用拉取收件箱，没有对外聊天推送或 exactly-once 保证。

```sh
npm test        # 服务、隔离、协议、版本与离线 Pi 契约检查
npm run check   # JavaScript 语法与版本一致性
npm run backup  # SQLite 在线快照 + 任务目录备份
```

完整文件与数据库一致的恢复点应停掉两个服务后备份。备份、运行历史、.env 与浏览器产物均不入 Git。本地发布使用 tag + 留痕文档；正式部署/模型质量/人工验收见 [验收记录](docs/VERIFICATION.md)。

## 共享端部署边界

Registry 可独立运行，部署准备见 [DEPLOYMENT.md](docs/DEPLOYMENT.md)。非 loopback 必须设 32 字符以上的服务 token。此版是单维护者控制面：有管理权限的本机用户可以查看所有历史；会话隔离只适用于上层请求 capability，不能当作多个恶意 OS 用户之间的沙箱或云端多租户 ACL。

## 调研与交付

本次核对了 10 个候选，未发现完整覆盖需求的现成成品，选择自建控制面和复用 Pi/MCP。证据与判断见 [调研报告](docs/RESEARCH.md)。所有待确认问题统一在 [DECISIONS.md](docs/DECISIONS.md)。文档入口：[docs/INDEX.md](docs/INDEX.md)。

项目采用 [MIT 协议](LICENSE)。第三方依赖保留各自许可证。欢迎提交脱敏的真实场景、故障复现和改进建议。参见 [贡献指南](CONTRIBUTING.md)、[安全说明](SECURITY.md)与[路线图](ROADMAP.md)。
