import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The operational CLI intentionally remains a plain Node.js module.
import * as backupTools from "../../scripts/backup-restore.mjs";

const {
  BACKUP_FORMAT,
  CONSISTENCY_WARNING,
  createBackup,
  parseCliArguments,
  resolveDatabasePath,
  restoreBackup,
  verifyBackup,
} = backupTools;

const temporaryDirectories: string[] = [];

async function makeWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "sontube-backup-test-"));
  temporaryDirectories.push(root);
  const schemaPath = path.join(root, "prisma", "schema.prisma");
  const databasePath = path.join(root, "prisma", "dev.db");
  const uploadsDirectory = path.join(root, "public", "uploads", "thumbnails");
  await mkdir(path.dirname(schemaPath), { recursive: true });
  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(schemaPath, "datasource db { provider = \"sqlite\" url = env(\"DATABASE_URL\") }\n");
  return { root, schemaPath, databasePath, uploadsDirectory };
}

function createTestDatabase(databasePath: string, value: string) {
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE sample (value TEXT NOT NULL)");
  database.prepare("INSERT INTO sample (value) VALUES (?)").run(value);
  database.close();
}

function readTestDatabase(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare("SELECT value FROM sample").get()?.value;
  } finally {
    database.close();
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("resolveDatabasePath", () => {
  it("resolves a relative Prisma file URL from the schema directory", () => {
    const schemaPath = path.join("C:\\service", "prisma", "schema.prisma");
    expect(resolveDatabasePath("file:./dev.db", schemaPath)).toBe(
      path.resolve(path.dirname(schemaPath), "dev.db"),
    );
  });

  it("rejects network databases, non-file URLs, and URL query data", () => {
    expect(() => resolveDatabasePath("postgresql://localhost/sontube")).toThrow(
      "SQLite file: URL",
    );
    expect(() => resolveDatabasePath("file://server/share/sontube.db")).toThrow(
      "Network",
    );
    expect(() => resolveDatabasePath("file:./dev.db?mode=ro")).toThrow(
      "without query",
    );
  });
});

describe("backup CLI arguments", () => {
  it("accepts positional paths used by npm scripts and retains direct named options", () => {
    expect(parseCliArguments(["backup", "C:/backups/one"])).toMatchObject({
      command: "backup",
      output: "C:/backups/one",
    });
    expect(
      parseCliArguments(["restore", "--archive", "C:/backups/one", "--force"]),
    ).toMatchObject({
      command: "restore",
      archive: "C:/backups/one",
      force: true,
    });
  });
});

describe("SonTube operational backup", () => {
  it("creates and verifies a VACUUM snapshot, thumbnails, checksums, and warning", async () => {
    const workspace = await makeWorkspace();
    createTestDatabase(workspace.databasePath, "before");
    await writeFile(path.join(workspace.uploadsDirectory, "first.webp"), "thumbnail-one");
    await mkdir(path.join(workspace.uploadsDirectory, "nested"));
    await writeFile(
      path.join(workspace.uploadsDirectory, "nested", "second.png"),
      "thumbnail-two",
    );
    const outputDirectory = path.join(workspace.root, "backups", "2026-08-30");

    const result = await createBackup({
      outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
      now: () => new Date("2026-08-30T01:02:03.000Z"),
    });
    const verified = await verifyBackup({ archiveDirectory: outputDirectory });

    expect(result.manifest.format).toBe(BACKUP_FORMAT);
    expect(result.manifest.createdAt).toBe("2026-08-30T01:02:03.000Z");
    expect(result.manifest.consistency).toMatchObject({
      databaseSnapshot: "SQLite VACUUM INTO",
      maintenanceModeRequired: true,
      warning: CONSISTENCY_WARNING,
    });
    expect(verified.thumbnailFiles.map((file: { uploadRelativePath: string }) => file.uploadRelativePath)).toEqual([
      "first.webp",
      "nested/second.png",
    ]);
    expect(readTestDatabase(verified.databasePath)).toBe("before");

    const manifestText = await readFile(path.join(outputDirectory, "manifest.json"), "utf8");
    expect(manifestText).not.toContain("DATABASE_URL");
    expect(manifestText).not.toContain(workspace.databasePath);
    expect(manifestText).not.toContain("SESSION_SECRET");
  });

  it("supports dry-run and refuses to overwrite a backup directory", async () => {
    const workspace = await makeWorkspace();
    createTestDatabase(workspace.databasePath, "before");
    const outputDirectory = path.join(workspace.root, "backup");

    const plan = await createBackup({
      outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
      dryRun: true,
    });
    expect(plan).toMatchObject({ dryRun: true, thumbnailCount: 0 });
    await expect(readFile(path.join(outputDirectory, "manifest.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    await createBackup({
      outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
    });
    await expect(
      createBackup({
        outputDirectory,
        databaseUrl: "file:./dev.db",
        schemaPath: workspace.schemaPath,
        uploadsDirectory: workspace.uploadsDirectory,
      }),
    ).rejects.toThrow("will not be overwritten");
  });

  it("detects a modified archive file", async () => {
    const workspace = await makeWorkspace();
    createTestDatabase(workspace.databasePath, "before");
    await writeFile(path.join(workspace.uploadsDirectory, "thumb.png"), "original");
    const outputDirectory = path.join(workspace.root, "backup");
    await createBackup({
      outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
    });

    await writeFile(path.join(outputDirectory, "data", "thumbnails", "thumb.png"), "tampered");
    await expect(verifyBackup({ archiveDirectory: outputDirectory })).rejects.toThrow(
      /size does not match|checksum does not match/,
    );
  });

  it("keeps existing targets by default and restores only with force", async () => {
    const workspace = await makeWorkspace();
    createTestDatabase(workspace.databasePath, "backed-up");
    await writeFile(path.join(workspace.uploadsDirectory, "kept.webp"), "kept-thumbnail");
    const outputDirectory = path.join(workspace.root, "backup");
    await createBackup({
      outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
    });

    await rm(workspace.databasePath);
    createTestDatabase(workspace.databasePath, "current");
    await rm(workspace.uploadsDirectory, { recursive: true });
    await mkdir(workspace.uploadsDirectory, { recursive: true });
    await writeFile(path.join(workspace.uploadsDirectory, "stale.webp"), "stale-thumbnail");

    const dryRun = await restoreBackup({
      archiveDirectory: outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
      dryRun: true,
    });
    expect(dryRun).toMatchObject({ dryRun: true, wouldOverwrite: true });
    expect(readTestDatabase(workspace.databasePath)).toBe("current");

    await expect(
      restoreBackup({
        archiveDirectory: outputDirectory,
        databaseUrl: "file:./dev.db",
        schemaPath: workspace.schemaPath,
        uploadsDirectory: workspace.uploadsDirectory,
      }),
    ).rejects.toThrow("--force");
    expect(readTestDatabase(workspace.databasePath)).toBe("current");

    await restoreBackup({
      archiveDirectory: outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
      force: true,
    });
    expect(readTestDatabase(workspace.databasePath)).toBe("backed-up");
    expect(await readFile(path.join(workspace.uploadsDirectory, "kept.webp"), "utf8")).toBe(
      "kept-thumbnail",
    );
    await expect(
      readFile(path.join(workspace.uploadsDirectory, "stale.webp")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects archive path traversal before restoring", async () => {
    const workspace = await makeWorkspace();
    createTestDatabase(workspace.databasePath, "before");
    await writeFile(path.join(workspace.uploadsDirectory, "thumb.png"), "thumbnail");
    const outputDirectory = path.join(workspace.root, "backup");
    await createBackup({
      outputDirectory,
      databaseUrl: "file:./dev.db",
      schemaPath: workspace.schemaPath,
      uploadsDirectory: workspace.uploadsDirectory,
    });

    const manifestPath = path.join(outputDirectory, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.thumbnails.files[0].path = "data/thumbnails/../../outside";
    await writeFile(manifestPath, JSON.stringify(manifest));

    await expect(verifyBackup({ archiveDirectory: outputDirectory })).rejects.toThrow(
      "safe archive-relative path",
    );
  });
});
