// Android 앱 푸시 권한, FCM 토큰, 서버 동기화를 관리합니다.
import { Capacitor } from "@capacitor/core";
import { getActiveSupabaseSession } from "@/lib/supabase";
import { resolvePushTargetPath } from "@/lib/pushTargetPath";
import type { PushTestKind } from "@/lib/pushTestMessages";
import type { SetupAlertPreset } from "@/lib/setupAlertPresets";

export type AppPushPermission = "unsupported" | "prompt" | "prompt-with-rationale" | "granted" | "denied";
export type AppPushPlatform = "android";
export type AppPushRegistrationStage =
  | "idle"
  | "checking_permission"
  | "requesting_permission"
  | "registering_device"
  | "saving_token"
  | "enabled"
  | "denied"
  | "failed";

export interface AppPushDeviceState {
  supported: boolean;
  platform: AppPushPlatform | "web";
  permission: AppPushPermission;
  token: string | null;
  synced: boolean;
  registrationStage: AppPushRegistrationStage;
  lastFailureStage: AppPushRegistrationStage | null;
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
const appPushRegistrationTimeoutMs = 10000;
const activeAppPushStages = new Set<AppPushRegistrationStage>([
  "checking_permission",
  "requesting_permission",
  "registering_device",
  "saving_token"
]);
const appPushTimeoutMessage = "앱 푸시 연결이 완료되지 않았습니다. 앱을 다시 실행하거나 알림 권한을 확인해 주세요.";
export const radarPushChannelId = "radar-alerts";
let pushListenersRegistered = false;

interface PushNotificationActionEvent {
  data?: Record<string, unknown> | null;
  notification?: {
    data?: Record<string, unknown> | null;
    notification?: {
      data?: Record<string, unknown> | null;
    } | null;
  } | null;
}

function emptyAppPushState(): AppPushDeviceState {
  return {
    supported: isAndroidNativeApp(),
    platform: isAndroidNativeApp() ? "android" : "web",
    permission: isAndroidNativeApp() ? "prompt" : "unsupported",
    token: null,
    synced: false,
    registrationStage: "idle",
    lastFailureStage: null,
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

function isAppPushRegistrationStage(value: unknown): value is AppPushRegistrationStage {
  return (
    value === "idle" ||
    value === "checking_permission" ||
    value === "requesting_permission" ||
    value === "registering_device" ||
    value === "saving_token" ||
    value === "enabled" ||
    value === "denied" ||
    value === "failed"
  );
}

function inferRegistrationStage(parsed: Partial<AppPushDeviceState>) {
  if (isAppPushRegistrationStage(parsed.registrationStage)) return parsed.registrationStage;
  if (parsed.permission === "granted" && parsed.synced && parsed.token) return "enabled";
  if (parsed.permission === "denied") return "denied";
  if (parsed.lastError) return "failed";
  return "idle";
}

function normalizeStaleRegistrationStage(stage: AppPushRegistrationStage, updatedAt: string | null | undefined) {
  if (!activeAppPushStages.has(stage)) return stage;
  if (!updatedAt) return "failed";
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) return "failed";
  return Date.now() - updatedTime > appPushRegistrationTimeoutMs ? "failed" : stage;
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
        registrationStage: "idle",
        lastFailureStage: null,
        updatedAt: parsed.updatedAt ?? null,
        lastError: null,
        lastNotificationTitle: null
      };
    }

    const inferredStage = inferRegistrationStage(parsed);
    const registrationStage = normalizeStaleRegistrationStage(inferredStage, parsed.updatedAt);

    return {
      ...emptyAppPushState(),
      ...parsed,
      supported: true,
      platform: "android",
      permission: parsed.permission ?? "prompt",
      token: parsed.token ?? null,
      synced: Boolean(parsed.synced && parsed.token),
      registrationStage,
      lastFailureStage:
        registrationStage === "failed"
          ? isAppPushRegistrationStage(parsed.lastFailureStage)
            ? parsed.lastFailureStage
            : activeAppPushStages.has(inferredStage)
              ? inferredStage
              : null
          : null,
      updatedAt: parsed.updatedAt ?? null,
      lastError: registrationStage === "failed" ? parsed.lastError ?? appPushTimeoutMessage : parsed.lastError ?? null,
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
        registrationStage: "idle" as const,
        lastFailureStage: null,
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

function createAndroidAppPushState(patch: Partial<AppPushDeviceState>): AppPushDeviceState {
  return {
    ...readAppPushState(),
    supported: true,
    platform: "android",
    updatedAt: new Date().toISOString(),
    ...patch
  };
}

function writeAndroidAppPushStage(stage: AppPushRegistrationStage, patch: Partial<AppPushDeviceState> = {}) {
  console.info("[app-push] registration stage", stage);
  return writeAppPushState(
    createAndroidAppPushState({
      registrationStage: stage,
      lastFailureStage: stage === "failed" ? patch.lastFailureStage ?? readAppPushState().lastFailureStage : null,
      lastError: stage === "failed" ? patch.lastError ?? appPushTimeoutMessage : patch.lastError ?? null,
      ...patch
    })
  );
}

function userFacingPushError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "앱 푸시 알림 연결에 실패했습니다.";
}

function withAppPushTimeout<T>(promise: Promise<T>, stage: AppPushRegistrationStage, message = appPushTimeoutMessage) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      console.warn("[app-push] registration stage timeout", { stage });
      reject(new Error(message));
    }, appPushRegistrationTimeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
}

async function loadPushNotifications() {
  if (!isAndroidNativeApp()) return null;
  const pushNotificationsModule = await import("@capacitor/push-notifications");
  return { plugin: pushNotificationsModule.PushNotifications };
}

type PushNotificationsPlugin = NonNullable<Awaited<ReturnType<typeof loadPushNotifications>>>["plugin"];

function pushActionData(event: PushNotificationActionEvent) {
  return {
    ...(event.notification?.notification?.data ?? {}),
    ...(event.notification?.data ?? {}),
    ...(event.data ?? {})
  };
}

async function waitForPushRegistration(PushNotifications: PushNotificationsPlugin) {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let registrationHandle: { remove: () => Promise<void> } | null = null;
    let errorHandle: { remove: () => Promise<void> } | null = null;
    const timeoutHandle = setTimeout(() => {
      finish(() => reject(new Error("기기 푸시 연결 정보를 받지 못했습니다. 최신 앱으로 다시 설치한 뒤 시도해 주세요.")));
    }, appPushRegistrationTimeoutMs);

    function cleanup() {
      clearTimeout(timeoutHandle);
      void registrationHandle?.remove();
      void errorHandle?.remove();
    }

    function finish(callback: () => void) {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    }

    void (async () => {
      try {
        registrationHandle = await PushNotifications.addListener("registration", (registration) => {
          const value = typeof registration.value === "string" ? registration.value.trim() : "";
          console.info("[app-push] registration event received", { hasValue: Boolean(value) });
          finish(() => {
            if (value) resolve(value);
            else reject(new Error("기기 푸시 연결 정보를 받지 못했습니다. 최신 앱으로 다시 설치한 뒤 시도해 주세요."));
          });
        });
        if (settled) {
          void registrationHandle.remove();
          return;
        }
        errorHandle = await PushNotifications.addListener("registrationError", (error) => {
          console.warn("[app-push] registrationError event", error);
          finish(() => reject(new Error(appPushTimeoutMessage)));
        });
        if (settled) {
          void errorHandle.remove();
          return;
        }
        console.info("[app-push] register called");
        await PushNotifications.register();
      } catch (error) {
        console.warn("[app-push] registration call failed", error);
        finish(() => reject(error instanceof Error ? error : new Error("앱 푸시 알림 연결에 실패했습니다.")));
      }
    })();
  });
}

async function syncTokenToServer(token: string, preferences: AppPushPreferences) {
  const session = await getActiveSupabaseSession();
  if (!session?.accessToken) {
    return { synced: false, error: "로그인 후 앱 푸시 알림을 계정에 연결할 수 있습니다." };
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
    return { synced: false, error: payload.error ?? "앱 푸시 알림 연결에 실패했습니다." };
  }

  return { synced: true, error: null };
}

async function ensureRadarPushChannel() {
  const pushNotifications = await loadPushNotifications();
  const PushNotifications = pushNotifications?.plugin;
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
  let currentStage: AppPushRegistrationStage = "checking_permission";
  try {
    writeAndroidAppPushStage("checking_permission");
    const pushNotifications = await withAppPushTimeout(loadPushNotifications(), "checking_permission");
    const PushNotifications = pushNotifications?.plugin;
    if (!PushNotifications) {
      return writeAppPushState({
        ...emptyAppPushState(),
        permission: "unsupported",
        registrationStage: "failed",
        lastFailureStage: "checking_permission",
        lastError: "앱에서만 푸시 알림을 켤 수 있습니다."
      });
    }

    let permission = await withAppPushTimeout(PushNotifications.checkPermissions(), "checking_permission");

    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      currentStage = "requesting_permission";
      writeAndroidAppPushStage("requesting_permission", { permission: permission.receive });
      permission = await withAppPushTimeout(PushNotifications.requestPermissions(), "requesting_permission");
    }

    if (permission.receive !== "granted") {
      return writeAndroidAppPushStage("denied", {
        permission: permission.receive,
        token: null,
        synced: false,
        lastFailureStage: null,
        lastError: "알림 권한이 거부되었습니다. 휴대폰 설정에서 알림을 허용해주세요.",
      });
    }

    currentStage = "registering_device";
    writeAndroidAppPushStage("registering_device", { permission: "granted", synced: false, token: null });
    await withAppPushTimeout(ensureRadarPushChannel(), "registering_device");
    const token = await waitForPushRegistration(PushNotifications);

    currentStage = "saving_token";
    writeAndroidAppPushStage("saving_token", { permission: "granted", token, synced: false });
    const syncResult = await withAppPushTimeout(syncTokenToServer(token, preferences), "saving_token");
    if (!syncResult.synced) {
      return writeAndroidAppPushStage("failed", {
        permission: "granted",
        token,
        synced: false,
        lastFailureStage: "saving_token",
        lastError: syncResult.error ?? "앱 푸시 알림 연결에 실패했습니다."
      });
    }

    return writeAndroidAppPushStage("enabled", {
      permission: "granted",
      token,
      synced: true,
      lastFailureStage: null,
      lastError: null,
      lastNotificationTitle: readAppPushState().lastNotificationTitle
    });
  } catch (error) {
    console.warn("[app-push] registration failed", { stage: currentStage, error });
    return writeAndroidAppPushStage("failed", {
      synced: false,
      lastFailureStage: currentStage,
      lastError: userFacingPushError(error)
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
    registrationStage: syncResult.synced ? "enabled" : "failed",
    lastFailureStage: syncResult.synced ? null : "saving_token",
    lastError: syncResult.error,
    updatedAt: new Date().toISOString()
  });
}

export async function disableAndroidAppPush() {
  if (!isAndroidNativeApp()) {
    return writeAppPushState({
      ...emptyAppPushState(),
      permission: "unsupported",
      lastError: "앱에서만 푸시 알림을 끌 수 있습니다."
    });
  }

  const state = readAppPushState();
  if (!state.token) return state;

  const session = await getActiveSupabaseSession();
  if (!session?.accessToken) throw new Error("로그인 후 앱 푸시 알림을 해제할 수 있습니다.");

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
  if (!response.ok) throw new Error(payload.error ?? "앱 푸시 알림 해제에 실패했습니다.");

  const pushNotifications = await loadPushNotifications();
  await pushNotifications?.plugin.unregister();

  return writeAppPushState({
    ...emptyAppPushState(),
    supported: true,
    platform: "android",
    permission: "prompt",
    updatedAt: new Date().toISOString()
  });
}

export async function sendAndroidAppPushTest(kind: PushTestKind = "default") {
  if (!isAndroidNativeApp()) throw new Error("앱에서만 테스트 알림을 보낼 수 있습니다.");

  const session = await getActiveSupabaseSession();
  if (!session?.accessToken) throw new Error("로그인 후 테스트 알림을 보낼 수 있습니다.");

  const response = await fetch("/api/push-test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ kind })
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "테스트 알림 발송에 실패했습니다.");
  return payload;
}

export async function registerAppPushListeners() {
  const pushNotifications = await loadPushNotifications();
  const PushNotifications = pushNotifications?.plugin;
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

  await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    const pushData = pushActionData(event as PushNotificationActionEvent);
    const targetPath = resolvePushTargetPath(pushData);
    console.info("[app-push] notification action performed", {
      targetPath,
      dataKeys: Object.keys(pushData).sort()
    });
    if (typeof window !== "undefined") window.location.assign(targetPath);
  });
}
