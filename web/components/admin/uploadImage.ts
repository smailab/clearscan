'use client';

// 관리자 이미지 업로드 — 큰 사진은 브라우저에서 줄여서(긴 변 2000px, WEBP) 올린다. GIF는 움직임 보존을 위해 그대로.
const MAX_SIDE = 2000;
const SHRINK_OVER = 1.5 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

async function shrink(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= SHRINK_OVER) { bmp.close(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.86));
  return out && out.size < file.size ? out : file;
}

// 성공하면 이미지 주소(/media/…)를, 실패하면 오류 메시지를 담은 Error를 던진다
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('JPG · PNG · WEBP · GIF 이미지만 올릴 수 있습니다.');
  const blob = await shrink(file);
  const body = new FormData();
  body.append('file', blob, file.name.replace(/\.[^.]+$/, '') + (blob === file ? '' : '.webp'));
  const res = await fetch('/api/admin/uploads', { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(json.error ?? '이미지를 올리지 못했습니다.');
  return json.url as string;
}

export function imageFiles(dt: DataTransfer | null): File[] {
  return dt ? Array.from(dt.files).filter(f => f.type.startsWith('image/')) : [];
}
