import { handle, requireUser } from '@/lib/booking/http';
import { clearHistory } from '@/lib/videos';

// 내 시청 기록 모두 지우기 (회원)
export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    await clearHistory(user.id);
    return { ok: true };
  });
}
