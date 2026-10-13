import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { ADMIN_COOKIE, adminToken, safeEqual } from '@/lib/booking/admin';

export async function POST(req: Request) {
  const token = adminToken();
  if (!token) return NextResponse.json({ error: 'ADMIN_PASSWORD가 설정되지 않았습니다.' }, { status: 503 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const got = createHash('sha256').update(`clearscan-admin:${password ?? ''}`).digest('hex');
  if (!safeEqual(got, token)) return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
  return res;
}
