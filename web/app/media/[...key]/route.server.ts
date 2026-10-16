import { readImage } from '@/lib/media';

// 업로드한 이미지 제공 (/media/posts/…). 키는 한 번 정해지면 바뀌지 않으므로 오래 캐시한다.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const img = await readImage(key.join('/'));
  if (!img) return new Response('Not found', { status: 404 });
  return new Response(img.body as BodyInit, {
    headers: {
      'Content-Type': img.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
