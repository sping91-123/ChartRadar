// 예전 BTC/ETH 주소를 새 코인 레이더 주소로 연결한다.
import { redirect } from "next/navigation";

export default function MajorsRedirectPage() {
  redirect("/crypto");
}
