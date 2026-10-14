import { requireAdmin, updateAdmin, type AdminRole } from '@/lib/auth/admins';
import { body, handle } from '@/lib/booking/http';

// 관리자 계정 활성/비활성, 권한 변경, 비밀번호 초기화 (대표 관리자만)
export async function POST(req: Request) {
  return handle(async () => {
    const actor = await requireAdmin('owner');
    const { id, active, role, password } = await body<{ id: string; active?: boolean; role?: AdminRole; password?: string }>(req);
    await updateAdmin(actor, String(id ?? ''), { active, role, password });
    return { ok: true };
  });
}
