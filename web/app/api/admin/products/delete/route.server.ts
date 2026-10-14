import { requireAdmin } from '@/lib/auth/admins';
import { ProductError, deleteProduct } from '@/lib/products';
import { kstToday } from '@/lib/booking/schedule';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 상품 삭제 (대표 관리자만)
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin('owner');
    const { id } = await body<{ id: string }>(req);
    try {
      return { ok: true, ...(await deleteProduct(id, kstToday())) };
    } catch (e) {
      if (e instanceof ProductError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
