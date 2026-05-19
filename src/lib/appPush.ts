// Android 앱 푸시 권한, FCM 토큰, 서버 동기화를 관리합니다.
import { Capacitor } from "@capacitor/core";
import { getActiveSupabaseSession } from "@/lib/supabase";
import type { SetupAlertPreset } from "@/lib/setupAlertPresets";

export type AppPushPermission = "unsupported" | "prompt" | "prompt-with-rationale" | "granted" | "denied";
export type AppPushPlatform = "android";

export interface AppPushDeviceState {
  supported: boolean;
  platform: AppPushPlatform | "web";
  permission: AppPushPermission;
  token: string | null;
  synced: boolean;
  updatedAt: string | null;
  lastError: string | null;
  lastNotificationTitle: string | null;
}

export interface AppPushPreferences {
  market: "crypto" | "stocks";
  ruleIds: string[];
  presets?: SetupAlertPreset[];
}

const appPushStorageKey = "chartRadar.appPush.device.v1";
const appPushChangedEvent = "chartRadar:appPushChanged";
export const radarPushChannelId = "radar-alerts";
let pushListenersRegistered = false;

function emptyAppPushState(): AppPushDeviceState {
  return {
    supported: isAndroidNativeApp(),
    platform: isAndroidNativeApp() ? "android" : "web",
    permission: isAndroidNativeApp() ? "prompt" : "unsupported",
    token: null,
    synced: false,
    updatedAt: null,
    lastError: null,
    lastNotificationTitle: null
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function isAndroidNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function readAppPushState(): AppPushDeviceState {
  if (!canUseStorage()) return emptyAppPushState();

  try {
    const isAndroidApp = isAndroidNativeApp();
    const raw = window.localStorage.getItem(appPushStorageKey);
    if (!raw) return emptyAppPushState();
    const parsed = JSON.parse(raw) as Partial<AppPushDeviceState>;
    if (!isAndroidApp) {
      return {
        ...emptyAppPushState(),
        supported: false,
        platform: "web",
        permission: "unsupported",
        token: null,
        synced: false,
        updatedAt: parsed.updatedAt ?? null,
        lastError: null,
        lastNotificationTitle: null
      };
    }

    return {
      ...emptyAppPushState(),
      ...parsed,
      supported: true,
      platform: "android",
      permission: parsed.permission ?? "prompt",
      token: parsed.token ?? null,
      synced: Boolean(parsed.synced && parsed.token),
      updatedAt: parsed.updatedAt ?? null,
      lastError: parsed.lastError ?? null,
      lastNotificationTitle: parsed.lastNotificationTitle ?? null
    };
  } catch {
    return emptyAppPushState();
  }
}

function writeAppPushState(next: AppPushDeviceState) {
  const sanitized = isAndroidNativeApp()
    ? next
    : {
        ...emptyAppPushState(),
        supported: false,
        platform: "web" as const,
        permission: "unsupported" as const,
        token: null,
        synced: false,
        updatedAt: next.updatedAt,
        lastError: next.lastError,
        lastNotificationTitle: null
      };
  if (!canUseStorage()) return sanitized;
  window.localStorage.setItem(appPushStorageKey, JSON.stringify(sanitized));
  window.dispatchEvent(new CustomEvent(appPushChangedEvent, { detail: sanitized }));
  return sanitized;
}

export function subscribeAppPushState(listener: (state: AppPushDeviceState) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener(readAppPushState());
  window.addEventListener(appPushChangedEvent, handler);
  return () => window.removeEventListener(appPushChangedEvent, handler);
}

async function loadPushNotifications() {
  if (!isAndroidNativeApp()) return null;
  const pushNotificationsModule = await import("@capacitor/push-notifications");
  return pushNotificationsModule.PushNotifications;
}

async function syncTokenToServer(token: string, preferences: AppPushPreferences) {
  const session = await getActiveSupabaseSession();
  if (!session?.accessToken) {
    return { synced: false, error: "로그인 후 앱 푸시 토큰을 서버에 연결할 수 있습니다." };
  }

  const response = await fetch("/api/push-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token,
      platform: "android",
      appId: "com.staronlabs.chartradar",
      markets: [preferences.market],
      ruleIds: preferences.ruleIds,
      presets: preferences.presets ?? [],
      enabled: true
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return { synced: false, error: payload.error ?? "앱 푸시 토큰 저장에 실패했습니다." };
  }

  return { synced: true, error: null };
}

async function ensureRadarPushChannel() {
  const PushNotifications = await loadPushNotifications();
  if (!PushNotifications) return;

  await PushNotifications.createChannel({
    id: radarPushChannelId,
    name: "Chart Radar Alerts",
    description: "레이더 조건, 뉴스, 시장 변화 알림",
    importance: 4,
    visibility: 1,
    lights: true,
    lightColor: "#0284c7",
    vibration: true
  });
}

export async function registerAndroidAppPush(preferences: AppPushPreferences) {
  const PushNotifications = await loadPushNotifications();
  if (!PushNotifications) {
    return writeAppPushState({
      ...emptyAppPushState(),
      permission: "unsupported",
      lastError: "Android 앱 환경에서만 앱 푸시를 등록할 수 있습니다."
    });
  }

  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== "granted") {
      return writeAppPushState({
        ...readAppPushState(),
        supported: true,
        platform: "android",
        permission: permission.receive,
        synced: false,
        lastError: "앱 푸시 권한이 허용되지 않았습니다.",
        updatedAt: new Date().toISOString()
      });
    }

    await ensureRadarPushChannel();

    const token = await new Promise<string>(async (resolve, reject) => {
      let registrationHandle: { remove: () => Promise<void> } | null = null;
      let errorHandle: { remove: () => Promise<void> } | null = null;

      registrationHandle = await PushNotifications.addListener("registration", (registration) => {
        void registrationHandle?.remove();
        void errorHandle?.remove();
        resolve(registration.value);
      });
      errorHandle = await PushNotifications.addListener("registrationError", (error) => {
        void registrationHandle?.remove();
        void errorHandle?.remove();
        reject(new Error(error.error));
      });
      await PushNotifications.register();
    });

    const syncResult = await syncTokenToServer(token, preferences);
    return writeAppPushState({
      supported: true,
      platform: "android",
      permission: "granted",
      token,
      synced: syncResult.synced,
      updatedAt: new Date().toISOString(),
      lastError: syncResult.error,
      lastNotificationTitle: readAppPushState().lastNotificationTitle
    });
  } catch (error) {
    return writeAppPushState({
      ...readAppPushState(),
      supported: true,
      platform: "android",
      synced: false,
      lastError: error instanceof Error ? error.message : "앱 푸시 등록에 실패했습니다.",
      updatedAt: new Date().toISOString()
    });
  }
}

export async function syncAndroidAppPushPreferences(preferences: AppPushPreferences) {
  if (!isAndroidNativeApp()) return readAppPushState();
  const state = readAppPushState();
  if (!state.supported || !state.token || state.permission !== "granted") return state;

  const syncResult = await syncTokenToServer(state.token, preferences);
  return writeAppPushState({
    ...state,
    synced: syncResult.synced,
    lastError: syncResult.error,
    updatedAt: new Date().toISOString()
  });
}

export async function disableAndroidAppPush() {
  if (!isAndroidNativeApp()) {
    return writeAppPushState({
      ...emptyAppPushState(),
      permission: "unsupported",
      lastError: "Android 앱 환경에서만 앱 푸시를 해제할 수 있습니다."
    });
  }

  const state = readAppPushState();
  if (!state.token) return state;

  const session = await getActiveSupabaseSession();
  if (!session?.accessToken) throw new Error("로그인 후 앱 푸시 토큰을 해제할 수 있습니다.");

  const response = await fetch("/api/push-tokens", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token: state.token,
      platform: "android"
    })
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "앱 푸시 토큰 해제에 실패했습니다.");

  const PushNotifications = await loadPushNotifications();
  await PushNotifications?.unregister();

  return writeAppPushState({
    ...emptyAppPushState(),
    supported: true,
    platform: "android",
    permission: "prompt",
    updatedAt: new Date().toISOString()
  });
}

export async function sendAndroidAppPushTest() {
  if (!isAndroidNativeApp()) throw new Error("Android 앱에서만 테스트 앱 푸시를 보낼 수 있습니다.");

  const session = await getActiveSupabaseSession();
  if (!session?.accessToken) throw new Error("로그인 후 테스트 푸시를 보낼 수 있습니다.");

  const response = await fetch("/api/push-test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "테스트 푸시 발송에 실패했습니다.");
  return payload;
}

export async function registerAppPushListeners() {
  const PushNotifications = await loadPushNotifications();
  if (!PushNotifications) return;
  if (pushListenersRegistered) return;
  pushListenersRegistered = true;

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    writeAppPushState({
      ...readAppPushState(),
      lastNotificationTitle: notification.title ?? "Chart Radar 앱 푸시",
      updatedAt: new Date().toISOString()
    });
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", () => {
    if (typeof window !== "undefined") window.location.href = "/alerts";
  });
}
