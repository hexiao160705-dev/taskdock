import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

// Optional headed-browser checks. The runtime and npm test do not require this CLI.
const allowed = [
  "ui-prepare",
  "ui-resume",
  "ui-compose",
  "ui-finish-composition",
  "ui-layout",
];
const name = process.argv[2];
if (!allowed.includes(name)) throw new Error(`Choose ${allowed.join(", ")}`);
const wrapper =
  process.env.PLAYWRIGHT_CLI ||
  path.join(homedir(), ".codex/skills/playwright/scripts/playwright_cli.sh");
const callback = readFileSync(`scripts/${name}.js`, "utf8")
  .trim()
  .replace(/;\s*$/, "");
const result = spawnSync(wrapper, ["-s=taskdock-v02", "run-code", callback], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
const match = result.stdout?.match(/### Result\n([\s\S]*?)\n### Ran/);
if (result.status !== 0 || !match) {
  console.error(
    (
      result.stdout ||
      result.stderr ||
      result.error?.message ||
      "Browser check failed"
    ).slice(0, 3000),
  );
  process.exitCode = 1;
} else {
  const data = JSON.parse(match[1]);
  mkdirSync("output/taskdock-0.2", { recursive: true });
  writeFileSync(
    `output/taskdock-0.2/${name}.json`,
    JSON.stringify(data, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      name === "ui-layout"
        ? { pages: data.pages.length, modal: data.modal, errors: data.errors }
        : data,
    ),
  );
}
