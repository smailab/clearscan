// Web Crypto 기반 — Node와 Cloudflare Workers 양쪽에서 동작한다

const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000; // Workers의 PBKDF2 반복 상한

export function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(bytes = 32): string {
  return toB64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt = randomToken(16)): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return { hash: toB64url(new Uint8Array(bits)), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { hash: got } = await hashPassword(password, salt);
  return constantTimeEqual(got, hash);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
