export const translations = {
  我的工作空间: "My workspace",
  维护者: "Maintainer",
  中台概览: "Control plane overview",
  任务工作台: "Tasks",
  任务关系: "Task graph",
  待你处理: "Needs your input",
  请求记录: "Run history",
  投递回执: "Deliveries",
  经验与学习: "Learning",
  定时任务: "Schedules",
  共享广场: "Registry",
  接入与设置: "Integrations",
  调研与路线: "Research",
  工程研发: "Engineering",
  研究与规划: "Research and planning",
  运维与运营: "Operations",
  自定义: "Custom",
  排队中: "Queued",
  执行中: "Running",
  等待回答: "Awaiting answer",
  等待子任务: "Awaiting children",
  已完成: "Completed",
  执行失败: "Failed",
  待补证据: "Evidence needed",
  已取消: "Cancelled",
  已中断: "Interrupted",
  待审核: "Pending review",
  已采纳: "Approved",
  已拒绝: "Rejected",
  "正式版 v": "Stable v",
  草稿待发布: "Unpublished draft",
  草稿有更新: "Draft updated",
  "串行 Team": "Serial Team",
  "单 Agent": "Single agent",
  次请求: " runs",
  ">管理任务": ">Manage task",
  "还没有请求。选择一个任务，提交第一次独立调用。":
    "No runs yet. Choose a task and submit your first isolated request.",
  上层会话: "Caller session",
  父任务调用: "Parent task",
  内置能力验收: "Bundled validation",
  控制台: "Console",
  测试版: "Test",
  正式版: "Stable",
  查看请求: "View run",
  "任务 / 请求": "Task / Run",
  来源与通道: "Source and channel",
  执行状态: "Execution status",
  "发起时间 · 上海": "Created · Shanghai",
  "让每一次协作，都有积累。": "Make every collaboration reusable.",
  "把重复的工作沉淀为任务 AI，让不同项目随时调用。":
    "Turn recurring work into task agents that any project can call.",
  接入中台: "Connect a client",
  新建任务: "New task",
  任务类型: "Task types",
  个正式版对外提供服务: " stable services available",
  请求总数: "Total runs",
  每次请求独立记录与归档:
    "Every request is recorded and archived independently",
  正在执行: "Active runs",
  "最多 4 个请求并发执行": "Up to 4 concurrent requests",
  待审核经验: "Pending proposals",
  "采纳后进入草稿，重测再发布":
    "Review into draft, then retest before publishing",
  个: " tasks",
  全部任务: "All tasks",
  研究规划: "Research",
  运维运营: "Operations",
  "我的任务 AI": "My task agents",
  "按任务组织能力，按请求隔离上下文":
    "Organize capabilities by task; isolate context by request",
  搜索任务: "Search tasks",
  "搜索任务或能力…": "Search tasks or capabilities…",
  "一次协作，如何发生": "How a collaboration works",
  "上层会话发现能力，中台负责执行。":
    "Clients discover capabilities. TaskDock manages execution.",
  "已有的交给任务 AI，其余留在当前会话。":
    "Delegate matching work; keep the rest in the current chat.",
  "Codex / 上层会话": "Codex / Caller",
  查询并匹配任务: "Discover matching tasks",
  调用固定正式版: "Invoke a pinned stable version",
  结果与历史独立留存: "Keep results and history separate",
  "共享能力；请求间不共享上下文。":
    "Share capabilities; keep request contexts separate.",
  "能力持续成长，边界始终清晰": "Improve capabilities with clear boundaries",
  每个请求拥有独立会话与目录: "Each request has its own session and directory",
  "测试通过后，才可晋级正式版":
    "Pass the release test before promoting to stable",
  "经验审核后进入草稿，不自动上线":
    "Review learning into draft; never publish silently",
  查看经验与学习: "Explore learning",
  最近请求: "Recent runs",
  全部记录: "All runs",
  "下一个可复用的任务，从这里开始": "Your next reusable task starts here",
  "给任务一个目标、一套方法，": "Give a task a goal, a method,",
  "和持续积累的空间。": "and room to improve.",
  "创建任务 AI": "Create task agent",
  "没有匹配的任务；未覆盖的工作由上层会话完成。":
    "No matching tasks. Uncovered work stays with the caller.",
  "每一次调用独立留档。复用任务能力，保留各自的证据。":
    "Every invocation has its own record and evidence.",
  刷新: "Refresh",
  ">包含已归档请求": ">Include archived runs",
  "最多显示最近 250 条记录 · 内置能力验收为真实规则运行":
    "Showing up to 250 recent runs · Bundled validations execute real deterministic rules",
  个父任务共享: " parents share this",
  草稿: "Draft",
  "· 派生自": "· Derived from",
  管理: "Manage",
  "· 固定 SHA": "· Pinned SHA",
  "按层展开任务能力。同一个子任务可以被多个父任务引用，每次调用仍有自己的请求记录。":
    "Expand capabilities by level. Multiple parents can reuse one child; each invocation gets a separate run.",
  "这里展示草稿中的组合关系。父任务引用固定的子任务正式版；子任务升级不会自动改变父任务。微调请派生新任务，再明确替换引用。":
    "This graph shows draft composition. Parents pin stable child releases. Child upgrades never silently change a parent; fork and explicitly rebind to specialize.",
  "补充信息或核对不确定的工具结果。回答会单独留痕，随后恢复原请求。":
    "Add information or reconcile uncertain tool outcomes. Answers are recorded separately before the original run resumes.",
  工具结果待核对: "Tool outcome needs reconciliation",
  查看并回答: "View and answer",
  请求: "Run",
  "目前没有等待你处理的事项。": "Nothing needs your input right now.",
  "结果和问题进入持久队列。断线后可以再取；同一消息 ID 重投时应去重。":
    "Results and questions enter a durable queue. Reconnect to receive them; deduplicate repeated message IDs.",
  "接收后处理，再 ACK。未确认的消息在租约到期后重投，NACK 会退避。本页只可确认由本标签页创建并持有凭证的会话消息。":
    "Process messages, then ACK. Unacknowledged messages return after the lease expires; NACK applies backoff. This tab can acknowledge only sessions for which it holds credentials.",
  接收持久消息: "Receive messages",
  第: "Attempt",
  次投递: " delivery",
  状态更新: "Status update",
  稍后重投: "Redeliver later",
  "已处理 · ACK": "Handled · ACK",
  租约至: "Lease until",
  "· 请求": "· Run",
  本标签页创建的调用方会话: "Caller sessions created in this tab",
  持久队列: "Durable queue",
  "消息 / 请求": "Message / Run",
  状态: "Status",
  投递次数: "Delivery attempts",
  创建时间: "Created",
  "把每次执行中的经验，变成下一次可复用的能力。":
    "Turn execution experience into reusable capabilities.",
  提交经验提案: "Propose learning",
  "自动汇总只包含请求计数。原始会话不会自动进入共享记忆；提案经你审核后写入任务草稿，重新测试发布后生效。":
    "Automatic summaries contain counts only. Raw chats never become shared memory automatically. Approved proposals enter draft and take effect after testing and promotion.",
  来源请求: "Source run",
  维护者提案: "Maintainer proposal",
  拒绝: "Reject",
  审核采纳: "Review and approve",
  "还没有待审核的经验。": "No learning proposals yet.",
  "从一次请求开始，记录值得复用的方法。":
    "Start with a run and record a reusable method.",
  "按明确的时区和节奏，调用任务的正式版本。":
    "Invoke stable tasks on an explicit schedule and timezone.",
  新建定时任务: "New schedule",
  "下方时间来自数据库中调度器实际保存的 next_run_at。服务停机期间不补跑；重新启动会计算下次时间并记录审计。":
    "Times below are the scheduler's saved next_run_at values. Downtime is not replayed; restart computes and audits the next occurrence.",
  已启用: "Enabled",
  已暂停: "Paused",
  下次执行: "Next run",
  "暂停中 · 保存的名义时间": "Paused · Saved nominal time",
  尚未执行: "Not run yet",
  暂停: "Pause",
  启用: "Enable",
  "最近执行：": "Last run:",
  "还没有定时任务。": "No schedules yet.",
  "发现、分享与安装任务能力。共享包保留方法与知识，运行历史留在本地。":
    "Discover, share, and install capabilities. Packages carry methods and reviewed knowledge; histories stay local.",
  重新连接: "Reconnect",
  "独立 Registry 服务 · 本机双服务 DEMO。当前没有连接公开社区；安装的能力以草稿进入工作空间，复核、配置并测试后再发布。":
    "Independent Registry · Local two-service demo. No public community is connected. Installed capabilities enter draft; review, configure, and test before publishing.",
  安装到本地: "Install locally",
  "广场还没有能力包。": "No capability packages yet.",
  "打开任务详情，在版本页审核导出内容，再分享到这里。":
    "Open a task and review its export on the Versions tab before sharing.",
  "# 先启动本地 TaskDock 服务。": "# Start the local TaskDock service first.",
  "让每个上层会话先发现已有任务，再决定如何分工。":
    "Discover existing tasks before deciding how to delegate.",
  复制配置: "Copy configuration",
  已就绪: "Ready",
  已安装: "Installed",
  已配置: "Configured",
  待配置: "Not configured",
  "MCP 接入": "MCP integration",
  "将下列配置加入你的 MCP 客户端。服务同时提供 stdio 和 Streamable HTTP 两种接入方式。":
    "Add this configuration to your MCP client. Both stdio and Streamable HTTP are supported.",
  上层会话的调用纪律: "Caller workflow",
  "先 search / plan，确认已有任务匹配。":
    "Search / plan first to find a matching task.",
  "为当前父会话创建新 session，再提交正式版请求。":
    "Create a new session for this caller, then submit a stable request.",
  "取回结果、版本和证据；未知任务留在当前会话完成。":
    "Retrieve results, versions, and evidence; keep unmatched work in the current chat.",
  "复用能力，不复用其他会话 token 和原始上下文。":
    "Reuse capabilities, never other sessions' tokens or raw context.",
  仓库中的: "The repository's",
  "可由你安装到 Codex；本版未修改你的全局配置。":
    "can be installed in your client. Your global configuration has not been changed.",
  运行环境: "Runtime",
  内置规则运行器: "Built-in deterministic runner",
  "OpenAI 模型": "OpenAI model",
  "Anthropic 模型": "Anthropic model",
  共享服务: "Registry service",
  "在本机 .env 配置模型 key，权限设为 600。任务只保存环境变量名称，密钥不会进入 Git 或共享包。":
    "Configure your own model key in local .env with permissions 600. Tasks store environment-variable names; secret values never enter Git or shared packages.",
  本地数据: "Local data",
  "每个任务的能力仓库、请求目录与统计都保存在本机。":
    "Capability repositories, request directories, and statistics stay on this machine.",
  "│     ├─ repo/     Git 能力仓库":
    "│     ├─ repo/     Git capability repository",
  "│     ├─ runs/     独立请求历史":
    "│     ├─ runs/     Isolated request history",
  "本机开发服务依赖电脑保持在线。重新测试前应检查 /health 和进程。":
    "Local development services require this computer to stay online. Check /health and processes before testing again.",
  为什么做一个任务中台: "Why a task control plane?",
  "2026-10-31 · 基于 GitHub 仓库与官方文档的候选调研。":
    "2026-10-31 · Candidate research based on GitHub repositories and official documentation.",
  "工作流、日志、MCP 发布出口。按任务服务配置与经验审核晋级仍需定制。":
    "Workflows, logs, and MCP publishing. Task-service configuration and reviewed learning still need customization.",
  "线程持久化、共享 Store、部署能力；完整控制台和能力市场需额外组合。":
    "Thread persistence, shared Store, and deployment. A complete console and capability marketplace require additional components.",
  "擅长持久 Agent 与共享记忆；需额外隔离一次性请求和受审查的公共能力。":
    "Persistent agents and shared memory. Isolated one-off requests and reviewed public capabilities need extra boundaries.",
  "丰富的管理与心跳执行，组织模型偏 AI 员工与公司，需要重构任务能力产品模型。":
    "Management and heartbeat execution organized around AI employees and companies; the task-capability product model needs adaptation.",
  "Agent / MCP / Skill 的版本管理与分发很接近云端能力库，仍需任务历史与学习治理层。":
    "Agent / MCP / Skill versioning and distribution resemble a capability registry; task history and learning governance still need a layer.",
  "轻量可嵌入的执行框架。TaskDock 负责目录、隔离、发布、调度和治理。":
    "Lightweight embeddable execution framework. TaskDock owns catalog, isolation, releases, scheduling, and governance.",
  ">查看源项目 ↗": ">View source project ↗",
  "找到多个可复用组件。": "Several reusable components exist.",
  "在本次候选中，未发现完整覆盖需求的现成平台。":
    "No evaluated candidate covered the complete workflow.",
  "这个结论限定于本次候选与文档核验；未将所有项目逐一部署。缺口集中在：任务类型目录、请求隔离、Git 版本发布、经验治理与本地/云端分工的完整闭环。":
    "This conclusion is limited to the candidates and documentation reviewed; not every project was deployed. The gap is the complete loop across task catalog, request isolation, Git releases, reviewed learning, and local/cloud separation.",
  本版的明确边界: "Current boundaries",
  "已实现本地控制面、独立请求目录、真实 Git 版本、MCP 入口、规则执行、Pi SDK 适配、串行 Team、经验审核、时区调度与独立共享服务。":
    "Implemented: local control plane, isolated run directories, real Git history, MCP access, deterministic checks, Pi adapter, serial Teams, reviewed learning, timezone scheduling, and independent Registry.",
  "本环境未配置模型 key，真实模型效果尚未验收。共享服务尚未部署公网；A2A、云端多租户身份、签名信任链、容器沙箱和自动演化评测属于后续工作。":
    "Live-model quality is not established by offline tests. The Registry is not a hosted public community. A2A, cloud multi-tenancy, package trust chains, container sandboxes, and autonomous evolution evaluations remain future work.",
  "详细证据、比较矩阵、方案与集中问题在 docs/RESEARCH.md、ARCHITECTURE.md 和 DECISIONS.md。":
    "Evidence, comparisons, design, and open questions are in docs/RESEARCH.md, ARCHITECTURE.md, and DECISIONS.md.",
  "连接中台失败：": "Could not connect:",
  "连接你的 TaskDock": "Connect to TaskDock",
  "当前服务启用了 API 认证。输入本机配置的 token，仅保存在当前标签页会话。":
    "This service requires API authentication. Enter the configured token; it is kept only in this tab's session.",
  连接中台: "Connect",
  "Pi 模型运行器": "Pi model runner",
  "内置规则 · 无模型推理": "Deterministic rules · No model inference",
  "阶段 Team": "-stage Team",
  尚未设置任务规则: "No task instructions yet",
  工具: "Tools",
  暂无附加组件: "No additional components",
  "尚无共享知识。原始请求不会自动进入这里。":
    "No shared knowledge yet. Raw requests never enter this area automatically.",
  服务状态: "Service status",
  执行方式: "Execution mode",
  知识与协作: "Knowledge and collaboration",
  "条审核知识 ·": " reviewed knowledge items ·",
  任务规则: "Task instructions",
  能力组件: "Capability components",
  审核后的共享知识: "Reviewed shared knowledge",
  "任务已暂停，新请求和后续执行被阻止。":
    "Task paused. New requests and further execution are blocked.",
  "当前授权已启用；每次执行仍受请求 Mandate 限制。":
    "Task enabled; every execution remains constrained by its request Mandate.",
  恢复任务授权: "Enable task authorization",
  暂停任务授权: "Pause task authorization",
  授权控制: "Authorization",
  测试草稿: "Test draft",
  正式调用: "Invoke stable",
  "草稿修改不会影响正在运行的正式版请求。":
    "Draft edits do not affect stable requests already running.",
  任务名称: "Task name",
  任务说明: "Description",
  "上层会话通过说明与标签发现任务。":
    "Callers discover tasks through descriptions and tags.",
  "能力标签（用逗号分隔）": "Tags (comma-separated)",
  执行规则: "Instructions",
  "执行器只接收本次请求、固定能力快照与已审核知识。":
    "The executor receives only this request, its pinned capability, and approved knowledge.",
  任务分类: "Category",
  保存草稿: "Save draft",
  "仅保存到草稿。完整配置在「能力与工具」中修改。":
    "Saved to draft only. Edit the full configuration under Capabilities.",
  "配置单 Agent / Team、Pi 模型、Skills、MCP allowlist、检查项与学习规则。密钥只填写环境变量名。Pi 不加载本机其他会话，也不启用 bash/read/write。":
    "Configure single agent / Team, Pi model, Skills, MCP allowlists, checks, and learning rules. Use credential environment-variable names only. Pi loads no other local chats and enables no bash/read/write tools.",
  "能力配置 JSON": "Capability JSON",
  "严格校验字段；未知字段与无效配置会被拒绝。":
    "Strict validation rejects unknown fields and invalid configuration.",
  校验并保存草稿: "Validate and save draft",
  "测试的是当前 draft，revision": "Testing current draft, revision",
  "。只有完全相同的能力摘要测试通过，才能晋级正式版。":
    ". Only a passing test of this exact digest permits stable promotion.",
  "本次请求上下文 JSON": "Request context JSON",
  "上线检查示例默认缺少实机证据，会如实返回「待补证据」。":
    "The release-check example intentionally lacks device evidence and reports that gap.",
  执行草稿测试: "Run draft test",
  "规则运行器只核对提交证据；不会执行真实服务探测。":
    "Rules validate submitted evidence; they do not probe a real service.",
  "引用使用子任务的固定正式版。inputMap 明确指定从父请求传哪些字段；不会自动复制全部上下文。修改后需要重新测试父任务。":
    "References pin a child's stable release. inputMap explicitly projects parent fields into child requests; full context is never copied automatically. Retest the parent after changes.",
  "派生来源：": "Derived from:",
  "调用 key（在当前父任务内唯一）": "Call key (unique within this parent)",
  "输入映射 JSON": "Input mapping JSON",
  "左边是子请求字段，右边是父请求中的字段路径。":
    "Left: child input field. Right: field path in the parent request.",
  保存子任务引用: "Save child reference",
  派生新任务: "Fork task",
  添加共享子任务: "Add shared child",
  已发布的子任务: "Published child task",
  微调后复用: "Specialize and reuse",
  "派生为新的独立草稿，原能力和现有父任务保持原版本。":
    "Create an independent draft. The source capability and existing parents keep their versions.",
  "任务图禁止成环；引用和派生都保留版本来源。":
    "Task graphs must be acyclic. References and forks retain version provenance.",
  "正式版绑定 Git commit 和能力摘要。晋级要求当前草稿已有通过的测试；正在执行的请求始终使用提交时的快照。":
    "Stable releases bind a Git commit and capability digest. Promotion requires a passing test of the current draft; active requests retain their submission snapshots.",
  审核并分享正式版: "Review and share stable",
  当前正式版: "Current stable",
  回滚到此版本: "Roll back to this version",
  "还没有正式版本。先调试草稿，再发布。":
    "No stable releases yet. Test the draft, then publish.",
  尚未发布: "Not published",
  版本记录: "Release history",
  草稿与正式版对照: "Draft / Stable comparison",
  晋级为正式版: "Promote to stable",
  "无当前摘要的通过记录，服务端会拒绝晋级。":
    "The server rejects promotion without a passing test for this digest.",
  概览: "Overview",
  基本配置: "Basic settings",
  能力与工具: "Capabilities",
  子任务与派生: "Children and forks",
  调试请求: "Test request",
  "版本与 Git": "Versions and Git",
  我的任务: "My task",
  "说明这个任务完成什么工作、需要什么输入、交付什么结果。":
    "Describe the work, required input, and expected deliverable.",
  "按检查项核对输入证据，缺少证据时如实报告。":
    "Check the supplied evidence and report missing evidence honestly.",
  核心证据已提供: "Core evidence provided",
  "定义一个可被其他会话发现和调用的任务。":
    "Define a task other sessions can discover and invoke.",
  "任务 ID（小写字母、数字、短横线）":
    "Task ID (lowercase letters, digits, hyphens)",
  "清楚描述它解决的任务，而不是扮演的角色。":
    "Describe the task it solves rather than a role it plays.",
  "初始配置 JSON": "Initial configuration JSON",
  "上方 ID、名称和说明会覆盖 JSON 中的对应字段。其余能力可在创建后继续维护。":
    "ID, name, and description above override the matching JSON fields. Maintain other capabilities after creation.",
  创建任务: "Create task",
  "创建为草稿；完成测试后再提供服务。":
    "Created as draft; test before serving requests.",
  发起正式调用: "Invoke stable task",
  "将创建一个新的独立调用方 session，复用正式版能力，不加载其他请求。":
    "Creates a fresh caller session using the stable capability, without loading other requests.",
  来源会话标签: "Caller session label",
  控制台体验会话: "Console demo session",
  "只提交本次任务需要的上下文。": "Submit only the context this task requires.",
  提交独立请求: "Submit isolated request",
  "session capability 仅在这次提交过程中使用。":
    "The session capability is scoped to this caller.",
  请求详情: "Run details",
  取消请求: "Cancel run",
  撤销授权: "Revoke authorization",
  归档: "Archive",
  明确重试: "Explicit retry",
  提取经验提案: "Propose learning from run",
  "独立目录：tasks/": "Isolated directory: tasks/",
  核对工具执行结果: "Reconcile tool outcome",
  等待你补充: "Your input is needed",
  是: "Yes",
  否: "No",
  "已核对：确认未执行，允许重试": "Verified: not executed; allow retry",
  "已核对：执行完成，记录结果": "Verified: completed; record result",
  请选择: "Select an option",
  提交回答并恢复: "Answer and resume",
  草稿测试: "Draft test",
  "Pi 模型执行": "Pi model execution",
  子任务汇总: "Child result aggregation",
  内置规则执行: "Deterministic execution",
  等待结果: "Awaiting result",
  返回父请求: "Back to parent run",
  证据通过: "Evidence passed",
  "Team 阶段产物": "Team stage outputs",
  查看子请求: "View child run",
  本次请求的子任务: "Children of this request",
  "尚未派工。": "Not dispatched yet.",
  已回答事项: "Answered questions",
  执行尝试: "Execution attempts",
  本次授权与工具回执: "Authorization and tool receipts",
  本次请求上下文: "This request's context",
  事件记录: "Events",
  "只提交可复用、已脱敏的方法；不复制原始上下文。":
    "Submit reusable, redacted methods only; never copy raw context.",
  "来源请求 ID（可选）": "Source run ID (optional)",
  可复用经验: "Reusable learning",
  "审核采纳后只更新草稿；正式版不自动改变。":
    "Approval updates draft only; stable does not change automatically.",
  提交待审核: "Submit for review",
  所属任务: "Task",
  "我已去除项目私密信息、凭据和不应跨请求共享的内容。":
    "I removed private project information, credentials, and content that must not cross requests.",
  "学习规则由任务 learningPolicy 控制。":
    "Task learningPolicy controls learning rules.",
  创建定时任务: "Create schedule",
  "使用明确的 IANA 时区。默认创建为暂停状态。":
    "Use an explicit IANA timezone. Schedules are paused by default.",
  每日任务回顾: "Daily task review",
  "Cron 表达式": "Cron expression",
  "示例：工作日 09:00": "Example: weekdays at 09:00",
  时区: "Timezone",
  "每次请求的输入 JSON": "Input JSON for each invocation",
  "每次触发创建新请求。不要填写凭据。":
    "Each trigger creates a new request. Never include credentials.",
  保存并核对时间: "Save and verify time",
  调用正式版任务: "Invoke stable task",
  "创建后启用；本地服务在线时才会执行。":
    "Enable after creation; execution requires the local service to stay online.",
  "创建后从 API 重新读取保存的下次时间供核对。":
    "After creation, saved next-run time is read back from the API for verification.",
  审核共享能力包: "Review capability package",
  "只提交下面的 stable 能力配置。已移除 MCP 连接与示例输入；运行目录和历史记录不在导出范围内。分享前仍须检查规则与知识文本是否包含私密信息。":
    "Only the stable capability below is exported. MCP connections, example input, runtime directories, and histories are excluded. Review rules and knowledge text for private information before sharing.",
  确认分享: "Confirm share",
  "我已审阅上方内容，可以分享到当前配置的共享 Registry。":
    "I reviewed the content above and approve sharing to the configured Registry.",
  "当前目标：": "Current destination:",
  安装任务能力: "Install capability",
  "外部能力仅安装为草稿，不自动执行、不自动发布。复核规则和模型配置后，补齐测试输入再晋级。":
    "External capabilities install as draft without execution or promotion. Review rules and model configuration, supply test input, then promote.",
  "本地任务 ID": "Local task ID",
  安装为草稿: "Install as draft",
  "JSON 格式不正确，请检查逗号、引号和括号。":
    "Invalid JSON. Check commas, quotes, and brackets.",
  "已保存草稿；正式版保持固定版本": "Draft saved; stable remains pinned",
  移除引用: "Remove reference",
  "固定 SHA": "Pinned SHA",
  "当前没有子任务引用。": "No child references yet.",
  来源: "Source",
  "新任务 ID": "New task ID",
  新任务名称: "New task name",
  "· 微调版": "· Variant",
  调整执行规则: "Adjust instructions",
  "继承来源能力，独立为草稿；仍须测试后发布。":
    "Inherits source capability as an independent draft; test before publishing.",
  创建派生草稿: "Create derived draft",
  "保留来源版本与摘要，原任务不被修改。":
    "Source version and digest are retained. The original task is unchanged.",
  任务已创建为草稿: "Task created as draft",
  请先选择一个已发布子任务: "Select a published child first",
  "已派生为独立草稿，来源版本已留存":
    "Independent draft created with source provenance",
  维护者通过控制台调整授权: "Maintainer changed authorization in console",
  "已创建 Git 版本并切换正式版": "Git release created and stable switched",
  "正式版已回滚并写入 Git 留痕": "Stable rolled back with Git history",
  请重新打开请求后回答: "Reopen the run before answering",
  "回答已保存；仍有待回答事项": "Answers saved; more questions remain",
  "回答已保存，原请求已重新排队": "Answer saved; original run queued again",
  撤销本次授权: "Revoke this authorization",
  "同时停止本次请求树中的后续工作。":
    "Stops further work throughout this request tree.",
  撤销原因: "Revocation reason",
  维护者撤销本次请求: "Maintainer revoked this request",
  "撤销会永久留痕；如需重新授权，请创建新请求。":
    "Revocation is permanently recorded. Create a new request for fresh authorization.",
  本标签页没有这个会话的凭证: "This tab has no credentials for that session",
  收到: "Received",
  条持久消息: " durable messages",
  "当前没有可接收消息；已租出的消息需等待租约到期":
    "No messages available. Leased messages return after their lease expires.",
  请重新接收消息: "Receive the message again",
  "消息已确认，回执已持久保存": "Message acknowledged; receipt persisted",
  已安排退避重投: "Redelivery scheduled with backoff",
  "请求已归档，历史证据仍保留": "Run archived; historical evidence retained",
  请先确认经验内容已脱敏: "Confirm the learning content is redacted first",
  "经验已提交，等待审核": "Learning submitted for review",
  审核经验提案: "Review learning proposal",
  "采纳后只进入草稿；正式版需重测后发布。":
    "Approval changes draft only; stable requires a new test and promotion.",
  采纳到草稿: "Approve into draft",
  "内容已脱敏、适用于跨请求复用，允许加入该任务草稿。":
    "Content is redacted, reusable across requests, and approved for this task's draft.",
  "原始请求不会附带写入知识库。":
    "Raw requests are not copied into the knowledge base.",
  提案已拒绝: "Proposal rejected",
  请先确认内容可被跨请求复用:
    "Confirm this content can be reused across requests",
  "经验已采纳到草稿，需测试后晋级":
    "Learning approved into draft; retest before promoting",
  "已核对保存时间：": "Verified saved time:",
  "；保存的下次时间": "; saved next-run time",
  请先审核并确认能力包内容: "Review and confirm the package content first",
  "正式版能力已分享到当前 Registry":
    "Stable capability shared to the configured Registry",
  "已安装为草稿，请复核后测试":
    "Installed as draft. Review and test before publishing.",
  配置已复制: "Configuration copied",
  "浏览器未允许剪贴板，请手动复制配置":
    "Clipboard access denied. Copy the configuration manually.",
  ">查看能力包 →": ">View package →",
  "还没有匹配的共享任务。": "No matching shared tasks yet.",
  "从本地中台审核并分享一个正式版能力。":
    "Review and share a stable capability from your local control plane.",
  "连接私有 Registry": "Connect private Registry",
  "在本地 TaskDock 的「共享广场」中连接本 Registry，并选择安装。能力安装为草稿，复核后测试发布。":
    "Connect this Registry under the local Registry page and install a package. It enters draft; review and test before publishing.",
  "任务 AGENT 中台": "TASK AGENT CONTROL PLANE",
  工作空间: "Workspace",
  本地优先: "Local first",
  "能力共享 · 上下文独立": "Shared capabilities · Private context",
  个人维护者: "Local maintainer",
  本机开发环境: "Local development",
  接入指南: "Integration guide",
  "正在连接本地中台…": "Connecting to TaskDock…",
  "/ 本地 DEMO": "/ Local preview",
  "为可复用的任务，建立可积累的能力。":
    "Reusable tasks. Capabilities that improve.",
  任务详情: "Task details",
  主导航: "Main navigation",
  "自托管 Registry DEMO": "Self-hosted Registry preview",
  "让好的任务能力，": "Let useful capabilities",
  "抵达下一个工作空间。": "reach the next workspace.",
  "共享经过维护和版本管理的任务 AI。保留方法、规则和审核后的知识；请求历史与私密数据留在本地。":
    "Share maintained, versioned task agents. Keep methods, rules, and reviewed knowledge; leave request histories and private data local.",
  搜索共享任务: "Search shared tasks",
  "搜索任务名称、能力或标签…": "Search names, capabilities, or tags…",
  "正在连接 Registry…": "Connecting to Registry…",
  "TaskDock Registry 0.3.0 · 独立服务演示 · 尚未部署为公开社区":
    "TaskDock Registry 0.3.0 · Independent service preview · No hosted public community",
  "TaskDock · 任务 Agent 中台": "TaskDock · Task agent control plane",
  "TaskDock Registry · 任务能力共享":
    "TaskDock Registry · Shared task capabilities",
  关闭: "Close",
};
