// 예전 Pro 신청 주소를 구독 안내 페이지로 연결합니다.
import { redirect } from "next/navigation";

export default function ProApplyPage() {
  redirect("/pro");
}
