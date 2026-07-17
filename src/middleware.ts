import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market");
  if (market === "global" || market === "stocks") return NextResponse.next();

  const destination = request.nextUrl.clone();
  destination.pathname = request.nextUrl.pathname === "/news" ? "/crypto/news" : "/crypto/alertlist";
  destination.search = "";
  return NextResponse.redirect(destination, 307);
}

export const config = {
  matcher: ["/news", "/alerts"]
};
