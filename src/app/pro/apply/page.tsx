// 예전 Pro 신청 주소를 새 구독 안내 페이지로 연결한다.
import { redirect } from "next/navigation";

export default function ProApplyPage() {
  redirect("/pro");
}
