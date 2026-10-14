import { requireAdmin } from '@/lib/auth/admins';
import { PostError, savePost, type PostInput } from '@/lib/posts';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';

// 건강 칼럼 글 작성·수정 (관리자) — 본문 HTML은 서버에서 정제해서 저장
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { post } = await body<{ post: PostInput }>(req);
    try {
      return { ok: true, ...(await savePost(post, admin.name)) };
    } catch (e) {
      if (e instanceof PostError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
