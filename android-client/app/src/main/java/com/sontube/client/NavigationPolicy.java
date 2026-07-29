package com.sontube.client;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Objects;

public final class NavigationPolicy {
    private final URI appUri;

    public NavigationPolicy(String appUrl) {
        this.appUri = parse(appUrl);
        if (
            !isHttpScheme(appUri.getScheme())
                || appUri.getHost() == null
                || appUri.getUserInfo() != null
                || appUri.getQuery() != null
                || appUri.getFragment() != null
                || !isAppPath(appUri.getPath())
        ) {
            throw new IllegalArgumentException("App URL must be an http(s) URL ending in /app");
        }
    }

    public boolean isAllowedTopLevelUrl(String candidateUrl) {
        final URI candidate;
        try {
            candidate = new URI(candidateUrl);
        } catch (URISyntaxException | NullPointerException error) {
            return false;
        }

        if (!isHttpScheme(candidate.getScheme()) || candidate.getHost() == null || candidate.getUserInfo() != null) {
            return false;
        }

        return normalize(candidate.getScheme()).equals(normalize(appUri.getScheme()))
            && normalize(candidate.getHost()).equals(normalize(appUri.getHost()))
            && effectivePort(candidate) == effectivePort(appUri)
            && isAppPath(candidate.getPath());
    }

    private static URI parse(String value) {
        try {
            return new URI(Objects.requireNonNull(value).trim());
        } catch (URISyntaxException | NullPointerException error) {
            throw new IllegalArgumentException("Invalid app URL", error);
        }
    }

    private static boolean isHttpScheme(String scheme) {
        String normalized = normalize(scheme);
        return "http".equals(normalized) || "https".equals(normalized);
    }

    private static boolean isAppPath(String path) {
        return "/app".equals(path) || "/app/".equals(path);
    }

    private static int effectivePort(URI uri) {
        if (uri.getPort() >= 0) return uri.getPort();
        return "https".equals(normalize(uri.getScheme())) ? 443 : 80;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}
