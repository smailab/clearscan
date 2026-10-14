import { createBooking } from '@/lib/booking/service';
import { body, handle, requireUser } from '@/lib/booking/http';
import type { BookingRequest } from '@/lib/booking/types';

// 여러 상품을 함께 신청하면 상품마다 예약이 따로 만들어진다
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const list = await createBooking(await body<BookingRequest>(req), user);
    return {
      bookings: list.map(b => ({ code: b.code, date: b.date, time: b.time, planId: b.planId, planName: b.planName, price: b.price, discount: b.discount ?? 0 })),
      couple: list[0].couple,
      groupCode: list[0].groupCode ?? null,
    };
  });
}
