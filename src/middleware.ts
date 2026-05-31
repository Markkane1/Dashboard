import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/env";
import { hasAnyPermission, normalizePermissions, normalizeRoles, normalizeUserRole, PERMISSIONS, type Permission } from "@/shared/permissions";

const AUTH_SECRET = env.AUTH_SECRET;
const LOCALES = ["en", "pak"];
const AUTHENTICATED_ROUTES = ["/dashboard"];
// Map route prefixes to required permission for access
const PERMISSION_ROUTES = [
  { prefix: "/dashboard", permissions: [PERMISSIONS.ACCESS_DASHBOARD] },
  { prefix: "/instructor", permissions: [PERMISSIONS.ACCESS_INSTRUCTOR, PERMISSIONS.MANAGE_CONTENT] },
  { prefix: "/admin", permissions: [PERMISSIONS.ACCESS_ADMIN, PERMISSIONS.MANAGE_USERS] },
];

function isRoute(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function loginRedirect(request: NextRequest, hasLocalePrefix: boolean, locale: string) {
  const redirectPath = hasLocalePrefix ? `/${locale}/auth/login` : "/auth/login";
  const loginUrl = new URL(redirectPath, request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(loginUrl);
}

function unauthorizedRedirect(request: NextRequest, hasLocalePrefix: boolean, locale: string) {
  const redirectPath = hasLocalePrefix ? `/${locale}/dashboard` : "/dashboard";
  const dashboardUrl = new URL(redirectPath, request.url);
  dashboardUrl.searchParams.set("error", "unauthorized");
  return NextResponse.redirect(dashboardUrl);
}

export async function middleware(request: NextRequest) {
  let pathname = request.nextUrl.pathname;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  // 2. Internationalization / Locale Prefix Handling
  let locale = "en";
  let hasLocalePrefix = false;

  const matchedLocale = LOCALES.find(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  );

  if (matchedLocale) {
    locale = matchedLocale;
    hasLocalePrefix = true;
    // Strip the locale prefix for routing internal pages
    pathname = pathname === `/${matchedLocale}` 
      ? "/" 
      : pathname.slice(matchedLocale.length + 1);
  }

  // 3. Session & Route Protection Check
  // Check token for authentication
  const token = await getToken({ req: request, secret: AUTH_SECRET });
  const protectedByAuth = AUTHENTICATED_ROUTES.some((prefix) => isRoute(pathname, prefix));
  const protectedByRole = PERMISSION_ROUTES.find((route) => isRoute(pathname, route.prefix));

  if ((protectedByAuth || protectedByRole) && !token) {
    return loginRedirect(request, hasLocalePrefix, locale);
  }

  if (protectedByRole && token) {
    const user = {
      role: normalizeUserRole(token.role),
      roles: normalizeRoles(token.roles, [normalizeUserRole(token.role)]),
      permissions: normalizePermissions(token.permissions),
    };
    if (!hasAnyPermission(user, protectedByRole.permissions as Permission[])) {
      return unauthorizedRedirect(request, hasLocalePrefix, locale);
    }
  }

  // 4. Perform the Internal Rewrite if localized
  if (hasLocalePrefix) {
    const rewriteUrl = new URL(pathname, request.url);
    rewriteUrl.search = request.nextUrl.search;
    const response = NextResponse.rewrite(rewriteUrl);
    // Attach the current locale as a response header so that layout/components can access it if needed
    response.headers.set("x-next-locale", locale);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api(?!/auth/callback/credentials)|_next/static|_next/image|favicon.ico|logo.png|.*\\.svg|.*\\.ico).*)",
  ],
};
