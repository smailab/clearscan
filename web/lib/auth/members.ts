import 'server-only';
import { cookies } from 'next/headers';
import { getDB } from '@/lib/db';
import { isValidDate, kstToday, normalizePhone } from '@/lib/booking/schedule';
import { constantTimeEqual, hashPassword, randomToken, sha256, verifyPassword } from './crypto';
import { sendVerificationEmail, type SendResult } from './email';

export const SESSION_COOKIE = 'cs_session';
export const LOGGED_IN_COOKIE = 'cs_li'; // 화면 표시용 표식(비밀값 아님). 실제 인증은 SESSION_COOKIE로만 한다
const SESSION_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 10;

// 이메일 인증번호 정책
const CODE_TTL_MIN = 10;          // 인증번호 유효 시간
const VERIFIED_TTL_MIN = 30;      // 인증 완료 후 가입을 마쳐야 하는 시간
const RESEND_COOLDOWN_SEC = 60;   // 재발송 간격
const MAX_SENDS_PER_HOUR = 5;
const MAX_CODE_ATTEMPTS = 5;

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string;
  birth: string;
  sex: 'M' | 'F';
  marketing: boolean;
  createdAt: string;
};

type UserRow = {
  id: string; email: string; name: string; phone: string; birth: string; sex: 'M' | 'F';
  password_hash: string; password_salt: string; marketing_opt_in: number; created_at: string;
  failed_logins: number; locked_until: string | null;
};

const toUser = (r: UserRow): User => ({
  id: r.id, email: r.email, name: r.name, phone: r.phone, birth: r.birth, sex: r.sex,
  marketing: Boolean(r.marketing_opt_in), createdAt: r.created_at,
});

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function normalizeEmail(v: string): string {
  return String(v ?? '').trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8 || pw.length > 64) return '비밀번호는 8자 이상 64자 이하로 입력해 주세요.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return '비밀번호는 영문과 숫자를 모두 포함해야 합니다.';
  return null;
}

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

// ---------- 이메일 인증 ----------

type VerifRow = {
  email: string; code_hash: string; expires_at: string; attempts: number; sent_count: number;
  window_start: string; last_sent_at: string; verified_at: string | null;
};

export async function sendEmailCode(emailRaw: string): Promise<SendResult> {
  const email = normalizeEmail(emailRaw);
  if (!validEmail(email)) throw new AuthError('이메일 주소를 확인해 주세요.');
  const db = await getDB();
  if (await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) {
    throw new AuthError('이미 가입된 이메일입니다. 로그인해 주세요.', 409);
  }

  const now = new Date();
  const prev = await db.prepare('SELECT * FROM email_verifications WHERE email = ?').bind(email).first<VerifRow>();
  let sentCount = 1;
  let windowStart = now.toISOString();
  if (prev) {
    const since = (now.getTime() - new Date(prev.last_sent_at).getTime()) / 1000;
    if (since < RESEND_COOLDOWN_SEC) throw new AuthError(`인증번호는 ${Math.ceil(RESEND_COOLDOWN_SEC - since)}초 뒤에 다시 받을 수 있어요.`, 429);
    const inWindow = now.getTime() - new Date(prev.window_start).getTime() < 3_600_000;
    if (inWindow && prev.sent_count >= MAX_SENDS_PER_HOUR) throw new AuthError('인증번호 요청이 너무 많습니다. 1시간 뒤에 다시 시도해 주세요.', 429);
    if (inWindow) { sentCount = prev.sent_count + 1; windowStart = prev.window_start; }
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  await db.prepare(
    `INSERT INTO email_verifications (email, code_hash, expires_at, attempts, sent_count, window_start, last_sent_at, verified_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, NULL)
     ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
       sent_count = excluded.sent_count, window_start = excluded.window_start, last_sent_at = excluded.last_sent_at, verified_at = NULL`,
  ).bind(email, await sha256(`${email}:${code}`), minutesFromNow(CODE_TTL_MIN), sentCount, windowStart, now.toISOString()).run();

  return sendVerificationEmail(email, code);
}

export async function verifyEmailCode(emailRaw: string, codeRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM email_verifications WHERE email = ?').bind(email).first<VerifRow>();
  if (!row) throw new AuthError('인증번호를 먼저 요청해 주세요.');
  if (row.expires_at < new Date().toISOString()) throw new AuthError('인증번호가 만료되었습니다. 다시 받아 주세요.');
  if (row.attempts >= MAX_CODE_ATTEMPTS) throw new AuthError('입력 횟수를 초과했습니다. 인증번호를 다시 받아 주세요.', 429);
  if (!constantTimeEqual(await sha256(`${email}:${code}`), row.code_hash)) {
    await db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    throw new AuthError('인증번호가 올바르지 않습니다.');
  }
  await db.prepare('UPDATE email_verifications SET verified_at = ?, expires_at = ? WHERE email = ?')
    .bind(new Date().toISOString(), minutesFromNow(VERIFIED_TTL_MIN), email).run();
}

// ---------- 가입 / 로그인 ----------

export type SignupInput = {
  email: string; password: string; name: string; phone: string; birth: string; sex: 'M' | 'F';
  consent: { terms: boolean; privacy: boolean; marketing?: boolean };
};

export async function signup(input: SignupInput): Promise<User> {
  const email = normalizeEmail(input.email);
  const name = String(input.name ?? '').trim();
  const phone = normalizePhone(String(input.phone ?? ''));
  const birth = String(input.birth ?? '');
  const password = String(input.password ?? '');

  if (!input.consent?.terms || !input.consent?.privacy) throw new AuthError('필수 약관에 동의해 주세요.');
  if (!validEmail(email)) throw new AuthError('이메일 주소를 확인해 주세요.');
  const pwErr = validatePassword(password);
  if (pwErr) throw new AuthError(pwErr);
  if (name.length < 2 || name.length > 20) throw new AuthError('이름을 확인해 주세요.');
  if (!/^01[016789]\d{7,8}$/.test(phone)) throw new AuthError('휴대폰 번호를 확인해 주세요.');
  if (!isValidDate(birth) || birth < '1900-01-01' || birth > kstToday()) throw new AuthError('생년월일을 확인해 주세요.');
  if (input.sex !== 'M' && input.sex !== 'F') throw new AuthError('성별을 선택해 주세요.');

  const db = await getDB();
  const v = await db.prepare('SELECT verified_at, expires_at FROM email_verifications WHERE email = ?').bind(email).first<VerifRow>();
  if (!v?.verified_at || v.expires_at < new Date().toISOString()) {
    throw new AuthError('이메일 인증을 먼저 완료해 주세요. 인증 후 30분이 지나면 다시 인증해야 합니다.');
  }

  const { hash, salt } = await hashPassword(password);
  const now = new Date().toISOString();
  const id = `u_${randomToken(12)}`;
  try {
    // 가입과 동시에 인증 기록을 지워 같은 인증으로 재가입하지 못하게 한다
    await db.batch([
      db.prepare(
        `INSERT INTO users (id, email, email_verified_at, name, phone, birth, sex, password_hash, password_salt, marketing_opt_in, consent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, email, v.verified_at, name, phone, birth, input.sex, hash, salt, input.consent.marketing ? 1 : 0, now, now),
      db.prepare('DELETE FROM email_verifications WHERE email = ?').bind(email),
    ]);
  } catch (e) {
    if (String((e as Error).message).includes('users.email')) throw new AuthError('이미 가입된 이메일입니다. 로그인해 주세요.', 409);
    throw e;
  }
  return { id, email, name, phone, birth, sex: input.sex, marketing: Boolean(input.consent.marketing), createdAt: now };
}

const BAD_LOGIN = '이메일 또는 비밀번호가 올바르지 않습니다.';

export async function login(emailRaw: string, password: string): Promise<User> {
  const email = normalizeEmail(emailRaw);
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!row) {
    // 없는 계정도 해시 계산 시간을 비슷하게 맞춘다
    await hashPassword(String(password ?? ''));
    throw new AuthError(BAD_LOGIN, 401);
  }
  if (row.locked_until && row.locked_until > new Date().toISOString()) {
    throw new AuthError(`로그인 시도가 너무 많습니다. ${LOCK_MINUTES}분 뒤에 다시 시도해 주세요.`, 429);
  }
  if (!(await verifyPassword(String(password ?? ''), row.password_hash, row.password_salt))) {
    const failed = row.failed_logins + 1;
    const lock = failed >= MAX_FAILED ? minutesFromNow(LOCK_MINUTES) : null;
    await db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
      .bind(lock ? 0 : failed, lock, row.id).run();
    throw new AuthError(BAD_LOGIN, 401);
  }
  if (row.failed_logins || row.locked_until) {
    await db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').bind(row.id).run();
  }
  return toUser(row);
}

// ---------- 세션 ----------

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const db = await getDB();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, new Date().toISOString(), expires.toISOString()).run();
  return { token, expires };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = await getDB();
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export async function userFromToken(token: string | undefined): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const db = await getDB();
  const row = await db.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), new Date().toISOString()).first<UserRow>();
  return row ? toUser(row) : null;
}

export async function currentUser(): Promise<User | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function listUsers(): Promise<(User & { bookingCount: number })[]> {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT u.*, (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS booking_count
     FROM users u ORDER BY u.created_at DESC`,
  ).all<UserRow & { booking_count: number }>();
  return results.map(r => ({ ...toUser(r), bookingCount: r.booking_count }));
}
