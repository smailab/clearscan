import { requireAdmin } from '@/lib/auth/admins';
import { CenterError, deleteCenter } from '@/lib/centers';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 검진 센터 삭제 (대표 관리자만)
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin('owner');
    const { id } = await body<{ id: string }>(req);
    try {
      return { ok: true, ...(await deleteCenter(id)) };
    } catch (e) {
      if (e instanceof CenterError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
