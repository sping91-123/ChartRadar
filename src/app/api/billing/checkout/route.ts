import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      status: "disabled",
      error: "웹 결제는 현재 제공하지 않습니다. Android 또는 iOS 앱의 스토어 결제를 이용해 주세요."
    },
    { status: 410 }
  );
}
