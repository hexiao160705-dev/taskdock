import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, cpSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";
const root = path.resolve(process.env.TASKDOCK_DATA_DIR || ".data"),
  stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const dest = path.resolve("backups", stamp);
mkdirSync(dest, { recursive: true, mode: 0o700 });
// Online SQLite backup is consistent with WAL. Request files are copied separately;
// stop services for a fully coordinated database-and-filesystem restore point.
for (const name of ["local.sqlite", "registry.sqlite"])
  if (existsSync(path.join(root, name))) {
    const db = new DatabaseSync(path.join(root, name));
    try {
      await backup(db, path.join(dest, name));
      chmodSync(path.join(dest, name), 0o600);
    } finally {
      db.close();
    }
  }
if (existsSync(path.join(root, "tasks")))
  cpSync(path.join(root, "tasks"), path.join(dest, "tasks"), {
    recursive: true,
    preserveTimestamps: true,
  });
console.log(
  `Backup: ${dest}\nSQLite snapshots completed. For a coordinated file/database restore point, stop both services before backup.`,
);
