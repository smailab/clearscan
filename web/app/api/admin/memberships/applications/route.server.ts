import { requireAdmin } from '@/lib/auth/admins';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';
import { MembershipError, updateApplication, type AppUpdate } from '@/lib/memberships';

// 멤버십 신청 상태 변경 (상담 중 · 가입 확정 · 취소) 및 관리자 메모
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    try {
      await updateApplication(await body<AppUpdate>(req), admin.name);
    } catch (e) {
      if (e instanceof MembershipError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
