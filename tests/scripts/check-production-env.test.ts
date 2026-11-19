import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/check-production-env.mjs");
const sensitiveMarker = "do-not-print-this-secret-marker";

describe("production environment preflight", () => {
  it("allows free operation without payment settings or Lite operators", () => {
    const env = validEnvironment();
    delete env.ADMIN_ALLOWED_EMAILS;
    for (const name of Object.keys(env)) if (name.startsWith("PAYMENT_")) delete env[name];
    expect(runPreflight(env).status).toBe(0);
  });
  it("passes a production configuration without printing values", () => {
    const result = runPreflight(validEnvironment());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("preflight passed");
    expect(`${result.stdout}${result.stderr}`).not.toContain(sensitiveMarker);
  });

  it("reports missing and placeholder settings by name only", () => {
    const env = validEnvironment();
    delete env.SESSION_SECRET;
    env.SUPERADMIN_SESSION_SECRET = "replace-with-a-secret";

    const result = runPreflight(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SESSION_SECRET: is required");
    expect(result.stderr).toContain("SUPERADMIN_SESSION_SECRET: still looks like a placeholder");
    expect(`${result.stdout}${result.stderr}`).not.toContain(sensitiveMarker);
  });

  it.each([
    ["https://database.invalid/sontube", "must be a SQLite file URL"],
    ["file:./production.db", "host-mounted persistent volume"],
    ["file:/tmp/sontube.db", "ephemeral or build directory"],
  ])("rejects unsafe DATABASE_URL %s", (databaseUrl, expectedMessage) => {
    const result = runPreflight({ ...validEnvironment(), DATABASE_URL: databaseUrl });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL:");
    expect(result.stderr).toContain(expectedMessage);
  });

  it("requires exactly two distinct allowed parent emails", () => {
    const result = runPreflight({
      ...validEnvironment(),
      ADMIN_ALLOWED_EMAILS: "one@sontube.test",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "ADMIN_ALLOWED_EMAILS: must contain exactly two distinct valid emails",
    );
  });

  it("allows bootstrap credentials to be omitted together but rejects a partial pair", () => {
    const withoutBootstrap = validEnvironment();
    delete withoutBootstrap.ADMIN_PASSWORD_HASH;
    delete withoutBootstrap.PARENT_BOOTSTRAP_EMAIL;

    expect(runPreflight(withoutBootstrap).status).toBe(0);

    const partialBootstrap = validEnvironment();
    delete partialBootstrap.PARENT_BOOTSTRAP_EMAIL;

    const result = runPreflight(partialBootstrap);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "ADMIN_PASSWORD_HASH/PARENT_BOOTSTRAP_EMAIL: must either both be set",
    );
  });
});

function runPreflight(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
  });
}

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: "production",
    DATABASE_URL: "file:/var/lib/sontube/sontube.db",
    SESSION_SECRET: `${sensitiveMarker}-parent-session-key-long-enough`,
    ADMIN_ALLOWED_EMAILS: "one@sontube.test,two@sontube.test",
    ADMIN_PASSWORD_HASH: "a".repeat(64),
    PARENT_BOOTSTRAP_EMAIL: "one@sontube.test",
    SUPERADMIN_LOGIN_ID: "sontube-operator",
    SUPERADMIN_PASSWORD_HASH: "b".repeat(64),
    SUPERADMIN_SESSION_SECRET: `${sensitiveMarker}-owner-session-key-long-enough`,
    PAYMENT_BUSINESS_NAME: "SonTube Operator",
    PAYMENT_BUSINESS_NUMBER: "000-00-00000",
    PAYMENT_BANK_NAME: "Test Bank",
    PAYMENT_ACCOUNT_NUMBER: "000000000000",
    PAYMENT_ACCOUNT_HOLDER: "SonTube Operator",
    PAYMENT_SUPPORT_CONTACT: "support@sontube.test",
  };
}
