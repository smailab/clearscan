import { requireAdmin } from '@/lib/auth/admins';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';
import { MembershipError, saveTier, type TierInput } from '@/lib/memberships';

// 멤버십 티어 추가·수정 (관리자)
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { mode, tier } = await body<{ mode: 'create' | 'update'; tier: TierInput }>(req);
    if (mode !== 'create' && mode !== 'update') throw new BookingError('잘못된 요청입니다.');
    try {
      await saveTier(tier, mode, admin.name);
    } catch (e) {
      if (e instanceof MembershipError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
