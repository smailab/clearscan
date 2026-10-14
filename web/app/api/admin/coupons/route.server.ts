import { requireAdmin } from '@/lib/auth/admins';
import { CouponError, issueCoupons, type IssueInput } from '@/lib/coupons';
import { listProducts } from '@/lib/products';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 쿠폰 발급 (관리자): 공용 코드 / 1회용 코드 여러 개 / 회원 지정
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const input = await body<IssueInput>(req);
    try {
      return await issueCoupons(input, admin.name, await listProducts({ includeInactive: true }));
    } catch (e) {
      if (e instanceof CouponError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
