package com.sontube.client;

public final class StartupPolicySmokeTest {
    public static void main(String[] args) {
        expect(Boolean.TRUE.equals(StartupPolicy.parseWifiRequired("{\"ok\":true,\"policy\":{\"wifiRequired\":true}}")));
        expect(Boolean.FALSE.equals(StartupPolicy.parseWifiRequired("{ \"wifiRequired\" : false }")));
        expect(StartupPolicy.parseWifiRequired("{\"ok\":true}") == null);
        expect(StartupPolicy.decide(false, true, true) == StartupPolicy.Decision.SHOW_SAMPLES);
        expect(StartupPolicy.decide(true, true, false) == StartupPolicy.Decision.SHOW_SAMPLES);
        expect(StartupPolicy.decide(true, true, true) == StartupPolicy.Decision.LOAD_APP);
        expect(StartupPolicy.decide(true, false, false) == StartupPolicy.Decision.LOAD_APP);
        System.out.println("StartupPolicy smoke tests passed.");
    }

    private static void expect(boolean condition) {
        if (!condition) throw new AssertionError("Startup policy expectation failed");
    }
}
