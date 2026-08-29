package com.sontube.client;

public final class WebViewLoadState {
    private boolean mainFrameFailed;

    public void beginMainFrameLoad() {
        mainFrameFailed = false;
    }

    public void markMainFrameFailed() {
        mainFrameFailed = true;
    }

    public boolean hasMainFrameFailed() {
        return mainFrameFailed;
    }
}
