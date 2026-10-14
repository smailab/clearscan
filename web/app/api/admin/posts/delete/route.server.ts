import { requireAdmin } from '@/lib/auth/admins';
import { PostError, deletePost } from '@/lib/posts';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 글 삭제 (관리자)
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await body<{ id: string }>(req);
    try {
      await deletePost(String(id ?? ''));
    } catch (e) {
      if (e instanceof PostError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
