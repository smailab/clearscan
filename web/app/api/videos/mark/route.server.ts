import { BookingError } from '@/lib/booking/service';
import { body, handle, requireUser } from '@/lib/booking/http';
import { VideoError, setMark } from '@/lib/videos';
import type { MarkKind } from '@/lib/videos-shared';

// 영상 좋아요 · 나중에 보기 · 시청 기록 (회원)
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { videoId, kind, on } = await body<{ videoId: string; kind: MarkKind; on: boolean }>(req);
    try {
      await setMark(user.id, String(videoId ?? ''), kind, on !== false);
    } catch (e) {
      if (e instanceof VideoError) throw new BookingError(e.message, e.status);
      throw e;
    }
    return { ok: true };
  });
}
