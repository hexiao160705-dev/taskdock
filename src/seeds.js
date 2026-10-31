import { taskSchema } from "./schema.js";

export const seeds = [
  {
    id: "release-check",
    name: "服务上线检查",
    category: "engineering",
    tags: ["上线", "部署", "发布", "检查", "release", "deploy"],
    description:
      "把上线前的检查固化为服务。核对健康、进程、测试、实机与回滚证据，返回可追溯的放行清单。",
    instructions:
      "逐项检查调用者提供的证据。缺少证据必须标记未通过。不能把用户提交的 health 状态当作中台实际探测结果。输出证据层级和阻塞项。",
    checks: [
      {
        id: "health",
        label: "健康接口返回 200",
        field: "healthStatus",
        operator: "equals",
        expected: 200,
      },
      {
        id: "process",
        label: "服务进程存活",
        field: "processAlive",
        operator: "equals",
        expected: true,
      },
      {
        id: "tests",
        label: "本版自动化检查通过",
        field: "testsPassed",
        operator: "equals",
        expected: true,
      },
      {
        id: "device",
        label: "目标设备核心链路验收",
        field: "deviceVerified",
        operator: "equals",
        expected: true,
      },
      {
        id: "rollback",
        label: "回滚方案已就绪",
        field: "rollbackReady",
        operator: "equals",
        expected: true,
      },
    ],
    skills: [
      {
        name: "release-evidence",
        content:
          "测试分层：单元、自动化浏览器、人工目标设备必须分别记录。缺少实际证据禁止推断可用。",
      },
    ],
    learningRules: [
      {
        id: "device-evidence-gap",
        when: "needs-attention",
        checkId: "device",
        proposal:
          "上线前应分别提供自动化测试和目标设备的实际验收证据，避免把规则检查或模拟器通过当作实机通过。",
      },
    ],
    sampleInput: {
      project: "示例项目 A",
      healthStatus: 200,
      processAlive: true,
      testsPassed: true,
      deviceVerified: false,
      rollbackReady: true,
    },
  },
  {
    id: "requirement-review",
    name: "需求完整性检查",
    category: "research",
    tags: ["需求", "方案", "评审", "需求检查", "requirement", "brief"],
    description:
      "在开发前核对目标、用户、约束和验收标准，提前找出需求中的空白。",
    instructions:
      "仅核对字段是否提供，不冒充语义需求分析。语义分析请切换 Pi 运行器。",
    checks: [
      {
        id: "goal",
        label: "业务目标已说明",
        field: "goal",
        operator: "truthy",
      },
      {
        id: "audience",
        label: "目标用户已说明",
        field: "audience",
        operator: "truthy",
      },
      {
        id: "constraints",
        label: "约束已说明",
        field: "constraints",
        operator: "truthy",
      },
      {
        id: "acceptance",
        label: "验收标准已说明",
        field: "acceptance",
        operator: "truthy",
      },
    ],
    sampleInput: {
      goal: "建立任务 Agent 中台",
      audience: "有多个 Codex 项目的个人开发者",
      constraints: "本地优先，私有代码",
      acceptance: "两个会话调用同一任务且上下文不交叉",
    },
  },
  {
    id: "incident-review",
    name: "故障复盘协作",
    category: "operations",
    tags: ["复盘", "故障", "incident", "事故", "postmortem"],
    mode: "team",
    description:
      "用证据整理、根因复核、改进检查三个阶段完成复盘材料的完整性检查。",
    instructions:
      "显式三阶段 Team。规则运行器只检查材料完整性；接入 Pi 后可执行分阶段推理。",
    stages: [
      {
        name: "证据整理",
        instructions: "检查时间线与影响范围，保留当前请求的证据。",
      },
      { name: "根因复核", instructions: "区分根因与推测，要求机制层证据。" },
      {
        name: "改进检查",
        instructions: "检查修复措施、负责人、验证方案和回归检查。",
      },
    ],
    checks: [
      {
        id: "timeline",
        label: "时间线与影响范围",
        field: "timeline",
        operator: "truthy",
      },
      {
        id: "rootcause",
        label: "机制层根因",
        field: "rootCause",
        operator: "truthy",
      },
      {
        id: "actions",
        label: "改进行动与负责人",
        field: "actions",
        operator: "truthy",
      },
    ],
    sampleInput: {
      timeline: "10:00 发现健康接口超时；10:05 回滚",
      rootCause: "数据库连接池上限过小，需补充监控证据",
      actions: "调整上限并增加压测；负责人：项目维护者",
    },
  },
].map(taskSchema.parse);
