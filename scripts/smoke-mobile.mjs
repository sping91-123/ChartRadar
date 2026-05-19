// 모바일 앱 출시 포장 파일을 빠르게 점검하는 로컬 스모크 테스트입니다.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function pass(label, detail = "") {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail = "") {
  checks.push({ ok: false, label, detail });
}

function expectFile(relativePath, label, minBytes = 1) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(label, `${relativePath} 파일이 없습니다.`);
    return null;
  }

  const size = statSync(absolutePath).size;
  if (size < minBytes) {
    fail(label, `${relativePath} 파일 크기가 너무 작습니다. 현재 ${size} bytes입니다.`);
    return null;
  }

  pass(label, `${relativePath} ${size} bytes`);
  return absolutePath;
}

function readText(relativePath) {
  const absolutePath = join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function readPngSize(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return null;

  const buffer = readFileSync(absolutePath);
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) return null;

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

expectFile("public/brand/chart-radar-icon.png", "앱 아이콘 원본", 100000);
expectFile("public/brand/chart-radar-mark.png", "브랜드 마크", 10000);
expectFile("public/offline.html", "오프라인 안내 화면", 500);
expectFile("public/sw.js", "PWA 서비스 워커", 500);
expectFile("mobile-shell/index.html", "Capacitor 모바일 shell", 500);
expectFile("src/app/manifest.ts", "PWA manifest 소스", 500);
expectFile("capacitor.config.ts", "Capacitor 설정", 200);
expectFile("android/app/src/main/res/drawable/ic_stat_chart_radar.xml", "Android 푸시 알림 아이콘", 200);
expectFile("supabase/migrations/20260519_push_tokens.sql", "앱 푸시 토큰 마이그레이션", 500);

const iconSize = readPngSize("public/brand/chart-radar-icon.png");
if (!iconSize) {
  fail("앱 아이콘 PNG 형식", "chart-radar-icon.png가 PNG로 읽히지 않습니다.");
} else if (iconSize.width !== 1024 || iconSize.height !== 1024) {
  fail("앱 아이콘 크기", `1024x1024가 필요합니다. 현재 ${iconSize.width}x${iconSize.height}입니다.`);
} else {
  pass("앱 아이콘 크기", "1024x1024");
}

const manifestSource = readText("src/app/manifest.ts");
if (manifestSource.includes("Chart Radar") && manifestSource.includes("/brand/chart-radar-icon.png")) {
  pass("manifest 브랜드 연결", "Chart Radar 이름과 앱 아이콘을 포함합니다.");
} else {
  fail("manifest 브랜드 연결", "Chart Radar 이름 또는 앱 아이콘 경로가 빠져 있습니다.");
}

const serviceWorker = readText("public/sw.js");
if (serviceWorker.includes("CACHE_NAME") && serviceWorker.includes("/offline.html")) {
  pass("서비스 워커 오프라인 fallback", "캐시 이름과 offline 화면을 포함합니다.");
} else {
  fail("서비스 워커 오프라인 fallback", "CACHE_NAME 또는 /offline.html이 빠져 있습니다.");
}

if (serviceWorker.includes('"/global"')) {
  pass("서비스 워커 글로벌 경로 캐시", "글로벌 레이더 시작 경로를 캐시에 포함합니다.");
} else {
  fail("서비스 워커 글로벌 경로 캐시", "글로벌 레이더 시작 경로가 캐시에 없습니다.");
}

const offlineHtml = readText("public/offline.html");
if (offlineHtml.includes("Chart Radar") && offlineHtml.includes('href="/"')) {
  pass("오프라인 화면 복귀 링크", "Chart Radar 문구와 홈 복귀 링크를 포함합니다.");
} else {
  fail("오프라인 화면 복귀 링크", "Chart Radar 문구 또는 홈 복귀 링크가 빠져 있습니다.");
}

const capacitorConfig = readText("capacitor.config.ts");
if (
  capacitorConfig.includes('appId: "com.staronlabs.chartradar"') &&
  capacitorConfig.includes('appName: "Chart Radar"') &&
  capacitorConfig.includes('webDir: "mobile-shell"') &&
  capacitorConfig.includes("PushNotifications")
) {
  pass("Capacitor 앱 식별자", "앱 ID, 앱 이름, webDir, 푸시 플러그인이 연결되어 있습니다.");
} else {
  fail("Capacitor 앱 식별자", "appId, appName, webDir, PushNotifications 중 하나가 예상값과 다릅니다.");
}

const packageJson = readText("package.json");
if (packageJson.includes('"@capacitor/push-notifications"')) {
  pass("Capacitor 푸시 의존성", "@capacitor/push-notifications가 설치되어 있습니다.");
} else {
  fail("Capacitor 푸시 의존성", "@capacitor/push-notifications가 package.json에 없습니다.");
}

const androidManifest = readText("android/app/src/main/AndroidManifest.xml");
if (
  androidManifest.includes("android.permission.POST_NOTIFICATIONS") &&
  androidManifest.includes("com.google.firebase.messaging.default_notification_channel_id") &&
  androidManifest.includes("@drawable/ic_stat_chart_radar")
) {
  pass("Android 푸시 Manifest", "Android 13 권한, 기본 채널, 알림 아이콘이 연결되어 있습니다.");
} else {
  fail("Android 푸시 Manifest", "POST_NOTIFICATIONS, 기본 채널, 알림 아이콘 중 하나가 빠져 있습니다.");
}

const androidBuildGradle = readText("android/app/build.gradle");
if (androidBuildGradle.includes("google-services.json") && androidBuildGradle.includes("com.google.gms.google-services")) {
  pass("Firebase 설정 연결", "google-services.json이 있으면 Google Services 플러그인이 적용됩니다.");
} else {
  fail("Firebase 설정 연결", "Android 빌드가 google-services.json과 Google Services 플러그인을 확인하지 않습니다.");
}

const mobileShell = readText("mobile-shell/index.html");
if (mobileShell.includes("Chart Radar") && mobileShell.includes("CAPACITOR_SERVER_URL")) {
  pass("모바일 shell 안내", "Chart Radar와 CAPACITOR_SERVER_URL 안내를 포함합니다.");
} else {
  fail("모바일 shell 안내", "모바일 shell에 앱 이름 또는 서버 URL 안내가 빠져 있습니다.");
}

const failures = checks.filter((check) => !check.ok);
for (const check of checks) {
  const mark = check.ok ? "PASS" : "FAIL";
  console.log(`${mark.padEnd(4)} ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length}개 모바일 출시 항목을 다시 확인해야 합니다.`);
  process.exit(1);
}

console.log("\n모바일/PWA 출시 포장 파일이 기본 점검을 통과했습니다.");
