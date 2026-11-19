import { readFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  db: undefined as unknown as import("@prisma/client").PrismaClient,
  session: { userId: "test-parent", familyId: "", email: "guest@example.com", impersonatedBy: undefined as string | undefined },
  owner: true,
}));
vi.mock("@/lib/db", () => ({ get prisma() { return state.db; } }));
vi.mock("@/lib/admin-session", () => ({ requireAdminSession: async () => state.session }));
vi.mock("@/lib/superadmin-session", () => ({ requireSuperAdminSession: async () => {
  if (!state.owner) throw new Error("unauthorized");
  return { loginId: "test-owner" };
} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

import { createVideoAction, updateVideoAction, updateTagAction } from "@/app/admin/actions";
import { createAppAccessKeyAction, disableAppAccessKeyAction } from "@/app/admin/app-keys/actions";
import { createPaymentRequestAction } from "@/app/admin/payment/actions";
import { updateFamilyVideoLimitAction } from "@/app/superadmin/actions";
import { renameChannelAction, mergeChannelAction } from "@/app/admin/channels/actions";
import { buildAppSyncResult } from "@/lib/app-sync";
import { getAppPolicyByInstallationId } from "@/lib/app-policy";
import { hashAppAccessKey } from "@/lib/app-access";

const dbPath = join(process.cwd(), "prisma", `.free-family-${process.pid}-${Date.now()}.db`);
const queries: string[] = [];
let serial = 0;
let familyId: string;
let otherFamilyId: string;
const originalAllowed = process.env.ADMIN_ALLOWED_EMAILS;

beforeAll(async () => {
  const sqlite = new DatabaseSync(dbPath);
  const directory = join(process.cwd(), "prisma", "migrations");
  const migrations = readdirSync(directory).filter((name) => /^\d/.test(name)).sort();
  for (const name of migrations.slice(0, -1)) sqlite.exec(readFileSync(join(directory, name, "migration.sql"), "utf8"));
  sqlite.exec(`INSERT INTO Family (id, name, updatedAt) VALUES ('legacy', 'Legacy', CURRENT_TIMESTAMP)`);
  for (let n = 0; n < 25; n++) {
    sqlite.prepare("INSERT INTO Video (id, familyId, youtubeVideoId, originalUrl, title, updatedAt) VALUES (?, 'legacy', ?, 'https://youtu.be/abcdefghijk', 'Legacy', CURRENT_TIMESTAMP)").run(`old-${n}`, `old-${n}`);
  }
  sqlite.exec(readFileSync(join(directory, migrations.at(-1)!, "migration.sql"), "utf8"));
  sqlite.close();
  state.db = new PrismaClient({ datasourceUrl: `file:${dbPath.replaceAll("\\", "/")}`, log: [{ emit: "event", level: "query" }] });
  state.db.$on("query" as never, ((event: { query: string }) => queries.push(event.query)) as never);
});

beforeEach(async () => {
  serial++;
  familyId = `family-${serial}`;
  otherFamilyId = `other-${serial}`;
  await state.db.family.createMany({ data: [{ id: familyId, name: "Test" }, { id: otherFamilyId, name: "Other" }] });
  state.session = { userId: "test-parent", familyId, email: "guest@example.com", impersonatedBy: undefined };
  state.owner = true;
  process.env.ADMIN_ALLOWED_EMAILS = "operator@example.com,partner@example.com";
});

afterAll(async () => {
  await state.db?.$disconnect();
  for (const suffix of ["", "-journal", "-wal", "-shm"]) if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
  if (originalAllowed === undefined) delete process.env.ADMIN_ALLOWED_EMAILS;
  else process.env.ADMIN_ALLOWED_EMAILS = originalAllowed;
});

function videoData(n: number, family = familyId) {
  return { familyId: family, youtubeVideoId: `v${String(n).padStart(10, "0")}`, originalUrl: `https://youtu.be/v${String(n).padStart(10, "0")}`, title: `Video ${n}` };
}

function form(n = 1) {
  const data = new FormData();
  data.set("originalUrl", videoData(n).originalUrl);
  data.set("title", `Edited ${n}`);
  data.set("safetyStatus", "PARENT_CHECKED");
  data.set("isPublished", "on");
  return data;
}

async function key(family = familyId) {
  const raw = `st_app_test_${family}_12345678901234567890`;
  const installationId = `installation_${family}_1234567890`;
  const record = await state.db.appAccessKey.create({ data: {
    familyId: family, name: "Test", keyHash: hashAppAccessKey(raw), keyPrefix: raw.slice(0, 14), installationId,
    trialStartedAt: new Date("2020-01-01"), trialEndsAt: new Date("2020-01-15"),
  } });
  return { key: raw, installationId, record };
}

describe("free family quotas and permissions", () => {
  it("preserves legacy families above the new cap and permits editing", async () => {
    expect(await state.db.video.count({ where: { familyId: "legacy" } })).toBe(25);
    expect((await state.db.family.findUniqueOrThrow({ where: { id: "legacy" } })).videoLimit).toBe(20);
    await expect(state.db.video.update({ where: { id: "old-0" }, data: { title: "Preserved" } })).resolves.toMatchObject({ title: "Preserved" });
    await expect(state.db.video.create({ data: videoData(100, "legacy") })).rejects.toThrow();
  });

  it("counts all videos, blocks the 21st at action and database boundaries without creating tags", async () => {
    await state.db.video.createMany({ data: Array.from({ length: 20 }, (_, i) => videoData(i)) });
    const input = form(21);
    input.set("quickNewTags", "Must not be created");
    input.set("videoLimit", "99999");
    expect(await createVideoAction(input)).toMatchObject({ ok: false, message: expect.stringContaining("20개") });
    expect(await state.db.tag.count({ where: { familyId } })).toBe(0);
    await expect(state.db.video.create({ data: videoData(22) })).rejects.toThrow();
    expect(await state.db.video.count({ where: { familyId } })).toBe(20);
    await expect(state.db.video.create({ data: videoData(22, otherFamilyId) })).resolves.toBeTruthy();
  });

  it("does not exceed the cap during competing inserts", async () => {
    await state.db.video.createMany({ data: Array.from({ length: 19 }, (_, i) => videoData(i)) });
    const results = await Promise.allSettled([state.db.video.create({ data: videoData(20) }), state.db.video.create({ data: videoData(21) })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await state.db.video.count({ where: { familyId } })).toBe(20);
  });

  it("allows only the owner to grant a quota and records it atomically", async () => {
    const data = new FormData();
    data.set("familyId", familyId);
    data.set("videoLimit", "30");
    data.set("reason", "Free family approval");
    state.owner = false;
    await expect(updateFamilyVideoLimitAction(data)).rejects.toThrow("unauthorized");
    expect((await state.db.family.findUniqueOrThrow({ where: { id: familyId } })).videoLimit).toBe(20);
    state.owner = true;
    await expect(updateFamilyVideoLimitAction(data)).rejects.toThrow("redirect:/superadmin/users?notice=");
    await state.db.video.createMany({ data: Array.from({ length: 21 }, (_, i) => videoData(i)) });
    data.set("videoLimit", "20");
    await expect(updateFamilyVideoLimitAction(data)).rejects.toThrow("redirect:/superadmin/users?notice=");
    expect(await state.db.video.count({ where: { familyId } })).toBe(21);
    const video = await state.db.video.findFirstOrThrow({ where: { familyId } });
    await expect(updateVideoAction(video.id, form(50))).rejects.toThrow("redirect:/admin/videos");
    expect(await state.db.superAdminAuditLog.count({ where: { targetFamilyId: familyId, action: "FAMILY_VIDEO_LIMIT_UPDATED" } })).toBe(2);
  });

  it.each(["19", "20.5", "100001", "", "NaN"])("rejects invalid quota %s without changing it", async (limit) => {
    const data = new FormData();
    data.set("familyId", familyId); data.set("videoLimit", limit); data.set("reason", "Test validation");
    await expect(updateFamilyVideoLimitAction(data)).rejects.toThrow("redirect:/superadmin/users?error=");
    expect((await state.db.family.findUniqueOrThrow({ where: { id: familyId } })).videoLimit).toBe(20);
  });

  it("rolls back a quota grant if its audit cannot be saved", async () => {
    const data = new FormData(); data.set("familyId", familyId); data.set("videoLimit", "30"); data.set("reason", "Test rollback");
    await state.db.$executeRawUnsafe(`CREATE TRIGGER test_audit_failure BEFORE INSERT ON SuperAdminAuditLog BEGIN SELECT RAISE(ABORT, 'test_audit_failure'); END`);
    try {
      await expect(updateFamilyVideoLimitAction(data)).rejects.toThrow("redirect:/superadmin/users?error=");
      expect((await state.db.family.findUniqueOrThrow({ where: { id: familyId } })).videoLimit).toBe(20);
    } finally {
      await state.db.$executeRawUnsafe("DROP TRIGGER test_audit_failure");
    }
  });

  it("rejects forged Lite publication and cross-family video, tag, channel and key changes", async () => {
    const input = form(); input.set("isLitePublished", "on");
    expect(await createVideoAction(input)).toMatchObject({ ok: false });
    expect(await state.db.video.count({ where: { familyId } })).toBe(0);
    const otherVideo = await state.db.video.create({ data: videoData(1, otherFamilyId) });
    expect(await updateVideoAction(otherVideo.id, form())).toMatchObject({ ok: false });
    const otherTag = await state.db.tag.create({ data: { familyId: otherFamilyId, name: "Other", slug: "other" } });
    const tagged = form(); tagged.append("tagIds", otherTag.id);
    expect(await createVideoAction(tagged)).toMatchObject({ ok: false });
    const otherChannel = await state.db.channel.create({ data: { familyId: otherFamilyId, displayName: "Other", normalizedName: "other" } });
    const channeled = form(); channeled.set("channelMode", "EXISTING"); channeled.set("channelId", otherChannel.id);
    expect(await createVideoAction(channeled)).toMatchObject({ ok: false });
    expect(await renameChannelAction(otherChannel.id, new FormData())).toMatchObject({ ok: false });
    const merge = new FormData(); merge.set("targetChannelId", otherChannel.id);
    expect(await mergeChannelAction("missing", merge)).toMatchObject({ ok: false });
    expect(await updateTagAction(otherTag.id, new FormData())).toMatchObject({ ok: false });
    const otherKey = await key(otherFamilyId);
    expect(await disableAppAccessKeyAction(otherKey.record.id)).toMatchObject({ ok: false });
  });

  it("allows operator publishing, audits it and withdraws approval on ordinary-parent edits", async () => {
    state.session.email = "operator@example.com";
    const input = form(); input.set("isLitePublished", "on");
    await expect(createVideoAction(input)).rejects.toThrow("redirect:/admin/videos");
    const video = await state.db.video.findFirstOrThrow({ where: { familyId } });
    expect(video.isLitePublished).toBe(true);
    state.session.email = "guest@example.com";
    await expect(updateVideoAction(video.id, form())).rejects.toThrow("redirect:/admin/videos");
    expect((await state.db.video.findUniqueOrThrow({ where: { id: video.id } })).isLitePublished).toBe(false);
    expect(await state.db.superAdminAuditLog.count({ where: { targetFamilyId: familyId, action: "LITE_PUBLICATION_UPDATED" } })).toBe(2);
  });

  it("prevents ordinary parents from changing public tag/channel metadata indirectly", async () => {
    const tag = await state.db.tag.create({ data: { familyId, name: "Public", slug: "public", isActive: false } });
    const channel = await state.db.channel.create({ data: { familyId, displayName: "Public", normalizedName: "public" } });
    await state.db.video.create({ data: { ...videoData(1), channelId: channel.id, isPublished: true, isLitePublished: true, safetyStatus: "PARENT_CHECKED", tags: { create: { tagId: tag.id } } } });
    expect(await updateTagAction(tag.id, new FormData())).toMatchObject({ ok: false, message: expect.stringContaining("운영자") });
    expect(await renameChannelAction(channel.id, new FormData())).toMatchObject({ ok: false, message: expect.stringContaining("운영자") });
    const input = form(2); input.set("quickNewTags", "Public");
    expect(await createVideoAction(input)).toMatchObject({ ok: false, message: expect.stringContaining("운영자") });
    expect((await state.db.tag.findUniqueOrThrow({ where: { id: tag.id } })).isActive).toBe(false);
    expect(await state.db.video.count({ where: { familyId } })).toBe(1);
  });

  it("keeps impersonation read-only and disables new payment requests", async () => {
    state.session.impersonatedBy = "test-owner";
    expect(await createVideoAction(form())).toMatchObject({ ok: false });
    expect(await createAppAccessKeyAction(new FormData())).toMatchObject({ ok: false });
    expect(await createPaymentRequestAction()).toMatchObject({ ok: false });
    expect(await state.db.paymentRequest.count()).toBe(0);
    state.session.impersonatedBy = undefined;
    expect(await createPaymentRequestAction()).toMatchObject({ ok: false });
  });
});

describe("revision-based authenticated catalog sync", () => {
  it("keeps old installation bindings on invalid replacement and binds a valid free key only on success", async () => {
    const old = await key();
    const next = await key(otherFamilyId);
    await state.db.appAccessKey.update({ where: { id: next.record.id }, data: { installationId: null } });
    expect(await buildAppSyncResult({ key: "st_app_invalid_replacement_1234567890", installationId: old.installationId }, { mode: "register" })).toMatchObject({ ok: false, status: 401 });
    expect((await state.db.appAccessKey.findUniqueOrThrow({ where: { id: old.record.id } })).installationId).toBe(old.installationId);
    const result = await buildAppSyncResult({ key: next.key, installationId: old.installationId }, { mode: "register" });
    expect(result).toMatchObject({ ok: true, access: { status: "free" }, catalog: { videos: [] } });
    expect((await state.db.appAccessKey.findUniqueOrThrow({ where: { id: old.record.id } })).installationId).toBeNull();
    expect((await state.db.appAccessKey.findUniqueOrThrow({ where: { id: next.record.id } })).installationId).toBe(old.installationId);
  });
  it("syncs expired legacy keys, sends only approved family data and skips catalog SQL when unchanged", async () => {
    const credentials = await key();
    const own = await state.db.video.create({ data: { ...videoData(1), isPublished: true, safetyStatus: "PARENT_CHECKED" } });
    await state.db.video.create({ data: { ...videoData(2, otherFamilyId), isPublished: true, safetyStatus: "PARENT_CHECKED" } });
    await state.db.video.create({ data: videoData(3) });
    const first = await buildAppSyncResult(credentials, { mode: "sync" });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("sync failed");
    expect(first.access).toMatchObject({ status: "free", canSync: true });
    expect(first.catalog?.videos.map((video) => video.id)).toEqual([own.id]);
    queries.length = 0;
    const same = await buildAppSyncResult({ ...credentials, catalogVersion: first.catalog!.version }, { mode: "sync" });
    expect(same).toMatchObject({ ok: true, catalog: null });
    expect(queries.some((q) => /(?:FROM|JOIN) [`"]?(?:Video|Tag|Channel)[`"\s.]/.test(q))).toBe(false);
    expect(queries.some((q) => /^UPDATE /i.test(q))).toBe(false);
    await state.db.video.update({ where: { id: own.id }, data: { isPublished: false } });
    expect(await buildAppSyncResult({ ...credentials, catalogVersion: first.catalog!.version }, { mode: "sync" })).toMatchObject({ ok: true, catalog: { videos: [] } });
  });

  it("invalidates revisions for metadata, tag links and deletions without affecting another family", async () => {
    const credentials = await key();
    const channel = await state.db.channel.create({ data: { familyId, displayName: "Channel", normalizedName: "channel" } });
    const tag = await state.db.tag.create({ data: { familyId, name: "Tag", slug: "tag" } });
    const video = await state.db.video.create({ data: { ...videoData(1), channelId: channel.id, isPublished: true, safetyStatus: "PARENT_CHECKED", tags: { create: { tagId: tag.id } } } });
    let lastVersion = "";
    const otherRevision = (await state.db.family.findUniqueOrThrow({ where: { id: otherFamilyId } })).catalogRevision;
    for (const mutate of [
      () => state.db.video.update({ where: { id: video.id }, data: { title: "Changed" } }),
      () => state.db.tag.update({ where: { id: tag.id }, data: { name: "Renamed" } }),
      () => state.db.tag.update({ where: { id: tag.id }, data: { sortOrder: 55 } }),
      () => state.db.channel.update({ where: { id: channel.id }, data: { displayName: "Renamed" } }),
      () => state.db.tag.update({ where: { id: tag.id }, data: { isActive: false } }),
      () => state.db.videoTag.deleteMany({ where: { videoId: video.id } }),
      () => state.db.video.delete({ where: { id: video.id } }),
    ]) {
      await mutate();
      const result = await buildAppSyncResult({ ...credentials, ...(lastVersion ? { catalogVersion: lastVersion } : {}) }, { mode: "sync" });
      if (!result.ok || !result.catalog) throw new Error("expected changed catalog");
      expect(result.catalog.version).not.toBe(lastVersion);
      lastVersion = result.catalog.version;
    }
    expect((await state.db.family.findUniqueOrThrow({ where: { id: otherFamilyId } })).catalogRevision).toBe(otherRevision);
  });

  it("rejects revoked families, disabled keys and wrong devices before returning a cache hit", async () => {
    const credentials = await key();
    expect(await buildAppSyncResult({ ...credentials, installationId: "another_installation_123456" }, { mode: "sync" })).toMatchObject({ ok: false, status: 403 });
    await state.db.family.update({ where: { id: familyId }, data: { isActive: false } });
    expect(await buildAppSyncResult(credentials, { mode: "sync" })).toMatchObject({ ok: false, status: 403 });
    await state.db.family.update({ where: { id: familyId }, data: { isActive: true, wifiRequired: false } });
    await state.db.appAccessKey.update({ where: { id: credentials.record.id }, data: { isActive: false } });
    expect(await buildAppSyncResult(credentials, { mode: "register" })).toMatchObject({ ok: false, status: 403 });
    expect(await getAppPolicyByInstallationId(credentials.installationId)).toEqual({ wifiRequired: true });
    expect((await state.db.appAccessKey.findUniqueOrThrow({ where: { id: credentials.record.id } })).installationId).toBe(credentials.installationId);
  });
});
