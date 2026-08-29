import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error("Prisma migration process could not start:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    "Database migration failed. For an existing database without Prisma history, follow docs/MANUAL_PAYMENT_OPERATION.md after creating a backup.",
  );
  process.exit(result.status ?? 1);
}