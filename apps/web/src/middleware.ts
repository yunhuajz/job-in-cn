import NextAuth, { type NextAuthRequest } from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { localRequestAllowed } from "./lib/local/access";

const authenticated = NextAuth(authConfig).auth((_request: NextAuthRequest, _event: NextFetchEvent) => NextResponse.next());

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (process.env.JBCN_LOCAL === "1") {
    if (!localRequestAllowed(request)) return new NextResponse("仅允许本机访问", { status: 403 });
    if (["/", "/signin", "/signup", "/dashboard"].includes(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/dashboard/myjobs", `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`));
    }
    return NextResponse.next();
  }
  const path = request.nextUrl.pathname;
  if (path.startsWith('/dashboard') || (path.startsWith('/api') && !path.startsWith('/api/auth') && !path.startsWith('/api/mcp'))) return authenticated(request, event);
  return NextResponse.next();
}

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
