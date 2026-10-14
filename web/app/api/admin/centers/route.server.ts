import { requireAdmin } from '@/lib/auth/admins';
import { CenterError, saveCenter, type CenterInput } from '@/lib/centers';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 검진 센터 추가·수정 (관리자)
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { mode, center } = await body<{ mode: 'create' | 'update'; center: CenterInput }>(req);
    if (mode !== 'create' && mode !== 'update') throw new BookingError('잘못된 요청입니다.');
    try {
      await saveCenter(center, mode, admin.name);
    } catch (e) {
      if (e instanceof CenterError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
