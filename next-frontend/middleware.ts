import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Tag all admin and vendor portal requests so StoreLayout skips the public storefront shell (Header, CategoryNav, and Footer)
  if (
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/vendor")
  ) {
    requestHeaders.set("x-is-admin-route", "true");
    requestHeaders.set("x-is-portal-route", "true");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
