import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
// Prints locations and categories, never matched credentials or identifiers.
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const files = git("ls-files", "-z").split("\0").filter(Boolean);
const findings = [];
const rules = [
  ["home-directory", /\/(?:Users|home)\/[^\s/"'<>]+/g],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  [
    "provider-key",
    /\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{24,}|AKIA[A-Z0-9]{16}|LTAI[A-Za-z0-9]{16,}|AKLT[A-Za-z0-9]{16,})/g,
  ],
  ["hardware-address", /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi],
];
for (const file of files) {
  if (
    file
      .split("/")
      .some((x) =>
        [
          ".data",
          "backups",
          "output",
          ".playwright-cli",
          "node_modules",
        ].includes(x),
      ) ||
    (file.startsWith(".env") && file !== ".env.example")
  )
    findings.push({ file, category: "private-artifact" });
  const source = readFileSync(file, "utf8");
  for (const [category, pattern] of rules)
    for (const m of source.matchAll(pattern))
      findings.push({
        file,
        category,
        line: source.slice(0, m.index).split("\n").length,
      });
  for (const m of source.matchAll(
    /[A-Za-z0-9_.+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
  ))
    if (
      ![
        "example.com",
        "example.org",
        "example.net",
        "users.noreply.github.com",
      ].includes(m[1])
    )
      findings.push({
        file,
        category: "email-review",
        line: source.slice(0, m.index).split("\n").length,
      });
}
if (process.argv.includes("--history")) {
  const commits = git("log", "--all", "--format=%H%x00%ae%x00%ce")
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const row of commits) {
    const [commit, ...emails] = row.split("\0");
    if (emails.some((e) => !e.endsWith("@users.noreply.github.com")))
      findings.push({ commit, category: "commit-email-review" });
  }
  const objects = git("rev-list", "--objects", "--all").trim().split("\n");
  for (const row of objects) {
    const split = row.indexOf(" ");
    if (split < 0) continue;
    const object = row.slice(0, split),
      file = row.slice(split + 1);
    if (git("cat-file", "-t", object).trim() !== "blob") continue;
    if (
      file
        .split("/")
        .some((x) =>
          [
            ".data",
            "backups",
            "output",
            ".playwright-cli",
            "node_modules",
          ].includes(x),
        ) ||
      (file.startsWith(".env") && file !== ".env.example")
    )
      findings.push({ file, object, category: "history-private-artifact" });
    const source = git("cat-file", "blob", object);
    for (const [category, pattern] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(source))
        findings.push({ file, object, category: "history-" + category });
    }
    for (const m of source.matchAll(
      /[A-Za-z0-9_.+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    ))
      if (
        ![
          "example.com",
          "example.org",
          "example.net",
          "users.noreply.github.com",
        ].includes(m[1])
      )
        findings.push({ file, object, category: "history-email-review" });
  }
}
console.log(
  JSON.stringify(
    {
      files: files.length,
      findings,
      scope: process.argv.includes("--history")
        ? "tracked files plus all reachable historical blobs and commit email metadata"
        : "tracked working files only; history requires --history",
      limitations:
        "Heuristic check, not a complete secret scanner. Review identifiers, history and public artifacts separately.",
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;
