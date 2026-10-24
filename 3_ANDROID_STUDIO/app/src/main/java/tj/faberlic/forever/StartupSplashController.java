package tj.faberlic.forever;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** Isolated, one-shot splash: never changes the existing app WebView or UI. */
final class StartupSplashController {
    private static final int SPLASH_BG = Color.rgb(9, 10, 12);
    private static final long FAILSAFE_MS = 11000;
    private final Activity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final FrameLayout host;
    private FrameLayout overlay;
    private WebView splashView;
    private boolean mainReady;
    private boolean finishedAnimation;
    private boolean closing;
    private boolean disposed;

    private final Runnable failsafe = () -> dismiss();

    @SuppressLint("SetJavaScriptEnabled")
    StartupSplashController(Activity activity) {
        this.activity = activity;
        host = activity.findViewById(android.R.id.content);
        overlay = new FrameLayout(activity);
        overlay.setBackgroundColor(SPLASH_BG);
        host.addView(overlay, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        splashView = new WebView(activity);
        splashView.setBackgroundColor(SPLASH_BG);
        splashView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        splashView.getSettings().setJavaScriptEnabled(true);
        splashView.getSettings().setAllowFileAccess(true);
        splashView.getSettings().setAllowContentAccess(false);
        splashView.getSettings().setDomStorageEnabled(false);
        splashView.getSettings().setAllowFileAccessFromFileURLs(false);
        splashView.getSettings().setAllowUniversalAccessFromFileURLs(false);
        splashView.addJavascriptInterface(new SplashBridge(), "FaberlicSplashAndroid");
        // Splash is a trusted, offline asset. Never navigate it to a remote URL.
        splashView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return true;
            }
        });
        overlay.addView(splashView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        splashView.loadUrl("file:///android_asset/www/splash/index.html");
        ui.postDelayed(failsafe, FAILSAFE_MS);
    }

    /** The existing home page has finished loading, not merely begun loading. */
    void onMainPageReady() {
        mainReady = true;
        maybeDismiss();
    }

    private final class SplashBridge {
        @JavascriptInterface public void finishSplash() {
            activity.runOnUiThread(() -> {
                if (disposed) return;
                finishedAnimation = true;
                maybeDismiss();
            });
        }
    }

    private void maybeDismiss() {
        if (!disposed && mainReady && finishedAnimation) dismiss();
    }

    private void dismiss() {
        if (disposed || closing) return;
        closing = true;
        ui.removeCallbacks(failsafe);
        if (overlay == null) { release(); return; }
        overlay.animate().alpha(0f).setDuration(180L).withEndAction(this::release).start();
    }

    void release() {
        if (disposed) return;
        disposed = true;
        ui.removeCallbacks(failsafe);
        if (overlay != null) {
            overlay.animate().cancel();
            host.removeView(overlay);
        }
        if (splashView != null) {
            splashView.removeJavascriptInterface("FaberlicSplashAndroid");
            splashView.stopLoading();
            splashView.destroy();
            splashView = null;
        }
        overlay = null;
    }
}
