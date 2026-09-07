"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { ActionButton } from "@/components/ui/DesignPrimitives";
import { isAndroidNativeApp } from "@/lib/appPush";
import { BROWSER_ALERTS_CHANGED } from "@/lib/browserPerpetualAlerts";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

export function BrowserConditionNotifications() {
  const { session } = useSupabaseAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isAndroidNativeApp()) return;
    const update = () => setPermission("Notification" in window ? Notification.permission : "unsupported");
    update();
    window.addEventListener("focus", update);
    window.addEventListener(BROWSER_ALERTS_CHANGED, update);
    return () => { window.removeEventListener("focus", update); window.removeEventListener(BROWSER_ALERTS_CHANGED, update); };
  }, []);
  if (permission === null) return null;
  async function enable() {
    setBusy(true);
    try {
      // Request directly from a user gesture, not after the asynchronous monitor save.
      const result = await Notification.requestPermission();
      setPermission(result);
      window.dispatchEvent(new Event(BROWSER_ALERTS_CHANGED));
      if (result !== "granted") { setMessage("주소창 왼쪽 사이트 설정에서 알림을 허용해 주세요."); return; }
      const notification = new Notification("차트레이더 · 수신 테스트", {
        body: "실제 조건 발생 알림이 아닙니다. 누르면 알림 기록으로 이동합니다.", icon: "/brand/chart-radar-mark.png", tag: "chart-radar-receipt-test"
      });
      notification.onclick = () => { notification.close(); window.focus(); window.location.assign("/crypto/alertlist"); };
      notification.onerror = () => setMessage("알림 표시를 완료하지 못했습니다. Chrome과 기기의 알림 설정을 확인해 주세요.");
      setMessage("테스트 알림을 요청했습니다. 화면에 도착했는지 확인해 주세요.");
    } catch { setMessage("알림을 표시하지 못했습니다. Chrome의 사이트 알림 설정을 확인해 주세요."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 border-t border-ui-line pt-3 text-xs leading-5 text-ui-muted">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p><span className="font-semibold text-ui-text">{session && permission === "granted" ? "브라우저 알림 허용됨" : "저장한 조건의 변화를 알림으로 받으세요"}</span><br />사이트 탭이 열려 있을 때 새 서버 감시 결과를 1분 간격으로 확인합니다. 탭을 닫으면 알림 기록에서 확인해 주세요.</p>
      {session ? <ActionButton tone="secondary" onClick={enable} disabled={busy || permission === "unsupported" || permission === "denied"} className="w-full shrink-0 sm:w-auto">
        <Bell size={15} aria-hidden />{busy ? "알림 연결 중" : permission === "granted" ? "테스트 알림 받기" : permission === "unsupported" ? "브라우저 알림 미지원" : permission === "denied" ? "사이트 설정에서 알림 허용" : "이 브라우저에서 알림 받기"}
      </ActionButton> : <ActionButton tone="secondary" className="w-full shrink-0 sm:w-auto" href={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}>로그인하고 알림 연결</ActionButton>}
    </div>
    {permission === "denied" ? <p className="mt-2">주소창 왼쪽 사이트 설정 → 알림에서 허용으로 바꿔 주세요.</p> : null}
    {message ? <p role="status" className="mt-2 text-ui-brand">{message}</p> : null}
  </div>;
}
