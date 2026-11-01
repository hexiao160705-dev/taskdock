import { ui, locale, httpError } from "./i18n.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let packages = [];
let apiToken = sessionStorage.getItem("registry-token") || "";
const target = document.querySelector("#registry-packages");
function render() {
  const q = document.querySelector("#registry-search").value.toLowerCase();
  const selected = packages.filter((p) =>
    `${p.task.name} ${p.task.id} ${p.task.description} ${p.task.tags.join(" ")}`
      .toLowerCase()
      .includes(q),
  );
  target.innerHTML =
    selected
      .map(
        (p) =>
          `<article class="task-card"><div class="card-top"><span class="task-icon purple">▥</span><span class="badge stable">v${esc(p.version)}</span></div><h3>${esc(p.task.name)}</h3><div class="task-slug">${esc(p.task.id)}</div><p class="task-description">${esc(p.task.description)}</p><div class="tags">${p.task.tags
            .slice(0, 4)
            .map((t) => `<span class="tag">${esc(t)}</span>`)
            .join(
              "",
            )}</div><div class="card-bottom"><span class="mono muted" style="font-size:9px">SHA ${esc(p.digest.slice(0, 12))}</span><button class="button small" data-package="${p.digest}${ui('">查看能力包 →</button></div></article>')}`,
      )
      .join("") ||
    ui(
      '<div class="full-panel empty full">还没有匹配的共享任务。<br>从本地中台审核并分享一个正式版能力。</div>',
    );
}
async function load() {
  try {
    const r = await fetch("/api/packages", {
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401) {
        document.querySelector("#registry-auth").innerHTML = ui(
          '<form id="registry-login" class="full-panel"><div class="field"><label for="registry-token">Registry API Token</label><input type="password" id="registry-token" autocomplete="off"></div><button class="button primary">连接私有 Registry</button></form>',
        );
      }
      throw new Error(httpError(r.status, data.error));
    }
    packages = data.packages;
    document.querySelector("#registry-auth").innerHTML = "";
    render();
  } catch (e) {
    target.innerHTML = `<div class="full-panel empty full">${esc(e.message)}</div>`;
  }
}
document.addEventListener("submit", (e) => {
  if (e.target.id !== "registry-login") return;
  e.preventDefault();
  apiToken = document.querySelector("#registry-token").value;
  sessionStorage.setItem("registry-token", apiToken);
  void load();
});
document.querySelector("#registry-search").addEventListener("input", render);
document.addEventListener("click", (e) => {
  if (e.target.id === "package-close") {
    document.querySelector("#package-dialog").close();
    return;
  }
  const el = e.target.closest("[data-package]");
  if (!el) return;
  const p = packages.find((p) => p.digest === el.dataset.package);
  document.querySelector("#package-detail").innerHTML =
    `<div class="modal-header"><div><h2>${esc(p.task.name)}</h2><small>v${esc(p.version)} · SHA-256 ${esc(p.digest.slice(0, 16))}${ui('</small></div><button class="close" id="package-close" aria-label="关闭">×</button></div><div class="modal-content"><div class="hint-box">在本地 TaskDock 的「共享广场」中连接本 Registry，并选择安装。能力安装为草稿，复核后测试发布。</div><pre class="code-block">')}${esc(JSON.stringify(p, null, 2))}</pre></div>`;
  document.querySelector("#package-dialog").showModal();
});
await load();
