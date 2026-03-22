import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Require any authenticated user
const USER_PAGES = ["/stock", "/packs", "/profile"];
const USER_API = ["/api/stock", "/api/packs", "/api/auth/password"];

// Require ADMIN role
const ADMIN_PAGES = ["/admin"];
const ADMIN_API = ["/api/admin"];

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isUserPage = USER_PAGES.some((p) => pathname.startsWith(p));
  const isUserApi = USER_API.some((p) => pathname.startsWith(p));
  const isAdminPage = ADMIN_PAGES.some((p) => pathname.startsWith(p));
  const isAdminApi = ADMIN_API.some((p) => pathname.startsWith(p));

  if (!isUserPage && !isUserApi && !isAdminPage && !isAdminApi) return NextResponse.next();

  const token = req.cookies.get("session")?.value;

  if (!token) {
    if (isUserApi || isAdminApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.role as string;

    if ((isAdminPage || isAdminApi) && role !== "ADMIN") {
      if (isAdminApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    if (isUserApi || isAdminApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/stock/:path*",
    "/packs/:path*",
    "/profile/:path*",
    "/profile",
    "/admin/:path*",
    "/api/stock/:path*",
    "/api/packs/:path*",
    "/api/auth/password",
    "/api/admin/:path*",
  ],
};
