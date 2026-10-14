import { requireAdmin } from '@/lib/auth/admins';
import { rescheduleBooking, rescheduleOptions } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

export const dynamic = 'force-dynamic';

// 관리자 일정 변경: GET ?code=&date= → 옮길 수 있는 시간, POST { code, date, time } → 변경
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const q = new URL(req.url).searchParams;
    return { slots: await rescheduleOptions(q.get('code') ?? '', q.get('date') ?? '') };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { code, date, time } = await body<{ code: string; date: string; time: string }>(req);
    const b = await rescheduleBooking(code, String(date ?? ''), String(time ?? ''), admin.name);
    return { ok: true, date: b.date, time: b.time };
  });
}
