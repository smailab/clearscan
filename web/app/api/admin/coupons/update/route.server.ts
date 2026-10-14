import { requireAdmin } from '@/lib/auth/admins';
import { CouponError, setCouponActive } from '@/lib/coupons';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 쿠폰 사용 중지·재개 (관리자)
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { code, active } = await body<{ code: string; active: boolean }>(req);
    try {
      await setCouponActive(code, Boolean(active));
    } catch (e) {
      if (e instanceof CouponError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
