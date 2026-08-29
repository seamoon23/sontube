import { describe, expect, it } from "vitest";
import { DEFAULT_APP_POLICY, parseWifiRequiredSetting } from "@/lib/app-policy";

describe("app policy", () => {
  it("defaults Wi-Fi required to true when the setting is missing or unreadable", () => {
    expect(DEFAULT_APP_POLICY.wifiRequired).toBe(true);
    expect(parseWifiRequiredSetting(undefined)).toBe(true);
    expect(parseWifiRequiredSetting(null)).toBe(true);
    expect(parseWifiRequiredSetting("unexpected")).toBe(true);
  });

  it("accepts only an explicit false value to disable the requirement", () => {
    expect(parseWifiRequiredSetting("false")).toBe(false);
    expect(parseWifiRequiredSetting(" FALSE ")).toBe(false);
    expect(parseWifiRequiredSetting("true")).toBe(true);
  });
});
