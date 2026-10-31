# GitHub 调研与选型

核验日期：2026-10-31，Asia/Shanghai。结论范围：下列 10 个候选的仓库、官方说明与相关接口文档；没有逐一安装运行所有候选，不把“未在文档中核实”写成“不支持”。GitHub 默认分支可能继续变化，实际采用的执行依赖由 package-lock.json 固定。

## 结论

本次候选中没有核实到一个可以直接满足全部要求的现成产品。最接近的几个分别覆盖了能力目录、任务执行、持久记忆或运营治理，但“以任务类型为产品对象 + 每次请求隔离 + 精确版本晋级 + 审核式经验沉淀 + 本地运行/云端共享”的闭环仍需开发。这里的“不完整覆盖”是基于需求与公开文档的工程判断，不是对整个 GitHub 的穷尽证明。

因此执行用户要求的第二条路径：选用成熟执行/协议组件，自建轻量控制面与 DEMO。没有把本次候选调研包装成已完成生产验证，也没有把一个改名后的角色管理面板当作需求实现。

## 需求核验标准

| 编号 | 必须验证的能力                          | 验收方式                                              |
| ---- | --------------------------------------- | ----------------------------------------------------- |
| R1   | 对象是任务类型，可检索、描述输入与输出  | 上层能查询 release-check，而不必寻找“运维角色”        |
| R2   | 独立服务，可被 Codex 等上层调用         | MCP 发现→新会话→提交→取回                             |
| R3   | 每请求独立上下文和目录                  | A/B 同时请求，互相读取被拒绝，提示与结果无混入        |
| R4   | 单 Agent / Team，任务独立配置 MCP/Skill | 能力清单作为该次运行的固定快照                        |
| R5   | 草稿/正式版 + Git + 测试门禁 + 回滚     | 变更后旧测试不再满足发布条件，旧运行不变              |
| R6   | 历史管理、汇总、按规则学习              | 原始历史保留，统计与知识分层，知识变更可审查          |
| R7   | 每任务定时任务                          | 真实调度、时区明确、读回保存的下一次执行时间          |
| R8   | 本地端 + 云端共享市场                   | 能力导出→独立 registry→另一任务安装，历史和密钥不上传 |

## 比较矩阵

标记：**原生**＝官方文档明确提供该能力族；**组合**＝有基础组件，仍需业务层组合；**缺口**＝产品对象或职责明显不同；**未核实**＝没有足够证据，不能据此断言不存在。矩阵评估的是完整需求，不是项目质量排名。

| 候选                  | 任务类型目录/服务             | 请求上下文隔离                              | MCP/Skills/Team              | 精确测试→Git→正式晋级            | 历史与受控学习                    | 独立共享市场               | 判断                                 |
| --------------------- | ----------------------------- | ------------------------------------------- | ---------------------------- | -------------------------------- | --------------------------------- | -------------------------- | ------------------------------------ |
| Dify                  | 组合：App/Workflow 可映射任务 | 组合：应用执行与日志，需自己定义调用者边界  | 原生/组合                    | 组合；本需求 Git 晋级契约未核实  | 日志/知识库原生，学习审核闭环需补 | 插件市场与任务服务市场不同 | 最快的低代码替代路线                 |
| LangGraph + LangSmith | 组合：图/assistant 服务       | 原生：thread checkpointer + namespace store | 组合                         | 部署支持，业务版本门禁需补       | 持久化原生，经验治理需补          | 缺少本需求的任务市场成品   | 强执行底座，控制面仍需开发           |
| Letta                 | Agent 身份模型，需映射任务    | conversation 与 memory 边界需配置           | 原生/组合                    | 本需求完整链路未核实             | 持久/共享记忆突出                 | 本需求任务市场未核实       | 适合长期身份，不能默认等同一次性请求 |
| Paperclip             | AI 员工/公司为主对象          | 任务与 heartbeat 有会话管理                 | 原生/组合                    | 修订、运行审计不等同能力发布契约 | 运行管理突出，学习闭环需补        | 本需求任务市场未核实       | UI 管理最接近，产品对象不匹配        |
| agentregistry         | 原生 Agent/MCP/Skill 目录     | 运行时职责，完整请求隔离契约未核实          | 原生/组合                    | 有版本制品，测试晋级需业务层     | 任务历史到经验审核未核实          | 原生注册/检索/分发         | 云端目录值得借鉴                     |
| CrewAI                | Task/Crew/Flow 原生组件       | 需按执行定义 state 与 memory scope          | 原生/组合                    | 平台能力不等同本地 Git 闭环      | Memory/Flow 原生，审核需补        | 本需求市场未核实           | Team 编排底座候选                    |
| Agent Zero            | 个人 Agent/项目为主           | 存在会话与记忆，硬边界需验证                | 原生/组合                    | 本需求晋级门禁未核实             | 持久知识可用，审核需补            | 本需求任务市场未核实       | 通用助手不是任务控制面               |
| Goose                 | 个人执行器/配方               | 会话能力不等同任务服务 ACL                  | MCP/配方突出                 | 本需求正式能力生命周期未核实     | 本需求审核学习未核实              | 配方共享不等同完整市场     | 可作为后续 runner                    |
| MCP Gateway Registry  | 原生 MCP/Agent/Skill 治理目录 | 工具访问治理，非请求上下文运行器            | 原生注册与治理               | 工具版本治理，非本需求任务发布   | 学习闭环未核实                    | 注册/federation 有基础     | 网关组件，不是完整执行平台           |
| Microsoft APM         | 配置依赖与包管理              | 不承担请求执行隔离                          | 原生 AGENTS/Skill/MCP 包管理 | lock/版本有基础，运行门禁需补    | 不承担请求学习闭环                | 可复用包分发               | 包管理组件，不是服务控制面           |

## 重点候选

### Dify

官方已支持将应用暴露为 MCP 服务，不能沿用旧资料说 Dify 没有 MCP 出口。应用、工作流、日志、知识库可以很快承载任务服务。仍需自己定义任务包目录、每个上层会话的 capability、任务专属 Git 仓库、精确摘要测试门禁以及从历史到知识的审核规则。若优先低代码搭流程而非本机目录与 Git 治理，可将其作为后续 runner/远端任务提供者。[仓库](https://github.com/langgenius/dify)、[官方 MCP 发布文档](https://docs.dify.ai/en/cloud/use-dify/publish/publish-mcp)。

### LangGraph / LangSmith

线程检查点与跨线程 Store 的分层，直接对应本需求“上下文隔离、底层能力共享”的概念。LangSmith 提供托管、BYOC 或自托管的执行基础设施。但图执行框架不自动给出任务类型市场、维护控制台或知识晋级规则。对本次单用户本地 DEMO，额外基础设施较多；若后续出现长时任务、恢复、分布式扩容，再替换/补充执行层更合理。这是选型推断，不是其能力不足的断言。[持久化文档](https://docs.langchain.com/oss/javascript/langgraph/persistence)、[部署文档](https://docs.langchain.com/langsmith/deployment)、[仓库](https://github.com/langchain-ai/langgraph)。

### Letta

当前资料把 Agent 描述为带有模型、工具与记忆的持久身份；官方同时存在 conversations、shared memory 和基于 Git 的 context repositories。它并非“没有记忆隔离”。但跨 conversation 的 Agent 记忆可能共享，不能把 A/B 请求投入同一持久身份便认定已满足零交叉污染。要按本需求使用，需要明确一次性会话与受审核知识之间的读写契约，并补上任务服务发布与分发层。[仓库](https://github.com/letta-ai/letta)、[Stateful agents](https://docs.letta.com/concepts/stateful-agents)、[Context repositories](https://www.letta.com/blog/context-repositories/)。

### Paperclip

提供 Agent 管理、预算、任务、心跳执行、适配器和审计，管理体验最接近用户对“能维护一组 AI”的诉求。但官方以 AI 员工、公司、组织层级为核心；任务关联会话和心跳继续上下文也与“每次外部请求新会话”不同。可借鉴运营管理模型，但若直接 fork，需要长期维护产品对象及执行契约的改造。[仓库](https://github.com/paperclipai/paperclip)、[官方 Agent 文档](https://docs.paperclip.ing/guides/org/agents/)、[心跳协议](https://github.com/paperclipai/paperclip/blob/master/docs/guides/agent-developer/heartbeat-protocol.md)。

### agentregistry

官方目录可存 Agent、MCP server、Skill、Prompt 和 Plugin，提供 UI、CLI、REST 与版本制品；Agent 可部署到连接的 runtime。它最值得作为后续共享云的集成对象。尚未从所查文档核实本需求的独立请求工作目录、原始上下文隔离、历史汇总到知识审核与精确测试晋级整条链路，因此不能称为完全满足。[仓库](https://github.com/agentregistry-dev/agentregistry)、[Core concepts](https://aregistry.ai/docs/about/concepts/)。

## 其余候选的直接证据

- [CrewAI 官方仓库](https://github.com/crewAIInc/crewAI) 与 [Flow Memory 文档](https://github.com/crewAIInc/crewAI/blob/main/docs/edge/en/concepts/flows.mdx)：具备编排和带 scope 的记忆组件；本需求的治理控制面需组合实现。
- [Agent Zero 官方仓库](https://github.com/agent0ai/agent-zero)：通用 Agent、知识、工具和 UI，不能据 README 推断已实现本需求的 Git 晋级门禁。
- [Goose 官方仓库](https://github.com/aaif-goose/goose)：可扩展执行器与 MCP 生态，是执行层替换候选。
- [MCP Gateway Registry 官方仓库](https://github.com/agentic-community/mcp-gateway-registry) 与 [Skill 架构文档](https://github.com/agentic-community/mcp-gateway-registry/blob/main/docs/design/agent-skills-architecture.md)：注册、访问治理与 federation，职责偏工具目录和网关。
- [APM 官方仓库](https://github.com/microsoft/apm)：配置和包依赖复现，对应能力分发而非请求服务运行。

## 场景与技术论证

首个验证问题是跨项目复用上线检查，而不是“让多个角色聊天”。按任务类型建立稳定输入输出，再固定上下文、版本和可见范围，可以让上层自主拆解和本地 fallback。把目录、运行器、协议、知识和市场拆成边界，后续能接入 Dify/LangGraph/Goose，而不重写任务对象。

选用 Pi 的理由是可嵌入、每次新建 session、能明确指定模型和工具。当前 npm 正式包为 @earendil-works/pi-coding-agent；旧 badlogic/pi-mono 仓库会重定向。不能直接照搬旧版 AuthStorage 示例，本次按安装包的实际导出进行了离线初始化验证。Pi 负责一次执行，控制面实现请求隔离、目录、发布与调度。[当前仓库](https://github.com/earendil-works/pi)、[SDK 文档](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sdk.md)。

MCP 是本版上层工具入口与下层工具连接；内部任务协议显式携带 run、session 和 pinned version。A2A 的 task/message/context 概念适合未来跨平台互通，但本版没有实现它，不能仅提供 Agent Card 就宣称兼容。Skill 也不能强制约束任何恶意客户端；权限与隔离必须在服务实现。[MCP 规范](https://modelcontextprotocol.io/specification/latest)、[A2A 规范](https://a2a-protocol.org/latest/specification/)。

## 开发结果与仍待验证项

功能覆盖和真实测试结果见 [VERIFICATION.md](VERIFICATION.md)。本版可检验关键控制面闭环；没有模型 key，因此没有宣称模型推理质量已验证。共享端为独立服务和独立网站，完成本机发布/检索/安装链路；尚未部署公共社区或实现云端多租户。生产多用户隔离、OS 沙箱、签名来源信任、分布式调度与自动模型改码评测，需要后续验收。
