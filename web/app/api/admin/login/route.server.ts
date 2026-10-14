import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, adminLogin } from '@/lib/auth/admins';
import { body, handle } from '@/lib/booking/http';

export async function POST(req: Request) {
  return handle(async () => {
    const { email, password } = await body<{ email: string; password: string }>(req);
    const { admin, token, expires } = await adminLogin(email, password);
    const res = NextResponse.json({ ok: true, name: admin.name });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', expires,
    });
    return res;
  });
}
