import { describe, expect, it } from "vitest";

import {
  IMPERSONATION_READ_ONLY_MESSAGE,
  isAdminMutationBlocked,
} from "@/lib/admin-mutation-guard";

describe("admin mutation guard", () => {
  it("allows a regular parent administrator to change family data", () => {
    expect(isAdminMutationBlocked({})).toBe(false);
  });

  it("blocks every mutation made from a support impersonation session", () => {
    expect(isAdminMutationBlocked({ impersonatedBy: "owner" })).toBe(true);
    expect(IMPERSONATION_READ_ONLY_MESSAGE).toContain("읽기 전용");
  });
});
