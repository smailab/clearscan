import { lookupBooking } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

export async function POST(req: Request) {
  return handle(async () => {
    const { code, phone } = await body<{ code: string; phone: string }>(req);
    return { booking: await lookupBooking(code, phone) };
  });
}
