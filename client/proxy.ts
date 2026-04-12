import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken');
  const refreshToken = request.cookies.get('refreshToken');
  const isAuthenticated = !!(accessToken || refreshToken);
  
  //
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from login page
  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // NOTE:
  // In production we run frontend and backend on different domains (Vercel + Heroku).
  // Auth cookies are set on backend domain, so they are not visible in frontend middleware.
  // If we redirect here, users get bounced to /login even after successful OAuth.
  // Protected-route auth should be validated via backend /auth/profile on the client side.

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/repositories/:path*',
  ],
};
