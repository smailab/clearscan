import { requireAdmin } from '@/lib/auth/admins';
import { ProductError, saveProduct, type ProductInput } from '@/lib/products';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 상품 추가·수정 (관리자)
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { mode, product } = await body<{ mode: 'create' | 'update'; product: ProductInput }>(req);
    if (mode !== 'create' && mode !== 'update') throw new BookingError('잘못된 요청입니다.');
    try {
      await saveProduct(product, mode, admin.name);
    } catch (e) {
      if (e instanceof ProductError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
