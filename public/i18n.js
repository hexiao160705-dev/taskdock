import { translations } from "./translations.js";
let language = "en";
try {
  language =
    localStorage.getItem("taskdock-language") === "zh-CN" ? "zh-CN" : "en";
} catch {}
export const locale = () => language;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = new RegExp(
  Object.keys(translations)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|"),
  "g",
);
// Call only for authored interface literals, never user values or API payloads.
export function ui(fragment) {
  return language === "zh-CN"
    ? fragment
    : fragment.replace(pattern, (phrase) => translations[phrase]);
}
export function httpError(status, detail) {
  const english = {
    400: "Invalid request",
    401: "Authentication required",
    403: "Access denied",
    404: "Not found",
    409: "Conflict: refresh or check release prerequisites",
    413: "Request too large",
    422: "Check required fields and values",
    500: "Service error",
    503: "Service unavailable",
  };
  const label =
    language === "en" ? english[status] || "Request failed" : "请求未完成";
  return `${label} (HTTP ${status}). ${detail || ""}`;
}
function applyChrome() {
  document.documentElement.lang = language;
  document.title = ui(document.title);
  for (const el of document.querySelectorAll("[data-i18n-text]"))
    el.textContent = ui(el.dataset.i18nText);
  for (const attr of ["aria-label", "placeholder", "title"])
    for (const el of document.querySelectorAll(`[data-i18n-${attr}]`))
      el.setAttribute(attr, ui(el.getAttribute(`data-i18n-${attr}`)));
  const toggle = document.querySelector("#locale-toggle");
  if (toggle) {
    toggle.textContent = language === "en" ? "简体中文" : "English";
    toggle.setAttribute(
      "aria-label",
      language === "en" ? "Switch to Simplified Chinese" : "切换至英文",
    );
    // Modal forms must be closed explicitly before changing the page language.
    toggle.addEventListener("click", () => {
      if (document.querySelector("dialog[open]")) return;
      language = language === "en" ? "zh-CN" : "en";
      try {
        localStorage.setItem("taskdock-language", language);
      } catch {}
      location.reload();
    });
  }
}
applyChrome();
