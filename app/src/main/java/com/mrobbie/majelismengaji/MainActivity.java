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
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String ONLINE_URL = "https://mrobbie.com/majelis-ngaji/";
    private static final String OFFLINE_URL = "file:///android_asset/bootstrap/index.html";
    private WebView webView;
    private GestureDetector gestureDetector;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
        s.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        s.setUserAgentString(s.getUserAgentString() + " MajelisMengajiAndroid/1.0");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            private boolean mainFrameFailed = false;

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://mrobbie.com/") || url.startsWith("file:///android_asset/")) {
                    return false;
                }
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onReceivedError(WebView view, android.webkit.WebResourceRequest request, android.webkit.WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    mainFrameFailed = true;
                    view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
                    if (!isOnline()) view.loadUrl(OFFLINE_URL);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (mainFrameFailed && isOnline() && url.startsWith("file:///")) {
                    mainFrameFailed = false;
                }
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
                // The website itself handles reading-page swipe. This fallback only handles browser history.
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
    }

    private void loadBestAvailable() {
        if (isOnline()) {
            webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            webView.loadUrl(ONLINE_URL);
        } else {
            webView.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
            webView.loadUrl(ONLINE_URL);
            webView.postDelayed(() -> {
                String u = webView.getUrl();
                if (u == null || u.equals("about:blank")) {
                    webView.loadUrl(OFFLINE_URL);
                    Toast.makeText(this, "Mode offline", Toast.LENGTH_SHORT).show();
                }
            }, 2500);
        }
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities c = cm.getNetworkCapabilities(n);
            return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
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
