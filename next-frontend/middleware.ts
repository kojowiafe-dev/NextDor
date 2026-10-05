import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  // Check for authentication cookies
  const hasAuth = Boolean(
    request.cookies.get("refresh_token")?.value ||
    request.cookies.get("nextdor_session")?.value ||
    request.cookies.get("nextdor-token")?.value ||
    request.cookies.get("vendor_token")?.value
  );

  // Protected route prefixes
  const isAdminRoute = pathname.startsWith("/admin");
  const isVendorRoute = pathname.startsWith("/vendor");
  const isAccountRoute = pathname.startsWith("/account");

  // Tag portal routes so StoreLayout skips the public storefront shell
  if (isAdminRoute || isVendorRoute) {
    requestHeaders.set("x-is-admin-route", "true");
    requestHeaders.set("x-is-portal-route", "true");
  }

  // 1. Admin portal protection (except /admin/login)
  if (isAdminRoute && !pathname.startsWith("/admin/login")) {
    if (!hasAuth) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Vendor portal protection (except /vendor/register)
  if (isVendorRoute && !pathname.startsWith("/vendor/register")) {
    if (!hasAuth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Customer account protection
  if (isAccountRoute) {
    if (!hasAuth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
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

