import { requireAdmin } from '@/lib/auth/admins';
import { BookingError } from '@/lib/booking/service';
import { handle } from '@/lib/booking/http';
import { MediaError, saveImage } from '@/lib/media';

// 건강 칼럼 이미지 업로드 (관리자) — multipart/form-data의 file 하나
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new BookingError('잘못된 요청입니다.');
    }
    try {
      return { url: await saveImage(form.get('file') as File) };
    } catch (e) {
      if (e instanceof MediaError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
