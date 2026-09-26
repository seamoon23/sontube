import { createHash, randomBytes } from "node:crypto";
import {
  constants as fsConstants,
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  lstat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BACKUP_FORMAT = "sontube-operational-backup";
export const BACKUP_VERSION = 1;
export const CONSISTENCY_WARNING =
  "Run backups and restores with SonTube application writes paused. The tool detects thumbnail changes during the backup window, but it cannot lock application file uploads.";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.dirname(scriptDirectory);
export const defaultSchemaPath = path.join(projectRoot, "prisma", "schema.prisma");
export const defaultUploadsPath = path.join(
  projectRoot,
  "public",
  "uploads",
  "thumbnails",
);

function fail(message) {
  throw new Error(message);
}

function isPathInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function pathsOverlap(left, right) {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return (
    resolvedLeft === resolvedRight ||
    isPathInside(resolvedLeft, resolvedRight) ||
    isPathInside(resolvedRight, resolvedLeft)
  );
}

function assertNotFilesystemRoot(target, label) {
  const resolved = path.resolve(target);
  if (resolved === path.parse(resolved).root) {
    fail(`${label} must not be a filesystem root.`);
  }
  return resolved;
}

function decodeFilePath(rawPath) {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    fail("DATABASE_URL contains invalid percent encoding.");
  }
}

/**
 * Prisma resolves relative SQLite file URLs from the directory containing
 * schema.prisma, not from process.cwd().
 */
export function resolveDatabasePath(databaseUrl, schemaPath = defaultSchemaPath) {
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:")) {
    fail("DATABASE_URL must be a SQLite file: URL.");
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath || rawPath.includes("\0") || rawPath.includes("?") || rawPath.includes("#")) {
    fail("DATABASE_URL must contain a plain SQLite file path without query or fragment data.");
  }

  if (rawPath.startsWith("//")) {
    fail("Network and authority-based file URLs are not supported for DATABASE_URL.");
  }

  let decodedPath = decodeFilePath(rawPath);
  if (process.platform === "win32" && /^\/[A-Za-z]:[\\/]/.test(decodedPath)) {
    decodedPath = decodedPath.slice(1);
  }

  const resolved = path.isAbsolute(decodedPath)
    ? path.resolve(decodedPath)
    : path.resolve(path.dirname(schemaPath), decodedPath);

  assertNotFilesystemRoot(resolved, "SQLite database path");
  return resolved;
}

function normalizeArchiveRelativePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.startsWith("/") ||
    path.posix.isAbsolute(value)
  ) {
    fail(`${label} is not a safe archive-relative path.`);
  }

  const normalized = path.posix.normalize(value);
  if (
    normalized !== value ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    fail(`${label} is not a safe archive-relative path.`);
  }
  return normalized;
}

function resolveArchiveEntry(archiveDirectory, relativePath, label) {
  const normalized = normalizeArchiveRelativePath(relativePath, label);
  const resolved = path.resolve(archiveDirectory, ...normalized.split("/"));
  if (!isPathInside(resolved, archiveDirectory)) {
    fail(`${label} escapes the backup directory.`);
  }
  return resolved;
}

async function assertRegularFile(filePath, label) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(`${label} does not exist: ${filePath}`);
    }
    throw error;
  }

  if (entry.isSymbolicLink() || !entry.isFile()) {
    fail(`${label} must be a regular file and must not be a symbolic link: ${filePath}`);
  }
  return entry;
}

async function assertDirectoryIfPresent(directoryPath, label) {
  let entry;
  try {
    entry = await lstat(directoryPath);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    fail(`${label} must be a directory and must not be a symbolic link: ${directoryPath}`);
  }
  return true;
}

async function sha256(filePath) {
  const handle = await open(filePath, "r");
  const hash = createHash("sha256");
  try {
    for await (const chunk of handle.createReadStream()) {
      hash.update(chunk);
    }
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}

async function describeFile(filePath) {
  const fileStat = await assertRegularFile(filePath, "Backup file");
  return {
    size: fileStat.size,
    sha256: await sha256(filePath),
  };
}

async function scanUploadFiles(uploadsDirectory) {
  const exists = await assertDirectoryIfPresent(uploadsDirectory, "Thumbnail upload path");
  if (!exists) return [];

  const files = [];
  async function visit(currentDirectory, relativeDirectory) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const sourcePath = path.join(currentDirectory, entry.name);
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      normalizeArchiveRelativePath(relativePath, "Thumbnail path");

      if (entry.isSymbolicLink()) {
        fail(`Thumbnail uploads must not contain symbolic links: ${sourcePath}`);
      }
      if (entry.isDirectory()) {
        await visit(sourcePath, relativePath);
      } else if (entry.isFile()) {
        const description = await describeFile(sourcePath);
        files.push({ relativePath, sourcePath, ...description });
      } else {
        fail(`Thumbnail uploads contain an unsupported filesystem entry: ${sourcePath}`);
      }
    }
  }

  await visit(uploadsDirectory, "");
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function compareUploadScans(before, after) {
  if (before.length !== after.length) return false;
  return before.every((file, index) => {
    const other = after[index];
    return (
      file.relativePath === other.relativePath &&
      file.size === other.size &&
      file.sha256 === other.sha256
    );
  });
}

async function loadDatabaseSync() {
  try {
    const sqlite = await import("node:sqlite");
    return sqlite.DatabaseSync;
  } catch {
    fail("This command requires a Node.js runtime that provides node:sqlite (Node 22.5 or newer).");
  }
}

function sqliteStringLiteral(value) {
  if (value.includes("\0")) fail("SQLite target path contains a null byte.");
  return `'${value.replaceAll("'", "''")}'`;
}

async function checkSqliteIntegrity(databasePath) {
  await assertRegularFile(databasePath, "SQLite database");
  const DatabaseSync = await loadDatabaseSync();
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = database.prepare("PRAGMA quick_check").all();
    if (
      rows.length === 0 ||
      rows.some((row) => Object.values(row)[0] !== "ok")
    ) {
      fail(`SQLite integrity check failed: ${databasePath}`);
    }
  } finally {
    database.close();
  }
}

async function vacuumInto(sourcePath, destinationPath) {
  const DatabaseSync = await loadDatabaseSync();
  const database = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    database.exec("PRAGMA busy_timeout = 5000");
    database.exec(`VACUUM INTO ${sqliteStringLiteral(destinationPath)}`);
  } finally {
    database.close();
  }
}

function generatedSibling(target, kind, identifier) {
  return `${target}.sontube-${kind}-${identifier}`;
}

async function removeGeneratedPath(target, expectedParent, marker) {
  const resolved = path.resolve(target);
  if (
    path.dirname(resolved) !== path.resolve(expectedParent) ||
    !path.basename(resolved).includes(marker)
  ) {
    fail(`Refused to remove an unexpected generated path: ${resolved}`);
  }
  await rm(resolved, { recursive: true, force: true });
}

function getDatabaseUrl(explicitDatabaseUrl) {
  const value = explicitDatabaseUrl ?? process.env.DATABASE_URL;
  if (!value) fail("DATABASE_URL is required.");
  return value;
}

function validateBackupTarget(outputDirectory, databasePath, uploadsDirectory) {
  const output = assertNotFilesystemRoot(outputDirectory, "Backup output path");
  if (pathsOverlap(output, uploadsDirectory)) {
    fail("Backup output path must not overlap public/uploads/thumbnails.");
  }
  if (output === path.resolve(databasePath)) {
    fail("Backup output path must not be the SQLite database file.");
  }
  return output;
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function createBackup({
  outputDirectory,
  databaseUrl,
  schemaPath = defaultSchemaPath,
  uploadsDirectory = defaultUploadsPath,
  dryRun = false,
  now = () => new Date(),
} = {}) {
  if (!outputDirectory) fail("Backup output directory is required.");

  const databasePath = resolveDatabasePath(getDatabaseUrl(databaseUrl), schemaPath);
  const uploadsPath = assertNotFilesystemRoot(uploadsDirectory, "Thumbnail upload path");
  const outputPath = validateBackupTarget(outputDirectory, databasePath, uploadsPath);
  await assertRegularFile(databasePath, "SQLite database");
  await checkSqliteIntegrity(databasePath);
  const initialUploads = await scanUploadFiles(uploadsPath);

  if (await pathExists(outputPath)) {
    fail(`Backup output already exists and will not be overwritten: ${outputPath}`);
  }

  const plan = {
    action: "backup",
    dryRun,
    outputDirectory: outputPath,
    databasePath,
    thumbnailCount: initialUploads.length,
    consistencyWarning: CONSISTENCY_WARNING,
  };
  if (dryRun) return plan;

  const identifier = `${process.pid}-${randomBytes(6).toString("hex")}`;
  const stagingPath = generatedSibling(outputPath, "partial", identifier);
  const stagingParent = path.dirname(stagingPath);
  const databaseRelativePath = "data/database.sqlite";
  const stagedDatabase = resolveArchiveEntry(
    stagingPath,
    databaseRelativePath,
    "Database archive path",
  );

  await mkdir(path.dirname(stagedDatabase), { recursive: true });
  try {
    await vacuumInto(databasePath, stagedDatabase);
    await checkSqliteIntegrity(stagedDatabase);

    const thumbnailFiles = [];
    for (const sourceFile of initialUploads) {
      const archiveRelativePath = `data/thumbnails/${sourceFile.relativePath}`;
      const destination = resolveArchiveEntry(
        stagingPath,
        archiveRelativePath,
        "Thumbnail archive path",
      );
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(sourceFile.sourcePath, destination, fsConstants.COPYFILE_EXCL);
      const copied = await describeFile(destination);
      if (copied.size !== sourceFile.size || copied.sha256 !== sourceFile.sha256) {
        fail(`Thumbnail changed while it was copied: ${sourceFile.relativePath}`);
      }
      thumbnailFiles.push({
        path: archiveRelativePath,
        publicPath: `/uploads/thumbnails/${sourceFile.relativePath}`,
        ...copied,
      });
    }

    const finalUploads = await scanUploadFiles(uploadsPath);
    if (!compareUploadScans(initialUploads, finalUploads)) {
      fail(
        "Thumbnail uploads changed during the backup window. Pause application writes and run the backup again.",
      );
    }

    const databaseDescription = await describeFile(stagedDatabase);
    const manifest = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: now().toISOString(),
      database: {
        path: databaseRelativePath,
        ...databaseDescription,
      },
      thumbnails: {
        root: "data/thumbnails",
        count: thumbnailFiles.length,
        files: thumbnailFiles,
      },
      consistency: {
        databaseSnapshot: "SQLite VACUUM INTO",
        thumbnailCheck: "SHA-256 compared before and after the database snapshot",
        maintenanceModeRequired: true,
        warning: CONSISTENCY_WARNING,
      },
    };

    await writeFile(
      path.join(stagingPath, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await mkdir(path.dirname(outputPath), { recursive: true });
    await rename(stagingPath, outputPath);
    return { ...plan, dryRun: false, manifest };
  } catch (error) {
    await removeGeneratedPath(stagingPath, stagingParent, ".sontube-partial-");
    throw error;
  }
}

function validateDigest(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    fail(`${label} does not contain a valid SHA-256 digest.`);
  }
}

function validateSize(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(`${label} does not contain a valid file size.`);
  }
}

async function verifyManifestFile(archivePath, entry, label) {
  const filePath = resolveArchiveEntry(archivePath, entry.path, `${label} path`);
  const fileStat = await assertRegularFile(filePath, label);
  validateSize(entry.size, `${label} size`);
  validateDigest(entry.sha256, `${label} checksum`);
  if (fileStat.size !== entry.size) fail(`${label} size does not match manifest.`);
  if ((await sha256(filePath)) !== entry.sha256) {
    fail(`${label} checksum does not match manifest.`);
  }
  return filePath;
}

async function listArchiveDataFiles(archivePath) {
  const dataPath = path.join(archivePath, "data");
  if (!(await assertDirectoryIfPresent(dataPath, "Backup data path"))) return [];
  const files = [];
  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      if (entry.isSymbolicLink()) fail(`Backup data contains a symbolic link: ${absolutePath}`);
      if (entry.isDirectory()) await visit(absolutePath, relativePath);
      else if (entry.isFile()) files.push(`data/${relativePath}`);
      else fail(`Backup data contains an unsupported filesystem entry: ${absolutePath}`);
    }
  }
  await visit(dataPath, "");
  return files.sort();
}

export async function verifyBackup({ archiveDirectory } = {}) {
  if (!archiveDirectory) fail("Backup archive directory is required.");
  const archivePath = assertNotFilesystemRoot(archiveDirectory, "Backup archive path");
  const archiveExists = await assertDirectoryIfPresent(archivePath, "Backup archive path");
  if (!archiveExists) fail(`Backup archive does not exist: ${archivePath}`);

  const manifestPath = path.join(archivePath, "manifest.json");
  await assertRegularFile(manifestPath, "Backup manifest");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    fail("Backup manifest is not valid JSON.");
  }

  if (manifest?.format !== BACKUP_FORMAT || manifest?.version !== BACKUP_VERSION) {
    fail("Backup manifest format or version is not supported.");
  }
  if (!manifest.createdAt || Number.isNaN(Date.parse(manifest.createdAt))) {
    fail("Backup manifest createdAt is invalid.");
  }
  if (
    manifest?.consistency?.maintenanceModeRequired !== true ||
    manifest?.consistency?.warning !== CONSISTENCY_WARNING
  ) {
    fail("Backup manifest is missing the required consistency warning.");
  }
  if (!manifest.database || manifest.database.path !== "data/database.sqlite") {
    fail("Backup manifest database entry is invalid.");
  }
  if (
    !manifest.thumbnails ||
    manifest.thumbnails.root !== "data/thumbnails" ||
    !Array.isArray(manifest.thumbnails.files) ||
    manifest.thumbnails.count !== manifest.thumbnails.files.length
  ) {
    fail("Backup manifest thumbnail entries are invalid.");
  }

  const databasePath = await verifyManifestFile(
    archivePath,
    manifest.database,
    "Backup database",
  );
  await checkSqliteIntegrity(databasePath);

  const seenPaths = new Set([manifest.database.path]);
  const thumbnailFiles = [];
  for (const [index, entry] of manifest.thumbnails.files.entries()) {
    const label = `Backup thumbnail ${index + 1}`;
    const normalizedPath = normalizeArchiveRelativePath(entry?.path, `${label} path`);
    if (!normalizedPath.startsWith("data/thumbnails/")) {
      fail(`${label} is outside data/thumbnails.`);
    }
    const uploadRelativePath = normalizedPath.slice("data/thumbnails/".length);
    if (entry.publicPath !== `/uploads/thumbnails/${uploadRelativePath}`) {
      fail(`${label} public path does not match its archive path.`);
    }
    if (seenPaths.has(normalizedPath)) fail(`${label} is duplicated in the manifest.`);
    seenPaths.add(normalizedPath);
    thumbnailFiles.push({
      ...entry,
      path: normalizedPath,
      sourcePath: await verifyManifestFile(archivePath, entry, label),
      uploadRelativePath,
    });
  }

  const actualDataFiles = await listArchiveDataFiles(archivePath);
  const declaredDataFiles = [...seenPaths].sort();
  if (
    actualDataFiles.length !== declaredDataFiles.length ||
    actualDataFiles.some((entry, index) => entry !== declaredDataFiles[index])
  ) {
    fail("Backup data contains missing or undeclared files.");
  }

  return {
    archiveDirectory: archivePath,
    manifest,
    databasePath,
    thumbnailFiles,
  };
}

async function assertRestorableTarget(target, label, expectedType) {
  let entry;
  try {
    entry = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (entry.isSymbolicLink()) fail(`${label} must not be a symbolic link: ${target}`);
  if (expectedType === "file" && !entry.isFile()) {
    fail(`${label} must be a regular file: ${target}`);
  }
  if (expectedType === "directory" && !entry.isDirectory()) {
    fail(`${label} must be a directory: ${target}`);
  }
  return true;
}

async function restoreRollbackMoves(moves) {
  for (const move of [...moves].reverse()) {
    if (await pathExists(move.original)) {
      await rm(move.original, { recursive: true, force: true });
    }
    if (await pathExists(move.rollback)) {
      await rename(move.rollback, move.original);
    }
  }
}

export async function restoreBackup({
  archiveDirectory,
  databaseUrl,
  schemaPath = defaultSchemaPath,
  uploadsDirectory = defaultUploadsPath,
  force = false,
  dryRun = false,
} = {}) {
  const verified = await verifyBackup({ archiveDirectory });
  const databasePath = resolveDatabasePath(getDatabaseUrl(databaseUrl), schemaPath);
  const uploadsPath = assertNotFilesystemRoot(uploadsDirectory, "Thumbnail upload path");
  if (pathsOverlap(verified.archiveDirectory, databasePath)) {
    fail("Backup archive must not overlap the target SQLite database path.");
  }
  if (pathsOverlap(verified.archiveDirectory, uploadsPath)) {
    fail("Backup archive must not overlap the target thumbnail path.");
  }
  if (pathsOverlap(databasePath, uploadsPath)) {
    fail("Target SQLite database and thumbnail directory must not overlap.");
  }

  const databaseTargets = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`];
  const databaseTargetExists = (await Promise.all(
    databaseTargets.map((target) => assertRestorableTarget(target, "SQLite target", "file")),
  )).some(Boolean);
  const uploadsTargetExists = await assertRestorableTarget(
    uploadsPath,
    "Thumbnail target",
    "directory",
  );
  const wouldOverwrite = databaseTargetExists || uploadsTargetExists;

  const plan = {
    action: "restore",
    dryRun,
    force,
    archiveDirectory: verified.archiveDirectory,
    databasePath,
    uploadsDirectory: uploadsPath,
    thumbnailCount: verified.thumbnailFiles.length,
    wouldOverwrite,
    consistencyWarning: CONSISTENCY_WARNING,
  };
  if (dryRun) return plan;
  if (wouldOverwrite && !force) {
    fail("Restore target already exists. Re-run with --force only after stopping the application.");
  }

  const identifier = `${process.pid}-${randomBytes(6).toString("hex")}`;
  const stagedDatabase = generatedSibling(databasePath, "restore", `${identifier}.tmp`);
  const stagedUploads = generatedSibling(uploadsPath, "restore", `${identifier}.tmp`);
  const rollbackMoves = [];
  let placedDatabase = false;
  let placedUploads = false;

  await mkdir(path.dirname(databasePath), { recursive: true });
  await mkdir(path.dirname(uploadsPath), { recursive: true });
  try {
    await copyFile(verified.databasePath, stagedDatabase, fsConstants.COPYFILE_EXCL);
    await checkSqliteIntegrity(stagedDatabase);
    await mkdir(stagedUploads, { recursive: false });
    for (const thumbnail of verified.thumbnailFiles) {
      const destination = path.resolve(
        stagedUploads,
        ...thumbnail.uploadRelativePath.split("/"),
      );
      if (!isPathInside(destination, stagedUploads)) {
        fail("Refused an unsafe thumbnail restore path.");
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(thumbnail.sourcePath, destination, fsConstants.COPYFILE_EXCL);
      const copied = await describeFile(destination);
      if (copied.size !== thumbnail.size || copied.sha256 !== thumbnail.sha256) {
        fail(`Restored thumbnail checksum mismatch: ${thumbnail.uploadRelativePath}`);
      }
    }

    for (const original of [...databaseTargets, uploadsPath]) {
      if (!(await pathExists(original))) continue;
      const rollback = generatedSibling(original, "pre-restore", identifier);
      await rename(original, rollback);
      rollbackMoves.push({ original, rollback });
    }

    await rename(stagedDatabase, databasePath);
    placedDatabase = true;
    await rename(stagedUploads, uploadsPath);
    placedUploads = true;
  } catch (error) {
    if (placedUploads && (await pathExists(uploadsPath))) {
      await rm(uploadsPath, { recursive: true, force: true });
    }
    if (placedDatabase && (await pathExists(databasePath))) {
      await rm(databasePath, { force: true });
    }
    await restoreRollbackMoves(rollbackMoves);
    throw error;
  } finally {
    await removeGeneratedPath(
      stagedDatabase,
      path.dirname(databasePath),
      ".sontube-restore-",
    );
    await removeGeneratedPath(
      stagedUploads,
      path.dirname(uploadsPath),
      ".sontube-restore-",
    );
  }

  // Placement is now complete. Cleanup failures must never roll back to a
  // partially deleted pre-restore set; a leftover rollback copy is safer.
  const cleanupWarnings = [];
  for (const move of rollbackMoves) {
    try {
      await removeGeneratedPath(
        move.rollback,
        path.dirname(move.original),
        ".sontube-pre-restore-",
      );
    } catch {
      cleanupWarnings.push(`Remove the leftover rollback copy manually: ${move.rollback}`);
    }
  }
  return { ...plan, dryRun: false, cleanupWarnings };
}

export function parseCliArguments(argv) {
  const [rawCommand, ...args] = argv;
  const topLevelHelp = rawCommand === "--help" || rawCommand === "-h";
  const options = {
    command: topLevelHelp ? undefined : rawCommand,
    dryRun: false,
    force: false,
    help: topLevelHelp,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--force") options.force = true;
    else if (["--output", "--archive", "--database-url"].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) fail(`${argument} requires a value.`);
      options[argument.slice(2).replace("-url", "Url")] = value;
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--") {
      continue;
    } else if (!argument.startsWith("-")) {
      const positionalName = options.command === "backup" ? "output" : "archive";
      if (
        !["backup", "verify", "restore"].includes(options.command) ||
        options[positionalName]
      ) {
        fail(`Unexpected positional argument: ${argument}`);
      }
      options[positionalName] = argument;
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`SonTube operational backup and restore

Run from the SonTube project root after stopping application writes:
  node scripts/backup-restore.mjs backup <new-backup-directory> [--dry-run]
  node scripts/backup-restore.mjs verify <backup-directory>
  node scripts/backup-restore.mjs restore <backup-directory> [--dry-run] [--force]

The --output and --archive named forms are also supported for direct Node use.

DATABASE_URL is read from the environment and must be a file: URL. An explicit
--database-url file:... may be used for controlled operations. Restore never
overwrites an existing database or thumbnail directory unless --force is given.

WARNING: ${CONSISTENCY_WARNING}`);
}

async function main(argv) {
  const options = parseCliArguments(argv);
  if (options.help || !options.command) {
    printHelp();
    return options.help ? 0 : 1;
  }

  let result;
  if (options.command === "backup") {
    result = await createBackup({
      outputDirectory: options.output,
      databaseUrl: options.databaseUrl,
      dryRun: options.dryRun,
    });
  } else if (options.command === "verify") {
    if (!options.archive) fail("verify requires --archive.");
    result = await verifyBackup({ archiveDirectory: options.archive });
    result = {
      action: "verify",
      archiveDirectory: result.archiveDirectory,
      thumbnailCount: result.thumbnailFiles.length,
      createdAt: result.manifest.createdAt,
    };
  } else if (options.command === "restore") {
    result = await restoreBackup({
      archiveDirectory: options.archive,
      databaseUrl: options.databaseUrl,
      dryRun: options.dryRun,
      force: options.force,
    });
  } else {
    fail(`Unknown command: ${options.command}`);
  }

  console.log(JSON.stringify(result, null, 2));
  console.warn(`WARNING: ${CONSISTENCY_WARNING}`);
  return 0;
}

const invokedAsScript = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (invokedAsScript) {
  main(process.argv.slice(2))
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      console.error(`Backup operation failed: ${error.message}`);
      process.exitCode = 1;
    });
}
