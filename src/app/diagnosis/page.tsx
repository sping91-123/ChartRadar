// 구형 진입진단 주소를 현재 계산기 화면으로 연결하는 라우트입니다.
import { redirect } from "next/navigation";

export default function DiagnosisPage() {
  redirect("/majors");
}
