import { NextResponse } from 'next/server';
import { createSession, login } from '@/lib/auth/members';
import { setSessionCookies } from '@/lib/auth/http';
import { body, handle } from '@/lib/booking/http';

export async function POST(req: Request) {
  return handle(async () => {
    const { email, password } = await body<{ email: string; password: string }>(req);
    const user = await login(email, password);
    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ ok: true, name: user.name });
    setSessionCookies(res, token, expires);
    return res;
  });
}
