// Android 앱의 Capacitor 진입 Activity입니다.
package com.staronlabs.chartradar;

import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.SystemBarStyle;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    private static final long MIN_SPLASH_DURATION_MS = 1500L;
    private static final long EXIT_BACK_INTERVAL_MS = 2000L;
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
                if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
                    getBridge().getWebView().goBack();
                    return;
                }

                long now = SystemClock.elapsedRealtime();
                if (now - lastBackPressedAt <= EXIT_BACK_INTERVAL_MS) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    return;
                }

                lastBackPressedAt = now;
                Toast.makeText(MainActivity.this, "한 번 더 누르면 종료됩니다.", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
