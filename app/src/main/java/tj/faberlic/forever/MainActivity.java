package tj.faberlic.forever;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
    private WebView webView;
    private StartupSplashController startupSplash;
    private PublishedLessonsBridge publishedLessons;
    // YouTube fullscreen is isolated from the approved WebView screens.
    private View fullscreenVideoView;
    private WebChromeClient.CustomViewCallback fullscreenVideoCallback;
    private int previousSystemUiFlags;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(9, 10, 12));
        window.setNavigationBarColor(Color.rgb(9, 10, 12));

        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webView);
        webView.setBackgroundColor(Color.rgb(9, 10, 12));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Isolated HTTPS origin ONLY for the nested video player. Keep the
        // main WebView on file:///android_asset to preserve language/favorites.
        final WebViewAssetLoader playerAssetLoader = new WebViewAssetLoader.Builder()
            .setDomain("tj.faberlic.forever")
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return playerAssetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && "https".equals(request.getUrl().getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                    } catch (Exception exception) {
                        android.util.Log.w("FFExternal", "No app for external link", exception);
                    }
                    return true;
                }
                return false;
            }

            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (startupSplash != null &&
                    "file:///android_asset/www/index.html".equals(url)) {
                    startupSplash.onMainPageReady();
                }
            }
        });
        // Nested YouTube iframe calls this callback when its fullscreen button is tapped.
        // Plain WebChromeClient does not provide fullscreen support.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenVideoView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenVideoView = view;
                fullscreenVideoCallback = callback;
                previousSystemUiFlags = getWindow().getDecorView().getSystemUiVisibility();
                FrameLayout decor = findViewById(android.R.id.content);
                decor.addView(view, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));
                view.bringToFront();
                getWindow().getDecorView().setSystemUiVisibility(
                    previousSystemUiFlags | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreenVideo();
            }
        });

        // Isolated read-only Firestore adapter. Does not modify any approved UI screens.
        publishedLessons = new PublishedLessonsBridge(this, webView);
        webView.addJavascriptInterface(publishedLessons, "FaberlicLessonsAndroid");

        if (savedInstanceState == null) {
            startupSplash = new StartupSplashController(this);
            webView.loadUrl("file:///android_asset/www/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void exitFullscreenVideo() {
        if (fullscreenVideoView == null) return;
        FrameLayout decor = findViewById(android.R.id.content);
        decor.removeView(fullscreenVideoView);
        fullscreenVideoView = null;
        getWindow().getDecorView().setSystemUiVisibility(previousSystemUiFlags);
        if (fullscreenVideoCallback != null) {
            WebChromeClient.CustomViewCallback callback = fullscreenVideoCallback;
            fullscreenVideoCallback = null;
            callback.onCustomViewHidden();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        exitFullscreenVideo();
        if (publishedLessons != null) {
            publishedLessons.close();
            publishedLessons = null;
        }
        if (startupSplash != null) {
            startupSplash.release();
            startupSplash = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (fullscreenVideoView != null) {
            exitFullscreenVideo();
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{if(document.fullscreenElement || document.webkitFullscreenElement){if(window.exitLessonFullscreen)window.exitLessonFullscreen();return true;}return window.ffHandleBack?window.ffHandleBack():false}catch(e){return false}})()",
            value -> {
                if ("true".equals(value)) return;
                if (webView.canGoBack()) webView.goBack();
                else MainActivity.super.onBackPressed();
            }
        );
    }
}
