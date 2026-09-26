import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

import { GET, HEAD } from "@/app/api/health/route";

describe("health route", () => {
  beforeEach(() => {
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a no-store 200 without deployment details after a database read", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(body).toEqual({ status: "ok" });
    expect(JSON.stringify(body)).not.toMatch(/database|prisma|sqlite|version|path/iu);
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("returns a generic no-store 503 when the database read fails", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("file:/private/database.db"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toContain("private/database.db");
  });

  it("checks the database for HEAD without returning a response body", async () => {
    const response = await HEAD();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("returns 503 for HEAD when the database is unavailable", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await HEAD();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});
