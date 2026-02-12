import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PROXY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  const res = await fetch(`${PROXY_URL}/api/auth/generate-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Pag0-Internal-Secret': process.env.PAG0_INTERNAL_SECRET || '',
    },
    body: JSON.stringify({ email: session.user.email }),
  });

  if (!res.ok) {
    const data = await res.json();
    return NextResponse.json(
      { error: data.error || { code: 'PROXY_ERROR', message: 'Failed to generate API key' } },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json({ apiKey: data.apiKey });
}
