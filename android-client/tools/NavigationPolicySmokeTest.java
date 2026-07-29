package com.sontube.client;

public final class NavigationPolicySmokeTest {
    public static void main(String[] args) {
        NavigationPolicy policy = new NavigationPolicy("https://family.example.com/app");

        assertAllowed(policy, "https://family.example.com/app");
        assertAllowed(policy, "https://family.example.com/app/?view=playlist#top");
        assertBlocked(policy, "https://family.example.com/admin");
        assertBlocked(policy, "https://family.example.com/kids");
        assertBlocked(policy, "https://www.youtube.com/watch?v=abc");
        assertBlocked(policy, "https://family.example.com.evil.test/app");
        assertBlocked(policy, "https://family.example.com:444/app");
        assertBlocked(policy, "http://family.example.com/app");
        assertBlocked(policy, "https://user@family.example.com/app");
        assertBlocked(policy, "https://family.example.com/app/../admin");
        assertBlocked(policy, "https://family.example.com/app/admin");
        assertBlocked(policy, "javascript:alert(1)");
        assertBlocked(policy, "intent://youtube.com");
        assertInvalidBaseUrl("https://user@family.example.com/app");
        assertInvalidBaseUrl("https://family.example.com/app?mode=admin");

        System.out.println("NavigationPolicy smoke test passed.");
    }

    private static void assertAllowed(NavigationPolicy policy, String url) {
        if (!policy.isAllowedTopLevelUrl(url)) {
            throw new AssertionError("Expected allowed URL: " + url);
        }
    }

    private static void assertBlocked(NavigationPolicy policy, String url) {
        if (policy.isAllowedTopLevelUrl(url)) {
            throw new AssertionError("Expected blocked URL: " + url);
        }
    }

    private static void assertInvalidBaseUrl(String url) {
        try {
            new NavigationPolicy(url);
        } catch (IllegalArgumentException expected) {
            return;
        }

        throw new AssertionError("Expected invalid app URL: " + url);
    }
}
