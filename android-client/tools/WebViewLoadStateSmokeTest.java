package com.sontube.client;

public final class WebViewLoadStateSmokeTest {
    public static void main(String[] args) {
        WebViewLoadState state = new WebViewLoadState();

        state.beginMainFrameLoad();
        assertFalse(state.hasMainFrameFailed(), "A new load must start without an error");

        state.markMainFrameFailed();
        assertTrue(state.hasMainFrameFailed(), "A main-frame error must remain visible after page finish");

        state.beginMainFrameLoad();
        assertFalse(state.hasMainFrameFailed(), "Retry must clear the previous main-frame error");

        System.out.println("WebViewLoadState smoke test passed.");
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    private static void assertFalse(boolean value, String message) {
        if (value) throw new AssertionError(message);
    }
}
