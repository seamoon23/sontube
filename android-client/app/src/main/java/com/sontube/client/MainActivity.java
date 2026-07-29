package com.sontube.client;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
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

public final class MainActivity extends Activity {
    private FrameLayout root;
    private WebView webView;
    private View errorPanel;
    private ProgressBar progressBar;
    private NavigationPolicy navigationPolicy;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private boolean clearHistoryAfterLoad;

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
        webView.setWebViewClient(new RestrictedNavigationClient());
        webView.setWebChromeClient(new RestrictedChromeClient());
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> showBlockedMessage());
        webView.setOnLongClickListener(view -> true);
        retryButton.setOnClickListener(view -> loadApp());

        // Never restore a WebView back-forward list. The child client has one trusted top-level route.
        loadApp();
    }

    private void loadApp() {
        errorPanel.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.VISIBLE);
        clearHistoryAfterLoad = true;
        webView.loadUrl(BuildConfig.SONTUBE_APP_URL);
    }

    private void recoverToApp(WebView view) {
        view.stopLoading();
        showBlockedMessage();
        loadApp();
    }

    private void showLoadError() {
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
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (fullscreenView != null) exitFullscreen();
        webView.stopLoading();
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
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
        webView.setVisibility(View.VISIBLE);
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
            if (!navigationPolicy.isAllowedTopLevelUrl(url)) {
                recoverToApp(view);
                return;
            }
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
            if (!navigationPolicy.isAllowedTopLevelUrl(url)) return;
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
            if (request.isForMainFrame()) showLoadError();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) showLoadError();
        }

        @Override
        public void onSafeBrowsingHit(
            WebView view,
            WebResourceRequest request,
            int threatType,
            SafeBrowsingResponse callback
        ) {
            callback.backToSafety(true);
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
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            enterFullscreen(view, callback);
        }

        @Override
        public void onHideCustomView() {
            exitFullscreen();
        }
    }
}
