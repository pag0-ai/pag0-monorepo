import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Google from 'next-auth/providers/google';

declare module 'next-auth' {
  interface Session {
    apiKey?: string;
    isNewUser?: boolean;
    pag0UserId?: string;
    projectId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    apiKey?: string;
    isNewUser?: boolean;
    pag0UserId?: string;
    projectId?: string;
  }
}

const PROXY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // On initial sign-in (account is only present on first call)
      if (account && user?.email) {
        try {
          const res = await fetch(`${PROXY_URL}/api/auth/oauth-register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Pag0-Internal-Secret': process.env.PAG0_INTERNAL_SECRET || '',
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name || undefined,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            token.apiKey = data.apiKey as string;
            token.isNewUser = data.isNewUser as boolean;
            token.pag0UserId = String(data.user.id);
            token.projectId = String(data.project.id);
          } else {
            console.error('OAuth register failed:', res.status, await res.text());
          }
        } catch (error) {
          console.error('OAuth register error:', error);
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.apiKey = token.apiKey;
      session.isNewUser = token.isNewUser;
      session.pag0UserId = token.pag0UserId;
      session.projectId = token.projectId;
      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === '/login';

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl));
        return true;
      }

      return isLoggedIn;
    },
  },
});
