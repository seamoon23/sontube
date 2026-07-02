import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = join(root, "prisma", "dev.db");

const first = run("npx", ["prisma", "db", "push"], { stdio: "inherit" });
if (first.status === 0) {
  process.exit(0);
}

console.warn("prisma db push failed; applying Prisma-generated SQLite SQL as a local fallback.");
mkdirSync(dirname(dbPath), { recursive: true });

if (existsSync(dbPath)) {
  const upgradeSql = `
ALTER TABLE "Video" ADD COLUMN "searchKeywords" TEXT;
ALTER TABLE "Video" ADD COLUMN "isParentRecommended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Video" ADD COLUMN "parentRecommendedAt" DATETIME;
`;
  const upgrade = run("sqlite3", [dbPath], {
    input: upgradeSql,
    stdio: ["pipe", "inherit", "pipe"],
  });

  if (upgrade.status === 0) {
    console.warn(`Existing database upgraded: ${dbPath}`);
    process.exit(0);
  }

  const stderr = upgrade.stderr?.toString() ?? "";
  if (stderr.includes("duplicate column name")) {
    console.warn(`Existing database already has the latest additive columns: ${dbPath}`);
    process.exit(0);
  }

  console.error(stderr);
  process.exit(upgrade.status ?? 1);
}

const diff = run("npx", [
  "prisma",
  "migrate",
  "diff",
  "--from-empty",
  "--to-schema-datamodel",
  "prisma/schema.prisma",
  "--script",
]);

if (diff.status !== 0 || !diff.stdout) {
  process.exit(diff.status ?? 1);
}

const sqlite = run("sqlite3", [dbPath], {
  input: diff.stdout,
  stdio: ["pipe", "inherit", "inherit"],
});

process.exit(sqlite.status ?? 1);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
}
