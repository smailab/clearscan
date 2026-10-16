import 'server-only';
import { getDB } from '@/lib/db';
import { randomToken } from '@/lib/auth/crypto';
import { saveImageBytes } from '@/lib/media';

// OpenAI 이미지 생성 → R2(또는 서버 디스크)에 저장 → /media/… 주소 반환.
// 키: OPENAI_API_KEY (Cloudflare secret / 서버 환경 변수). 모델은 OPENAI_IMAGE_MODEL로 바꿀 수 있다.

export class AiImageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const AI_SIZES = {
  landscape: { label: '가로 (3:2)', value: '1536x1024' },
  square: { label: '정사각형', value: '1024x1024' },
  portrait: { label: '세로 (2:3)', value: '1024x1536' },
} as const;
export type AiSize = keyof typeof AI_SIZES;
export type AiQuality = 'medium' | 'high';

const DAILY_LIMIT = Number(process.env.OPENAI_IMAGE_DAILY_LIMIT || 40); // 사이트 전체 하루 생성 수 (비용 보호)
const DEFAULT_MODEL = 'gpt-image-2.5-flare';

// 사이트 톤에 맞추는 기본 스타일 (관리자가 끌 수 있다)
export const BRAND_STYLE =
  'Premium medical editorial photography for a longevity clinic. Calm, clean, modern; deep navy and soft sky-blue palette with natural light. Realistic, high detail. No text, no logos, no watermarks.';

const kstDayStart = () => {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000).toISOString();
};

export async function usedToday(): Promise<number> {
  const db = await getDB();
  const row = await db.prepare('SELECT count(*) AS n FROM ai_images WHERE created_at >= ? AND url IS NOT NULL').bind(kstDayStart()).first<{ n: number }>();
  return row?.n ?? 0;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateImage(
  input: { prompt: string; size: AiSize; quality: AiQuality; brandStyle: boolean },
  adminName: string,
): Promise<{ url: string; remaining: number }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiImageError('OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의하세요.', 503);
  const prompt = String(input.prompt ?? '').trim();
  if (prompt.length < 5) throw new AiImageError('만들 이미지를 5자 이상 설명해 주세요.');
  if (prompt.length > 2000) throw new AiImageError('설명은 2000자 이하로 입력해 주세요.');
  const size = AI_SIZES[input.size] ? input.size : 'landscape';
  const quality: AiQuality = input.quality === 'high' ? 'high' : 'medium';
  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;

  const used = await usedToday();
  if (used >= DAILY_LIMIT) throw new AiImageError(`오늘 생성 한도(${DAILY_LIMIT}장)를 모두 썼습니다. 내일 다시 시도해 주세요.`, 429);

  const fullPrompt = input.brandStyle ? `${prompt}\n\nStyle: ${BRAND_STYLE}` : prompt;
  const db = await getDB();
  const log = (url: string | null, error: string | null) =>
    db.prepare('INSERT INTO ai_images (id, admin_name, prompt, size, quality, model, url, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(`ai_${randomToken(9)}`, adminName, prompt.slice(0, 2000), AI_SIZES[size].value, quality, model, url, error, new Date().toISOString()).run();

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, prompt: fullPrompt, n: 1, size: AI_SIZES[size].value, quality,
        output_format: 'webp', output_compression: 85, background: 'opaque',
      }),
      signal: AbortSignal.timeout(170_000),
    });
  } catch (e) {
    await log(null, `network: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    throw new AiImageError('이미지 생성 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 502);
  }

  const json = (await res.json().catch(() => ({}))) as {
    data?: { b64_json?: string }[];
    error?: { code?: string; type?: string; message?: string };
  };
  if (!res.ok || !json.data?.[0]?.b64_json) {
    const code = json.error?.code ?? '';
    await log(null, `${res.status} ${code} ${json.error?.message ?? ''}`.slice(0, 300));
    if (code === 'moderation_blocked') throw new AiImageError('안전 정책에 걸려 만들 수 없는 내용입니다. 설명을 바꿔 다시 시도해 주세요.');
    if (res.status === 401) throw new AiImageError('OpenAI API 키가 올바르지 않습니다.', 502);
    if (res.status === 403) throw new AiImageError('OpenAI 계정에서 이미지 모델 사용 권한(조직 인증)이 필요합니다.', 502);
    if (res.status === 429) throw new AiImageError('OpenAI 사용 한도 또는 잔액이 부족합니다. 잠시 후 다시 시도해 주세요.', 502);
    throw new AiImageError('이미지를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.', 502);
  }

  const bin = atob(json.data[0].b64_json);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = await saveImageBytes(bytes);
  await log(url, null);
  return { url, remaining: Math.max(0, DAILY_LIMIT - used - 1) };
}
