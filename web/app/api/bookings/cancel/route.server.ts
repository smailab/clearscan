import { cancelMyBooking } from '@/lib/booking/service';
import { body, handle, requireUser } from '@/lib/booking/http';

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { code } = await body<{ code: string }>(req);
    const b = await cancelMyBooking(user, code);
    return { code: b.code, status: b.status };
  });
}
