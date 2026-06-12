// Capacitor entry Activity for the Android app.
package com.staronlabs.chartradar;

import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.SystemBarStyle;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long MIN_SPLASH_DURATION_MS = 1500L;
    private static final long EXIT_BACK_INTERVAL_MS = 2000L;
    private static final String HOME_PATH = "/crypto/home";
    private long lastBackPressedAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        long splashStartedAt = SystemClock.elapsedRealtime();
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> SystemClock.elapsedRealtime() - splashStartedAt < MIN_SPLASH_DURATION_MS);

        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && !isHomePath(webView.getUrl())) {
                    lastBackPressedAt = 0L;
                    webView.evaluateJavascript("window.location.replace('" + HOME_PATH + "')", null);
                    return;
                }

                long now = SystemClock.elapsedRealtime();
                if (now - lastBackPressedAt <= EXIT_BACK_INTERVAL_MS) {
                    finish();
                    return;
                }

                lastBackPressedAt = now;
                Toast.makeText(MainActivity.this, "\ud55c \ubc88 \ub354 \ub204\ub974\uba74 \uc885\ub8cc\ub429\ub2c8\ub2e4.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private boolean isHomePath(String url) {
        if (url == null || url.isEmpty()) return false;

        try {
            Uri uri = Uri.parse(url);
            return HOME_PATH.equals(uri.getPath());
        } catch (Exception ignored) {
            return false;
        }
    }
}
