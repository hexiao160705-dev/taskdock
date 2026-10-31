# TaskDock 0.1 — 场景与方案

日期：2026-10-31（Asia/Shanghai）。本版为本机开发 DEMO，不是已部署的公共商业服务。

## 要解决的场景

1. Codex 的项目 A 和 B 都在上线：先检索 release-check，分别提交独立请求，各自只能取回自己所属会话的结果；复用相同能力，不复用聊天记录。
2. 维护者调整检查项：修改 draft → 以 draft 调试 → 精确摘要的测试通过 → 创建真实 Git commit/tag → 切换 stable。正在执行的旧请求继续使用旧快照。
3. 历史请求出现可复用经验：历史独立归档；自动生成的汇总只含计数；人工或 Agent 提交脱敏知识提案，维护者审核后进入 draft，再测试晋级。原始请求绝不自动进入知识库。
4. 复合任务：中台检索已知任务建议分工，未知任务明确交还上层。Task AI 内可配置单 Agent 或串行 Team；Team 只共享当前请求的阶段产物。
5. 共享：本地能力包导出到独立 registry，其他本地实例检索并安装为 draft。只分发能力配置、规则和已审核知识，不上传运行历史、目录、密钥或模型凭据。初版 registry 可本机双进程演示；尚未托管到公网。

## 选择

Node 24 + SQLite（WAL）+ 本地目录 + Git + Pi SDK + MCP SDK。前端为无构建依赖的 HTML/CSS/JavaScript。小型单用户服务只需 npm ci / npm start；registry 独立进程、独立数据库，为之后的云端拆分保留边界。

选择轻量控制面而不 fork 大型平台：需求缺口主要是任务产品模型、发布与记忆治理，Pi 只负责一次执行。MCP 负责上层发现/提交/取回和下层受控工具连接；内部使用显式 request/run 协议。A2A 是后续兼容层，本版不宣称实现 A2A 标准。Skill 约束上层习惯，但它不是安全边界；会话授权、通道固定、版本与参数校验由服务实现。

## 数据与目录

```
.data/local.sqlite
.data/tasks/<task-id>/repo/task.json       # 可维护能力，真实独立 Git 仓库
.data/tasks/<task-id>/runs/<run-id>/        # 独立请求、快照、事件、结果
.data/tasks/<task-id>/summary.json         # 不含原始上下文的统计
.data/registry.sqlite                     # 仅在 registry 服务端
```

SQLite 是状态源；文件是可检查的请求归档；写文件使用临时文件 + rename。发布先提交不可变 Git 对象、再数据库事务切换 stable，失败可能留下未引用 commit，但不误切 stable。单实例内发布串行，任务摘要使用内容 SHA-256。进程重启将未结束请求标为 interrupted，绝不自动重复有副作用的请求。

## 执行与隔离

内置规则引擎真实执行 JSON 检查并明确返回 deterministic，不伪装 LLM。Pi 运行器每次创建全新会话、资源加载器和受限工具集，不载入用户主目录 settings、skills、history，也不启用 bash/read/write。只接受配置中明确声明的 MCP HTTP 服务和工具 allowlist；外部服务自身的授权仍由它负责。每次运行固定配置与知识摘要。调用方持有随机 session capability（不写入查询串），中台存 hash；REST/MCP 请求按 capability 限制 run 访问，Web 管理端拥有本机维护权限。应用级隔离不是恶意代码的 OS 沙箱；支持不可信插件前应增加容器与网络策略。

## 版本、定时与学习

draft 可变；stable 引用不可变版本，晋级要求同一 digest 的成功测试；回滚只指向曾发布版本，也写入 Git 留痕。定时使用 IANA 时区和持久化 nextRunAt；读取保存后的 nextRunAt，UI 同时显示本地时区日期。调度默认关闭，按 stable 执行，重复触发用持久幂等键防重；停机期间不补跑，恢复时计算下次时间并留痕。

学习策略由维护者配置，默认 review-required；learningRules 可按请求状态与失败检查项自动生成维护者预定义的经验提案，并对同一待审核内容去重。运行统计自动更新；规则只输出预定义文本，不复制请求内容。内容提案审核后只改 draft，再测试发布。对模型质量的真实评测、模型自主改代码与自动晋级、A/B、容器沙箱、分布式调度和云端多租户身份系统属于后续产品化工作，不冒充已完成。
