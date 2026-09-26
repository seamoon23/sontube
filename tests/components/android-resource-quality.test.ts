import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Android fallback resource quality", () => {
  it("keeps the launcher manifest private, least-privilege, and rotation-safe", () => {
    const manifest = readProjectFile(
      "android-client/app/src/main/AndroidManifest.xml",
    );
    const permissions = manifest.match(/<uses-permission\b/g) ?? [];

    expect(permissions).toHaveLength(2);
    expect(manifest).toContain("android.permission.INTERNET");
    expect(manifest).toContain("android.permission.ACCESS_NETWORK_STATE");
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain(
      'android:dataExtractionRules="@xml/data_extraction_rules"',
    );
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    expect(manifest).toContain(
      'android:usesCleartextTraffic="${usesCleartextTraffic}"',
    );
    expect(manifest).toContain('android:supportsRtl="true"');
    expect(manifest).toContain('android:icon="@mipmap/ic_launcher"');
    expect(manifest).toContain('android:roundIcon="@mipmap/ic_launcher_round"');
    expect(manifest).toContain('android:label="@string/app_name"');
    expect(manifest).not.toContain("android:screenOrientation");
  });

  it("keeps app keys and install identifiers out of backup and device transfer", () => {
    const backupRules = readProjectFile(
      "android-client/app/src/main/res/xml/backup_rules.xml",
    );
    const extractionRules = readProjectFile(
      "android-client/app/src/main/res/xml/data_extraction_rules.xml",
    );

    expect(backupRules).toContain('<exclude domain="sharedpref" path="." />');
    expect(backupRules).toContain(
      '<exclude domain="device_sharedpref" path="." />',
    );
    expect(extractionRules).toContain("<cloud-backup>");
    expect(extractionRules).toContain("<device-transfer>");
    expect(extractionRules.match(/domain="sharedpref"/g)).toHaveLength(2);
    expect(extractionRules.match(/domain="device_sharedpref"/g)).toHaveLength(
      2,
    );
  });

  it("provides adaptive and themed launcher icons without losing the fallback", () => {
    const fallbackIcon = readProjectFile(
      "android-client/app/src/main/res/mipmap-anydpi/ic_launcher.xml",
    );
    const adaptiveIcon = readProjectFile(
      "android-client/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
    );

    expect(fallbackIcon).toContain("<vector");
    expect(adaptiveIcon).toContain("<adaptive-icon");
    expect(adaptiveIcon).toContain(
      'android:drawable="@drawable/ic_launcher_foreground"',
    );
    expect(adaptiveIcon).toContain(
      '<monochrome android:drawable="@drawable/ic_launcher_monochrome" />',
    );
  });

  it("keeps spoken sample labels independent from decorative emoji and punctuation", () => {
    const layout = readProjectFile(
      "android-client/app/src/main/res/layout/activity_main.xml",
    );
    const strings = readProjectFile(
      "android-client/app/src/main/res/values/strings.xml",
    );
    const samples = [
      "animals",
      "science",
      "making",
      "english",
      "exercise",
      "travel",
    ];

    for (const sample of samples) {
      expect(layout).toContain(
        `android:contentDescription="@string/sample_card_${sample}_a11y"`,
      );
      expect(strings).toMatch(
        new RegExp(`<string name="sample_card_${sample}_a11y">[^<]+</string>`),
      );
    }
  });

  it("keeps fallback content readable on phones and wide screens", () => {
    const layout = readProjectFile(
      "android-client/app/src/main/res/layout/activity_main.xml",
    );
    const phoneDimensions = readProjectFile(
      "android-client/app/src/main/res/values/dimens.xml",
    );
    const wideDimensions = readProjectFile(
      "android-client/app/src/main/res/values-w600dp/dimens.xml",
    );
    const extraWideDimensions = readProjectFile(
      "android-client/app/src/main/res/values-w840dp/dimens.xml",
    );

    expect(layout).toContain(
      'android:paddingStart="@dimen/fallback_horizontal_padding"',
    );
    expect(layout).toContain(
      'android:paddingEnd="@dimen/fallback_horizontal_padding"',
    );
    expect(layout.match(/android:breakStrategy="balanced"/g)).toHaveLength(2);
    expect(phoneDimensions).toContain(
      '<dimen name="fallback_horizontal_padding">24dp</dimen>',
    );
    expect(wideDimensions).toContain(
      '<dimen name="fallback_horizontal_padding">64dp</dimen>',
    );
    expect(extraWideDimensions).toContain(
      '<dimen name="fallback_horizontal_padding">160dp</dimen>',
    );
  });
});
