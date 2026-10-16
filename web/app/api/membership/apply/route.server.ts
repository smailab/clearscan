import { BookingError } from '@/lib/booking/service';
import { body, handle, requireUser } from '@/lib/booking/http';
import { MembershipError, applyMembership, type ApplyInput } from '@/lib/memberships';

// 멤버십 가입(상담) 신청 — 회원 전용
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    try {
      const app = await applyMembership(user.id, await body<ApplyInput>(req));
      return { ok: true, id: app.id, tierName: app.tierName, contactTime: app.contactTime };
    } catch (e) {
      if (e instanceof MembershipError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
