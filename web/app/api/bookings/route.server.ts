import { createBooking } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';
import type { BookingRequest } from '@/lib/booking/types';

export async function POST(req: Request) {
  return handle(async () => {
    const b = await createBooking(await body<BookingRequest>(req));
    return { code: b.code, date: b.date, time: b.time, planId: b.planId, couple: b.couple, price: b.price };
  });
}
