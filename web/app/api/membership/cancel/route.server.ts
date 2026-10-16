import { BookingError } from '@/lib/booking/service';
import { body, handle, requireUser } from '@/lib/booking/http';
import { MembershipError, cancelMyApplication } from '@/lib/memberships';

// 상담 대기 중인 멤버십 신청 취소 (회원 본인)
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await body<{ id: string }>(req);
    try {
      await cancelMyApplication(user.id, id);
    } catch (e) {
      if (e instanceof MembershipError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
