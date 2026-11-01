import { parse } from "acorn";
import { readFileSync } from "node:fs";
import { translations } from "../../public/translations.js";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = new RegExp(
  Object.keys(translations)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|"),
  "g",
);
const translate = (s) => s.replace(pattern, (p) => translations[p]);
const missing = [];
let checked = 0;
function check(s) {
  checked++;
  const out = translate(s);
  if (/\p{Script=Han}/u.test(out)) missing.push(out);
}
function visit(n) {
  if (!n || typeof n !== "object") return;
  if (
    n.type === "CallExpression" &&
    n.callee.name === "ui" &&
    n.arguments[0]?.type === "Literal"
  )
    check(n.arguments[0].value);
  for (const v of Object.values(n))
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") visit(v);
}
for (const file of ["public/app.js", "public/registry.js"])
  visit(
    parse(readFileSync(file, "utf8"), {
      ecmaVersion: "latest",
      sourceType: "module",
    }),
  );
for (const file of ["public/index.html", "public/registry.html"])
  for (const m of readFileSync(file, "utf8").matchAll(
    /data-i18n-(?:text|aria-label|placeholder)="([^"]*)"/g,
  ))
    check(m[1]);
console.log(JSON.stringify({ checked, missing }, null, 2));
if (missing.length) process.exitCode = 1;
