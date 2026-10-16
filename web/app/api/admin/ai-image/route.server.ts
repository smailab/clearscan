import { requireAdmin } from '@/lib/auth/admins';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';
import { AiImageError, aiConfigured, generateImage, usedToday, type AiQuality, type AiSize } from '@/lib/ai-image';
import { MediaError } from '@/lib/media';

// AI 이미지 생성 (관리자) — GET: 사용 가능 여부·오늘 사용량, POST: 생성
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return { configured: aiConfigured(), usedToday: await usedToday() };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const input = await body<{ prompt: string; size: AiSize; quality: AiQuality; brandStyle: boolean }>(req);
    try {
      return await generateImage(input, admin.name);
    } catch (e) {
      if (e instanceof AiImageError || e instanceof MediaError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
