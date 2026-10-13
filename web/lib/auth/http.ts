import 'server-only';
import { NextResponse } from 'next/server';
import { LOGGED_IN_COOKIE, SESSION_COOKIE } from './members';

const secure = process.env.NODE_ENV === 'production';

export function setSessionCookies(res: NextResponse, token: string, expires: Date) {
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', expires });
  res.cookies.set(LOGGED_IN_COOKIE, '1', { httpOnly: false, secure, sameSite: 'lax', path: '/', expires });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(LOGGED_IN_COOKIE);
}

// 로그인 후 이동할 경로는 사이트 내부 경로만 허용 (오픈 리다이렉트 방지)
export function safeNext(next: unknown, fallback = '/my'): string {
  const s = typeof next === 'string' ? next : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : fallback;
}
