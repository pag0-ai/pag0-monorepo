import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const needsOnboarding = req.auth?.needsOnboarding;
  const hasApiKey = !!req.auth?.apiKey;

  // Let login page through
  if (nextUrl.pathname === '/login') {
    if (isLoggedIn) {
      const target = (needsOnboarding && !hasApiKey) ? '/onboarding' : '/dashboard';
      return NextResponse.redirect(new URL(target, nextUrl));
    }
    return NextResponse.next();
  }

  // Not logged in → redirect to login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // Already has API key but on /onboarding → skip to dashboard
  if (hasApiKey && nextUrl.pathname === '/onboarding') {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  // User needs onboarding and has no API key → redirect to onboarding
  if (needsOnboarding && !hasApiKey && nextUrl.pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|api/onboarding|_next/static|_next/image|favicon.ico).*)'],
};
