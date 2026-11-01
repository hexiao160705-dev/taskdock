# TaskDock × DeepSeek Super-agent：目的地、方法与技术取舍

听众：任务 Agent 中台设计者与维护者

范围：按用户四个问题展开；固定 DeepSeek 原型提交 6337fc823ce20251c8de8085948165c81aaa701e；区分已实现、建议、未验证


## 01 · 我们需要怎样的任务 Agent 中台？


- **objective**：理解并能够解释：保留任务服务目标，吸收 DeepSeek 的可靠协作机制。

- **audience_question**：DeepSeek 项目是否可以直接替代 TaskDock？

- **key_message**：保留任务服务目标，吸收 DeepSeek 的可靠协作机制。

- **counterargument**：如果目标收窄为维护一个代码仓库，直接采用原型的价值会显著提高。

- **uncertainty**：适配收益尚未通过真实模型同题实验。

- **visual**：四章导航与建议路线：目标、方法、DeepSeek、对比建议。

- **transition**：先把目的地说准确。

- **estimated_seconds**：36


论证链：
1. 两者都在让 Agent 超越单次聊天，但服务对象不同。 [U1, D1]
2. 原型提供有价值的执行治理机制，尚不是完整任务能力平台。 [D3, D10, H1]


口播：

这份汇报回答四个问题：我们的目的地是什么，为什么采用现在的方法，DeepSeek 这个开源原型实际解决什么，以及接下来应该怎么选。先给结论：你的直觉有根据，两者都在把 Agent 从一次聊天推进为可持续管理的工作系统。但我不建议直接用这个原型替换任务中台。更合适的路线，是保留任务能力的产品模型，吸收它在授权、可靠交付和人工协作上的设计。后面会用代码和图说明这个判断，也会说清当前 Demo 的不足。


## 02 · 目的地：可持续运营的任务能力服务


- **objective**：理解并能够解释：管理可复用的任务类型，而不只是管理聊天窗口。

- **audience_question**：这个平台最终应交付什么价值？

- **key_message**：管理可复用的任务类型，而不只是管理聊天窗口。

- **counterargument**：直接共享 Skill 的成本更低，若无需服务执行和治理，未必需要中台。

- **uncertainty**：完整商业云与多租户身份并不在现有 Demo 中。

- **visual**：中心任务能力服务，外圈发现、执行、治理、学习、共享五个目标。

- **transition**：实现前先分清三个对象。

- **estimated_seconds**：35


论证链：
1. 上层项目提出需求，中台发现并复用已定义任务，未知工作留给上层。 [U1, T1]
2. 任务方法、组件与知识长期维护，请求执行则彼此独立。 [U1, T2, T4]


口播：

我对目的地的理解是：建立一个面向任务类型的能力服务平台。比如服务上线检查是一种长期维护的能力，项目甲和项目乙都能调用它。中台保存这项能力的方法、工具配置、正式版本和审核知识；每次调用则创建独立的工作实例。它既要方便上层复用，也要方便维护者调试、升级、回滚和观察历史。云端分享的是能力包，本地保存的是项目上下文和执行证据。最终价值不是多出几个会话，而是重复工作能积累、协作边界能验证。


## 03 · 先分清：任务类型、执行请求、运行 Agent


- **objective**：理解并能够解释：TaskType 是产品；Run 是订单；Agent 是可替换执行器。

- **audience_question**：为什么不能用角色或持久会话替代任务类型？

- **key_message**：TaskType 是产品；Run 是订单；Agent 是可替换执行器。

- **counterargument**：小规模系统可把三者合并以减少复杂度，但会限制版本、隔离和替换。

- **uncertainty**：统一协议的数据模型仍是后续设计。

- **visual**：一对多对象图：任务类型→多个 Run→各自单 Agent/Team。

- **transition**：接着解释系统的分层方法。

- **estimated_seconds**：43


论证链：
1. 一个任务类型可以服务多个独立 Run，使用不同版本和运行器。 [U1, T2, T3]
2. DeepSeek 的 Ticket 已是工作实例，内部 router/worker 角色本身不是冲突点。 [D3, D6]


口播：

这里最容易混淆三个对象。第一，任务类型，是能反复提供的服务，例如上线检查，包含输入约定和验收方式。第二，执行请求，是这次为项目甲做的检查，有自己的数据、状态和结果。第三，运行 Agent，是完成这次请求的执行器，它可以是单 Agent，也可以是一个团队，未来还可以更换框架。因此，任务类型和 Agent 不应硬绑成同一个身份。DeepSeek 的 Ticket 其实已经是工作实例，不能简单批评它只按角色组织。真正需要比较的是，它有没有我们需要的任务类型目录和能力生命周期。


## 04 · 方法一：把控制面与执行面分开


- **objective**：理解并能够解释：中台管理契约与生命周期，运行器负责一次执行。

- **audience_question**：为什么不先押注 Pi、DSH 或某个全能 Agent？

- **key_message**：中台管理契约与生命周期，运行器负责一次执行。

- **counterargument**：直接采用完整平台能更快得到界面与生态，分层也有额外接口成本。

- **uncertainty**：多个框架之间的行为等价尚未验证。

- **visual**：五层架构图，上层调用/任务控制面/运行器适配/隔离工作区/分层存储。

- **transition**：用上线检查串起一次完整调用。

- **estimated_seconds**：37


论证链：
1. 任务目录、版本和知识治理不应随运行框架一起改写。 [U1, T1, T2, H1]
2. Pi 与 DSH 分别提供执行接口和宿主能力，产品边界在其上层。 [T3, D15]


口播：

我们的方法从分层开始。上层是 Codex 等提出工作需求的会话；控制面负责能力发现、请求鉴权、版本选择、状态和审计；执行面按约定启动一次工作；底层保存能力包、私有请求和审核知识。Pi 或 DeepSeek Harness 属于执行层的选择，不应该决定整个产品的数据模型。这样做不是为了同时接入所有框架，而是为了把更换运行器的影响限制在适配接口。先明确用户如何调用、如何验证和如何升级，再决定哪个框架最适合执行。


## 05 · 方法二：先发现能力，再提交最小上下文


- **objective**：理解并能够解释：已有任务委托中台，未覆盖的任务由父会话完成。

- **audience_question**：一个 Codex 会话实际上应怎样调用？

- **key_message**：已有任务委托中台，未覆盖的任务由父会话完成。

- **counterargument**：单纯列出工具可能更简单；目录增加维护成本。

- **uncertainty**：任务匹配准确率没有实测数据。

- **visual**：泳道：父会话→检索→匹配分支→独立凭证→正式版本→结果/本地 fallback。

- **transition**：下一步解决能力共享和上下文隔离的矛盾。

- **estimated_seconds**：38


论证链：
1. 现有 MCP 已提供 search、plan、open_session、submit、get_run。 [T1]
2. 当前 plan 只是关键词建议，不代替父会话的语义分解。 [T7]


口播：

以项目上线为例，父会话先把工作拆成服务检查、文案修改和发布执行。它查询任务目录，发现已经有上线检查，就只提交检查需要的证据；没有对应能力的工作，继续在父会话完成。中台为这次父会话创建独立凭证，固定正式版本，再返回请求编号，后续通过状态和结果取回证据。当前 Demo 已有这些 MCP 入口，但 plan 只是关键词匹配建议，不能说它已经完成智能规划。真正的语义拆解仍由上层会话承担，任务匹配也需要确认输入输出是否合适。


## 06 · 方法三：共享能力，不共享原始请求


- **objective**：理解并能够解释：隔离需要覆盖会话、文件、工具和知识四个边界。

- **audience_question**：项目甲和乙为什么不会互相污染？

- **key_message**：隔离需要覆盖会话、文件、工具和知识四个边界。

- **counterargument**：完全禁止跨请求信息流会损失协作价值，需要受控共享而非一刀切。

- **uncertainty**：本机维护者可查看历史；多租户隔离尚未实现。

- **visual**：A/B 双工作区与共享只读能力包；四层边界清单；显式产物通道。

- **transition**：历史要积累，但必须经过知识晋级。

- **estimated_seconds**：39


论证链：
1. 新会话和固定快照只解决部分问题，还需请求资源权限及知识写入规则。 [T1, T3, U1]
2. 同一 Run 的 Team 可共享阶段产物；跨 Run 的协作要有显式授权。 [T3, H1]


口播：

隔离不能只靠换一个会话名字。我们至少要检查四个边界：模型收到什么上下文，执行器能读哪些文件，能调用哪些工具，以及什么内容会写入共享知识。项目甲和乙可以引用同一个正式能力包，但原始输入和产物分别保存，读取需要各自的请求权限。同一个请求内部的 Team 可以共享必要的阶段产物；不同请求之间如果确实需要协作，应通过明确授权的产物引用传递，而不是互相读取整段聊天。现有 Demo 已实现应用层的部分边界，还没有恶意代码的操作系统沙箱。


## 07 · 方法四：把学习做成可审查的变更


- **objective**：理解并能够解释：原始记录→脱敏提案→评测→版本发布，才构成改进闭环。

- **audience_question**：历史存在目录里，是否就等于 Agent 学会了？

- **key_message**：原始记录→脱敏提案→评测→版本发布，才构成改进闭环。

- **counterargument**：全自动更新更快，但若无法识别污染和退化，速度会放大风险。

- **uncertainty**：自主经验抽取与改进收益未实现也未测量。

- **visual**：两条管道：私有历史库与共享能力库，中间用脱敏、审核、评测、发布闸门连接。

- **transition**：同样的原则也适用于版本。

- **estimated_seconds**：39


论证链：
1. 保存历史不等于学习；当前规则只生成维护者预定义提案。 [T4]
2. 知识变化应更新草稿、重测并生成正式版本，不回流原始上下文。 [T2, T4, T5]


口播：

历史文件只是原料，不等于 Agent 已经学会。真正的改进闭环，应先从历史中找出可复用的经验，去除项目私密信息，形成有来源的提案，再用回归样例评估有没有变好，最后进入能力版本。当前 Demo 比较保守：状态命中规则时，会产生维护者预先写好的提案，审核后进入草稿。这证明了治理通道，不证明模型能自主总结经验，更不证明升级提高了质量。后续应补的核心，是有证据的经验抽取和有对照的能力评测，而不是直接让 Agent 改写自己的正式提示词。


## 08 · 方法五：固定能力版本，动态复核授权


- **objective**：理解并能够解释：能力可复现，与权限可撤销，是两件不同的事。

- **audience_question**：既然版本固定，运行中还能响应规则变化吗？

- **key_message**：能力可复现，与权限可撤销，是两件不同的事。

- **counterargument**：热更新提示词更灵活，也可能符合运维场景，但影响请求结果的复现。

- **uncertainty**：TaskDock 尚未实现完整的运行中授权撤销机制。

- **visual**：双时间线：能力版本固定；授权策略持续复核；运行溯源元组。

- **transition**：先诚实定位我们当前的位置。

- **estimated_seconds**：40


论证链：
1. 正式能力包需要不可变快照，现有晋级以 digest 和 Git 为证。 [T2]
2. 授权/安全策略则需要继续有效；DeepSeek 对 Policy 变化与恢复复核有独立语义。 [D17, H1]


口播：

这里需要比上一版方案更精确。为了复现结果，一次请求应固定它使用的能力、知识、模型标识和工具清单。但这不代表权限永远有效：账户被撤销、数据授权变化或者出现紧急安全限制时，执行必须能受控停止或重新授权。所以建议把能力版本和安全策略分开记录。能力包在本次执行中保持不变，权限和授权则在关键动作与恢复时继续复核。DeepSeek 的 Policy 和 Mandate 给了很好的参考。我们不该把所有热更新都复制过来，也不该把版本固定误解为不能撤销权限。


## 09 · 当前 TaskDock：控制面 Demo，而非成熟自治系统


- **objective**：理解并能够解释：已有的接口与治理流程，不能替代模型质量和恢复能力。

- **audience_question**：之前的 Demo 已经做到哪里，还缺什么？

- **key_message**：已有的接口与治理流程，不能替代模型质量和恢复能力。

- **counterargument**：Demo 已足够检验产品方向，没有必要一开始就做完整生产系统。

- **uncertainty**：真实模型、云部署与长期运行质量未知。

- **visual**：已实现/有限实现/未验证三列；用具体边界而非完成率。

- **transition**：现在转向 DeepSeek 的目的地。

- **estimated_seconds**：44


论证链：
1. 任务目录、请求隔离、MCP、版本、提案审核和本机 Registry 已有代码。 [T1, T2, T3, T4, T5]
2. 关键词路由、内存队列、模拟模型测试与未部署云端限制了能力边界。 [T6, T7, V2, N1]


口播：

当前 TaskDock 已把任务目录、MCP 接入、请求隔离、Git 版本、提案审核和独立 Registry 串起来，但它仍是控制面 Demo。内置任务执行的是确定性规则，不是语言模型推理；Team 目前是串行阶段。运行队列在内存里，重启会把未结束请求标为中断，而不是自动恢复。云端共享端只完成本机独立服务验证，模型效果、多租户和沙箱都没有被证明。本次重新运行的二十六项检查通过，只能说明这些测试层的断言通过。后面的建议会优先补这些短板，不会把我们自己的 Demo 当成既成的成熟产品。


## 10 · DeepSeek 的目标：持续承担一个仓库的工作


- **objective**：理解并能够解释：优化的不只是执行能力，还有团队注意力成本。

- **audience_question**：这个项目究竟想解决什么？

- **key_message**：优化的不只是执行能力，还有团队注意力成本。

- **counterargument**：可以扩展更多来源，因此单仓库是当前部署边界，不是领域模型永远只能如此。

- **uncertainty**：没有验证多仓库改造成本。

- **visual**：一个仓库为中心，GitHub/飞书事件输入，PR/答复输出，监督面板与注意力准则。

- **transition**：它用一条领域链来组织持续工作。

- **estimated_seconds**：42


论证链：
1. 官方明确面向一个 GitHub 仓库，可选飞书来源，以 Harness bundle 运行。 [D1, D15]
2. 行动和发言都围绕最少打扰、明确授权和可操作结果。 [D2, D19]


口播：

DeepSeek 这个项目的目标，是让一个 coding agent 持续参与一个仓库的日常工作。它监听 GitHub，可选接入飞书，判断什么时候应该工作，独立完成任务，再把结果送回原来的讨论。它特别强调团队注意力：不应因为 Agent 能干活，就制造大量没人需要的消息和拉取请求。官方也明确说明，这是研究原型，不是正式产品，公开代码不等同内部版本，更不等同文章里的全部未来设计。因此，我们比较的是这份固定提交的原型，而不是一个想象中已经完工的超级 Agent 平台。


## 11 · 核心逻辑：事件先变成有授权的工作单


- **objective**：理解并能够解释：Trigger 不是任务；通过判断后才产生 Ticket 与 Mandate。

- **audience_question**：一条评论怎样变成 Agent 工作？

- **key_message**：Trigger 不是任务；通过判断后才产生 Ticket 与 Mandate。

- **counterargument**：更多概念会增加理解成本；需要用不变条件证明每个概念的价值。

- **uncertainty**：完整外部 E2E 没有执行。

- **visual**：Source→Trigger/Thread→Gate+Assessment→Ticket+Mandate→Assignment/Worker→Channel。

- **transition**：授权机制值得单独放大看。

- **estimated_seconds**：41


论证链：
1. Source 将外部内容翻译为稳定 Trigger，Thread 组织相关讨论。 [D3, D5]
2. Gate/Assessment 决定接单，Mandate 记录为什么能做，Assignment 绑定执行。 [D4, D6]


口播：

图中这条链是原型的骨架。来源适配器先把评论或消息转为不可变事件，再按讨论线程组织。系统不是看到文本就立刻启动 Agent，而是先检查身份、接收范围和当前规则，再让模型判断是否形成工作。接单后创建工作单 Ticket，并附上授权依据 Mandate，说明谁提出、允许做什么、依赖哪个策略版本。接下来派工到独立执行器，结果通过原来的 Channel 送回。这套模型最有价值的地方，是把事件、授权、工作和执行分开了，后面才能讨论重试、后续消息和恢复到底属于哪一层。


## 12 · 关键设计：看到消息，不等于获得授权


- **objective**：理解并能够解释：上下文可以进入工作单，权限必须有独立依据。

- **audience_question**：评论、机器人和后续讨论会不会偷偷扩权？

- **key_message**：上下文可以进入工作单，权限必须有独立依据。

- **counterargument**：上下文与权限完全分离仍需执行工具配合，单靠领域记录不能防所有越权。

- **uncertainty**：推理误判与实际工具风险未通过对抗 E2E 测量。

- **visual**：两条输入通道：新授权与上下文；observe→记录，auto+规则→可执行。

- **transition**：持续工作还需要独立状态机。

- **estimated_seconds**：43


论证链：
1. Gate 是代码约束，模型 Assessment 不能把观察模式变成自动接单。 [D4, D17]
2. 订阅投递上下文不授予新权限；超出范围应交回重新路由。 [D3, D5, D17]


口播：

授权有两条不同路径。明确的授权请求可以直接被路由；推断出来的主动候选必须经过规则评估。默认观察模式下，即使模型认为值得接单，也只记录本来会做什么，不启动工作。另一个路径是订阅：工作单可以收到相关线程的后续消息，但收到消息本身不授予新权限。执行器只能在原授权范围内继续，超出范围要交回路由。这一点非常适合借到我们的中台：别人转来的日志、文档甚至模型的建议都只能是数据，不能修改工具权限或发布规则。不过业务范围是否满足仍部分依赖模型判断，不能把 Mandate 当成完整的代码沙箱。


## 13 · 持续协作：工作单、派工和模型回合分开


- **objective**：理解并能够解释：一轮模型结束，不代表工作完成。

- **audience_question**：Agent 等人、等 CI、重试和恢复时，状态怎么管理？

- **key_message**：一轮模型结束，不代表工作完成。

- **counterargument**：长期恢复会增加重复动作风险，因此恢复不能等同无条件再跑一次。

- **uncertainty**：需要把恢复协议与外部副作用幂等一起设计。

- **visual**：三层生命周期与工作单状态图；等待人/等待事件/尝试失败/人工停止分开。

- **transition**：然后看它怎样保存尚未完成的动作。

- **estimated_seconds**：37


论证链：
1. Ticket 生命周期独立于 Assignment 和 Session；结构化 Attention 代表等待人。 [D3, D12]
2. 订阅驱动继续，人工停止有不同语义；恢复前复核 Mandate。 [D6, D17]


口播：

这张状态图解释原型为什么比普通聊天会话更像一个工作系统。模型的一轮输出结束了，工作单可能仍在等测试、等评审或等一个人的答案。一次派工失败，也不必丢掉整个工作单；重试可以沿用原来的目录、会话和拉取请求。结构化的人工问题会进入待人处理状态，面板优先显示它。人工明确停止与暂时等待又是不同状态，不能被自动反馈随便唤醒。对我们的中台，未来也应区分请求、执行尝试和人工等待，避免把所有未完成情况都压进成功或失败两个标签。


## 14 · 可靠执行：先保存待办动作，再做外部副作用


- **objective**：理解并能够解释：Effects 与 Outbox 比“失败后再问模型一次”更关键。

- **audience_question**：进程崩溃或发消息失败后，怎样不丢工作？

- **key_message**：Effects 与 Outbox 比“失败后再问模型一次”更关键。

- **counterargument**：事务队列更复杂，小型原型可先选择中断而不自动重放以避免重复副作用。

- **uncertainty**：不宣称外部副作用严格 exactly-once。

- **visual**：事务提交与外部副作用双泳道；崩溃窗口和幂等核对提示。

- **transition**：再看独立目录真正保证了什么。

- **estimated_seconds**：40


论证链：
1. 业务状态和 effect 在事务内保存，提交后由适配器执行。 [D10]
2. Outbox 保存回执与重试状态；原子记录不等于所有外部动作 exactly-once。 [D11, H1]
3. TaskDock 当前内存队列在这一层有明确短板。 [T6]


口播：

这是我建议优先借鉴的工程机制。假设系统已经决定要启动工作或发送结果，如果只把动作放在内存里，进程一崩就可能丢失。DeepSeek 把待执行动作先写进数据库事务，提交后再真正调用外部系统。失败时保留状态，按退避规则重试；Outbox 同时保留消息回执和同一会话的发送顺序。这里仍不能宣称所有动作严格只执行一次，因为外部系统成功、回执落库前崩溃的窗口还在。我们需要结合外部幂等键或状态核对。相比换一个更强模型，先补这层能直接改善任务中台的可靠性。


## 15 · 隔离的共同点与不同边界


- **objective**：理解并能够解释：独立 Session 与目录是基础，操作系统隔离需要另外做。

- **audience_question**：它能否直接满足甲乙请求绝不交叉污染？

- **key_message**：独立 Session 与目录是基础，操作系统隔离需要另外做。

- **counterargument**：单用户受信任运行器未必需要强沙箱，边界应随实际威胁模型选择。

- **uncertainty**：未运行恶意工具和跨租户对抗实验。

- **visual**：三列：已有应用隔离/有意协作输入/未提供 OS 沙箱；并列 TaskDock 的同类限制。

- **transition**：版本机制也不能只看有没有历史列表。

- **estimated_seconds**：44


论证链：
1. worker 资源读取会隐藏其他 Ticket/Decision，且一 Ticket 一 Session/目录。 [D6, D7]
2. 订阅和主会话笔记允许受控协作；danger-full-access 可读操作者目录。 [D5, D8]
3. 两项目都不能把应用层限制说成恶意代码 OS 沙箱。 [T3, N1]


口播：

原型确实做了值得肯定的应用层隔离。每个工作单有独立持久会话和目录，读取工具会过滤其他工作单和决策记录。但它也有意允许通过订阅和主会话笔记传递相关上下文，这服务于单仓库内持续协作，和跨项目默认不串上下文的要求不同。更关键的是，官方部署文档明确说，执行器使用操作者的操作系统用户和完整权限，账户 wrapper 和工作目录不是安全边界，仍可能读取主目录。我们自己的 Demo 也没有操作系统沙箱。因此不能把谁有独立目录当成谁已经安全；真正的跨用户服务，还需要进程、文件系统和网络权限隔离。


## 16 · 版本不是同一种版本


- **objective**：理解并能够解释：提示词编辑历史，不等于测试版到正式服务的晋级。

- **audience_question**：它也有 revisions，是否已经满足我们的版本要求？

- **key_message**：提示词编辑历史，不等于测试版到正式服务的晋级。

- **counterargument**：某些长时 Agent 的热更新是需求而非缺陷，应由产品契约决定。

- **uncertainty**：没有比较两种版本策略对模型效果的实测差异。

- **visual**：时间轴对照：运行中 prompt revision 更新 vs Run 固定 stable digest；复用与保留标记。

- **transition**：现在把相似度拆成可核查的需求矩阵。

- **estimated_seconds**：40


论证链：
1. 原型每次保存不可变提示词版本，但每次模型请求读取当前最新配置。 [D9]
2. TaskDock 对一次 Run 固定能力 digest，晋级需要当前摘要测试并写 Git。 [T2]
3. 应复用编辑历史与冲突保护，保留服务版本与安全策略的独立边界。 [H1]


口播：

两边都有版本，但语义不同。DeepSeek 保存提示词和设置的不可变修订记录，支持冲突检查和恢复；同时，会话的下一次模型请求会读取最新提示词。这很适合团队边运行边调整工作习惯，却不等于一项正式任务服务始终使用经过评测的同一能力版本。我们的目标还要求测试通道、正式通道、能力包摘要和 Git 回滚。所以可以借它的编辑历史和默认值升级提示，但正式服务仍应按发布版本固定。上一页说的授权撤销则走另一条策略通道，不必为了可撤销权限而让整套能力随时热变。


## 17 · 需求对照：相近，但不是完整替代


- **objective**：理解并能够解释：原型强在持续工作治理，中台仍需能力服务生命周期。

- **audience_question**：我的要求到底覆盖到哪，缺口在哪里？

- **key_message**：原型强在持续工作治理，中台仍需能力服务生命周期。

- **counterargument**：源插件和规则可扩展，因此定制后可覆盖更多需求。

- **uncertainty**：未实施扩展，不能给出确定改造工作量。

- **visual**：八行能力矩阵，用已有/部分或需扩展/未见配套实现标识，不算百分比。

- **transition**：根据缺口比较三条可选路线。

- **estimated_seconds**：44


论证链：
1. Ticket、授权、历史、恢复和事件订阅有代码；任务类型服务目录不是 Ticket 列表。 [D3, D6, D10, D16]
2. 源注册表不是能力市场，测试内存仓储不是学习记忆。 [D13, D14]
3. TaskDock 的目录、版本与共享也仍是有限 Demo。 [T1, T2, T4, T5, N1]


口播：

这张矩阵按需求而不是按项目名打勾。DeepSeek 在工作单、授权、历史、持续反馈和恢复上有较多可核查实现；我们的 Demo 在任务目录、MCP 服务入口和测试到正式版的链路上更贴近原始目标。但双方都没有完成我们设想的公共能力社区和可信自主学习。两个文件名尤其容易误读：原型的 SourceRegistry 管的是事件来源插件，不是能力包市场；core 目录的 memory 文件是测试用的内存仓储，不是 Agent 经验系统。矩阵里的未见实现，是本次阅读范围内的结论，不等于永远不能扩展。


## 18 · 三条路线：整体采用、机制移植、运行器适配


- **objective**：理解并能够解释：先移植高价值机制，再用适配实验决定框架。

- **audience_question**：应该 fork、重写，还是接成一个执行后端？

- **key_message**：先移植高价值机制，再用适配实验决定框架。

- **counterargument**：若唯一目标是维护一个 GitHub 仓库，整体采用可能是最省事的路线。

- **uncertainty**：尚未测得适配成本、长期维护成本和性能收益。

- **visual**：三路线卡片：适用场景、收益、代价、建议，不给伪造工时或评分。

- **transition**：推荐方案在架构上如何落地？

- **estimated_seconds**：41


论证链：
1. 直接采用原型更适合单仓库主动维护，但保留原型假设。 [D1, D15]
2. 机制移植保持现有任务契约；DSH 适配仍需映射授权和生命周期。 [H1, T1, D3]


口播：

可以选三条路线。整体 fork 最快得到主动仓库协作，但任务目录、包发布、云端分发和宿主耦合都还要处理。第二条是保留 TaskDock，把授权记录、持久队列、Outbox 和人工等待状态逐项移植。这条路线最符合目前的产品对象，也更容易验证每次改动。第三条是增加一个 DSH 执行适配器，让两种框架做同一道题。不过这不是换一个模型接口，必须处理工作单状态、权限和恢复语义。我建议第二条优先，第三条作为有边界的实验；暂时没有证据支持把整个产品立即迁移。


## 19 · 推荐架构：TaskDock 控制面＋可替换执行适配


- **objective**：理解并能够解释：先统一任务契约，再兼容 Pi 或 DeepSeek Harness。

- **audience_question**：吸收它以后，整体产品会变成什么？

- **key_message**：先统一任务契约，再兼容 Pi 或 DeepSeek Harness。

- **counterargument**：过早抽象多个执行后端会拖慢首个真实任务，需要只定义当前必需接口。

- **uncertainty**：DSH 适配器尚未开发或运行。

- **visual**：保留/新增/可选三色架构图；控制面与两种 runner 之间明示 adapter。

- **transition**：通信协议必须携带这些边界。

- **estimated_seconds**：41


论证链：
1. 中台继续拥有 TaskType、Run、Release、KnowledgeProposal、Registry。 [U1, T1, T2, T4, T5]
2. 借鉴 Mandate、Attempt、Effects、Outbox、Attention，但不混同对象。 [D3, D10, D11, D12, H1]


口播：

推荐架构中，TaskDock 继续管理任务类型、发布版本、请求和知识提案。借鉴的工作治理机制放在控制面内部：授权记录说明这次允许什么，执行尝试支持重试和恢复，持久副作用队列负责不能丢的动作，人工等待状态负责把必要的问题交回去。执行端只接收固定能力和授权范围，再通过统一适配口启动 Pi 或 DSH。事件来源也可以接到入口，但不能越过任务目录和授权。这里是目标设计图，不是已完成集成的截图。优先把一个请求从提交到中断恢复的契约定义完整，再增加第二个运行器。


## 20 · 协议最小集：请求、权限、版本、证据、状态


- **objective**：理解并能够解释：MCP 是接入方式，不会自动提供任务隔离与生命周期。

- **audience_question**：Agent 之间应该传什么，才能真正协同？

- **key_message**：MCP 是接入方式，不会自动提供任务隔离与生命周期。

- **counterargument**：字段越多接入越重，应保留最小安全和可恢复语义，其余用可扩展元数据。

- **uncertainty**：具体 schema 与跨框架行为仍需实现验证。

- **visual**：Request/Result 两张协议卡与状态带；标为建议契约，不是标准实现。

- **transition**：把建议排成可以验收的增量。

- **estimated_seconds**：38


论证链：
1. 现有 MCP 能提供发现/提交/查询，业务安全仍由服务定义。 [T1]
2. 新协议应带来源、允许范围、固定包、幂等键、预算和结果引用。 [D3, D17, H1]


口播：

通信协议不需要一开始就发明一整套标准，但必须带对信息。请求至少说明谁发起、调用哪个任务版本、输入在哪里、允许访问什么、幂等键是什么，以及时间和费用边界。结果要有状态、证据与产物引用；需要人时返回结构化问题，不能把一段模糊文字当成失败。团队内部子任务也应继承受限权限和同一追踪链，而不是继承全部父上下文。MCP 可以承载这些工具调用，未来也可以增加 A2A 适配，但协议名称本身不会替我们完成鉴权、版本固定和数据隔离。


## 21 · 落地顺序：先可靠，再证明能力，最后共享


- **objective**：理解并能够解释：每一步都用明确门禁，不用自动化数量代替业务效果。

- **audience_question**：下一轮开发最应该先做什么？

- **key_message**：每一步都用明确门禁，不用自动化数量代替业务效果。

- **counterargument**：可以更早做市场页面验证需求，但它不能替代底层可信执行。

- **uncertainty**：需要真实任务数据与模型账号后才能评估投入。

- **visual**：三个里程碑与各自通过条件；不标未估算的日期或工时。

- **transition**：用同题实验决定是否真的需要 DSH。

- **estimated_seconds**：35


论证链：
1. 内存队列和简单失败状态是当前控制面的直接短板。 [T6, D10, D12]
2. 真实模型、隔离与回归评测要先于公共分发和自动升级。 [T4, T5, N1, H1]


口播：

落地顺序建议分三步。第一步补可靠性：持久请求队列、执行尝试、人工等待和授权记录，让崩溃恢复的行为可预测。第二步只选一个真实任务接入模型，验证证据质量、A 和 B 的上下文隔离、工具边界以及取消和重试。第三步再做能力评测与共享：把历史转为可审核经验，用固定回归集控制升级，再增加包签名、发布者身份和多租户。每一步都有验收条件，不先承诺工期，也不因为能打开一个共享网页就认为公共社区已经完成。


## 22 · 同题实验：把框架争论变成可观察结果


- **objective**：理解并能够解释：比较相同任务契约，不比较测试条数或演示热闹程度。

- **audience_question**：怎样知道采用 DSH 是否值得？

- **key_message**：比较相同任务契约，不比较测试条数或演示热闹程度。

- **counterargument**：真实模型非确定性会使单次实验失真，需要固定配置与重复试验。

- **uncertainty**：没有完成同题真实模型对照。

- **visual**：八场景验收网格与五类待测指标；醒目标注“实验设计，未执行对照”。

- **transition**：最后说明什么情况下应该改变建议。

- **estimated_seconds**：38


论证链：
1. 现有两项目测试都通过，但覆盖面不同，不能按数量排名。 [V1, V2]
2. 提出八个验收场景与证据指标，测量后再决定适配。 [H1, N1]


口播：

为了决定是否接入 DSH，我建议设计同题实验，而不是凭项目热度选框架。两边执行同样的上线检查，使用相同输入、权限和验收要求。八个场景分别是双请求隔离、重复提交、进程中断、外部动作回执丢失、人工补充信息、越权输入、能力版本更新和经验升级回归。记录业务完成率、证据完整性、重复副作用、人工介入和成本。这些是待测指标，不是我已经得到的数据。本次原型一千一百九十七项测试与我们二十六项测试都通过，也绝不能据此计算谁强多少倍。


## 23 · 建议与反转条件


- **objective**：理解并能够解释：目标仍是任务能力平台，就保留中台；若收窄为单仓库协作，再优先 DSH。

- **audience_question**：什么结论最值得带走？

- **key_message**：目标仍是任务能力平台，就保留中台；若收窄为单仓库协作，再优先 DSH。

- **counterargument**：直接 fork 可更快探索完整协作体验，是合理备选而非错误路线。

- **uncertainty**：建议依赖用户目标保持不变；新实验可能推翻运行器选择。

- **visual**：条件决策树：任务能力平台/单仓库主动协作/证据支持的后端适配。

- **transition**：用证据边界收束，所有来源可追溯。

- **estimated_seconds**：43


论证链：
1. 推荐机制移植优先，运行器选择服从任务产品契约。 [H1, U1]
2. 当业务目标变成单仓库主动修复时，原型的默认工作方式更贴合。 [D1, D2, D15]


口播：

最终建议是有条件的。如果目的地仍是跨项目、按任务类型复用、可发布和持续改进的能力平台，就保留中台的数据模型，优先吸收 DeepSeek 的授权、持久动作和人工协作机制。如果你的近期目标收窄成让一个 Agent 长期维护一个 GitHub 仓库，那么直接采用它作为独立系统试点，可能更省事。若同题实验表明 DSH 的执行和恢复显著降低人工介入，再把它接成后端。真正值得借鉴的不是超级 Agent 这个名字，而是明确的工作边界，以及出问题时仍能说明发生了什么、接下来由谁做什么。


## 24 · 这份结论经过什么验证？


- **objective**：理解并能够解释：代码与测试证据支持设计分析，尚未证明线上生产效果。

- **audience_question**：哪些是事实，哪些仍是建议或未知？

- **key_message**：代码与测试证据支持设计分析，尚未证明线上生产效果。

- **counterargument**：单元和替身测试仍是有价值的代码证据，但不能替代真实运行。

- **uncertainty**：真实业务质量、长期可靠性和适配收益仍待验证。

- **visual**：固定 commit、阅读范围、实际测试层、未测边界与来源导航。

- **transition**：结束：按目标保留产品边界，按证据选择实现。

- **estimated_seconds**：41


论证链：
1. 固定提交阅读关键领域/执行/资源/版本/副作用模块，并实际完成 check。 [V1, D3, D4, D7, D9, D10]
2. 未触发真实账户写入，也没有安装生产 profile；视频建议不是集成完成声明。 [N1, H1]


口播：

这次研究固定了屏幕上的提交版本，阅读官方文档，并跟进了授权、执行、资源隔离、提示词修订和副作用队列等关键代码。在本机，官方类型检查、五十九个测试文件中的一千一百九十七项检查以及构建都通过；我们的现有二十六项检查也重新通过。但我没有安装会改变工作环境的生产 profile，没有替你发 GitHub 评论或飞书消息，也没有跑真实模型对照。视频里的推荐架构和实验计划都明确属于建议。完整来源、逐页讲稿、比较矩阵和验证记录随视频一起交付，方便你逐条复核。


## 证据台账


### U1 · user_report

**claim**：用户目标：以任务类型为对象的可复用 Agent 服务；请求隔离；版本、学习、本地与共享云闭环。

**source**：TaskDock 工作区 docs/ARCHITECTURE.md:5

**as_of**：2026-11-01

**scope**：本次读取工作区 docs/ARCHITECTURE.md

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### T1 · fact

**claim**：现有 TaskDock 有任务配置、MCP HTTP/stdio、会话 capability 与固定正式版本。

**source**：TaskDock 工作区 src/mcp.js:5

**as_of**：2026-11-01

**scope**：本次读取工作区 src/mcp.js

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### T2 · fact

**claim**：晋级要求当前能力 digest 的成功草稿测试，并生成真实 Git commit/tag。

**source**：TaskDock 工作区 src/store.js:139

**as_of**：2026-11-01

**scope**：本次读取工作区 src/store.js

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### T3 · fact

**claim**：Pi 使用新 session 与显式工具集，Team 串行；规则模式明确 deterministic。

**source**：TaskDock 工作区 src/runner.js:66

**as_of**：2026-11-01

**scope**：本次读取工作区 src/runner.js

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### T4 · fact

**claim**：学习是预定义规则产生提案，审核更新草稿；不是模型自主学习闭环。

**source**：TaskDock 工作区 src/runner.js:329

**as_of**：2026-11-01

**scope**：本次读取工作区 src/runner.js

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### T5 · fact

**claim**：能力导出严格筛选并移除 MCP 连接/示例请求，Registry 是独立本机服务。

**source**：TaskDock 工作区 src/schema.js:171

**as_of**：2026-11-01

**scope**：本次读取工作区 src/schema.js

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### T6 · fact

**claim**：当前运行队列在内存；重启将未结束请求标为 interrupted，不自动重放。

**source**：TaskDock 工作区 src/store.js:28

**as_of**：2026-11-01

**scope**：本次读取工作区 src/store.js

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### T7 · fact

**claim**：目前 plan 是关键词匹配建议，上层仍负责分解；不是语义规划器。

**source**：TaskDock 工作区 src/app.js:204

**as_of**：2026-11-01

**scope**：本次读取工作区 src/app.js

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D1 · fact

**claim**：官方定位是面向一个 GitHub 仓库的主动 coding agent；研究原型，非正式产品；文章愿景不等于原型实现。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/README.md#L3

**as_of**：2026-11-01

**scope**：README.md，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D2 · fact

**claim**：核心目标是尽量减少人的注意力成本；只按请求或书面规则行动，发言以可操作价值为准。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/000-philosophy.md#L5

**as_of**：2026-11-01

**scope**：docs/000-philosophy.md，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D3 · fact

**claim**：领域链条是 Source/Trigger/Thread/Eval/Mandate/Ticket/Assignment/Executor/Channel；Ticket 是工作实例。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/model.ts#L23

**as_of**：2026-11-01

**scope**：src/core/model.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D4 · fact

**claim**：确定性 Gate 与模型 Assessment 分层；主动接单须规则与意图证据，observe 默认只记录 would_accept。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/policy.ts#L40

**as_of**：2026-11-01

**scope**：src/policy.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D5 · fact

**claim**：事件 intake 按稳定 Trigger ID 去重，并按 Subscription 投递上下文；相关性本身不等于路由。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/intake.ts#L23

**as_of**：2026-11-01

**scope**：src/core/intake.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D6 · fact

**claim**：每 Ticket 使用自己的持久 worker Session 与目录；可重试、恢复与接收后续输入。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/executor/dsh.ts#L24

**as_of**：2026-11-01

**scope**：src/executor/dsh.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D7 · fact

**claim**：worker 的读取工具会限制到其 Ticket，隐藏别的 Ticket/Decision；这属于应用层边界。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/resources.ts#L144

**as_of**：2026-11-01

**scope**：src/app/resources.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D8 · fact

**claim**：原型以操作者 OS 用户运行、danger-full-access；工作目录和账户 wrapper 不是 OS 沙箱。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md#L19

**as_of**：2026-11-01

**scope**：docs/006-deployment.md，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D9 · fact

**claim**：提示词有不可变历史版本，但每次模型请求取最新配置；保存不要求先测后发布。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/004-prompts.md#L95

**as_of**：2026-11-01

**scope**：docs/004-prompts.md，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D10 · fact

**claim**：Effects 在业务事务内持久化副作用任务，提交后执行，支持退避、顺序与恢复。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/effects.ts#L43

**as_of**：2026-11-01

**scope**：src/app/effects.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D11 · fact

**claim**：Outbox 将消息回执与 reply effect 原子保存，再发送并记录状态。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/outbox.ts#L27

**as_of**：2026-11-01

**scope**：src/app/outbox.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D12 · fact

**claim**：结构化 Ticket stage 优先显示待人答复/审核/受阻；ready 不是所有情况下都代表工作终结。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/stage.ts#L9

**as_of**：2026-11-01

**scope**：src/core/stage.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D13 · fact

**claim**：SourceRegistry 注册的是事件来源插件及实例，不是任务能力市场。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/sources/registry.ts#L1

**as_of**：2026-11-01

**scope**：src/sources/registry.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D14 · fact

**claim**：core/memory.ts 是测试/临时 Engine 的 Map 仓储，不是 Agent 学习记忆模块。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/memory.ts#L1

**as_of**：2026-11-01

**scope**：src/core/memory.ts，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D15 · fact

**claim**：依赖 DeepSeek Harness/Cordis 的宿主能力，以 bundle 接入；换 harness 不只是改模型 API。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/package.json#L62

**as_of**：2026-11-01

**scope**：package.json，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D16 · fact

**claim**：管理路由限 loopback 与同源；原型未展示面向任意父客户端的任务目录 MCP 服务。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/http.ts#L1

**as_of**：2026-11-01

**scope**：src/app/http.ts，本次固定提交 6337fc823ce2

**limits**：结合 MCP/能力目录相关全仓检索与接口阅读；未发现不能证明永远不可能支持

### D17 · fact

**claim**：暂停/恢复、Policy 变化与恢复前授权复核有单独语义；不应把上下文当成新授权。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md#L107

**as_of**：2026-11-01

**scope**：docs/002-authorization.md，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D18 · fact

**claim**：开发者可实现 SourceKind 扩展触发来源；等待条件属于 Source 而非 Eval。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/008-cookbook.md#L21

**as_of**：2026-11-01

**scope**：docs/008-cookbook.md，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### D19 · fact

**claim**：面板先回答是否需要人、系统是否健康、单个工作的历史。

**source**：https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/005-panel.md#L5

**as_of**：2026-11-01

**scope**：docs/005-panel.md，本次固定提交 6337fc823ce2

**limits**：代码/文档核对；不等于真实模型或线上业务验收

### V1 · fact

**claim**：本机执行官方 pnpm check：类型检查、59 个文件的 1197 项测试、构建均通过；client CJS/ESM 建议警告保留。

**source**：output/research/deepseek-check.log

**as_of**：2026-11-01

**scope**：固定提交 6337fc823ce20251c8de8085948165c81aaa701e；Node 24；依赖按 frozen-lockfile 安装且 ignore-scripts

**limits**：单元/组件/宿主替身测试与构建；没有安装生产 profile，没有真实模型或 GitHub/飞书写入 E2E

### V2 · fact

**claim**：本机重新执行 TaskDock npm test：26 项通过，包含模拟模型的 Pi 契约。

**source**：output/research/taskdock-check.log

**as_of**：2026-11-01

**scope**：现有 TaskDock 0.1.0 工作区

**limits**：不是模型效果证明；两项目测试数量和覆盖面不同，不能按数量排名

### H1 · hypothesis

**claim**：建议保留 TaskDock 产品与契约，吸收领域模型、持久副作用、授权与人工等待语义，DSH 作为可选适配实验。

**source**：本次跨项目代码审查与用户目标推导

**as_of**：2026-11-01

**scope**：任务类型服务平台优先的目标

**limits**：不是已实现集成；成本、性能、模型质量和适配收益尚须同题实验

### N1 · unknown

**claim**：未进行真实模型与真实账户的端到端联调；未证明云端多租户、恶意插件沙箱或自主学习质量。

**source**：本次执行边界

**as_of**：2026-11-01

**scope**：DeepSeek 原型及当前 TaskDock

**limits**：不能据此断言其不可用，也不能反向宣称生产可用