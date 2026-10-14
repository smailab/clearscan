import { previewCoupon } from '@/lib/booking/service';
import { body, handle, requireUser } from '@/lib/booking/http';

// 예약 화면에서 쿠폰 할인 미리보기 (회원 전용)
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { code, planIds, planId, couple } = await body<{ code: string; planIds?: string[]; planId?: string; couple: boolean }>(req);
    return previewCoupon(user, code, planIds?.length ? planIds : planId ? [planId] : [], Boolean(couple));
  });
}
