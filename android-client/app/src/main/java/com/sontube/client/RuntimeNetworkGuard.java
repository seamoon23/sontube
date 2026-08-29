package com.sontube.client;

final class RuntimeNetworkGuard {
    enum Connection {
        OFFLINE,
        WIFI,
        OTHER
    }

    enum Action {
        NONE,
        SHOW_SAMPLES,
        RECHECK_POLICY
    }

    private boolean observing;
    private long networkHandle;
    private Connection connection = Connection.OFFLINE;
    private boolean validated;

    void start(long currentNetworkHandle, Connection currentConnection, boolean currentValidated) {
        observing = true;
        networkHandle = currentNetworkHandle;
        connection = currentConnection;
        validated = currentValidated;
    }

    void stop() {
        observing = false;
    }

    Action onNetworkChanged(long newNetworkHandle, Connection newConnection, boolean newValidated) {
        if (!observing) return Action.NONE;

        boolean changed = networkHandle != newNetworkHandle
            || connection != newConnection
            || validated != newValidated;
        networkHandle = newNetworkHandle;
        connection = newConnection;
        validated = newValidated;

        if (!changed) return Action.NONE;
        if (newConnection == Connection.OFFLINE) return Action.SHOW_SAMPLES;
        return Action.RECHECK_POLICY;
    }
}
