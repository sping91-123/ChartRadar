import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      status: "disabled",
      error: "웹 결제 확인은 비활성화되어 있습니다. 결제 공급자 호출이나 권한 변경을 수행하지 않았습니다."
    },
    { status: 410 }
  );
}
