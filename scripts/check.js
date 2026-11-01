import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const dirs = ["src", "public", "scripts", "test"];
let count = 0;
for (const dir of dirs)
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".js")) {
      execFileSync(process.execPath, ["--check", `${dir}/${name}`], {
        stdio: "pipe",
      });
      count++;
    }
  }
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (!readFileSync("docs/INDEX.md", "utf8").includes(packageJson.version))
  throw new Error("Update release index when version changes");
console.log(
  `${count} JavaScript files passed syntax checks; release version ${packageJson.version}.`,
);
