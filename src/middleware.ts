import { NextResponse, type NextRequest } from "next/server";

function newsImpactUiEnabled() {
  return process.env.NEWS_IMPACT_V1?.trim().toLowerCase() === "on";
}

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
    if (newsImpactUiEnabled() && market !== "global" && market !== "stocks") {
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

  if (newsImpactUiEnabled()) return NextResponse.next();
  if (target.pathname === "/crypto/news") {
    target.pathname = "/crypto/home";
  } else {
    const market = target.searchParams.get("market");
    target.pathname = market === "global" || market === "stocks" ? "/global" : "/crypto/home";
  }
  target.search = "";
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/alerts", "/crypto/news", "/news"]
};
