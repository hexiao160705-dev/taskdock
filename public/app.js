const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2"/>',
  learn:
    '<path d="M12 3 3 7.5 12 12l9-4.5L12 3ZM6 10v7c3 3 9 3 12 0v-7M21 8v8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  plug: '<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-6 6v4M6 8h12"/>',
  book: '<path d="M3 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3V4Zm18 0h-6a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h5V4Z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  branch:
    '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M6 14c0-4 12 0 12-6"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="10" y="10" width="4" height="4"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4M18 9h4m-4 6h4"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5m-9 5L3 8m9 5v9M7 5.8l10 5"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  rocket:
    '<path d="m12 15-3-3c3-7 8-9 12-9 0 4-2 9-9 12ZM8 13l-4 1 1-5 5-2m3 9 1 4 5-1 2-5M6 17l-3 4 4-2"/><circle cx="16" cy="8" r="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  refresh: '<path d="M20 8a9 9 0 1 0 0 8M20 3v5h-5"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3V6Z"/>',
  terminal:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m6 0h4"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.box}</svg>`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const json = (v) => JSON.stringify(v, null, 2);
const $ = (s) => document.querySelector(s);
const state = {
  page: "home",
  overview: null,
  filter: "all",
  query: "",
  task: null,
  modalTab: "overview",
  runs: [],
  proposals: [],
  schedules: [],
  packages: [],
  archived: false,
  runTimer: null,
  apiToken: sessionStorage.getItem("taskdock-api-token") || "",
  clientSessions: {},
  received: [],
  modalGeneration: 0,
};
try {
  state.clientSessions = JSON.parse(
    sessionStorage.getItem("taskdock-demo-sessions") || "{}",
  );
} catch {}
const navs = [
  ["home", "grid", "任务工作台"],
  ["graph", "branch", "任务关系"],
  ["attention", "shield", "待你处理"],
  ["runs", "history", "请求记录"],
  ["deliveries", "activity", "投递回执"],
  ["knowledge", "learn", "经验与学习"],
  ["schedules", "clock", "定时任务"],
  ["market", "globe", "共享广场"],
  ["separator"],
  ["settings", "plug", "接入与设置"],
  ["research", "book", "调研与路线"],
];
const categoryLabels = {
  engineering: "工程研发",
  research: "研究与规划",
  operations: "运维与运营",
  custom: "自定义",
};
const statusLabels = {
  queued: "排队中",
  running: "执行中",
  waiting_human: "等待回答",
  waiting_children: "等待子任务",
  succeeded: "已完成",
  failed: "执行失败",
  "needs-attention": "待补证据",
  cancelled: "已取消",
  interrupted: "已中断",
  pending: "待审核",
  approved: "已采纳",
  rejected: "已拒绝",
};
const time = (value, timezone = "Asia/Shanghai") =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: timezone,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "—";
const fullTime = (value, timezone = "Asia/Shanghai") =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
const badge = (label, kind = "") =>
  `<span class="badge ${kind}">${esc(label)}</span>`;
const statusBadge = (s) =>
  badge(
    statusLabels[s] || s,
    s === "succeeded" || s === "approved"
      ? "stable"
      : s === "failed" || s === "rejected"
        ? "red"
        : s === "needs-attention" || s === "pending"
          ? "amber"
          : "blue",
  );
const button = (label, action, kind = "", data = "") =>
  `<button class="button ${kind}" data-action="${action}" ${data}>${label}</button>`;
const heading = (eyebrow, title, description, actions = "") =>
  `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${description}</p></div><div class="heading-actions">${actions}</div></div>`;
const hint = (content, kind = "") =>
  `<div class="hint-box ${kind}">${content}</div>`;
const field = (label, name, value = "", type = "text", help = "") =>
  `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" autocomplete="off">${help ? `<small>${help}</small>` : ""}</div>`;
const area = (label, name, value, help = "", rows = 6) =>
  `<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" rows="${rows}" ${name.includes("json") ? 'class="code" spellcheck="false"' : ""}>${esc(value)}</textarea>${help ? `<small>${help}</small>` : ""}</div>`;
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast visible ${error ? "error" : ""}`;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => (el.className = "toast"), 5000);
}
async function api(route, { method = "GET", body, sessionToken } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.apiToken) headers["X-TaskDock-Key"] = state.apiToken;
  if (sessionToken) headers.Authorization = `Session ${sessionToken}`;
  const r = await fetch(route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  if (!r.ok) {
    const e = new Error(data.error || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return data;
}
const activeInput = () =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
function nav() {
  const pending = state.overview?.stats.pending || 0;
  $("#nav").innerHTML = navs
    .map(([id, i, label]) =>
      id === "separator"
        ? '<div class="nav-separator"></div>'
        : `<a href="#${id}" class="nav-item ${state.page === id ? "active" : ""}" aria-label="${label}" title="${label}" ${state.page === id ? 'aria-current="page"' : ""}>${icon(i)}<span class="nav-text">${label}</span>${id === "knowledge" && pending ? `<span class="nav-number">${pending}</span>` : id === "attention" && state.overview.stats.waitingHuman ? `<span class="nav-number">${state.overview.stats.waitingHuman}</span>` : ""}</a>`,
    )
    .join("");
  $("#page-label").textContent =
    navs.find((n) => n[0] === state.page)?.[2] || "任务工作台";
}
function taskCard(t) {
  return `<article class="task-card"><div class="card-top"><span class="task-icon ${t.category === "operations" ? "orange" : t.category === "research" ? "green" : ""}">${icon(t.category === "engineering" ? "shield" : t.category === "operations" ? "activity" : "book")}</span>${t.stable ? `<span class="badge stable"><span class="live-dot"></span>正式版 v${esc(t.stable.version)}</span>` : badge("草稿待发布", "amber")}</div><div class="task-name"><h3>${esc(t.name)}</h3>${t.mode === "team" ? badge("Team", "blue") : ""}</div><div class="task-slug">${esc(t.id)}</div><p class="task-description">${esc(t.description)}</p><div class="tags">${t.tags
    .slice(0, 3)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join(
      "",
    )}${t.hasChanges ? '<span class="tag">草稿有更新</span>' : ""}</div><div class="card-bottom"><div class="card-meta"><span>${icon(t.mode === "team" ? "team" : "cpu")}${t.mode === "team" ? "串行 Team" : "单 Agent"}</span><span>${icon("history")}${t.runs || 0} 次请求</span></div><button class="card-open" data-action="task" data-id="${esc(t.id)}">管理任务 ${icon("arrow")}</button></div></article>`;
}
function runTable(
  runs,
  emptyLabel = "还没有请求。选择一个任务，提交第一次独立调用。",
) {
  if (!runs.length)
    return `<div class="table-wrap empty">${icon("history")}<br>${emptyLabel}</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>任务 / 请求</th><th>来源与通道</th><th>执行状态</th><th>发起时间 · 上海</th><th></th></tr></thead><tbody>${runs.map((r) => `<tr><td>${esc(state.overview.tasks.find((t) => t.id === r.task_id)?.name || r.task_id)}<div class="task-slug">${esc(r.id.slice(0, 8))}</div></td><td>${badge(r.source === "client" ? "上层会话" : r.source === "schedule" ? "定时任务" : r.source === "delegate" ? "父任务调用" : r.source === "bundled-validation" ? "内置能力验收" : "控制台")}&nbsp;${badge(r.channel === "test" ? "测试版" : "正式版", r.channel === "test" ? "amber" : "blue")}</td><td>${statusBadge(r.status)}</td><td>${time(r.created_at)}</td><td><button class="table-action" data-action="run" data-id="${r.id}" aria-label="查看请求 ${esc(r.id.slice(0, 8))}">${icon("arrow")}</button></td></tr>`).join("")}</tbody></table></div>`;
}
function home() {
  const o = state.overview;
  $("#main").innerHTML =
    heading(
      "YOUR TASKS, CONNECTED",
      "让每一次协作，都有积累。",
      "把重复的工作沉淀为任务 AI，让不同项目随时调用。",
      button(`${icon("plug")} 接入中台`, "settings") +
        button(`${icon("plus")} 新建任务`, "new-task", "primary"),
    ) +
    `<section class="stats" aria-label="中台概览">${[
      [
        "任务类型",
        o.stats.tasks,
        "grid",
        `${o.stats.published} 个正式版对外提供服务`,
      ],
      ["请求总数", o.stats.runs, "history", "每次请求独立记录与归档"],
      ["正在执行", o.stats.active, "activity", "最多 4 个请求并发执行"],
      ["待审核经验", o.stats.pending, "learn", "采纳后进入草稿，重测再发布"],
    ]
      .map(
        ([name, value, i, foot]) =>
          `<div class="stat"><div class="stat-label">${name}${icon(i)}</div><div class="stat-value">${value}<small>${name === "任务类型" ? "个" : ""}</small></div><div class="stat-foot"><span class="mini-dot"></span>${foot}</div></div>`,
      )
      .join(
        "",
      )}</section><div class="workspace-columns"><div><div class="section-heading"><h2>我的任务 AI <span class="count">${o.stats.tasks}</span></h2><span class="caption">按任务组织能力，按请求隔离上下文</span></div><div class="toolbar"><div class="tabs" aria-label="任务分类">${[
      ["all", "全部任务"],
      ["engineering", "工程研发"],
      ["research", "研究规划"],
      ["operations", "运维运营"],
    ]
      .map(
        ([id, label]) =>
          `<button class="tab ${state.filter === id ? "active" : ""}" data-action="filter" data-filter="${id}">${label}</button>`,
      )
      .join(
        "",
      )}</div><label class="search">${icon("search")}<input id="task-search" aria-label="搜索任务" placeholder="搜索任务或能力…" value="${esc(state.query)}"></label></div><div id="task-grid" class="task-grid"></div></div><aside class="right-rail"><section class="panel"><div class="panel-title">${icon("branch")} 一次协作，如何发生</div><p class="panel-description">上层会话发现能力，中台负责执行。<br>已有的交给任务 AI，其余留在当前会话。</p><div class="flow-diagram"><div class="flow-box">${icon("terminal")} Codex / 上层会话 <span class="flow-num">01</span></div><div class="flow-arrow">↓</div><div class="flow-box active">${icon("search")} 查询并匹配任务 <span class="flow-num">02</span></div><div class="flow-arrow">↓</div><div class="flow-box">${icon("box")} 调用固定正式版 <span class="flow-num">03</span></div><div class="flow-arrow">↓</div><div class="flow-box">${icon("folder")} 结果与历史独立留存 <span class="flow-num">04</span></div></div><div class="flow-foot">${icon("shield")} 共享能力；请求间不共享上下文。</div></section><section class="panel"><div class="panel-title">${icon("shield")} 能力持续成长，边界始终清晰</div><ul class="rule-list"><li>${icon("check")} 每个请求拥有独立会话与目录</li><li>${icon("check")} 测试通过后，才可晋级正式版</li><li>${icon("check")} 经验审核后进入草稿，不自动上线</li></ul><a class="rail-link" href="#knowledge">查看经验与学习 ${icon("arrow")}</a></section></aside></div><section class="recent"><div class="section-heading"><h2>最近请求</h2><a class="button ghost" href="#runs">全部记录 ${icon("arrow")}</a></div>${runTable(o.runs.slice(0, 4))}</section>`;
  filterCards();
}
function filterCards() {
  const tasks = state.overview.tasks.filter(
    (t) =>
      (state.filter === "all" || t.category === state.filter) &&
      `${t.name} ${t.id} ${t.description} ${t.tags.join(" ")}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
  $("#task-grid").innerHTML =
    tasks.map(taskCard).join("") +
    (state.query
      ? ""
      : `<div class="task-card add"><span class="add-circle">${icon("plus")}</span><h3>下一个可复用的任务，从这里开始</h3><p>给任务一个目标、一套方法，<br>和持续积累的空间。</p><button class="button ghost" data-action="new-task">创建任务 AI ${icon("arrow")}</button></div>`);
  if (!tasks.length && state.query)
    $("#task-grid").innerHTML =
      '<div class="empty full">没有匹配的任务；未覆盖的工作由上层会话完成。</div>';
  document
    .querySelectorAll('[data-action="filter"]')
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === state.filter),
    );
}
async function runsPage() {
  const { runs } = await api(`/api/runs?archived=${state.archived}`);
  state.runs = runs;
  $("#main").innerHTML =
    heading(
      "EVERY REQUEST, ITS OWN CONTEXT",
      "请求记录",
      "每一次调用独立留档。复用任务能力，保留各自的证据。",
      button(`${icon("refresh")} 刷新`, "refresh"),
    ) +
    `<div class="page-tools"><label><input type="checkbox" id="include-archived" ${state.archived ? "checked" : ""}>包含已归档请求</label><span class="muted" style="font-size:10px">最多显示最近 250 条记录 · 内置能力验收为真实规则运行</span></div>${runTable(runs)}`;
}
async function graphPage() {
  const graph = await api("/api/task-graph"),
    incoming = new Map();
  for (const edge of graph.edges)
    incoming.set(edge.taskId, (incoming.get(edge.taskId) || 0) + 1);
  const draw = (id, depth = 0) => {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node || depth > 8) return "";
    const edges = graph.edges.filter((e) => e.parentId === id);
    return `<li><div class="tree-node"><span class="task-icon">${icon(edges.length ? "branch" : "box")}</span><div><h3>${esc(node.name)} ${(incoming.get(id) || 0) > 1 ? badge(`${incoming.get(id)} 个父任务共享`, "blue") : ""}</h3><small class="mono muted">${esc(id)} · ${node.stable ? `v${esc(node.stable.version)}` : "草稿"}${node.origin ? ` · 派生自 ${esc(node.origin.taskId)}` : ""}</small></div>${button("管理", "task", "small", `data-id="${esc(id)}"`)}</div>${edges.length ? `<ul>${edges.map((e) => `<li class="tree-reference"><span class="tag">${esc(e.key)} · 固定 SHA ${esc(e.digest.slice(0, 10))}</span><ul>${draw(e.taskId, depth + 1)}</ul></li>`).join("")}</ul>` : ""}</li>`;
  };
  $("#main").innerHTML =
    heading(
      "CAPABILITIES, CONNECTED",
      "任务关系",
      "按层展开任务能力。同一个子任务可以被多个父任务引用，每次调用仍有自己的请求记录。",
      button("新建任务", "new-task", "primary"),
    ) +
    hint(
      "这里展示草稿中的组合关系。父任务引用固定的子任务正式版；子任务升级不会自动改变父任务。微调请派生新任务，再明确替换引用。",
    ) +
    `<section class="full-panel task-tree"><ul>${graph.nodes
      .filter((n) => !incoming.has(n.id))
      .sort(
        (a, b) =>
          graph.edges.filter((e) => e.parentId === b.id).length -
          graph.edges.filter((e) => e.parentId === a.id).length,
      )
      .map((n) => draw(n.id))
      .join("")}</ul></section>`;
}
async function attentionPage() {
  const { attentions } = await api("/api/attentions");
  $("#main").innerHTML =
    heading(
      "KEEP WORK MOVING",
      "待你处理",
      "补充信息或核对不确定的工具结果。回答会单独留痕，随后恢复原请求。",
      button("刷新", "refresh"),
    ) +
    `<div class="item-list">${attentions.map((a) => `<article class="list-card"><div><h3>${esc(a.taskName)} ${badge(a.kind === "reconciliation" ? "工具结果待核对" : "等待回答", "amber")}</h3><p>${esc(a.question)}</p><small class="muted">请求 ${esc(a.run_id.slice(0, 8))} · ${time(a.created_at)}</small></div>${button("查看并回答", "run", "primary", `data-id="${a.run_id}"`)}</article>`).join("") || '<section class="full-panel empty">目前没有等待你处理的事项。</section>'}</div>`;
}
async function deliveriesPage() {
  const { messages } = await api("/api/deliveries");
  const sessions = Object.entries(state.clientSessions);
  $("#main").innerHTML =
    heading(
      "DELIVERED WITH RECEIPTS",
      "投递回执",
      "结果和问题进入持久队列。断线后可以再取；同一消息 ID 重投时应去重。",
      button("刷新", "refresh"),
    ) +
    hint(
      "接收后处理，再 ACK。未确认的消息在租约到期后重投，NACK 会退避。本页只可确认由本标签页创建并持有凭证的会话消息。",
    ) +
    `<section class="full-panel"><div class="form-grid"><div class="field"><label for="delivery-session">本标签页创建的调用方会话</label><select id="delivery-session">${sessions.map(([id, s]) => `<option value="${esc(id)}">${esc(s.label)} · ${esc(id.slice(0, 8))}</option>`).join("")}</select></div><div class="delivery-receive">${button("接收持久消息", "receive-messages", "primary", sessions.length ? "" : "disabled")}</div></div><div class="item-list">${state.received.map((m) => `<article class="list-card"><div><h3>${statusBadge(m.payload.status)} <span class="mono">${esc(m.id.slice(0, 8))}</span> ${badge(`第 ${m.attempt} 次投递`, "blue")}</h3><p>${esc(m.payload.attention?.question || m.payload.result?.summary || m.payload.error || "状态更新")}</p><small>租约至 ${time(m.leaseUntil)} · 请求 ${esc(m.payload.runId.slice(0, 8))}</small></div><div class="actions">${button("稍后重投", "nack-message", "small", `data-id="${m.id}"`)}${button("已处理 · ACK", "ack-message", "small primary", `data-id="${m.id}"`)}</div></article>`).join("")}</div></section><section class="full-panel"><h2>持久队列</h2><div class="table-wrap"><table><thead><tr><th>消息 / 请求</th><th>状态</th><th>投递次数</th><th>创建时间</th></tr></thead><tbody>${messages.map((m) => `<tr><td><span class="mono">${esc(m.id.slice(0, 8))}</span><small class="task-slug">${esc(m.run_id.slice(0, 8))} · ${esc(m.kind)}</small></td><td>${badge(m.state, m.state === "acked" ? "stable" : "amber")}</td><td>${m.attempts}</td><td>${time(m.created_at)}</td></tr>`).join("")}</tbody></table></div></section>`;
}
async function knowledgePage() {
  const { proposals } = await api("/api/knowledge");
  state.proposals = proposals;
  $("#main").innerHTML =
    heading(
      "LEARN WITH INTENTION",
      "经验与学习",
      "把每次执行中的经验，变成下一次可复用的能力。",
      button(`${icon("plus")} 提交经验提案`, "new-proposal", "primary"),
    ) +
    hint(
      "自动汇总只包含请求计数。原始会话不会自动进入共享记忆；提案经你审核后写入任务草稿，重新测试发布后生效。",
    ) +
    `<div class="item-list">${proposals.length ? proposals.map((p) => `<article class="list-card"><div><h3>${esc(state.overview.tasks.find((t) => t.id === p.task_id)?.name || p.task_id)} ${statusBadge(p.status)}</h3><p style="white-space:pre-wrap">${esc(p.content)}</p><small class="muted">${time(p.created_at)} · ${p.run_id ? `来源请求 ${esc(p.run_id.slice(0, 8))}` : "维护者提案"}</small></div><div class="actions">${p.status === "pending" ? button("拒绝", "review-proposal", "small", `data-id="${p.id}" data-decision="rejected"`) + button("审核采纳", "review-proposal", "small primary", `data-id="${p.id}" data-decision="approved"`) : ""}</div></article>`).join("") : `<section class="full-panel empty">${icon("learn")}<br>还没有待审核的经验。<br>从一次请求开始，记录值得复用的方法。</section>`}</div>`;
}
async function schedulesPage() {
  const { schedules } = await api("/api/schedules");
  state.schedules = schedules;
  $("#main").innerHTML =
    heading(
      "ON YOUR SCHEDULE",
      "定时任务",
      "按明确的时区和节奏，调用任务的正式版本。",
      button(`${icon("plus")} 新建定时任务`, "new-schedule", "primary"),
    ) +
    hint(
      "下方时间来自数据库中调度器实际保存的 next_run_at。服务停机期间不补跑；重新启动会计算下次时间并记录审计。",
    ) +
    `<div class="item-list">${schedules.map((s) => `<article class="list-card"><div><h3>${esc(s.name)} ${badge(s.enabled ? "已启用" : "已暂停", s.enabled ? "stable" : "")}</h3><p>${esc(state.overview.tasks.find((t) => t.id === s.task_id)?.name || s.task_id)} <span class="mono">${esc(s.cron)}</span> · ${esc(s.timezone)}</p><div class="schedule-time">${s.enabled ? "下次执行" : "暂停中 · 保存的名义时间"}：${fullTime(s.next_run_at, s.timezone)}</div><p>最近执行：${s.last_run_at ? time(s.last_run_at, s.timezone) : "尚未执行"}${s.last_run_id ? ` · 请求 ${esc(s.last_run_id.slice(0, 8))}` : ""}</p></div><div class="actions">${button(s.enabled ? "暂停" : "启用", "toggle-schedule", s.enabled ? "small" : "small primary", `data-id="${s.id}" data-enabled="${!s.enabled}"`)}</div></article>`).join("") || '<section class="full-panel empty">还没有定时任务。</section>'}</div>`;
}
async function marketPage() {
  let error = "";
  try {
    state.packages = (await api("/api/registry")).packages;
  } catch (e) {
    error = e.message;
    state.packages = [];
  }
  $("#main").innerHTML =
    heading(
      "CAPABILITIES WORTH SHARING",
      "共享广场",
      "发现、分享与安装任务能力。共享包保留方法与知识，运行历史留在本地。",
      button(`${icon("refresh")} 重新连接`, "refresh"),
    ) +
    hint(
      "独立 Registry 服务 · 本机双服务 DEMO。当前没有连接公开社区；安装的能力以草稿进入工作空间，复核、配置并测试后再发布。",
    ) +
    (error
      ? `<section class="full-panel empty">${icon("globe")}<br>${esc(error)}<div class="code-block">npm run registry</div></section>`
      : `<div class="wide-grid">${
          state.packages
            .map(
              (p) =>
                `<article class="task-card"><div class="card-top"><span class="task-icon purple">${icon("box")}</span>${badge(`v${p.version}`, "blue")}</div><h3>${esc(p.task.name)}</h3><div class="task-slug">${esc(p.task.id)}</div><p class="task-description">${esc(p.task.description)}</p><div class="tags">${p.task.tags
                  .slice(0, 3)
                  .map((t) => `<span class="tag">${esc(t)}</span>`)
                  .join(
                    "",
                  )}</div><div class="card-bottom"><span class="mono muted" style="font-size:9px">SHA ${p.digest.slice(0, 10)}</span>${button("安装到本地", "install-package", "small", `data-digest="${p.digest}"`)}</div></article>`,
            )
            .join("") ||
          '<section class="full-panel empty full">广场还没有能力包。<br>打开任务详情，在版本页审核导出内容，再分享到这里。</section>'
        }</div>`);
}
function settingsPage() {
  const r = state.overview.runtime;
  const config = `[mcp_servers.taskdock]\ncommand = "node"\nargs = [${JSON.stringify(`${state.overview.projectRoot}/src/mcp-stdio.js`)}]\n\n[mcp_servers.taskdock.env]\nTASKDOCK_URL = ${JSON.stringify(location.origin)}\n# 先启动本地 TaskDock 服务。`;
  $("#main").innerHTML =
    heading(
      "CONNECT YOUR WORKSPACE",
      "接入与设置",
      "让每个上层会话先发现已有任务，再决定如何分工。",
    ) +
    `<div class="integrations"><div><section class="full-panel"><h2>MCP 接入</h2><p class="prose">将下列配置加入你的 MCP 客户端。服务同时提供 stdio 和 Streamable HTTP 两种接入方式。</p><pre class="code-block" id="mcp-config">${esc(config)}</pre>${button(`${icon("copy")} 复制配置`, "copy-config", "small")}<p class="prose">HTTP MCP：<span class="mono">${esc(location.origin)}/mcp</span></p></section><section class="full-panel"><h2>上层会话的调用纪律</h2><ol class="prose"><li>先 search / plan，确认已有任务匹配。</li><li>为当前父会话创建新 session，再提交正式版请求。</li><li>取回结果、版本和证据；未知任务留在当前会话完成。</li><li>复用能力，不复用其他会话 token 和原始上下文。</li></ol><p class="prose">仓库中的 <span class="mono">skills/taskdock-client/SKILL.md</span> 可由你安装到 Codex；本版未修改你的全局配置。</p></section></div><div><section class="full-panel"><h2>运行环境</h2><div class="integration-row"><span>内置规则运行器</span>${badge("已就绪", "stable")}</div><div class="integration-row"><span>Pi SDK 1.4.0</span>${badge("已安装", "stable")}</div><div class="integration-row"><span>OpenAI 模型</span>${badge(r.openaiConfigured ? "已配置" : "待配置", r.openaiConfigured ? "stable" : "amber")}</div><div class="integration-row"><span>Anthropic 模型</span>${badge(r.anthropicConfigured ? "已配置" : "待配置", r.anthropicConfigured ? "stable" : "amber")}</div><div class="integration-row"><span>共享服务</span><span class="mono">${esc(r.registryUrl)}</span></div><p class="prose">在本机 .env 配置模型 key，权限设为 600。任务只保存环境变量名称，密钥不会进入 Git 或共享包。</p></section><section class="full-panel"><h2>本地数据</h2><p class="prose">每个任务的能力仓库、请求目录与统计都保存在本机。</p><pre class="code-block">${esc(state.overview.dataDir)}\n├─ local.sqlite\n├─ tasks/\n│  └─ &lt;task-id&gt;/\n│     ├─ repo/     Git 能力仓库\n│     ├─ runs/     独立请求历史\n│     └─ summary.json\n└─ registry.sqlite</pre><p class="status-message">本机开发服务依赖电脑保持在线。重新测试前应检查 /health 和进程。</p></section></div></div>`;
}
function researchPage() {
  $("#main").innerHTML =
    heading(
      "RESEARCH → DECISION → DEMO",
      "为什么做一个任务中台",
      "2026-10-31 · 基于 GitHub 仓库与官方文档的候选调研。",
    ) +
    `<section class="full-panel"><div class="eyebrow">RESEARCH FINDING</div><div class="big-lead">找到多个可复用组件。<br>在本次候选中，未发现完整覆盖需求的现成平台。</div><p class="prose">这个结论限定于本次候选与文档核验；未将所有项目逐一部署。缺口集中在：任务类型目录、请求隔离、Git 版本发布、经验治理与本地/云端分工的完整闭环。</p></section><div class="research-grid">${[
      [
        "Dify",
        "工作流、日志、MCP 发布出口。按任务服务配置与经验审核晋级仍需定制。",
        "https://github.com/langgenius/dify",
      ],
      [
        "LangGraph / LangSmith",
        "线程持久化、共享 Store、部署能力；完整控制台和能力市场需额外组合。",
        "https://github.com/langchain-ai/langgraph",
      ],
      [
        "Letta",
        "擅长持久 Agent 与共享记忆；需额外隔离一次性请求和受审查的公共能力。",
        "https://github.com/letta-ai/letta",
      ],
      [
        "Paperclip",
        "丰富的管理与心跳执行，组织模型偏 AI 员工与公司，需要重构任务能力产品模型。",
        "https://github.com/paperclipai/paperclip",
      ],
      [
        "agentregistry",
        "Agent / MCP / Skill 的版本管理与分发很接近云端能力库，仍需任务历史与学习治理层。",
        "https://github.com/agentregistry-dev/agentregistry",
      ],
      [
        "Pi",
        "轻量可嵌入的执行框架。TaskDock 负责目录、隔离、发布、调度和治理。",
        "https://github.com/earendil-works/pi",
      ],
    ]
      .map(
        ([name, description, url]) =>
          `<article class="research-card"><h3>${name}</h3><p>${description}</p><a href="${url}" target="_blank" rel="noopener noreferrer">查看源项目 ↗</a></article>`,
      )
      .join(
        "",
      )}</div><section class="full-panel" style="margin-top:20px"><h2>本版的明确边界</h2><div class="prose"><p>已实现本地控制面、独立请求目录、真实 Git 版本、MCP 入口、规则执行、Pi SDK 适配、串行 Team、经验审核、时区调度与独立共享服务。</p><p>本环境未配置模型 key，真实模型效果尚未验收。共享服务尚未部署公网；A2A、云端多租户身份、签名信任链、容器沙箱和自动演化评测属于后续工作。</p><p>详细证据、比较矩阵、方案与集中问题在 docs/RESEARCH.md、ARCHITECTURE.md 和 DECISIONS.md。</p></div></section>`;
}
async function refresh() {
  state.overview = await api("/api/overview");
  if (activeInput()) {
    state.refreshPending = true;
    return;
  }
  state.refreshPending = false;
  nav();
  if (state.page === "home") home();
  else if (state.page === "graph") await graphPage();
  else if (state.page === "attention") await attentionPage();
  else if (state.page === "deliveries") await deliveriesPage();
  else if (state.page === "runs") await runsPage();
  else if (state.page === "knowledge") await knowledgePage();
  else if (state.page === "schedules") await schedulesPage();
  else if (state.page === "market") await marketPage();
  else if (state.page === "settings") settingsPage();
  else researchPage();
}
async function navigate() {
  const page = location.hash.slice(1) || "home";
  state.page = navs.some((n) => n[0] === page) ? page : "home";
  try {
    await refresh();
  } catch (e) {
    if (e.status === 401) authPage();
    else {
      $("#main").innerHTML =
        `<section class="empty">连接中台失败：${esc(e.message)}<br>${button("重新连接", "refresh")}</section>`;
    }
  }
}
function authPage() {
  $("#main").innerHTML =
    `<section class="full-panel auth-page"><h2>连接你的 TaskDock</h2><p class="prose">当前服务启用了 API 认证。输入本机配置的 token，仅保存在当前标签页会话。</p><form id="auth-form">${field("API Token", "auth-token", "", "password")}<button class="button primary" type="submit">连接中台</button><p class="form-error"></p></form></section>`;
}
function openModal(content) {
  state.modalGeneration++;
  clearInterval(state.runTimer);
  $("#modal-body").innerHTML = content;
  if (!$("#modal").open) $("#modal").showModal();
  $("#modal").scrollTop = 0;
}
function closeModal() {
  clearInterval(state.runTimer);
  $("#modal").close();
}
const modalHeader = (title, sub = "", i = "box") =>
  `<div class="modal-header"><span class="task-icon">${icon(i)}</span><div><h2>${title}</h2><small>${sub}</small></div><button class="close" data-action="close" aria-label="关闭">×</button></div>`;
async function taskModal(id, tab = "overview") {
  state.task = await api(`/api/tasks/${id}`);
  state.modalTab = tab;
  renderTaskModal();
}
function renderTaskModal() {
  const t = state.task,
    c = t.draft,
    tab = state.modalTab;
  let content = "",
    footer = "";
  if (tab === "overview") {
    content = `<div class="detail-summary"><div>服务状态<b>${t.stable ? `正式版 v${esc(t.stable.version)}` : "草稿待发布"}</b></div><div>执行方式<b>${c.runner === "pi" ? "Pi 模型运行器" : "内置规则 · 无模型推理"}</b></div><div>知识与协作<b>${c.knowledge.length} 条审核知识 · ${c.mode === "team" ? `${c.stages.length} 阶段 Team` : "单 Agent"}</b></div></div><p class="prose">${esc(c.description)}</p><h3 class="subhead">任务规则</h3><pre class="code-block">${esc(c.instructions || "尚未设置任务规则")}</pre><h3 class="subhead">能力组件</h3><div class="tags">${c.skills.map((s) => `<span class="tag">Skill · ${esc(s.name)}</span>`).join("")}${c.mcpServers.map((m) => `<span class="tag">MCP · ${esc(m.name)} · ${m.allowedTools.length} 工具</span>`).join("")}${!c.skills.length && !c.mcpServers.length ? '<span class="muted">暂无附加组件</span>' : ""}</div><h3 class="subhead">审核后的共享知识</h3>${c.knowledge.length ? c.knowledge.map((k) => `<p class="prose">${esc(k.content)}</p>`).join("") : '<p class="prose">尚无共享知识。原始请求不会自动进入这里。</p>'}`;
    content += `<h3 class="subhead">授权控制</h3><p class="prose">${t.authorization?.enabled === false ? "任务已暂停，新请求和后续执行被阻止。" : "当前授权已启用；每次执行仍受请求 Mandate 限制。"}</p>${button(t.authorization?.enabled === false ? "恢复任务授权" : "暂停任务授权", "toggle-authorization", "small", `data-enabled="${t.authorization?.enabled === false}"`)}`;
    footer = `<span class="hint">草稿修改不会影响正在运行的正式版请求。</span><div>${button("测试草稿", "task-tab", "", `data-tab="test"`)} ${button("正式调用", "invoke-stable", "primary", `${t.stable ? "" : "disabled"}`)}</div>`;
  }
  if (tab === "edit") {
    content = `<form id="edit-task"><div class="form-grid">${field("任务名称", "task-name", c.name)}<div class="field"><label for="task-category">任务分类</label><select id="task-category">${Object.entries(
      categoryLabels,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${c.category === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></div></div>${area("任务说明", "task-description", c.description, "上层会话通过说明与标签发现任务。", 3)}${field("能力标签（用逗号分隔）", "task-tags", c.tags.join(", "))}${area("执行规则", "task-instructions", c.instructions, "执行器只接收本次请求、固定能力快照与已审核知识。", 7)}<div class="form-error"></div></form>`;
    footer = `<span class="hint">仅保存到草稿。完整配置在「能力与工具」中修改。</span>${button("保存草稿", "save-basic", "primary")}`;
  }
  if (tab === "capabilities") {
    content =
      hint(
        "配置单 Agent / Team、Pi 模型、Skills、MCP allowlist、检查项与学习规则。密钥只填写环境变量名。Pi 不加载本机其他会话，也不启用 bash/read/write。",
      ) +
      `<form id="config-task">${area("能力配置 JSON", "capability-json", json(c), "严格校验字段；未知字段与无效配置会被拒绝。", 21)}<div class="form-error"></div></form>`;
    footer = `<span class="hint">runner: checklist / pi · mode: single / team</span>${button("校验并保存草稿", "save-config", "primary")}`;
  }
  if (tab === "test") {
    content =
      hint(
        `测试的是当前 draft，revision ${t.revision}。只有完全相同的能力摘要测试通过，才能晋级正式版。`,
      ) +
      `<form id="test-task">${area("本次请求上下文 JSON", "test-json", json(c.sampleInput), "上线检查示例默认缺少实机证据，会如实返回「待补证据」。", 13)}<div class="form-error"></div></form>`;
    footer = `<span class="hint">规则运行器只核对提交证据；不会执行真实服务探测。</span>${button(`${icon("rocket")} 执行草稿测试`, "test-task", "primary")}`;
  }
  if (tab === "composition") {
    const candidates = state.overview.tasks.filter(
      (n) => n.stable && n.id !== t.id,
    );
    content =
      hint(
        "引用使用子任务的固定正式版。inputMap 明确指定从父请求传哪些字段；不会自动复制全部上下文。修改后需要重新测试父任务。",
      ) +
      `${c.origin ? `<p class="prose">派生来源：${esc(c.origin.taskId)} · SHA ${esc(c.origin.digest.slice(0, 12))}</p>` : ""}<div class="item-list" id="child-references">${childRows(c.children || [])}</div><h3 class="subhead">添加共享子任务</h3><form id="child-form"><div class="form-grid"><div class="field"><label for="child-task">已发布的子任务</label><select id="child-task">${candidates.map((n) => `<option value="${esc(n.id)}">${esc(n.name)} · v${esc(n.stable.version)}</option>`).join("")}</select></div>${field("调用 key（在当前父任务内唯一）", "child-key", "shared-check")}</div>${area("输入映射 JSON", "child-map", '{\n  "evidence": "evidence"\n}', "左边是子请求字段，右边是父请求中的字段路径。", 4)}<div class="form-error"></div>${button("保存子任务引用", "add-child", "", candidates.length ? "" : "disabled")}</form><h3 class="subhead">微调后复用</h3><p class="prose">派生为新的独立草稿，原能力和现有父任务保持原版本。</p>${button("派生新任务", "fork-preview", "", t.stable ? "" : "disabled")}`;
    footer =
      '<span class="hint">任务图禁止成环；引用和派生都保留版本来源。</span>';
  }
  if (tab === "versions") {
    content =
      hint(
        "正式版绑定 Git commit 和能力摘要。晋级要求当前草稿已有通过的测试；正在执行的请求始终使用提交时的快照。",
      ) +
      `<div class="section-heading"><h3>版本记录</h3>${button("审核并分享正式版", "share-preview", "small", t.stable ? "" : "disabled")}</div><div class="item-list">${t.releases.map((r) => `<div class="list-card"><div><h3>v${esc(r.version)} ${r.id === t.stable?.id ? badge("当前正式版", "stable") : ""}</h3><p class="mono">Git ${esc(r.git_sha.slice(0, 12))} · SHA ${esc(r.digest.slice(0, 12))}</p><small class="muted">${time(r.created_at)}</small></div>${r.id !== t.stable?.id ? button("回滚到此版本", "rollback", "small", `data-release="${r.id}"`) : ""}</div>`).join("") || '<p class="prose">还没有正式版本。先调试草稿，再发布。</p>'}</div><h3 class="subhead">草稿与正式版对照</h3><div class="diff"><div><div class="badge-label">DRAFT · REVISION ${t.revision}</div><pre class="code-block">${esc(json(c))}</pre></div><div><div class="badge-label">STABLE · ${t.stable ? `v${esc(t.stable.version)}` : "NONE"}</div><pre class="code-block">${esc(t.stable ? json(t.stable.config) : "尚未发布")}</pre></div></div>`;
    footer = `<span class="hint">无当前摘要的通过记录，服务端会拒绝晋级。</span>${button("晋级为正式版", "promote", "primary")}`;
  }
  openModal(
    modalHeader(esc(c.name), `${esc(c.id)} · revision ${t.revision}`) +
      `<div class="modal-nav">${[
        ["overview", "概览"],
        ["edit", "基本配置"],
        ["capabilities", "能力与工具"],
        ["composition", "子任务与派生"],
        ["test", "调试请求"],
        ["versions", "版本与 Git"],
      ]
        .map(
          ([id, label]) =>
            `<button class="tab ${tab === id ? "active" : ""}" data-action="task-tab" data-tab="${id}">${label}</button>`,
        )
        .join(
          "",
        )}</div><div class="modal-content">${content}<div class="modal-error"></div></div><div class="modal-footer">${footer}</div>`,
  );
}
function newTaskModal() {
  const c = {
    id: "my-task",
    name: "我的任务",
    description: "说明这个任务完成什么工作、需要什么输入、交付什么结果。",
    runner: "checklist",
    mode: "single",
    category: "custom",
    tags: [],
    instructions: "按检查项核对输入证据，缺少证据时如实报告。",
    checks: [
      {
        id: "evidence",
        label: "核心证据已提供",
        field: "evidence",
        operator: "truthy",
      },
    ],
    sampleInput: { evidence: "" },
  };
  openModal(
    modalHeader(
      "创建任务 AI",
      "定义一个可被其他会话发现和调用的任务。",
      "plus",
    ) +
      `<div class="modal-content"><form id="new-task-form"><div class="form-grid">${field("任务 ID（小写字母、数字、短横线）", "new-id", "")}${field("任务名称", "new-name", "")}</div>${area("任务说明", "new-description", "", "清楚描述它解决的任务，而不是扮演的角色。", 3)}${area("初始配置 JSON", "new-json", json(c), "上方 ID、名称和说明会覆盖 JSON 中的对应字段。其余能力可在创建后继续维护。", 12)}<div class="form-error"></div></form></div><div class="modal-footer"><span class="hint">创建为草稿；完成测试后再提供服务。</span>${button("创建任务", "create-task", "primary")}</div>`,
  );
}
function invokeModal() {
  const t = state.task;
  openModal(
    modalHeader(
      "发起正式调用",
      `${esc(t.draft.name)} · stable v${esc(t.stable.version)}`,
      "terminal",
    ) +
      `<div class="modal-content">${hint("将创建一个新的独立调用方 session，复用正式版能力，不加载其他请求。")}<form id="invoke-form">${field("来源会话标签", "invoke-label", "控制台体验会话")}${area("本次请求上下文 JSON", "invoke-json", json(t.stable.config.sampleInput), "只提交本次任务需要的上下文。", 12)}<div class="form-error"></div></form></div><div class="modal-footer"><span class="hint">session capability 仅在这次提交过程中使用。</span>${button("提交独立请求", "submit-stable", "primary")}</div>`,
  );
}
async function runModal(id) {
  const r = await api(`/api/runs/${id}`);
  state.currentRun = r;
  const pending = [
    "queued",
    "running",
    "waiting_human",
    "waiting_children",
  ].includes(r.status);
  const polling = ["queued", "running", "waiting_children"].includes(r.status);
  openModal(
    modalHeader("请求详情", `${esc(r.config.name)} · ${esc(r.id)}`, "history") +
      `<div class="modal-content"><div id="run-detail">${runContent(r)}</div><div class="modal-error"></div></div><div class="modal-footer"><span class="hint">独立目录：tasks/${esc(r.task_id)}/runs/${esc(r.id.slice(0, 8))}…</span><div class="run-actions">${pending ? button("取消请求", "cancel-run", "danger", `data-id="${r.id}"`) + button("撤销授权", "revoke-preview", "", `data-id="${r.id}"`) : button("归档", "archive-run", "", `data-id="${r.id}"`)} ${!pending && !r.mandate.revokedAt && r.status !== "succeeded" ? button("明确重试", "retry-run", "primary", `data-id="${r.id}"`) : ""} ${button("提取经验提案", "proposal-from-run", "", `data-id="${r.id}" data-task="${esc(r.task_id)}"`)}</div></div>`,
  );
  const generation = state.modalGeneration;
  if (polling)
    state.runTimer = setInterval(async () => {
      if (
        activeInput() ||
        generation !== state.modalGeneration ||
        !$("#modal").open
      )
        return;
      try {
        const updated = await api(`/api/runs/${id}`);
        if (
          activeInput() ||
          generation !== state.modalGeneration ||
          !$("#modal").open
        )
          return;
        if (
          !["queued", "running", "waiting_children"].includes(updated.status)
        ) {
          clearInterval(state.runTimer);
          await runModal(id);
          return;
        }
        state.currentRun = updated;
        $("#run-detail").innerHTML = runContent(updated);
      } catch (e) {
        toast(e.message, true);
      }
    }, 1500);
}
function runContent(r) {
  const result = r.result;
  const attention = (r.attentions || [])
    .filter((a) => a.status === "open")
    .map(
      (a) =>
        `<section class="attention-card"><h3>${a.kind === "reconciliation" ? "核对工具执行结果" : "等待你补充"}</h3><p class="prose">${esc(a.question)}</p><form id="answer-form-${a.id}">${a.fields
          .map((f) =>
            f.type === "text"
              ? area(
                  esc(f.label) + (f.required ? " *" : ""),
                  `answer-${a.id}-${f.id}`,
                  "",
                  "",
                  3,
                )
              : `<div class="field"><label for="answer-${a.id}-${f.id}">${esc(f.label)}${f.required ? " *" : ""}</label><select id="answer-${a.id}-${f.id}"><option value="">请选择</option>${(f.type ===
                "boolean"
                  ? [
                      ["true", "是"],
                      ["false", "否"],
                    ]
                  : f.options.map((x) => [
                      x,
                      x === "confirmed-not-performed"
                        ? "已核对：确认未执行，允许重试"
                        : x === "record-completed"
                          ? "已核对：执行完成，记录结果"
                          : x,
                    ])
                )
                  .map(
                    ([value, label]) =>
                      `<option value="${esc(value)}">${esc(label)}</option>`,
                  )
                  .join("")}</select></div>`,
          )
          .join(
            "",
          )}<div class="form-error"></div>${button("提交回答并恢复", "answer-attention", "primary", `data-run="${r.id}" data-attention="${a.id}"`)}</form></section>`,
    )
    .join("");
  return `<div class="run-overview"><div>${statusBadge(r.status)} ${badge(r.channel === "test" ? "草稿测试" : "正式调用", r.channel === "test" ? "amber" : "blue")} ${badge(result?.executionMode === "pi" ? "Pi 模型执行" : result?.executionMode === "composition" ? "子任务汇总" : result ? "内置规则执行" : "等待结果")}</div><span class="muted mono" style="font-size:10px">SHA ${r.digest.slice(0, 16)}</span></div>${r.parent_id ? button("返回父请求", "run", "small", `data-id="${r.parent_id}"`) : ""}${r.error ? hint(esc(r.error), "amber") : ""}${attention}${result ? `<p class="prose" style="white-space:pre-wrap">${esc(result.summary)}</p>${(result.checks || []).map((c) => `<div class="check-result"><span>${c.passed ? "✓" : "○"} ${esc(c.label)}</span>${badge(c.passed ? "证据通过" : "待补证据", c.passed ? "stable" : "amber")}</div>`).join("")}<div style="margin-top:16px">${hint((result.limitations || []).map(esc).join("<br>"))}</div>${result.stages?.length ? `<h3 class="subhead">Team 阶段产物</h3>${result.stages.map((s) => `<p class="prose"><b>${esc(s.name)}</b><br><span style="white-space:pre-wrap">${esc(s.output)}</span></p>`).join("")}` : ""}` : ""}${r.children?.length ? `<h3 class="subhead">本次请求的子任务</h3><div class="item-list">${r.children.map((c) => `<div class="list-card"><div><h3>${esc(c.child_key)} · ${statusBadge(c.status)}</h3><small class="mono">${esc(c.task_id)} · ${esc(c.id.slice(0, 8))}</small></div>${button("查看子请求", "run", "small", `data-id="${c.id}"`)}</div>`).join("")}</div>` : ""}<h3 class="subhead">执行尝试</h3><div class="attempt-list">${(r.attempts || []).map((a) => `<div class="event"><b>Attempt ${a.ordinal}</b> · ${esc(a.state)} · ${time(a.started_at)}<small class="task-slug">${esc(a.id.slice(0, 12))}${a.error ? ` · ${esc(a.error)}` : ""}</small></div>`).join("") || '<p class="prose">尚未派工。</p>'}</div><details><summary>本次授权与工具回执</summary><pre class="code-block">${esc(json({ mandate: r.mandate, tools: r.toolCalls }))}</pre></details>${r.attentions?.some((a) => a.status === "answered") ? `<details><summary>已回答事项</summary><pre class="code-block">${esc(json(r.attentions.filter((a) => a.status === "answered")))}</pre></details>` : ""}<h3 class="subhead">本次请求上下文</h3><pre class="code-block">${esc(json(r.input))}</pre><h3 class="subhead">事件记录</h3><div class="event-list">${r.events.map((e) => `<div class="event"><b>${esc(e.type)}</b> · ${time(e.created_at)}${e.data.label ? `<br>${esc(e.data.label)}` : ""}${e.data.name ? `<br>${esc(e.data.name)}` : ""}</div>`).join("")}</div>`;
}
function proposalModal(taskId = "", runId = "") {
  openModal(
    modalHeader(
      "提交经验提案",
      "只提交可复用、已脱敏的方法；不复制原始上下文。",
      "learn",
    ) +
      `<div class="modal-content"><form id="proposal-form"><div class="field"><label for="proposal-task">所属任务</label><select id="proposal-task">${state.overview.tasks.map((t) => `<option value="${esc(t.id)}" ${t.id === taskId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div>${field("来源请求 ID（可选）", "proposal-run", runId)}${area("可复用经验", "proposal-content", "", "审核采纳后只更新草稿；正式版不自动改变。", 8)}<label class="checkbox-row"><input id="proposal-reviewed" type="checkbox">我已去除项目私密信息、凭据和不应跨请求共享的内容。</label><div class="form-error"></div></form></div><div class="modal-footer"><span class="hint">学习规则由任务 learningPolicy 控制。</span>${button("提交待审核", "submit-proposal", "primary")}</div>`,
  );
}
function scheduleModal() {
  openModal(
    modalHeader(
      "创建定时任务",
      "使用明确的 IANA 时区。默认创建为暂停状态。",
      "clock",
    ) +
      `<div class="modal-content"><form id="schedule-form">${field("任务名称", "schedule-name", "每日任务回顾")}<div class="field"><label for="schedule-task">调用正式版任务</label><select id="schedule-task">${state.overview.tasks
        .filter((t) => t.stable)
        .map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`)
        .join(
          "",
        )}</select></div><div class="form-grid">${field("Cron 表达式", "schedule-cron", "0 9 * * 1-5", "text", "示例：工作日 09:00")}${field("时区", "schedule-timezone", "Asia/Shanghai")}</div>${area("每次请求的输入 JSON", "schedule-json", "{}", "每次触发创建新请求。不要填写凭据。", 6)}<label class="checkbox-row"><input id="schedule-enabled" type="checkbox">创建后启用；本地服务在线时才会执行。</label><div class="form-error"></div></form></div><div class="modal-footer"><span class="hint">创建后从 API 重新读取保存的下次时间供核对。</span>${button("保存并核对时间", "submit-schedule", "primary")}</div>`,
  );
}
async function shareModal() {
  const bundle = await api(`/api/tasks/${state.task.id}/export`);
  openModal(
    modalHeader(
      "审核共享能力包",
      `${esc(bundle.task.name)} · v${esc(bundle.version)}`,
      "globe",
    ) +
      `<div class="modal-content">${hint("只提交下面的 stable 能力配置。已移除 MCP 连接与示例输入；运行目录和历史记录不在导出范围内。分享前仍须检查规则与知识文本是否包含私密信息。")}<pre class="code-block" style="max-height:330px">${esc(json(bundle))}</pre><label class="checkbox-row"><input id="share-reviewed" type="checkbox">我已审阅上方内容，可以分享到当前配置的共享 Registry。</label><div class="modal-error"></div></div><div class="modal-footer"><span class="hint">当前目标：${esc(state.overview.runtime.registryUrl)}</span>${button("确认分享", "share-task", "primary")}</div>`,
  );
}
function installModal(hash) {
  const p = state.packages.find((p) => p.digest === hash);
  openModal(
    modalHeader(
      "安装任务能力",
      `${esc(p.task.name)} · v${esc(p.version)}`,
      "box",
    ) +
      `<div class="modal-content">${hint("外部能力仅安装为草稿，不自动执行、不自动发布。复核规则和模型配置后，补齐测试输入再晋级。")}${field("本地任务 ID", "install-id", `${p.task.id}-copy`.slice(0, 63))}<pre class="code-block" style="max-height:270px">${esc(json(p.task))}</pre><div class="modal-error"></div></div><div class="modal-footer"><span class="hint">SHA-256 ${hash.slice(0, 20)}…</span>${button("安装为草稿", "confirm-install", "primary", `data-digest="${hash}"`)}</div>`,
  );
}
function val(id) {
  return document.getElementById(id).value;
}
function parse(id) {
  try {
    return JSON.parse(val(id));
  } catch {
    throw new Error("JSON 格式不正确，请检查逗号、引号和括号。");
  }
}
async function saveConfig(config) {
  state.task = await api(`/api/tasks/${state.task.id}/draft`, {
    method: "PUT",
    body: { config, revision: state.task.revision },
  });
  toast("已保存草稿；正式版保持固定版本");
  await refresh();
  // Save responses update only non-editable projections. Keep the actual form
  // nodes, selection, focus and unsaved typing alive across asynchronous writes.
  const refs = $("#child-references");
  if (refs && state.modalTab === "composition")
    refs.innerHTML = childRows(state.task.draft.children || []);
  const title = $("#modal .modal-header h2"),
    sub = $("#modal .modal-header small");
  if (title) title.textContent = state.task.draft.name;
  if (sub)
    sub.textContent = `${state.task.id} · revision ${state.task.revision}`;
}
function childRows(children) {
  return (
    children
      .map(
        (r) =>
          `<div class="list-card"><div><h3>${esc(r.key)} → ${esc(r.taskId)}</h3><small class="mono">固定 SHA ${esc(r.digest.slice(0, 12))}</small><pre class="code-block">${esc(json(r.inputMap))}</pre></div>${button("移除引用", "remove-child", "small", `data-key="${esc(r.key)}"`)}</div>`,
      )
      .join("") || '<p class="prose">当前没有子任务引用。</p>'
  );
}
function forkModal() {
  const t = state.task;
  openModal(
    modalHeader(
      "派生新任务",
      `来源 ${esc(t.id)} · v${esc(t.stable.version)}`,
      "branch",
    ) +
      `<div class="modal-content"><form id="fork-form"><div class="form-grid">${field("新任务 ID", "fork-id", `${t.id}-variant`.slice(0, 63))}${field("新任务名称", "fork-name", `${t.draft.name} · 微调版`)}</div>${area("调整执行规则", "fork-instructions", t.stable.config.instructions, "继承来源能力，独立为草稿；仍须测试后发布。", 7)}<div class="form-error"></div></form></div><div class="modal-footer"><span class="hint">保留来源版本与摘要，原任务不被修改。</span>${button("创建派生草稿", "create-fork", "primary")}</div>`,
  );
}
async function action(name, el) {
  switch (name) {
    case "close":
      closeModal();
      break;
    case "refresh":
      await refresh();
      break;
    case "settings":
      location.hash = "settings";
      break;
    case "filter":
      state.filter = el.dataset.filter;
      filterCards();
      break;
    case "new-task":
      newTaskModal();
      break;
    case "task":
      await taskModal(el.dataset.id);
      break;
    case "task-tab":
      state.modalTab = el.dataset.tab;
      renderTaskModal();
      break;
    case "run":
      await runModal(el.dataset.id);
      break;
    case "create-task": {
      const config = {
        ...parse("new-json"),
        id: val("new-id").trim(),
        name: val("new-name").trim(),
        description: val("new-description").trim(),
      };
      const t = await api("/api/tasks", { method: "POST", body: config });
      await refresh();
      await taskModal(t.id);
      toast("任务已创建为草稿");
      break;
    }
    case "save-basic":
      await saveConfig({
        ...state.task.draft,
        name: val("task-name"),
        description: val("task-description"),
        category: val("task-category"),
        tags: val("task-tags")
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
        instructions: val("task-instructions"),
      });
      break;
    case "save-config":
      await saveConfig(parse("capability-json"));
      break;
    case "add-child": {
      const selected = state.overview.tasks.find(
        (t) => t.id === val("child-task"),
      );
      if (!selected?.stable) throw new Error("请先选择一个已发布子任务");
      await saveConfig({
        ...state.task.draft,
        children: [
          ...(state.task.draft.children || []),
          {
            key: val("child-key").trim(),
            taskId: selected.id,
            releaseId: selected.stable.id,
            digest: selected.stable.digest,
            inputMap: parse("child-map"),
          },
        ],
      });
      break;
    }
    case "remove-child":
      await saveConfig({
        ...state.task.draft,
        children: (state.task.draft.children || []).filter(
          (c) => c.key !== el.dataset.key,
        ),
      });
      break;
    case "fork-preview":
      forkModal();
      break;
    case "create-fork": {
      const task = await api(`/api/tasks/${state.task.id}/fork`, {
        method: "POST",
        body: {
          id: val("fork-id").trim(),
          name: val("fork-name").trim(),
          patch: { instructions: val("fork-instructions") },
        },
      });
      await refresh();
      await taskModal(task.id);
      toast("已派生为独立草稿，来源版本已留存");
      break;
    }
    case "toggle-authorization":
      state.task.authorization = await api(
        `/api/tasks/${state.task.id}/authorization`,
        {
          method: "POST",
          body: {
            enabled: el.dataset.enabled === "true",
            reason: "维护者通过控制台调整授权",
          },
        },
      );
      renderTaskModal();
      await refresh();
      break;
    case "test-task": {
      const r = await api(`/api/tasks/${state.task.id}/test`, {
        method: "POST",
        body: { input: parse("test-json") },
      });
      await refresh();
      await runModal(r.id);
      break;
    }
    case "invoke-stable":
      invokeModal();
      break;
    case "submit-stable": {
      const input = parse("invoke-json");
      const session = await api("/api/client/sessions", {
        method: "POST",
        body: { label: val("invoke-label") },
      });
      state.clientSessions[session.sessionId] = {
        token: session.sessionToken,
        label: val("invoke-label"),
      };
      sessionStorage.setItem(
        "taskdock-demo-sessions",
        JSON.stringify(state.clientSessions),
      );
      const r = await api("/api/client/runs", {
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          taskId: state.task.id,
          input,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      await refresh();
      await runModal(r.id);
      break;
    }
    case "promote":
      state.task = await api(`/api/tasks/${state.task.id}/promote`, {
        method: "POST",
        body: {},
      });
      await refresh();
      renderTaskModal();
      toast("已创建 Git 版本并切换正式版");
      break;
    case "rollback":
      state.task = await api(`/api/tasks/${state.task.id}/rollback`, {
        method: "POST",
        body: { releaseId: el.dataset.release },
      });
      await refresh();
      renderTaskModal();
      toast("正式版已回滚并写入 Git 留痕");
      break;
    case "cancel-run":
      await api(`/api/runs/${el.dataset.id}/cancel`, {
        method: "POST",
        body: {},
      });
      await runModal(el.dataset.id);
      break;
    case "answer-attention": {
      const attention = state.currentRun.attentions.find(
        (a) => a.id === el.dataset.attention,
      );
      if (!attention) throw new Error("请重新打开请求后回答");
      const answers = {};
      for (const f of attention.fields) {
        const value = val(`answer-${attention.id}-${f.id}`);
        if (!f.required && value === "") continue;
        answers[f.id] =
          f.type === "boolean" && value !== "" ? value === "true" : value;
      }
      const answered = await api(
        `/api/runs/${el.dataset.run}/attentions/${attention.id}/answer`,
        { method: "POST", body: { answers } },
      );
      await runModal(el.dataset.run);
      toast(
        answered.status === "waiting_human"
          ? "回答已保存；仍有待回答事项"
          : "回答已保存，原请求已重新排队",
      );
      break;
    }
    case "retry-run":
      await api(`/api/runs/${el.dataset.id}/retry`, {
        method: "POST",
        body: {},
      });
      await runModal(el.dataset.id);
      break;
    case "revoke-preview":
      openModal(
        modalHeader(
          "撤销本次授权",
          "同时停止本次请求树中的后续工作。",
          "shield",
        ) +
          `<div class="modal-content">${area("撤销原因", "revoke-reason", "维护者撤销本次请求", "撤销会永久留痕；如需重新授权，请创建新请求。", 3)}<div class="modal-error"></div></div><div class="modal-footer">${button("撤销授权", "confirm-revoke", "danger", `data-id="${el.dataset.id}"`)}</div>`,
      );
      break;
    case "confirm-revoke":
      await api(`/api/runs/${el.dataset.id}/revoke`, {
        method: "POST",
        body: { reason: val("revoke-reason") },
      });
      await runModal(el.dataset.id);
      break;
    case "receive-messages": {
      const sessionId = val("delivery-session"),
        s = state.clientSessions[sessionId];
      if (!s) throw new Error("本标签页没有这个会话的凭证");
      const { messages } = await api("/api/client/deliveries/receive", {
        method: "POST",
        sessionToken: s.token,
        body: { limit: 10, leaseSeconds: 30 },
      });
      const retained = state.received.filter(
        (m) =>
          !messages.some((n) => n.id === m.id) &&
          Date.parse(m.leaseUntil) > Date.now(),
      );
      state.received = [
        ...retained,
        ...messages.map((m) => ({ ...m, sessionId })),
      ];
      await deliveriesPage();
      toast(
        messages.length
          ? `收到 ${messages.length} 条持久消息`
          : "当前没有可接收消息；已租出的消息需等待租约到期",
      );
      break;
    }
    case "ack-message":
    case "nack-message": {
      const m = state.received.find((m) => m.id === el.dataset.id);
      if (!m) throw new Error("请重新接收消息");
      await api(
        `/api/client/deliveries/${m.id}/${name === "ack-message" ? "ack" : "nack"}`,
        {
          method: "POST",
          sessionToken: state.clientSessions[m.sessionId].token,
          body: { receipt: m.receipt },
        },
      );
      state.received = state.received.filter((n) => n.id !== m.id);
      await deliveriesPage();
      toast(
        name === "ack-message"
          ? "消息已确认，回执已持久保存"
          : "已安排退避重投",
      );
      break;
    }
    case "archive-run":
      await api(`/api/runs/${el.dataset.id}/archive`, {
        method: "POST",
        body: {},
      });
      closeModal();
      await refresh();
      toast("请求已归档，历史证据仍保留");
      break;
    case "new-proposal":
      proposalModal();
      break;
    case "proposal-from-run":
      proposalModal(el.dataset.task, el.dataset.id);
      break;
    case "submit-proposal": {
      if (!$("#proposal-reviewed").checked)
        throw new Error("请先确认经验内容已脱敏");
      const runId = val("proposal-run").trim();
      await api("/api/knowledge", {
        method: "POST",
        body: {
          taskId: val("proposal-task"),
          ...(runId ? { runId } : {}),
          content: val("proposal-content"),
        },
      });
      closeModal();
      location.hash = "knowledge";
      await refresh();
      toast("经验已提交，等待审核");
      break;
    }
    case "review-proposal": {
      const p = state.proposals.find((p) => p.id === el.dataset.id);
      if (el.dataset.decision === "approved") {
        openModal(
          modalHeader(
            "审核经验提案",
            "采纳后只进入草稿；正式版需重测后发布。",
            "learn",
          ) +
            `<div class="modal-content"><p class="prose" style="white-space:pre-wrap">${esc(p.content)}</p><label class="checkbox-row"><input id="review-confirmed" type="checkbox">内容已脱敏、适用于跨请求复用，允许加入该任务草稿。</label><div class="modal-error"></div></div><div class="modal-footer"><span class="hint">原始请求不会附带写入知识库。</span>${button("采纳到草稿", "confirm-review", "primary", `data-id="${p.id}"`)}</div>`,
        );
      } else {
        await api(`/api/knowledge/${p.id}/review`, {
          method: "POST",
          body: { decision: "rejected" },
        });
        await refresh();
        toast("提案已拒绝");
      }
      break;
    }
    case "confirm-review":
      if (!$("#review-confirmed").checked)
        throw new Error("请先确认内容可被跨请求复用");
      await api(`/api/knowledge/${el.dataset.id}/review`, {
        method: "POST",
        body: { decision: "approved" },
      });
      closeModal();
      await refresh();
      toast("经验已采纳到草稿，需测试后晋级");
      break;
    case "new-schedule":
      scheduleModal();
      break;
    case "submit-schedule": {
      const s = await api("/api/schedules", {
        method: "POST",
        body: {
          taskId: val("schedule-task"),
          name: val("schedule-name"),
          cron: val("schedule-cron"),
          timezone: val("schedule-timezone"),
          input: parse("schedule-json"),
          enabled: $("#schedule-enabled").checked,
        },
      });
      const saved = await api(`/api/schedules/${s.id}`);
      closeModal();
      await refresh();
      toast(
        `已核对保存时间：${fullTime(saved.next_run_at, saved.timezone)} ${saved.timezone}`,
      );
      break;
    }
    case "toggle-schedule": {
      await api(`/api/schedules/${el.dataset.id}/toggle`, {
        method: "POST",
        body: { enabled: el.dataset.enabled === "true" },
      });
      const s = await api(`/api/schedules/${el.dataset.id}`);
      await refresh();
      toast(
        `${s.enabled ? "已启用" : "已暂停"}；保存的下次时间 ${fullTime(s.next_run_at, s.timezone)} ${s.timezone}`,
      );
      break;
    }
    case "share-preview":
      await shareModal();
      break;
    case "share-task":
      if (!$("#share-reviewed").checked)
        throw new Error("请先审核并确认能力包内容");
      await api(`/api/tasks/${state.task.id}/share`, {
        method: "POST",
        body: { reviewed: true },
      });
      closeModal();
      location.hash = "market";
      await refresh();
      toast("正式版能力已分享到当前 Registry");
      break;
    case "install-package":
      installModal(el.dataset.digest);
      break;
    case "confirm-install": {
      const t = await api("/api/registry/install", {
        method: "POST",
        body: { digest: el.dataset.digest, id: val("install-id") },
      });
      await refresh();
      await taskModal(t.id);
      toast("已安装为草稿，请复核后测试");
      break;
    }
    case "copy-config":
      try {
        await navigator.clipboard.writeText($("#mcp-config").textContent);
        toast("配置已复制");
      } catch {
        toast("浏览器未允许剪贴板，请手动复制配置", true);
      }
      break;
  }
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const errorEl =
    $("#modal[open] .form-error") || $("#modal[open] .modal-error");
  if (errorEl) errorEl.textContent = "";
  el.disabled = true;
  try {
    await action(el.dataset.action, el);
  } catch (error) {
    if (errorEl?.isConnected) errorEl.textContent = error.message;
    else toast(error.message, true);
  } finally {
    if (el.isConnected) el.disabled = false;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "task-search") {
    state.query = e.target.value;
    filterCards();
  }
});
document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (state.refreshPending && !activeInput())
      void refresh().catch((error) => toast(error.message, true));
  }, 0);
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "include-archived") {
    state.archived = e.target.checked;
    try {
      await runsPage();
    } catch (error) {
      toast(error.message, true);
    }
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (e.target.id === "auth-form") {
    state.apiToken = val("auth-token");
    sessionStorage.setItem("taskdock-api-token", state.apiToken);
    try {
      await refresh();
    } catch (error) {
      e.target.querySelector(".form-error").textContent = error.message;
    }
  }
});
$("#modal").addEventListener("close", () => {
  state.modalGeneration++;
  clearInterval(state.runTimer);
});
window.addEventListener("hashchange", () => void navigate());
await navigate();
