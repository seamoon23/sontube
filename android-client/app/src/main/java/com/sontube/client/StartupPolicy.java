package com.sontube.client;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class StartupPolicy {
    enum Decision {
        LOAD_APP,
        SHOW_SAMPLES
    }

    private static final Pattern WIFI_REQUIRED_PATTERN = Pattern.compile(
        "\\\"wifiRequired\\\"\\s*:\\s*(true|false)",
        Pattern.CASE_INSENSITIVE
    );

    private StartupPolicy() {}

    static Boolean parseWifiRequired(String responseBody) {
        if (responseBody == null) return null;
        Matcher matcher = WIFI_REQUIRED_PATTERN.matcher(responseBody);
        if (!matcher.find()) return null;
        return Boolean.parseBoolean(matcher.group(1));
    }

    static Decision decide(boolean policyReached, boolean wifiRequired, boolean wifiConnected) {
        if (!policyReached) return Decision.SHOW_SAMPLES;
        if (wifiRequired && !wifiConnected) return Decision.SHOW_SAMPLES;
        return Decision.LOAD_APP;
    }
}
