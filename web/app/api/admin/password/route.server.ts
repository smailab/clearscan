import { changeOwnPassword, requireAdmin } from '@/lib/auth/admins';
import { body, handle } from '@/lib/booking/http';

// 로그인한 관리자 본인의 비밀번호 변경
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { current, next } = await body<{ current: string; next: string }>(req);
    await changeOwnPassword(admin, current, next);
    return { ok: true };
  });
}
