import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, adminLogout } from '@/lib/auth/admins';
import { handle } from '@/lib/booking/http';

export async function POST() {
  return handle(async () => {
    await adminLogout((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(ADMIN_SESSION_COOKIE);
    return res;
  });
}
