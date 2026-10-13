import 'server-only';
import { NextResponse } from 'next/server';
import { AuthError, currentUser, type User } from '@/lib/auth/members';
import { BookingError } from './service';

// 결과를 JSON으로 돌려주고, 알려진 오류는 상태 코드와 메시지로 바꾼다.
// fn이 NextResponse를 돌려주면 그대로 쓴다 (쿠키를 설정해야 하는 로그인 등)
export async function handle<T>(fn: () => Promise<T | NextResponse>) {
  try {
    const out = await fn();
    return out instanceof NextResponse ? out : NextResponse.json(out);
  } catch (e) {
    if (e instanceof BookingError || e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BookingError('잘못된 요청입니다.');
  }
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AuthError('로그인이 필요합니다.', 401);
  return user;
}
