import 'server-only';
import { createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'cs_admin';

// ADMIN_PASSWORD 환경 변수가 없으면 관리자 페이지는 비활성화된다
export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? createHash('sha256').update(`clearscan-admin:${pw}`).digest('hex') : null;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(token && got && safeEqual(got, token));
}
