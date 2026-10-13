import { NextResponse } from 'next/server';
import { createSession, signup, type SignupInput } from '@/lib/auth/members';
import { setSessionCookies } from '@/lib/auth/http';
import { body, handle } from '@/lib/booking/http';

export async function POST(req: Request) {
  return handle(async () => {
    const user = await signup(await body<SignupInput>(req));
    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ ok: true, name: user.name });
    setSessionCookies(res, token, expires);
    return res;
  });
}
