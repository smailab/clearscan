import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { randomToken } from '@/lib/auth/crypto';

// 업로드 이미지 저장소 — Cloudflare에서는 R2(MEDIA 바인딩), 일반 Node 서버에서는 디스크(MEDIA_DIR).
// 사이트에서는 /media/<키> 주소로 제공한다 (app/media/[...key]/route.server.ts).

export class MediaError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const MAX_BYTES = 5 * 1024 * 1024;

// 파일 내용(앞부분 바이트)으로 형식을 판별한다 — 브라우저가 보낸 Content-Type은 믿지 않는다. SVG는 받지 않는다(스크립트 위험).
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  const is = (sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
  if (is([0xff, 0xd8, 0xff])) return { type: 'image/jpeg', ext: 'jpg' };
  if (is([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: 'image/png', ext: 'png' };
  if (is([0x47, 0x49, 0x46, 0x38])) return { type: 'image/gif', ext: 'gif' };
  if (is([0x52, 0x49, 0x46, 0x46]) && is([0x57, 0x45, 0x42, 0x50], 8)) return { type: 'image/webp', ext: 'webp' };
  return null;
}

type R2 = {
  put(key: string, body: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; size: number } | null>;
};

async function bucket(): Promise<R2> {
  const { env } = await getCloudflareContext({ async: true });
  const b = (env as unknown as { MEDIA?: R2 }).MEDIA;
  if (!b) throw new MediaError('이미지 저장소(R2)가 연결되지 않았습니다.', 500);
  return b;
}

const KEY_RE = /^posts\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{8,40}\.(jpg|png|gif|webp)$/;
const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

async function nodeFs() {
  const mod = 'node:fs/promises';
  const pathMod = 'node:path';
  const fs = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ mod)) as typeof import('node:fs/promises');
  const path = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ pathMod)) as typeof import('node:path');
  return { fs, path, dir: process.env.MEDIA_DIR || '/var/lib/orae/media' };
}

export async function saveImage(file: File): Promise<string> {
  if (!file || typeof file.arrayBuffer !== 'function') throw new MediaError('이미지 파일을 선택해 주세요.');
  if (file.size > MAX_BYTES) throw new MediaError('이미지는 5MB 이하만 올릴 수 있습니다.');
  return saveImageBytes(new Uint8Array(await file.arrayBuffer()));
}

// 이미지 바이트를 저장하고 /media/… 주소를 돌려준다 (업로드 · AI 생성 공용)
export async function saveImageBytes(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_BYTES * 2) throw new MediaError('이미지가 너무 큽니다.');
  const kind = sniff(bytes);
  if (!kind) throw new MediaError('JPG · PNG · WEBP · GIF 이미지만 올릴 수 있습니다.');

  const now = new Date();
  const key = `posts/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomToken(12)}.${kind.ext}`;

  if (process.env.DB_PATH) {
    const { fs, path, dir } = await nodeFs();
    const full = path.join(dir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  } else {
    await (await bucket()).put(key, bytes, { httpMetadata: { contentType: kind.type, cacheControl: 'public, max-age=31536000, immutable' } });
  }
  return `/media/${key}`;
}

export async function readImage(key: string): Promise<{ body: ReadableStream | Uint8Array; type: string } | null> {
  if (!KEY_RE.test(key)) return null;
  const type = TYPES[key.split('.').pop()!];
  if (process.env.DB_PATH) {
    const { fs, path, dir } = await nodeFs();
    try {
      return { body: new Uint8Array(await fs.readFile(path.join(dir, key))), type };
    } catch {
      return null;
    }
  }
  const obj = await (await bucket()).get(key);
  return obj ? { body: obj.body, type } : null;
}
