import 'server-only';
import { cookies } from 'next/headers';
import { getDB } from '@/lib/db';
import { hashPassword, randomToken, sha256, verifyPassword } from './crypto';
import { AuthError, normalizeEmail, validatePassword } from './members';

export const ADMIN_SESSION_COOKIE = 'cs_admin_session';
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type AdminRole = 'owner' | 'staff';
export type Admin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type AdminRow = {
  id: string; email: string; name: string; role: AdminRole; password_hash: string; password_salt: string;
  active: number; created_at: string; last_login_at: string | null; failed_logins: number; locked_until: string | null;
};

const toAdmin = (r: AdminRow): Admin => ({
  id: r.id, email: r.email, name: r.name, role: r.role, active: Boolean(r.active),
  createdAt: r.created_at, lastLoginAt: r.last_login_at,
});

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const BAD_LOGIN = '이메일 또는 비밀번호가 올바르지 않습니다.';

// ---------- 로그인 / 세션 ----------

export async function adminLogin(emailRaw: string, password: string): Promise<{ admin: Admin; token: string; expires: Date }> {
  const email = normalizeEmail(emailRaw);
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first<AdminRow>();
  if (!row || !row.active) {
    await hashPassword(String(password ?? '')); // 계정 존재 여부가 응답 시간으로 드러나지 않게
    throw new AuthError(BAD_LOGIN, 401);
  }
  if (row.locked_until && row.locked_until > new Date().toISOString()) {
    throw new AuthError(`로그인 시도가 너무 많습니다. ${LOCK_MINUTES}분 뒤에 다시 시도해 주세요.`, 429);
  }
  if (!(await verifyPassword(String(password ?? ''), row.password_hash, row.password_salt))) {
    const failed = row.failed_logins + 1;
    const lock = failed >= MAX_FAILED ? minutesFromNow(LOCK_MINUTES) : null;
    await db.prepare('UPDATE admins SET failed_logins = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : failed, lock, row.id).run();
    throw new AuthError(BAD_LOGIN, 401);
  }

  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE admins SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').bind(now, row.id),
    db.prepare('INSERT INTO admin_sessions (token_hash, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256(token), row.id, now, expires.toISOString()),
  ]);
  return { admin: toAdmin({ ...row, last_login_at: now }), token, expires };
}

export async function adminLogout(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = await getDB();
  await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export async function currentAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDB();
  const row = await db.prepare(
    `SELECT a.* FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND a.active = 1`,
  ).bind(await sha256(token), new Date().toISOString()).first<AdminRow>();
  return row ? toAdmin(row) : null;
}

export async function requireAdmin(role?: AdminRole): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) throw new AuthError('관리자 로그인이 필요합니다.', 401);
  if (role === 'owner' && admin.role !== 'owner') throw new AuthError('대표 관리자만 할 수 있습니다.', 403);
  return admin;
}

// ---------- 계정 관리 ----------

export async function listAdmins(): Promise<Admin[]> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT * FROM admins ORDER BY role DESC, created_at').all<AdminRow>();
  return results.map(toAdmin);
}

export async function createAdmin(input: { email: string; name: string; role: AdminRole; password: string }): Promise<Admin> {
  const email = normalizeEmail(input.email);
  const name = String(input.name ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AuthError('이메일 주소를 확인해 주세요.');
  if (name.length < 2 || name.length > 20) throw new AuthError('이름을 확인해 주세요.');
  if (input.role !== 'owner' && input.role !== 'staff') throw new AuthError('권한을 선택해 주세요.');
  const pwErr = validatePassword(String(input.password ?? ''));
  if (pwErr) throw new AuthError(pwErr);

  const db = await getDB();
  const { hash, salt } = await hashPassword(input.password);
  const id = `a_${randomToken(12)}`;
  const now = new Date().toISOString();
  try {
    await db.prepare(
      'INSERT INTO admins (id, email, name, role, password_hash, password_salt, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    ).bind(id, email, name, input.role, hash, salt, now).run();
  } catch (e) {
    if (String((e as Error).message).includes('admins.email')) throw new AuthError('이미 등록된 관리자 이메일입니다.', 409);
    throw e;
  }
  return { id, email, name, role: input.role, active: true, createdAt: now, lastLoginAt: null };
}

async function activeOwnerCount(): Promise<number> {
  const db = await getDB();
  const r = await db.prepare("SELECT COUNT(*) AS n FROM admins WHERE role = 'owner' AND active = 1").first<{ n: number }>();
  return r?.n ?? 0;
}

// 대표 관리자가 다른 관리자 계정을 활성/비활성, 권한 변경, 비밀번호 초기화한다
export async function updateAdmin(
  actor: Admin,
  id: string,
  change: { active?: boolean; role?: AdminRole; password?: string },
): Promise<void> {
  const db = await getDB();
  const target = await db.prepare('SELECT * FROM admins WHERE id = ?').bind(id).first<AdminRow>();
  if (!target) throw new AuthError('관리자 계정을 찾을 수 없습니다.', 404);

  const demotingOwner = target.role === 'owner' && target.active === 1
    && (change.active === false || (change.role && change.role !== 'owner'));
  if (target.id === actor.id && demotingOwner) throw new AuthError('본인 계정의 대표 권한이나 활성 상태는 바꿀 수 없습니다.');
  if (demotingOwner && (await activeOwnerCount()) <= 1) throw new AuthError('대표 관리자는 최소 1명 있어야 합니다.');

  const stmts = [];
  if (change.role) {
    if (change.role !== 'owner' && change.role !== 'staff') throw new AuthError('권한을 확인해 주세요.');
    stmts.push(db.prepare('UPDATE admins SET role = ? WHERE id = ?').bind(change.role, id));
  }
  if (typeof change.active === 'boolean') {
    stmts.push(db.prepare('UPDATE admins SET active = ? WHERE id = ?').bind(change.active ? 1 : 0, id));
  }
  if (change.password !== undefined) {
    const pwErr = validatePassword(change.password);
    if (pwErr) throw new AuthError(pwErr);
    const { hash, salt } = await hashPassword(change.password);
    stmts.push(db.prepare('UPDATE admins SET password_hash = ?, password_salt = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').bind(hash, salt, id));
  }
  // 비활성화하거나 비밀번호를 바꾸면 그 관리자의 기존 로그인은 모두 끊는다
  if (change.active === false || change.password !== undefined) {
    stmts.push(db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').bind(id));
  }
  if (stmts.length) await db.batch(stmts);
}

export async function changeOwnPassword(actor: Admin, current: string, next: string): Promise<void> {
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM admins WHERE id = ?').bind(actor.id).first<AdminRow>();
  if (!row || !(await verifyPassword(String(current ?? ''), row.password_hash, row.password_salt))) {
    throw new AuthError('현재 비밀번호가 올바르지 않습니다.');
  }
  const pwErr = validatePassword(String(next ?? ''));
  if (pwErr) throw new AuthError(pwErr);
  const { hash, salt } = await hashPassword(next);
  // 현재 로그인은 유지하고, 다른 기기의 로그인만 끊는다
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? '';
  await db.batch([
    db.prepare('UPDATE admins SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, actor.id),
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND token_hash != ?').bind(actor.id, await sha256(token)),
  ]);
}
