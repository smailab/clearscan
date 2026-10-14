import { createAdmin, requireAdmin, type AdminRole } from '@/lib/auth/admins';
import { body, handle } from '@/lib/booking/http';

// 관리자 계정 추가 (대표 관리자만)
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin('owner');
    const input = await body<{ email: string; name: string; role: AdminRole; password: string }>(req);
    const a = await createAdmin(input);
    return { ok: true, id: a.id };
  });
}
