# TaskDock 与 DeepSeek Super-agent：技术研究 v1.0

日期：2026-11-01。DeepSeek 固定提交：[6337fc823ce20251c8de8085948165c81aaa701e](https://github.com/deepseek-ai/dsh-superagent-prototype/commit/6337fc823ce20251c8de8085948165c81aaa701e)。

## 结论

建议保留 TaskDock 的“任务能力服务”产品模型，优先吸收 DeepSeek 的授权记录、工作实例与执行尝试分离、持久 Effects/Outbox 和结构化人工协作；DSH 运行器适配先做同题实验，暂不整体迁移。这是工程建议，不是已经完成的集成。[H1]

如果近期目标收窄为“持续维护一个 GitHub 仓库”，建议可反转为先独立采用原型试点。内部 router/worker 是实现角色，不与用户要求的任务类型产品模型天然矛盾；真正缺口是任务类型目录、服务版本与学习/分发治理。[D1,D3,D15]

## 用户目标与当前方法

目的地是可复用、可版本化、可持续运营的任务服务：父会话发现已有 TaskType，提交独立 Run，使用受限 Agent/Team，取回带证据的结果。未知任务留在父会话。本地保留私有执行，云端分发经审核的能力包。[U1,T1]

分清 TaskType、Run、Agent，分开控制面和执行面；能力包固定版本，运行权限动态复核。会话、文件、工具与共享知识均需边界。同一 Run 内可协作；跨 Run 只允许显式、最小、可审计的信息流。[T2,T3,D17,H1]

当前 Demo 的 plan 为关键词建议，内置执行为 deterministic，Team 为串行。学习规则产生的是预定义提案，不是自主经验抽取；队列在内存，重启标为 interrupted；Registry 仅本机独立服务，未完成公共社区。不能把这些缩写成“成熟任务平台”。[T3-T7,N1]

## DeepSeek 实际解决逻辑

原型服务一个仓库，监听 GitHub/可选飞书，将 Source 事件翻译为 Trigger 和 Thread。Gate 先做确定性准入；模型 Assessment 判断规则与意图，默认 observe 只记 would_accept。接单后 Ticket 携带 Mandate，派工为 Assignment，worker 使用独立持久 Session/目录，结果回原 Channel。[D1,D3-D6]

工作单、派工、模型回合分别有生命周期；结构化 Attention 将真正需要人处理的问题放到前面。来源游标、稳定事件 ID、持久副作用队列、Outbox 回执和退避处理重启与失败。外部副作用仍应使用幂等键或状态核对，不把本地事务误称所有外部动作 exactly-once。[D5,D10-D12,D19]

资源工具会限制 worker 读取到其 Ticket，但订阅与主会话笔记允许受控上下文协作。官方明确完整 OS 权限不构成安全沙箱。提示词保存不可变修订，但下一次模型请求读取最新版本，这不同于测试→正式包的版本晋级。[D7-D9,D17]

## 需求比较矩阵

| 需求 | DeepSeek 原型 | TaskDock 0.1 Demo | 建议 |
|---|---|---|---|
| 任务类型服务目录 | Ticket 是工作实例；未见同等能力服务目录 | 已有目录；匹配是关键词建议 | 保留 TaskType 与输入/输出契约 |
| 上层跨项目调用 | DSH 内部工具与本机管理接口；未见同等外部任务 MCP | MCP HTTP/stdio 已有 | 服务鉴权、版本、追踪由控制面定义 |
| 请求隔离 | 一 Ticket 一 Session/目录；可订阅相关讨论；非 OS 沙箱 | capability/快照/受控工具；非多租户沙箱 | 明确跨 Run 数据流与 OS/网络隔离 |
| Team/工具/Skill | worker 可用宿主子 Agent；配置与提示词偏部署/角色 | 每任务组件；串行 Team；Pi 模型未实测 | 统一受限执行适配口 |
| 生命周期与恢复 | 持久工作单、派工、Effects/Outbox、人工等待 | 内存队列，重启中断，归档留证据 | 优先补持久 Attempt/Effects |
| 测试版/正式版/Git | Prompt/Settings 修订 ≠ 能力包测试晋级 | 精确 digest 测试→Git/tag→stable | 能力与授权策略分版本 |
| 历史到持续学习 | 有历史/Prompt/Skill编辑；未见要求的自动学习评测闭环 | 预定义规则提案→审核→草稿 | 脱敏抽取、回归评测、发布门禁 |
| 本地＋云共享 | SourceRegistry 是事件插件注册表；未见能力市场 | 独立本机 Registry；未部署公有社区 | 身份、签名、权限与多租户另做 |

“未见”限定在本次固定代码与接口阅读，不等于不能扩展。测试用 MemoryRepositories 不是 Agent 学习记忆；源码中的 draft 也不能一概解读为正式测试通道。[D13,D14]

## 建议路线与门禁

1. 可靠性：持久 Run/Attempt、最小 Mandate、Effects/Outbox、Attention。通过重启、重复动作、回执丢失、人工恢复测试后再扩展。
2. 能力证明：一个真实任务、一套固定输入与证据要求；验证真实模型、A/B 隔离、工具边界、取消与恢复。不能只保留模拟模型测试。
3. 学习与共享：脱敏提案→审核→固定回归集→能力版本→签名安装。最后再部署多用户社区。
4. 可选 DSH 实验：相同任务契约对照 Pi/DSH；八场景为隔离、幂等、中断、回执丢失、人工补充、越权、版本变化、经验回归。业务完成率、证据完整性、重复副作用、人工介入、成本均是待测指标，无现成测量值。

## 实际验证

- 原型：`pnpm install --frozen-lockfile --ignore-scripts`；`pnpm check` 成功，59 个文件、1197 项测试通过，类型检查和构建通过。构建保留一条 CJS/ESM 格式建议警告。测试层：仓库单元、组件、宿主替身与构建。
- TaskDock：本次 `npm test` 26/26 通过，含模拟模型的 Pi 契约，不沿用上一轮数字。
- 未部署 DSH 生产 profile；未注入账户/密钥；未触发真实 GitHub/飞书写入；未执行真实模型质量或跨框架效果对照。
- 交付为静态逐页图解＋中文 TTS 旁白的视频，不称动画仿真。字幕为句长估算，不是词级强制对齐。

## 逐页论证与来源

完整逐页问题、推理、反证、口播和证据台账见 `page-outline.json` 与 `build/page-outline.md`。技术栈、部署耦合和原始需求逐项核对见 [技术补充](technical-appendix.md)；成品验证见 [QA](QA.md)。可点击固定提交来源见下方。

### U1 · user_report

用户目标：以任务类型为对象的可复用 Agent 服务；请求隔离；版本、学习、本地与共享云闭环。

来源：TaskDock 工作区 docs/ARCHITECTURE.md:5

边界：代码/文档核对；不等于真实模型或线上业务验收

### T1 · fact

现有 TaskDock 有任务配置、MCP HTTP/stdio、会话 capability 与固定正式版本。

来源：TaskDock 工作区 src/mcp.js:5

边界：代码/文档核对；不等于真实模型或线上业务验收

### T2 · fact

晋级要求当前能力 digest 的成功草稿测试，并生成真实 Git commit/tag。

来源：TaskDock 工作区 src/store.js:139

边界：代码/文档核对；不等于真实模型或线上业务验收

### T3 · fact

Pi 使用新 session 与显式工具集，Team 串行；规则模式明确 deterministic。

来源：TaskDock 工作区 src/runner.js:66

边界：代码/文档核对；不等于真实模型或线上业务验收

### T4 · fact

学习是预定义规则产生提案，审核更新草稿；不是模型自主学习闭环。

来源：TaskDock 工作区 src/runner.js:329

边界：代码/文档核对；不等于真实模型或线上业务验收

### T5 · fact

能力导出严格筛选并移除 MCP 连接/示例请求，Registry 是独立本机服务。

来源：TaskDock 工作区 src/schema.js:171

边界：代码/文档核对；不等于真实模型或线上业务验收

### T6 · fact

当前运行队列在内存；重启将未结束请求标为 interrupted，不自动重放。

来源：TaskDock 工作区 src/store.js:28

边界：代码/文档核对；不等于真实模型或线上业务验收

### T7 · fact

目前 plan 是关键词匹配建议，上层仍负责分解；不是语义规划器。

来源：TaskDock 工作区 src/app.js:204

边界：代码/文档核对；不等于真实模型或线上业务验收

### D1 · fact

官方定位是面向一个 GitHub 仓库的主动 coding agent；研究原型，非正式产品；文章愿景不等于原型实现。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/README.md#L3

边界：代码/文档核对；不等于真实模型或线上业务验收

### D2 · fact

核心目标是尽量减少人的注意力成本；只按请求或书面规则行动，发言以可操作价值为准。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/000-philosophy.md#L5

边界：代码/文档核对；不等于真实模型或线上业务验收

### D3 · fact

领域链条是 Source/Trigger/Thread/Eval/Mandate/Ticket/Assignment/Executor/Channel；Ticket 是工作实例。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/model.ts#L23

边界：代码/文档核对；不等于真实模型或线上业务验收

### D4 · fact

确定性 Gate 与模型 Assessment 分层；主动接单须规则与意图证据，observe 默认只记录 would_accept。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/policy.ts#L40

边界：代码/文档核对；不等于真实模型或线上业务验收

### D5 · fact

事件 intake 按稳定 Trigger ID 去重，并按 Subscription 投递上下文；相关性本身不等于路由。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/intake.ts#L23

边界：代码/文档核对；不等于真实模型或线上业务验收

### D6 · fact

每 Ticket 使用自己的持久 worker Session 与目录；可重试、恢复与接收后续输入。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/executor/dsh.ts#L24

边界：代码/文档核对；不等于真实模型或线上业务验收

### D7 · fact

worker 的读取工具会限制到其 Ticket，隐藏别的 Ticket/Decision；这属于应用层边界。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/resources.ts#L144

边界：代码/文档核对；不等于真实模型或线上业务验收

### D8 · fact

原型以操作者 OS 用户运行、danger-full-access；工作目录和账户 wrapper 不是 OS 沙箱。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md#L19

边界：代码/文档核对；不等于真实模型或线上业务验收

### D9 · fact

提示词有不可变历史版本，但每次模型请求取最新配置；保存不要求先测后发布。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/004-prompts.md#L95

边界：代码/文档核对；不等于真实模型或线上业务验收

### D10 · fact

Effects 在业务事务内持久化副作用任务，提交后执行，支持退避、顺序与恢复。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/effects.ts#L43

边界：代码/文档核对；不等于真实模型或线上业务验收

### D11 · fact

Outbox 将消息回执与 reply effect 原子保存，再发送并记录状态。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/outbox.ts#L27

边界：代码/文档核对；不等于真实模型或线上业务验收

### D12 · fact

结构化 Ticket stage 优先显示待人答复/审核/受阻；ready 不是所有情况下都代表工作终结。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/stage.ts#L9

边界：代码/文档核对；不等于真实模型或线上业务验收

### D13 · fact

SourceRegistry 注册的是事件来源插件及实例，不是任务能力市场。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/sources/registry.ts#L1

边界：代码/文档核对；不等于真实模型或线上业务验收

### D14 · fact

core/memory.ts 是测试/临时 Engine 的 Map 仓储，不是 Agent 学习记忆模块。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/memory.ts#L1

边界：代码/文档核对；不等于真实模型或线上业务验收

### D15 · fact

依赖 DeepSeek Harness/Cordis 的宿主能力，以 bundle 接入；换 harness 不只是改模型 API。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/package.json#L62

边界：代码/文档核对；不等于真实模型或线上业务验收

### D16 · fact

管理路由限 loopback 与同源；原型未展示面向任意父客户端的任务目录 MCP 服务。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/http.ts#L1

边界：结合 MCP/能力目录相关全仓检索与接口阅读；未发现不能证明永远不可能支持

### D17 · fact

暂停/恢复、Policy 变化与恢复前授权复核有单独语义；不应把上下文当成新授权。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md#L107

边界：代码/文档核对；不等于真实模型或线上业务验收

### D18 · fact

开发者可实现 SourceKind 扩展触发来源；等待条件属于 Source 而非 Eval。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/008-cookbook.md#L21

边界：代码/文档核对；不等于真实模型或线上业务验收

### D19 · fact

面板先回答是否需要人、系统是否健康、单个工作的历史。

来源：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/005-panel.md#L5

边界：代码/文档核对；不等于真实模型或线上业务验收

### V1 · fact

本机执行官方 pnpm check：类型检查、59 个文件的 1197 项测试、构建均通过；client CJS/ESM 建议警告保留。

来源：output/research/deepseek-check.log

边界：单元/组件/宿主替身测试与构建；没有安装生产 profile，没有真实模型或 GitHub/飞书写入 E2E

### V2 · fact

本机重新执行 TaskDock npm test：26 项通过，包含模拟模型的 Pi 契约。

来源：output/research/taskdock-check.log

边界：不是模型效果证明；两项目测试数量和覆盖面不同，不能按数量排名

### H1 · hypothesis

建议保留 TaskDock 产品与契约，吸收领域模型、持久副作用、授权与人工等待语义，DSH 作为可选适配实验。

来源：本次跨项目代码审查与用户目标推导

边界：不是已实现集成；成本、性能、模型质量和适配收益尚须同题实验

### N1 · unknown

未进行真实模型与真实账户的端到端联调；未证明云端多租户、恶意插件沙箱或自主学习质量。

来源：本次执行边界

边界：不能据此断言其不可用，也不能反向宣称生产可用
