package com.sontube.client;

public final class RuntimeNetworkGuardSmokeTest {
    public static void main(String[] args) {
        RuntimeNetworkGuard guard = new RuntimeNetworkGuard();

        guard.start(10L, RuntimeNetworkGuard.Connection.WIFI, true);
        expect(
            guard.onNetworkChanged(10L, RuntimeNetworkGuard.Connection.WIFI, true),
            RuntimeNetworkGuard.Action.NONE,
            "Repeated capabilities must not trigger another policy fetch"
        );
        expect(
            guard.onNetworkChanged(11L, RuntimeNetworkGuard.Connection.WIFI, true),
            RuntimeNetworkGuard.Action.RECHECK_POLICY,
            "A different default Wi-Fi network must recheck policy"
        );
        expect(
            guard.onNetworkChanged(11L, RuntimeNetworkGuard.Connection.WIFI, false),
            RuntimeNetworkGuard.Action.RECHECK_POLICY,
            "A meaningful validation change must recheck policy"
        );
        expect(
            guard.onNetworkChanged(12L, RuntimeNetworkGuard.Connection.OTHER, true),
            RuntimeNetworkGuard.Action.RECHECK_POLICY,
            "Moving to mobile data must recheck the Wi-Fi requirement"
        );
        expect(
            guard.onNetworkChanged(0L, RuntimeNetworkGuard.Connection.OFFLINE, false),
            RuntimeNetworkGuard.Action.SHOW_SAMPLES,
            "Losing the default network must fail closed immediately"
        );

        guard.stop();
        expect(
            guard.onNetworkChanged(13L, RuntimeNetworkGuard.Connection.WIFI, true),
            RuntimeNetworkGuard.Action.NONE,
            "Callbacks after the Activity is hidden must be ignored"
        );

        guard.start(13L, RuntimeNetworkGuard.Connection.WIFI, true);
        expect(
            guard.onNetworkChanged(13L, RuntimeNetworkGuard.Connection.WIFI, true),
            RuntimeNetworkGuard.Action.NONE,
            "Restarting observation must establish a fresh baseline"
        );

        System.out.println("RuntimeNetworkGuard smoke tests passed.");
    }

    private static void expect(
        RuntimeNetworkGuard.Action actual,
        RuntimeNetworkGuard.Action expected,
        String message
    ) {
        if (actual != expected) {
            throw new AssertionError(message + ": expected " + expected + ", got " + actual);
        }
    }
}
