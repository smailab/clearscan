import { requireAdmin } from '@/lib/auth/admins';
import { PostError, setPostStatus } from '@/lib/posts';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 글 공개 / 비공개 전환 (관리자)
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id, status } = await body<{ id: string; status: 'draft' | 'published' }>(req);
    try {
      await setPostStatus(String(id ?? ''), status === 'published' ? 'published' : 'draft', admin.name);
    } catch (e) {
      if (e instanceof PostError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
