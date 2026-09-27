package com.mrobbie.majelismengaji;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String ONLINE_URL = "https://mrobbie.com/majelis-ngaji/";
    private static final String FALLBACK_URL = "file:///android_asset/bootstrap/index.html";

    private WebView webView;
    private GestureDetector gestureDetector;
    private SyncManager syncManager;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        syncManager = new SyncManager(this);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadsImagesAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " MajelisMengajiAndroid/1.1");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://mrobbie.com/") || url.startsWith("file://")) return false;
                view.loadUrl(url);
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!isOnline()) {
                    WebResourceResponse cached = syncManager.intercept(request.getUrl().toString());
                    if (cached != null) return cached;
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame() && !isOnline()) loadOffline();
            }
        });

        gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            private static final int DISTANCE = 120;
            private static final int VELOCITY = 120;

            @Override
            public boolean onFling(MotionEvent e1, MotionEvent e2, float velocityX, float velocityY) {
                if (e1 == null || e2 == null) return false;
                float dx = e2.getX() - e1.getX();
                float dy = e2.getY() - e1.getY();
                if (Math.abs(dx) < DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.2f || Math.abs(velocityX) < VELOCITY) {
                    return false;
                }
                // Swipe inside Yasin/Tahlil/Simtud and Quran is handled by the Majelis Ngaji web app.
                // This fallback only returns to the previous browser view when swiping right.
                if (dx > 0 && webView.canGoBack()) {
                    webView.goBack();
                    return true;
                }
                return false;
            }
        });
        webView.setOnTouchListener((v, event) -> gestureDetector.onTouchEvent(event));

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadBestAvailable();
        }

        if (isOnline()) startBackgroundSync();
    }

    private void startBackgroundSync() {
        syncManager.startFullSync(new SyncManager.Listener() {
            private boolean coreNotified = false;

            @Override
            public void onCoreReady() {
                if (!coreNotified) {
                    coreNotified = true;
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Bacaan offline siap", Toast.LENGTH_SHORT).show());
                }
            }

            @Override
            public void onProgress(String message) {
                // Keep the reading screen quiet; synchronization continues in the background.
            }

            @Override
            public void onFinished() {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Sinkronisasi offline selesai", Toast.LENGTH_SHORT).show());
            }
        });
    }

    private void loadBestAvailable() {
        if (isOnline()) {
            webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            webView.loadUrl(ONLINE_URL);
        } else {
            loadOffline();
        }
    }

    private void loadOffline() {
        webView.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        if (syncManager.hasOfflineCore()) {
            webView.loadUrl(SyncManager.fileUrl(syncManager.getCachedIndex()));
            Toast.makeText(this, "Mode offline", Toast.LENGTH_SHORT).show();
        } else {
            webView.loadUrl(FALLBACK_URL);
        }
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities c = cm.getNetworkCapabilities(n);
            return c != null
                    && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }
}
