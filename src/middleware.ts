import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const target = request.nextUrl.clone();
  if (target.pathname === "/alerts") {
    if (target.searchParams.get("market") !== "crypto") return NextResponse.next();
    target.pathname = "/crypto/alertlist";
    target.search = "";
    return NextResponse.redirect(target);
  }

  if (target.pathname === "/news") {
    const market = target.searchParams.get("market");
    if (market !== "global" && market !== "stocks") {
      const preserved = new URLSearchParams();
      for (const key of ["asset", "event", "snapshot", "source"] as const) {
        const value = target.searchParams.get(key);
        if (value) preserved.set(key, value.slice(0, 256));
      }
      target.pathname = "/crypto/news";
      target.search = preserved.size > 0 ? `?${preserved.toString()}` : "";
      return NextResponse.redirect(target);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/alerts", "/crypto/news", "/news"]
};
