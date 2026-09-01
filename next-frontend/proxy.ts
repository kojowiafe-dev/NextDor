import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  // Tag all admin-route requests so StoreLayout can skip storefront UI
  if (request.nextUrl.pathname.startsWith("/admin")) {
    response.headers.set("x-is-admin-route", "true");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
