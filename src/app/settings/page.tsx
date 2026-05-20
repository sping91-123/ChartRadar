// 설정 메뉴의 지표 안내 진입 경로를 기존 안내 화면으로 연결합니다.
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/learn");
}
