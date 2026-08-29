import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageName = "com.sontube.client";
const sourceDirectory = join(
  root,
  "android-client",
  "app",
  "src",
  "main",
  "java",
  ...packageName.split("."),
);
const testDirectory = join(root, "android-client", "tools");
const buildParent = join(root, "android-client", "app", "build");
const policyClasses = [
  "NavigationPolicy",
  "WebViewLoadState",
  "StartupPolicy",
  "RuntimeNetworkGuard",
];
const smokeTests = policyClasses.map((className) => `${className}SmokeTest`);

mkdirSync(buildParent, { recursive: true });
const buildDirectory = mkdtempSync(join(buildParent, "logic-smoke-"));

const executable = (name) => {
  const filename = process.platform === "win32" ? `${name}.exe` : name;
  return process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", filename)
    : filename;
};

function run(label, command, arguments_) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, arguments_, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

try {
  const sourceFiles = policyClasses.map((className) =>
    join(sourceDirectory, `${className}.java`),
  );
  const testFiles = smokeTests.map((className) =>
    join(testDirectory, `${className}.java`),
  );

  run("Compile Android policy logic", executable("javac"), [
    "-encoding",
    "UTF-8",
    "-d",
    buildDirectory,
    ...sourceFiles,
    ...testFiles,
  ]);

  for (const testClass of smokeTests) {
    run(
      `Run ${testClass}`,
      executable("java"),
      ["-cp", buildDirectory, `${packageName}.${testClass}`],
    );
  }

  console.log("\nAndroid policy logic verification passed.");
} catch (error) {
  console.error(`\nAndroid policy logic verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    rmSync(buildDirectory, { force: true, recursive: true, maxRetries: 3 });
  } catch (error) {
    console.error(`Failed to remove temporary build directory: ${error.message}`);
    process.exitCode = 1;
  }
}
