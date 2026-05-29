// Android 앱의 Capacitor 진입 Activity입니다.
package com.staronlabs.chartradar;

import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.Window;

import com.getcapacitor.BridgeActivity;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    private static final long MIN_SPLASH_DURATION_MS = 1500L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        long splashStartedAt = SystemClock.elapsedRealtime();
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> SystemClock.elapsedRealtime() - splashStartedAt < MIN_SPLASH_DURATION_MS);

        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#0B0B0F"));
        window.setNavigationBarColor(Color.parseColor("#0B0B0F"));
        window.getDecorView().setSystemUiVisibility(window.getDecorView().getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    }
}
