# 技术补充与需求追踪

研究版本 1.0，2026-11-01。下述 DeepSeek 结论均限定于固定提交 `6337fc823ce20251c8de8085948165c81aaa701e`；“未见”表示阅读与检索范围内未找到等价实现。

## 技术构成与部署耦合

| 层 | 原型实现 | 对 TaskDock 的含义 |
|---|---|---|
| 宿主 | DeepSeek Harness bundle，经 Cordis 插件配置挂载；`engines.dsh` 为 `^0.2.1-alpha.2` | 它不是只需替换模型 URL 的通用运行器；适配必须处理会话、权限、工具和后台任务生命周期 |
| 领域核 | TypeScript，Repository 接口，Ticket/Assignment/Mandate 等显式类型 | 最适合先研究和移植领域概念；不必连同整套 UI/宿主迁移 |
| 状态与可靠性 | `node:sqlite`；WAL、FULL 同步；目录锁；业务事务、effect 表、outbox 表、状态迁移 | 持久任务与副作用值得优先补；SQLite 仍是本机单实例部署假设，不能据此宣称分布式服务 |
| 模型 | 来源准入后的 Assessment，以及执行 worker；provider 由 DSH 配置 | 接收一个事件可能消耗评估和执行两部分模型成本；本次没有测出成本与质量数据 |
| 来源与外部动作 | GitHub 与可选飞书来源插件；账户与命令 wrapper | 权限既涉及模型工具，也涉及外部账户和 OS 用户；业务 Mandate 不能代替这些边界 |
| 管理面板 | DSH Web client 插件，React；工作、历史、设置、提示词修订 | 可参考“人需要先处理什么”的信息架构；并非能力包社区网站 |
| 构建与测试 | pnpm 11.7.0、TypeScript、Vitest、tsdown；Node `^22.19.0 || >=24.0.0` | 固定宿主和依赖再复现；本次只安装仓库依赖并执行仓库检查 |
| 许可 | 仓库 `LICENSE` 与 package 元数据均标注 MIT | 若将来移植代码，应单独做依赖与许可清单；本次未把上游实现移入 TaskDock |

以上直接对应 [package.json](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/package.json)、[Store](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/store.ts)、[架构](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md)、[部署](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md)和[许可文件](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/LICENSE)。

部署文档要求专用 profile，并指出插件会改变进程级 PATH 与 Git 设置。升级需要备份数据库，迁移后的数据库可能不能直接降级。本次没有照搬生产安装命令到日常工作环境，也没有创建会替换既有设置的 profile。上述是上游的部署约束，不能误算为 TaskDock 已完成的能力。

## 原始需求逐项对应

| 用户要求 | DeepSeek 原型阅读结果 | 我们的方法与当前状态 |
|---|---|---|
| 按任务类型管理，而非按角色建产品 | Ticket 表示一件工作；router/worker 是内部实现角色；未见等价 TaskType 服务目录 | 保留 TaskType→Release→Run 模型；内部可以使用不同角色 |
| 父会话先检索、再拆解、委托 | 主要从仓库事件和显式请求路由工作 | 已有任务检索与关键词 plan 建议；复杂拆解仍由父会话负责 |
| 每任务可选择单 Agent/Team | worker 可使用宿主 subagent；不是每任务能力包的同等配置产品 | Demo 有单 Agent 与串行阶段 Team；不声称已实现并行团队协作 |
| 独立 MCP、Skill、模型和知识 | 有 DSH 宿主工具、团队技能、角色模型/提示词；配置粒度偏部署与角色 | 每 TaskType 能力配置固定到 Run；真实模型与具体外部 MCP 仍须实测 |
| 每任务定时工作 | 有内部扫描/退避/轮询；文档还用外部宿主定时做健康维护；未见等价任务类型 cron 管理产品 | Demo 已有 IANA 时区、持久 nextRunAt、stable 调度与幂等键；停机不补跑；这与持久执行恢复是两件事 |
| 测试/正式版本与 Git | 提示词/设置修订与热读取，仓库开发本身可使用 Git | Demo 要求精确 capability digest 测试通过，再晋级 stable 并生成任务仓库 Git commit/tag |
| A/B 请求上下文不能混 | 一 Ticket 一 Session/目录，资源读取过滤；允许订阅与事实中继；OS 完整权限 | 复用只读能力，Run 私有归档；跨 Run 分享须显式产物与权限；两边都未提供恶意代码 OS 沙箱 |
| 历史独立、汇总可维护 | 有持久历史、工作状态和管理面板 | Demo 独立保存请求/快照/事件/结果；汇总只含统计，不能把全量历史灌入运行器 |
| 基于规则持续学习与升级 | 可以编辑规则/技能/提示词；未见完整的历史抽取→评测→正式发布闭环 | Demo 是预定义规则生成提案；建议增加脱敏模型抽取、来源审核、固定回归集，禁止静默修改 stable |
| 上层 Codex 通过 MCP 等调用 | 主要为 DSH 内部工具和本机管理端；未见等价跨项目外部任务服务接口 | 继续提供 MCP/HTTP/stdio；Skill 约束调用习惯，服务端负责 capability、版本、参数、隔离和状态校验 |
| 本地设计，云端自由共享 | SourceRegistry 管事件来源插件；未见能力包市场 | 已有本机独立 registry 演示；公共云还缺身份、签名、租户权限、包治理与运维 |

DeepSeek 的技能与配置粒度参见[提示词文档](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/004-prompts.md)，工具及定时限制参见[架构文档](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md#L532)，来源注册参见[SourceRegistry](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/sources/registry.ts)。TaskDock 对应证据为本工作区 `docs/ARCHITECTURE.md`、`docs/PROTOCOL.md`、`src/schema.js`、`src/store.js`、`src/scheduler.js` 和 `skills/taskdock-client/SKILL.md`；代码事实不等于真实模型效果验收。

## 推荐迁移的最小切片

先以“服务上线检查”一个 TaskType 实现：提交→事务保存 Run 与 Attempt→提交后派工→结构化等待→结果持久保存→可靠投递。每个外部动作带业务幂等键和回执；出现“外部已成功但回执丢失”时进入核对，而不是盲目重试。能力 digest 固定，恢复前重新检查授权策略。

第一轮不要求 DSH 接管全部 TaskDock。先让当前适配口证明中断、重复输入与人工恢复，再在同一输入集和权限约束下增加 DSH 适配。运行器实验的决策依据是证据完整性、成功率、重复副作用、人工介入与成本，而非测试数量或框架名称。

若将来允许社区上传可执行插件，就需要另外选择容器/微虚机、文件与网络策略、凭据代理等隔离方案。当前研究没有做这些方案的实测比较；不能把其中任意一个名词写成已经成立的安全保证。
