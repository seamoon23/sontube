import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const databaseFilename = `verify-web-${process.pid}.db`;
const databasePath = join(root, "prisma", databaseFilename);
const databaseUrl = `file:./${databaseFilename}`;
const npmExecutable = process.env.npm_execpath
  ? process.execPath
  : process.platform === "win32"
    ? "npm.cmd"
    : "npm";
const npmPrefixArguments = process.env.npm_execpath
  ? [process.env.npm_execpath]
  : [];
const prismaCliPath = join(root, "node_modules", "prisma", "build", "index.js");
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NEXT_TELEMETRY_DISABLED: "1",
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1",
  SESSION_SECRET:
    process.env.SESSION_SECRET ??
    "ci-only-parent-session-secret-do-not-use-in-production",
  ADMIN_ALLOWED_EMAILS:
    process.env.ADMIN_ALLOWED_EMAILS ??
    "ci-parent@example.com,ci-partner@example.com",
  SUPERADMIN_LOGIN_ID: process.env.SUPERADMIN_LOGIN_ID ?? "ci-owner",
  SUPERADMIN_SESSION_SECRET:
    process.env.SUPERADMIN_SESSION_SECRET ??
    "ci-only-superadmin-session-secret-do-not-use-in-production",
};

// In this Windows environment Prisma 6 can exit without diagnostics while
// creating a fresh SQLite database. Commands are explicitly non-interactive,
// so local CI/engine overrides can be removed in favor of the installed engine.
if (process.platform === "win32") {
  delete environment.CI;
  delete environment.PRISMA_SCHEMA_ENGINE_BINARY;
  delete environment.PRISMA_QUERY_ENGINE_BINARY;
  delete environment.PRISMA_QUERY_ENGINE_LIBRARY;
  // Info logging avoids that silent startup path and preserves useful details
  // if all bounded retries still fail.
  environment.RUST_LOG = process.env.RUST_LOG || "info";
}

const steps = [
  [
    "Apply migrations to temporary SQLite database",
    process.execPath,
    [prismaCliPath, "migrate", "deploy"],
    process.platform === "win32" ? 3 : 1,
  ],
  ["Generate Prisma client", process.execPath, [prismaCliPath, "generate"], 1],
  ["Validate Prisma schema", process.execPath, [prismaCliPath, "validate"], 1],
  ["Type-check", npmExecutable, [...npmPrefixArguments, "run", "typecheck"]],
  ["Lint", npmExecutable, [...npmPrefixArguments, "run", "lint"]],
  ["Run unit tests", npmExecutable, [...npmPrefixArguments, "test"]],
  [
    "Build Next.js application",
    npmExecutable,
    [...npmPrefixArguments, "run", "build"],
  ],
];

try {
  // Pre-create the unique SQLite file. On some Windows machines Prisma's
  // schema engine intermittently fails before creating a brand-new file.
  // SQLite safely initializes this empty file when migrations begin.
  writeFileSync(databasePath, "", { flag: "wx" });
  console.log(`Using temporary database: ${databaseUrl}`);

  for (const [label, executable, arguments_, configuredAttempts] of steps) {
    console.log(`\n==> ${label}`);
    const maxAttempts = configuredAttempts ?? 1;
    let result;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      result = spawnSync(executable, arguments_, {
        cwd: root,
        env: environment,
        shell:
          process.platform === "win32" &&
          executable.toLowerCase().endsWith(".cmd"),
        stdio: "inherit",
      });

      if (!result.error && result.status === 0) break;
      if (attempt < maxAttempts) {
        console.warn(`${label} failed; retrying (${attempt + 1}/${maxAttempts})...`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500 * attempt);
      }
    }

    if (result.error) {
      throw new Error(`${label} could not start: ${result.error.message}`);
    }

    if (result.status !== 0) {
      throw new Error(
        `${label} failed with exit code ${result.status ?? "unknown"}.`,
      );
    }
  }

  console.log("\nWeb verification passed.");
} catch (error) {
  console.error(`\nWeb verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}
