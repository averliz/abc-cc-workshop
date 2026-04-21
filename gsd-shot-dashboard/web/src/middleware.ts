import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Must match backend Settings.cookie_name (see backend/src/config.py). Drift = broken auth.
const SESSION_COOKIE = 'osint_session';

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.get(SESSION_COOKIE);
  if (!hasSession && req.nextUrl.pathname !== '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (hasSession && req.nextUrl.pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
