// Capacitor entry Activity for the Android app.
package com.staronlabs.chartradar;

import android.content.Intent;
import android.content.SharedPreferences;
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

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private static final long MIN_SPLASH_DURATION_MS = 1500L;
    private static final long EXIT_BACK_INTERVAL_MS = 2000L;
    private static final String HOME_PATH = "/crypto/home";
    private static final String PRO_PATH = "/pro";
    private static final String CAMPAIGN_PREFS = "coin_pro_campaign";
    private static final String INSTALL_REFERRER_CONSUMED = "install_referrer_consumed";
    private static final String PENDING_INSTALL_REFERRER_ROUTE = "pending_install_referrer_route";
    private static final Set<String> ALLOWED_SOURCES = new HashSet<>(Arrays.asList(
            "direct", "crypto-gate", "alt-analysis", "alt-analysis-limit", "alt-scout", "watchlist",
            "perpetual-evidence", "perpetual-monitor", "paused-monitor", "perpetual-ai", "ai-limit", "alert-limit",
            "usage-meter", "spot-condition", "news", "exchange-journal", "perpetual-monitor-limit"
    ));
    private static final Set<String> ALLOWED_PLACEMENTS = new HashSet<>(Arrays.asList(
            "direct_paywall", "crypto_detail_lock", "alt_usage_banner", "alt_daily_limit", "alt_scout_results",
            "watchlist_limit", "perpetual_evidence_lock", "perpetual_monitor_lock", "perpetual_ai_lock", "ai_daily_limit",
            "alert_limit", "usage_meter", "spot_condition"
    ));
    private static final Set<String> ALLOWED_ROUTES = new HashSet<>(Arrays.asList(
            "crypto_home", "perpetual_btc", "perpetual_eth", "alts", "spot", "alerts", "journal"
    ));
    private static final Set<String> ALLOWED_MARKETS = new HashSet<>(Arrays.asList(
            "crypto", "stocks", "all"
    ));
    private long lastBackPressedAt = 0L;
    private String pendingCampaignRoute = null;
    private boolean pendingNavigationFromInstallReferrer = false;
    private int pendingNavigationAttempts = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        long splashStartedAt = SystemClock.elapsedRealtime();
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> SystemClock.elapsedRealtime() - splashStartedAt < MIN_SPLASH_DURATION_MS);

        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        super.onCreate(savedInstanceState);

        Intent launchIntent = getIntent();
        boolean acceptedAppLink = handleCampaignUri(launchIntent != null ? launchIntent.getData() : null, false);
        if (!acceptedAppLink) {
            restorePendingInstallReferrerRoute();
            consumeInstallReferrerOnce();
        }

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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCampaignUri(intent != null ? intent.getData() : null, false);
    }

    private void restorePendingInstallReferrerRoute() {
        SharedPreferences preferences = getSharedPreferences(CAMPAIGN_PREFS, MODE_PRIVATE);
        String pendingRoute = preferences.getString(PENDING_INSTALL_REFERRER_ROUTE, null);
        if (pendingRoute == null || !pendingRoute.startsWith(PRO_PATH + "?")) return;
        navigateWebView(pendingRoute, true);
    }

    private void consumeInstallReferrerOnce() {
        SharedPreferences preferences = getSharedPreferences(CAMPAIGN_PREFS, MODE_PRIVATE);
        if (preferences.getBoolean(INSTALL_REFERRER_CONSUMED, false)) return;
        if (preferences.getString(PENDING_INSTALL_REFERRER_ROUTE, null) != null) return;

        InstallReferrerClient client = InstallReferrerClient.newBuilder(this).build();
        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                try {
                    if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                        ReferrerDetails details = client.getInstallReferrer();
                        String referrer = details != null ? details.getInstallReferrer() : null;
                        boolean acceptedCampaign = false;
                        if (referrer != null && !referrer.isEmpty()) {
                            Uri campaignUri = Uri.parse("https://chartradar.kr/pro?" + referrer);
                            if ("coin-pro-v2".equals(campaignUri.getQueryParameter("campaign"))) {
                                acceptedCampaign = handleCampaignUri(campaignUri, true);
                            }
                        }
                        if (!acceptedCampaign) {
                            preferences.edit().putBoolean(INSTALL_REFERRER_CONSUMED, true).apply();
                        }
                    }
                } catch (Exception ignored) {
                    // Keep the referrer unconsumed so a later app start can retry safely.
                } finally {
                    client.endConnection();
                }
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                // Google Play reconnects on the next cold start.
            }
        });
    }

    private boolean handleCampaignUri(Uri uri, boolean fromInstallReferrer) {
        if (uri == null || !"https".equals(uri.getScheme()) || !"chartradar.kr".equals(uri.getHost())) return false;
        if (!PRO_PATH.equals(uri.getPath())) return false;

        Uri.Builder safeRoute = new Uri.Builder().path(PRO_PATH);
        String market = uri.getQueryParameter("market");
        if ("coin-pro-v2".equals(uri.getQueryParameter("campaign")) && market == null) {
            market = "crypto";
        }
        appendAllowlistedQuery(safeRoute, "market", market, ALLOWED_MARKETS);
        appendAllowlistedQuery(safeRoute, "source", uri.getQueryParameter("source"), ALLOWED_SOURCES);
        appendAllowlistedQuery(safeRoute, "placement", uri.getQueryParameter("placement"), ALLOWED_PLACEMENTS);
        appendAllowlistedQuery(safeRoute, "route", uri.getQueryParameter("route"), ALLOWED_ROUTES);

        String funnel = uri.getQueryParameter("funnel");
        if (funnel != null && funnel.matches("^[a-fA-F0-9-]{16,64}$")) {
            safeRoute.appendQueryParameter("funnel", funnel.toLowerCase());
        }

        String symbol = uri.getQueryParameter("symbol");
        if (symbol != null) {
            String normalizedSymbol = symbol.toUpperCase().replaceAll("[^A-Z0-9._-]", "");
            if (!normalizedSymbol.isEmpty() && normalizedSymbol.length() <= 24) {
                safeRoute.appendQueryParameter("symbol", normalizedSymbol);
            }
        }

        String relativeRoute = safeRoute.build().toString();
        if (fromInstallReferrer) {
            getSharedPreferences(CAMPAIGN_PREFS, MODE_PRIVATE)
                    .edit()
                    .putString(PENDING_INSTALL_REFERRER_ROUTE, relativeRoute)
                    .apply();
        }
        navigateWebView(relativeRoute, fromInstallReferrer);
        return true;
    }

    private void appendAllowlistedQuery(Uri.Builder builder, String key, String value, Set<String> allowed) {
        if (value != null && allowed.contains(value)) builder.appendQueryParameter(key, value);
    }

    private void navigateWebView(String relativeRoute, boolean fromInstallReferrer) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        pendingCampaignRoute = relativeRoute;
        pendingNavigationFromInstallReferrer = fromInstallReferrer;
        pendingNavigationAttempts = 0;
        webView.post(() -> attemptPendingCampaignNavigation(webView));
    }

    private void attemptPendingCampaignNavigation(WebView webView) {
        if (pendingCampaignRoute == null || pendingNavigationAttempts >= 50) return;
        pendingNavigationAttempts += 1;
        webView.evaluateJavascript(
                "(window.location.hostname === 'chartradar.kr' && (document.readyState === 'interactive' || document.readyState === 'complete')) ? 'ready' : 'wait'",
                readyState -> {
            if (pendingCampaignRoute == null) return;
            if ("\"ready\"".equals(readyState)) {
                String route = pendingCampaignRoute;
                boolean fromInstallReferrer = pendingNavigationFromInstallReferrer;
                pendingCampaignRoute = null;
                pendingNavigationFromInstallReferrer = false;
                String script = "window.location.replace(" + JSONObject.quote(route) + ")";
                webView.evaluateJavascript(script, ignored -> {
                    if (fromInstallReferrer) {
                        getSharedPreferences(CAMPAIGN_PREFS, MODE_PRIVATE)
                                .edit()
                                .putBoolean(INSTALL_REFERRER_CONSUMED, true)
                                .remove(PENDING_INSTALL_REFERRER_ROUTE)
                                .apply();
                    }
                });
                return;
            }
            webView.postDelayed(() -> attemptPendingCampaignNavigation(webView), 200L);
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
