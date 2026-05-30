import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const AUTH_SECRET = process.env.AUTH_SECRET || "elearning-epa-dev-auth-secret-change-me";
const LOCALES = ["en", "pak"];

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

  // If path is protected (like /dashboard)
  if (pathname.startsWith("/dashboard") && !token) {
    // Redirect to login (adding the dynamic prefix to preserve localized URLs)
    const redirectPath = hasLocalePrefix ? `/${locale}/auth/login` : "/auth/login";
    const loginUrl = new URL(redirectPath, request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
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
