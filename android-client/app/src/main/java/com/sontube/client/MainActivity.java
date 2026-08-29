package com.sontube.client;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SafeBrowsingResponse;
import android.webkit.WebBackForwardList;
import android.webkit.WebChromeClient;
import android.webkit.WebHistoryItem;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private FrameLayout root;
    private WebView webView;
    private View errorPanel;
    private ProgressBar progressBar;
    private NavigationPolicy navigationPolicy;
    private final WebViewLoadState loadState = new WebViewLoadState();
    private final RuntimeNetworkGuard runtimeNetworkGuard = new RuntimeNetworkGuard();
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private boolean clearHistoryAfterLoad;
    private final ExecutorService startupExecutor = Executors.newSingleThreadExecutor();
    private int startupRequestId;
    private boolean policyRequestRunning;
    private boolean policyRecheckPending;
    private boolean appLoadAuthorized;
    private boolean hasResumedOnce;
    private boolean activityStarted;
    private boolean activityResumed;
    private Object backInvokedCallback;
    private ConnectivityManager connectivityManager;
    private boolean networkCallbackRegistered;
    private final ConnectivityManager.NetworkCallback networkCallback =
        new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                scheduleActiveNetworkCheck();
            }

            @Override
            public void onLost(Network network) {
                scheduleActiveNetworkCheck();
            }

            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                scheduleActiveNetworkCheck();
            }
        };

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        root = findViewById(R.id.root);
        webView = findViewById(R.id.web_view);
        errorPanel = findViewById(R.id.error_panel);
        progressBar = findViewById(R.id.progress);
        Button retryButton = findViewById(R.id.retry_button);
        navigationPolicy = new NavigationPolicy(BuildConfig.SONTUBE_APP_URL);
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " SonTubeAndroid/0.1");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.addJavascriptInterface(new NetworkBridge(), "SonTubeNetwork");
        webView.addJavascriptInterface(new DeviceBridge(), "SonTubeDevice");
        webView.setWebViewClient(new RestrictedNavigationClient());
        webView.setWebChromeClient(new RestrictedChromeClient());
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> showBlockedMessage());
        webView.setOnLongClickListener(view -> true);
        retryButton.setOnClickListener(view -> checkPolicyAndLoadApp());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backInvokedCallback = Api33BackNavigation.register(this, this::handleBackNavigation);
        }

        // Never restore a WebView back-forward list. The child client has one trusted top-level route.
        checkPolicyAndLoadApp();
    }

    private void checkPolicyAndLoadApp() {
        if (
            activityStarted
                && getActiveNetworkSnapshot().connection == RuntimeNetworkGuard.Connection.OFFLINE
        ) {
            failClosedToSamples();
            return;
        }

        final int requestId = ++startupRequestId;
        appLoadAuthorized = false;
        loadState.beginMainFrameLoad();
        if (fullscreenView != null) exitFullscreen();
        webView.onPause();
        webView.stopLoading();
        errorPanel.setVisibility(View.GONE);
        webView.setVisibility(View.GONE);
        progressBar.setIndeterminate(true);
        progressBar.setVisibility(View.VISIBLE);

        if (policyRequestRunning) {
            policyRecheckPending = true;
            return;
        }

        startPolicyRequest(requestId);
    }

    private void startPolicyRequest(int requestId) {
        policyRequestRunning = true;
        policyRecheckPending = false;
        startupExecutor.execute(() -> {
            PolicyFetchResult policyResult = fetchStartupPolicy();

            runOnUiThread(() -> {
                policyRequestRunning = false;
                if (isFinishing() || isDestroyed()) return;
                if (requestId != startupRequestId) {
                    if (policyRecheckPending) startPolicyRequest(startupRequestId);
                    return;
                }
                policyRecheckPending = false;
                StartupPolicy.Decision decision = StartupPolicy.decide(
                    policyResult.reached,
                    policyResult.wifiRequired,
                    isWifiConnected()
                );
                if (decision == StartupPolicy.Decision.LOAD_APP) {
                    loadApp();
                } else {
                    showLoadError();
                }
            });
        });
    }

    private PolicyFetchResult fetchStartupPolicy() {
        HttpURLConnection connection = null;
        try {
            URI appUri = URI.create(BuildConfig.SONTUBE_APP_URL);
            URL policyUrl = appUri.resolve("/api/app/policy?installationId=" + getInstallationId()).toURL();
            connection = (HttpURLConnection) policyUrl.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(4000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "SonTubeAndroid/0.1");
            connection.setUseCaches(false);

            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return PolicyFetchResult.unreachable();
            }

            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
            )) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }

            Boolean wifiRequired = StartupPolicy.parseWifiRequired(body.toString());
            return wifiRequired == null
                ? PolicyFetchResult.unreachable()
                : new PolicyFetchResult(true, wifiRequired);
        } catch (Exception ignored) {
            return PolicyFetchResult.unreachable();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private boolean isWifiConnected() {
        return getActiveNetworkSnapshot().connection == RuntimeNetworkGuard.Connection.WIFI;
    }

    private NetworkSnapshot getActiveNetworkSnapshot() {
        if (connectivityManager == null) return NetworkSnapshot.offline();

        Network activeNetwork = connectivityManager.getActiveNetwork();
        if (activeNetwork == null) return NetworkSnapshot.offline();

        NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(activeNetwork);
        if (capabilities == null) return NetworkSnapshot.offline();

        RuntimeNetworkGuard.Connection connection = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
            ? RuntimeNetworkGuard.Connection.WIFI
            : RuntimeNetworkGuard.Connection.OTHER;
        boolean validated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        return new NetworkSnapshot(activeNetwork.getNetworkHandle(), connection, validated);
    }

    private boolean startNetworkMonitoring() {
        if (networkCallbackRegistered) return true;
        if (connectivityManager == null) return false;

        NetworkSnapshot snapshot = getActiveNetworkSnapshot();
        runtimeNetworkGuard.start(snapshot.networkHandle, snapshot.connection, snapshot.validated);
        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
            networkCallbackRegistered = true;
            return true;
        } catch (RuntimeException ignored) {
            runtimeNetworkGuard.stop();
            return false;
        }
    }

    private void stopNetworkMonitoring() {
        runtimeNetworkGuard.stop();
        if (!networkCallbackRegistered || connectivityManager == null) return;

        networkCallbackRegistered = false;
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback);
        } catch (RuntimeException ignored) {
            // The callback may already have been released by the platform.
        }
    }

    private void scheduleActiveNetworkCheck() {
        runOnUiThread(() -> {
            if (!activityStarted || isFinishing() || isDestroyed()) return;

            NetworkSnapshot snapshot = getActiveNetworkSnapshot();
            RuntimeNetworkGuard.Action action = runtimeNetworkGuard.onNetworkChanged(
                snapshot.networkHandle,
                snapshot.connection,
                snapshot.validated
            );
            if (action == RuntimeNetworkGuard.Action.SHOW_SAMPLES) {
                failClosedToSamples();
            } else if (action == RuntimeNetworkGuard.Action.RECHECK_POLICY) {
                checkPolicyAndLoadApp();
            }
        });
    }

    private void failClosedToSamples() {
        startupRequestId += 1;
        policyRecheckPending = false;
        appLoadAuthorized = false;
        webView.stopLoading();
        showLoadError();
    }

    private void loadApp() {
        appLoadAuthorized = true;
        loadState.beginMainFrameLoad();
        errorPanel.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        if (activityResumed) webView.onResume();
        progressBar.setIndeterminate(false);
        progressBar.setVisibility(View.VISIBLE);
        clearHistoryAfterLoad = true;
        webView.loadUrl(BuildConfig.SONTUBE_APP_URL);
    }

    private void recoverToApp(WebView view) {
        view.stopLoading();
        showBlockedMessage();
        if (appLoadAuthorized) loadApp();
    }

    private void showLoadError() {
        appLoadAuthorized = false;
        loadState.markMainFrameFailed();
        if (fullscreenView != null) exitFullscreen();
        webView.onPause();
        progressBar.setVisibility(View.GONE);
        webView.setVisibility(View.GONE);
        errorPanel.setVisibility(View.VISIBLE);
    }

    private void showBlockedMessage() {
        Toast.makeText(this, R.string.external_navigation_blocked, Toast.LENGTH_SHORT).show();
    }

    private boolean canGoBackWithinApp() {
        WebBackForwardList history = webView.copyBackForwardList();
        int targetIndex = history.getCurrentIndex() - 1;
        if (targetIndex < 0) return false;

        WebHistoryItem target = history.getItemAtIndex(targetIndex);
        return target != null && navigationPolicy.isAllowedTopLevelUrl(target.getUrl());
    }

    @Override
    protected void onStart() {
        super.onStart();
        activityStarted = true;
        if (
            !startNetworkMonitoring()
                || getActiveNetworkSnapshot().connection == RuntimeNetworkGuard.Connection.OFFLINE
        ) {
            failClosedToSamples();
        }
    }

    @Override
    protected void onPause() {
        activityResumed = false;
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        activityResumed = true;
        if (!networkCallbackRegistered && !startNetworkMonitoring()) {
            failClosedToSamples();
            hasResumedOnce = true;
            return;
        }
        if (hasResumedOnce) {
            checkPolicyAndLoadApp();
        } else if (appLoadAuthorized && webView.getVisibility() == View.VISIBLE) {
            webView.onResume();
        }
        if (hasResumedOnce && appLoadAuthorized && webView.getVisibility() == View.VISIBLE) {
            webView.evaluateJavascript("window.SonTubeCheckForUpdates && window.SonTubeCheckForUpdates()", null);
        }
        hasResumedOnce = true;
    }

    @Override
    protected void onStop() {
        activityStarted = false;
        stopNetworkMonitoring();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        startupRequestId += 1;
        policyRecheckPending = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backInvokedCallback != null) {
            Api33BackNavigation.unregister(this, backInvokedCallback);
            backInvokedCallback = null;
        }
        stopNetworkMonitoring();
        startupExecutor.shutdownNow();
        if (fullscreenView != null) exitFullscreen();
        webView.stopLoading();
        webView.removeJavascriptInterface("SonTubeNetwork");
        webView.removeJavascriptInterface("SonTubeDevice");
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBackNavigation();
    }

    private void handleBackNavigation() {
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        if (canGoBackWithinApp()) {
            webView.goBack();
            return;
        }
        webView.clearHistory();
        moveTaskToBack(true);
    }

    @SuppressLint("UseRequiresApi")
    @android.annotation.TargetApi(Build.VERSION_CODES.TIRAMISU)
    private static final class Api33BackNavigation {
        static Object register(Activity activity, Runnable action) {
            android.window.OnBackInvokedCallback callback = action::run;
            activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                callback
            );
            return callback;
        }

        static void unregister(Activity activity, Object callback) {
            activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(
                (android.window.OnBackInvokedCallback) callback
            );
        }
    }

    private void enterFullscreen(View view, WebChromeClient.CustomViewCallback callback) {
        if (fullscreenView != null) {
            callback.onCustomViewHidden();
            return;
        }

        fullscreenView = view;
        fullscreenCallback = callback;
        root.addView(view, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setVisibility(View.GONE);
        setSystemBarsVisible(false);
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;

        root.removeView(fullscreenView);
        fullscreenView = null;
        webView.setVisibility(appLoadAuthorized ? View.VISIBLE : View.GONE);
        setSystemBarsVisible(true);

        if (fullscreenCallback != null) {
            fullscreenCallback.onCustomViewHidden();
            fullscreenCallback = null;
        }
    }

    @SuppressWarnings("deprecation")
    private void setSystemBarsVisible(boolean visible) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller == null) return;
            if (visible) {
                controller.show(WindowInsets.Type.systemBars());
            } else {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
            return;
        }

        getWindow().getDecorView().setSystemUiVisibility(
            visible
                ? View.SYSTEM_UI_FLAG_VISIBLE
                : View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    private final class NetworkBridge {
        @JavascriptInterface
        public boolean isWifiConnected() {
            return MainActivity.this.isWifiConnected();
        }
    }

    private final class DeviceBridge {
        @JavascriptInterface
        public String getInstallationId() {
            return MainActivity.this.getInstallationId();
        }
    }

    private String getInstallationId() {
        android.content.SharedPreferences preferences = getSharedPreferences("sontube_device", MODE_PRIVATE);
        String existing = preferences.getString("installation_id", null);
        if (existing != null && !existing.isEmpty()) return existing;

        String created = "install_" + UUID.randomUUID().toString().replace("-", "");
        preferences.edit().putString("installation_id", created).apply();
        return created;
    }
    private static final class PolicyFetchResult {
        final boolean reached;
        final boolean wifiRequired;

        PolicyFetchResult(boolean reached, boolean wifiRequired) {
            this.reached = reached;
            this.wifiRequired = wifiRequired;
        }

        static PolicyFetchResult unreachable() {
            return new PolicyFetchResult(false, true);
        }
    }

    private static final class NetworkSnapshot {
        final long networkHandle;
        final RuntimeNetworkGuard.Connection connection;
        final boolean validated;

        NetworkSnapshot(
            long networkHandle,
            RuntimeNetworkGuard.Connection connection,
            boolean validated
        ) {
            this.networkHandle = networkHandle;
            this.connection = connection;
            this.validated = validated;
        }

        static NetworkSnapshot offline() {
            return new NetworkSnapshot(0L, RuntimeNetworkGuard.Connection.OFFLINE, false);
        }
    }

    private final class RestrictedNavigationClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            if (navigationPolicy.isAllowedTopLevelUrl(request.getUrl().toString())) return false;

            showBlockedMessage();
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (!appLoadAuthorized) {
                view.stopLoading();
                return;
            }
            if (!navigationPolicy.isAllowedTopLevelUrl(url)) {
                recoverToApp(view);
                return;
            }
            loadState.beginMainFrameLoad();
            progressBar.setVisibility(View.VISIBLE);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            if (!navigationPolicy.isAllowedTopLevelUrl(url)) {
                recoverToApp(view);
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!appLoadAuthorized) return;
            if (!navigationPolicy.isAllowedTopLevelUrl(url)) return;
            if (loadState.hasMainFrameFailed()) {
                showLoadError();
                return;
            }
            if (clearHistoryAfterLoad) {
                view.clearHistory();
                clearHistoryAfterLoad = false;
            }
            progressBar.setVisibility(View.GONE);
            errorPanel.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (appLoadAuthorized && request.isForMainFrame()) showLoadError();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (appLoadAuthorized && request.isForMainFrame() && errorResponse.getStatusCode() >= 400) {
                showLoadError();
            }
        }

        @Override
        public void onSafeBrowsingHit(
            WebView view,
            WebResourceRequest request,
            int threatType,
            SafeBrowsingResponse callback
        ) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                callback.backToSafety(true);
            } else {
                view.stopLoading();
            }
            showLoadError();
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            recreate();
            return true;
        }
    }

    private final class RestrictedChromeClient extends WebChromeClient {
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
            showBlockedMessage();
            return false;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();
        }

        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            if (!appLoadAuthorized) return;
            if (loadState.hasMainFrameFailed()) {
                progressBar.setVisibility(View.GONE);
                return;
            }
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (!appLoadAuthorized) {
                callback.onCustomViewHidden();
                return;
            }
            enterFullscreen(view, callback);
        }

        @Override
        public void onHideCustomView() {
            exitFullscreen();
        }
    }
}
