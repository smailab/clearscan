import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, destroySession } from '@/lib/auth/members';
import { clearSessionCookies } from '@/lib/auth/http';
import { handle } from '@/lib/booking/http';

export async function POST() {
  return handle(async () => {
    await destroySession((await cookies()).get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    clearSessionCookies(res);
    return res;
  });
}
