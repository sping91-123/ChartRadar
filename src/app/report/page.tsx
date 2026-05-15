// 숨긴 검증 페이지를 차트 판독 화면으로 돌려보내는 라우트
import { redirect } from "next/navigation";

export default function ReportPage() {
  redirect("/majors");
}
