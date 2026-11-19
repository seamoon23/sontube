const REQUIRED_ENV_NAMES = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "SUPERADMIN_LOGIN_ID",
  "SUPERADMIN_PASSWORD_HASH",
  "SUPERADMIN_SESSION_SECRET",
];

const PLACEHOLDER_FRAGMENTS = [
  "change-me",
  "changeme",
  "example.com",
  "replace-with",
  "your-",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const HEX_HASH_PATTERN = /^[a-f0-9]{64}$/iu;

export function inspectProductionEnvironment(env) {
  const issues = [];

  if (env.NODE_ENV !== "production") {
    issues.push(error("NODE_ENV", "must be production"));
  }

  for (const name of REQUIRED_ENV_NAMES) {
    const value = clean(env[name]);
    if (!value) {
      issues.push(error(name, "is required"));
      continue;
    }

    if (looksLikePlaceholder(value)) {
      issues.push(error(name, "still looks like a placeholder"));
    }
  }

  inspectSqliteUrl(clean(env.DATABASE_URL), issues);
  inspectSecret("SESSION_SECRET", clean(env.SESSION_SECRET), issues);
  inspectSecret("SUPERADMIN_SESSION_SECRET", clean(env.SUPERADMIN_SESSION_SECRET), issues);

  if (
    clean(env.SESSION_SECRET) &&
    clean(env.SESSION_SECRET) === clean(env.SUPERADMIN_SESSION_SECRET)
  ) {
    issues.push(error("SUPERADMIN_SESSION_SECRET", "must differ from SESSION_SECRET"));
  }

  inspectAllowedEmails(clean(env.ADMIN_ALLOWED_EMAILS), issues);
  inspectHash("SUPERADMIN_PASSWORD_HASH", clean(env.SUPERADMIN_PASSWORD_HASH), issues);
  inspectBootstrapEnvironment(env, issues);

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    checkedCount: REQUIRED_ENV_NAMES.length + 1,
    issues,
  };
}

function inspectSqliteUrl(databaseUrl, issues) {
  if (!databaseUrl) {
    return;
  }

  if (!databaseUrl.startsWith("file:")) {
    issues.push(error("DATABASE_URL", "must be a SQLite file URL"));
    return;
  }

  const location = databaseUrl.slice("file:".length);
  if (!location || location.includes("?") || location.includes("#")) {
    issues.push(error("DATABASE_URL", "is not a valid SQLite file URL"));
    return;
  }

  if (/^:memory:$/iu.test(location)) {
    issues.push(error("DATABASE_URL", "cannot use an in-memory database in production"));
    return;
  }

  const normalizedLocation = location.replaceAll("\\", "/");
  const isUnixAbsolute = normalizedLocation.startsWith("/");
  const isWindowsAbsolute = /^[a-z]:\//iu.test(normalizedLocation);
  const isUncAbsolute = normalizedLocation.startsWith("//");

  if (!isUnixAbsolute && !isWindowsAbsolute && !isUncAbsolute) {
    issues.push(
      error(
        "DATABASE_URL",
        "must use an absolute path on a host-mounted persistent volume",
      ),
    );
    return;
  }

  const lowerLocation = normalizedLocation.toLowerCase();
  if (
    /(^|\/)tmp(\/|$)/u.test(lowerLocation) ||
    /(^|\/)temp(\/|$)/u.test(lowerLocation) ||
    /(^|\/)\.next(\/|$)/u.test(lowerLocation) ||
    /(^|\/)node_modules(\/|$)/u.test(lowerLocation)
  ) {
    issues.push(error("DATABASE_URL", "points to an ephemeral or build directory"));
  }
}

function inspectSecret(name, value, issues) {
  if (value && value.length < 32) {
    issues.push(error(name, "must contain at least 32 characters"));
  }
}

function inspectAllowedEmails(raw, issues) {
  if (!raw) {
    return;
  }
  if (looksLikePlaceholder(raw)) {
    issues.push(error("ADMIN_ALLOWED_EMAILS", "still looks like a placeholder"));
  }

  const emails = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (
    emails.length !== 2 ||
    new Set(emails).size !== 2 ||
    emails.some((email) => email.length > 320 || !EMAIL_PATTERN.test(email))
  ) {
    issues.push(error("ADMIN_ALLOWED_EMAILS", "must contain exactly two distinct valid emails"));
  }
}

function inspectHash(name, value, issues) {
  if (value && !HEX_HASH_PATTERN.test(value)) {
    issues.push(error(name, "must be a 64-character hexadecimal password hash"));
  }
}

function inspectBootstrapEnvironment(env, issues) {
  const passwordHash = clean(env.ADMIN_PASSWORD_HASH);
  const bootstrapEmail = clean(env.PARENT_BOOTSTRAP_EMAIL).toLowerCase();

  if (Boolean(passwordHash) !== Boolean(bootstrapEmail)) {
    issues.push(
      error(
        "ADMIN_PASSWORD_HASH/PARENT_BOOTSTRAP_EMAIL",
        "must either both be set for bootstrap or both be omitted after bootstrap",
      ),
    );
  }

  inspectHash("ADMIN_PASSWORD_HASH", passwordHash, issues);

  if (bootstrapEmail) {
    if (!EMAIL_PATTERN.test(bootstrapEmail)) {
      issues.push(
        error(
          "PARENT_BOOTSTRAP_EMAIL",
          "must be a valid email",
        ),
      );
    }
  }
}

function looksLikePlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return (
    PLACEHOLDER_FRAGMENTS.some((fragment) => normalized.includes(fragment)) ||
    normalized.startsWith("<") ||
    normalized.endsWith(">") ||
    normalized === "owner" ||
    normalized === "password" ||
    normalized === "secret"
  );
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function error(name, message) {
  return { level: "error", name, message };
}

function run() {
  const result = inspectProductionEnvironment(process.env);

  if (result.ok) {
    console.log(
      `SonTube production environment preflight passed (${result.checkedCount} settings checked; values hidden).`,
    );
    return;
  }

  console.error("SonTube production environment preflight failed (values hidden):");
  for (const issue of result.issues) {
    console.error(`- ${issue.name}: ${issue.message}`);
  }
  process.exitCode = 1;
}

run();
