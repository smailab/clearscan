import { createBooking } from '@/lib/booking/service';
import { body, handle, requireUser } from '@/lib/booking/http';
import type { BookingRequest } from '@/lib/booking/types';

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const b = await createBooking(await body<BookingRequest>(req), user);
    return { code: b.code, date: b.date, time: b.time, planId: b.planId, couple: b.couple, price: b.price, discount: b.discount ?? 0 };
  });
}
