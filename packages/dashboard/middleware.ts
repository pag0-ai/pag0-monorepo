import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const isNewUser = req.auth?.isNewUser;

  // Let login page through
  if (nextUrl.pathname === '/login') {
    if (isLoggedIn) {
      const target = isNewUser ? '/onboarding' : '/dashboard';
      return NextResponse.redirect(new URL(target, nextUrl));
    }
    return NextResponse.next();
  }

  // Not logged in → redirect to login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // New user trying to go anywhere except onboarding → redirect to onboarding
  if (isNewUser && nextUrl.pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
