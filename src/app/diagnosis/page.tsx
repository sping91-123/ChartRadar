// 제거된 진입진단 주소를 현재 코인 레이더 화면으로 연결한다.
import { redirect } from "next/navigation";

export default function DiagnosisRedirectPage() {
  redirect("/crypto/home");
}
