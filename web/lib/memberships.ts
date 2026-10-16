import 'server-only';
import { cache } from 'react';
import { getDB } from '@/lib/db';
import { randomToken } from '@/lib/auth/crypto';
import { addDays, addMonths, isValidDate, kstToday } from '@/lib/booking/schedule';
import {
  APP_STATUS, CONTACT_TIMES, GOALS, MAX_SEATS, TIER_ID_RE, type AppStatus, type Tier, type TierWithPrice,
} from './memberships-shared';

// 멤버십 티어와 가입 신청 (D1). 연 회비는 서버에서만 다루고 비회원에게는 toPublicTier()로 뺀다.

export class MembershipError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type TierRow = {
  id: string; name: string; name_ko: string; tagline: string; description: string; price: number | null;
  seats: number; benefits: string; featured: number; active: number; sort_order: number;
};

const arr = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

const toTier = (r: TierRow): TierWithPrice => ({
  id: r.id, name: r.name, nameKo: r.name_ko, tagline: r.tagline, description: r.description, price: r.price,
  seats: r.seats, benefits: arr(r.benefits), featured: Boolean(r.featured), active: Boolean(r.active), sortOrder: r.sort_order,
});

export function toPublicTier(t: TierWithPrice): Tier {
  const { price: _p, ...rest } = t;
  return rest;
}

export const listTiers = cache(async (opts: { includeInactive?: boolean } = {}): Promise<TierWithPrice[]> => {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT * FROM membership_tiers ${opts.includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort_order, name`,
  ).all<TierRow>();
  return results.map(toTier);
});

export type TierInput = {
  id: string; name: string; nameKo: string; tagline: string; description: string; price: number | null;
  seats: number; benefits: string[]; featured: boolean; active: boolean; sortOrder: number;
};

export async function saveTier(input: TierInput, mode: 'create' | 'update', adminName: string): Promise<void> {
  const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const id = s(input.id, 31).toLowerCase();
  if (!TIER_ID_RE.test(id)) throw new MembershipError('티어 ID는 영문 소문자·숫자·하이픈(-) 2~31자로 입력해 주세요.');
  const name = s(input.name, 30).toUpperCase();
  const nameKo = s(input.nameKo, 20);
  if (name.length < 2 || nameKo.length < 1) throw new MembershipError('티어 이름(영문·한글)을 입력해 주세요.');
  let price: number | null = null;
  if (input.price !== null && input.price !== undefined && String(input.price) !== '') {
    price = Math.round(Number(input.price));
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000_000) throw new MembershipError('연 회비를 확인해 주세요.');
  }
  const seats = Math.round(Number(input.seats));
  if (!(seats >= 1 && seats <= MAX_SEATS)) throw new MembershipError(`기본 인원은 1~${MAX_SEATS}명으로 입력해 주세요.`);
  const benefits = (Array.isArray(input.benefits) ? input.benefits : []).map(b => s(b, 120)).filter(Boolean).slice(0, 20);
  if (!benefits.length) throw new MembershipError('혜택을 한 개 이상 입력해 주세요.');
  const vals = [name, nameKo, s(input.tagline, 80), s(input.description, 400), price, seats, JSON.stringify(benefits),
    input.featured ? 1 : 0, input.active ? 1 : 0, Math.round(Number(input.sortOrder) || 0), new Date().toISOString(), adminName];

  const db = await getDB();
  if (mode === 'create') {
    try {
      await db.prepare(
        `INSERT INTO membership_tiers (id, name, name_ko, tagline, description, price, seats, benefits, featured, active, sort_order, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, ...vals).run();
    } catch (e) {
      if (String((e as Error).message).includes('membership_tiers.id')) throw new MembershipError('이미 있는 티어 ID입니다.', 409);
      throw e;
    }
    return;
  }
  const r = await db.prepare(
    `UPDATE membership_tiers SET name = ?, name_ko = ?, tagline = ?, description = ?, price = ?, seats = ?, benefits = ?,
       featured = ?, active = ?, sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
  ).bind(...vals, id).run();
  if (!r.meta?.changes) throw new MembershipError('티어를 찾을 수 없습니다.', 404);
}

// ---------- 가입 신청 ----------

export type Application = {
  id: string; userId: string; tierId: string; tierName: string; seats: number; contactTime: string; goals: string[];
  memo: string; status: AppStatus; adminMemo: string; startedAt: string | null; expiresAt: string | null;
  createdAt: string; updatedAt: string; updatedBy: string | null;
};

type AppRow = {
  id: string; user_id: string; tier_id: string; tier_name: string; seats: number; contact_time: string; goals: string;
  memo: string; status: AppStatus; admin_memo: string; started_at: string | null; expires_at: string | null;
  created_at: string; updated_at: string; updated_by: string | null;
};

const toApp = (r: AppRow): Application => ({
  id: r.id, userId: r.user_id, tierId: r.tier_id, tierName: r.tier_name, seats: r.seats, contactTime: r.contact_time,
  goals: arr(r.goals), memo: r.memo, status: r.status, adminMemo: r.admin_memo, startedAt: r.started_at,
  expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at, updatedBy: r.updated_by,
});

// 진행 중인 신청(상담 대기·상담 중)이나 이용 중인 멤버십이 있는지
const isOpen = (a: Application, today = kstToday()) =>
  a.status === 'requested' || a.status === 'contacted' || (a.status === 'active' && (!a.expiresAt || a.expiresAt >= today));

export async function myApplications(userId: string): Promise<Application[]> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT * FROM membership_applications WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId).all<AppRow>();
  return results.map(toApp);
}

export async function currentMembership(userId: string): Promise<Application | null> {
  return (await myApplications(userId)).find(a => isOpen(a)) ?? null;
}

export type ApplyInput = { tierId: string; seats?: number; contactTime: string; goals?: string[]; memo?: string; consent?: boolean };

export async function applyMembership(userId: string, input: ApplyInput): Promise<Application> {
  const tier = (await listTiers()).find(t => t.id === String(input.tierId ?? ''));
  if (!tier) throw new MembershipError('신청할 수 없는 멤버십입니다.');
  if (!input.consent) throw new MembershipError('상담을 위한 개인정보 이용에 동의해 주세요.');
  if (!(CONTACT_TIMES as readonly string[]).includes(input.contactTime)) throw new MembershipError('연락 받을 시간대를 선택해 주세요.');
  const seats = tier.seats > 1 ? Math.round(Number(input.seats ?? tier.seats)) : 1;
  if (!(seats >= tier.seats && seats <= MAX_SEATS)) throw new MembershipError(`가입 인원은 ${tier.seats}~${MAX_SEATS}명으로 선택해 주세요.`);
  const goals = (Array.isArray(input.goals) ? input.goals : []).filter(g => (GOALS as readonly string[]).includes(g));
  const memo = String(input.memo ?? '').trim().slice(0, 500);

  const open = await currentMembership(userId);
  if (open) {
    throw new MembershipError(open.status === 'active'
      ? `이미 ${open.tierName} 멤버십을 이용 중입니다. 변경은 컨시어지에게 문의해 주세요.`
      : `이미 ${open.tierName} 멤버십 상담을 신청하셨습니다. 내 페이지에서 확인할 수 있어요.`, 409);
  }

  const now = new Date().toISOString();
  const app: Application = {
    id: `m_${randomToken(10)}`, userId, tierId: tier.id, tierName: `${tier.name} · ${tier.nameKo}`, seats, contactTime: input.contactTime,
    goals, memo, status: 'requested', adminMemo: '', startedAt: null, expiresAt: null, createdAt: now, updatedAt: now, updatedBy: null,
  };
  const db = await getDB();
  await db.prepare(
    `INSERT INTO membership_applications (id, user_id, tier_id, tier_name, seats, contact_time, goals, memo, status, admin_memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', '', ?, ?)`,
  ).bind(app.id, userId, app.tierId, app.tierName, seats, app.contactTime, JSON.stringify(goals), memo, now, now).run();
  return app;
}

// 회원 본인은 상담 대기 중인 신청만 취소할 수 있다
export async function cancelMyApplication(userId: string, id: string): Promise<void> {
  const db = await getDB();
  const r = await db.prepare(
    "UPDATE membership_applications SET status = 'cancelled', updated_at = ?, updated_by = '회원 본인' WHERE id = ? AND user_id = ? AND status = 'requested'",
  ).bind(new Date().toISOString(), String(id ?? ''), userId).run();
  if (!r.meta?.changes) throw new MembershipError('취소할 수 있는 신청이 없습니다. 상담이 시작된 뒤에는 컨시어지에게 문의해 주세요.');
}

// ---------- 관리자 ----------

export type AdminApplication = Application & { userName: string; userEmail: string; userPhone: string };

export async function listApplications(): Promise<AdminApplication[]> {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT a.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM membership_applications a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY CASE a.status WHEN 'requested' THEN 0 WHEN 'contacted' THEN 1 WHEN 'active' THEN 2 ELSE 3 END, a.created_at DESC`,
  ).all<AppRow & { user_name: string | null; user_email: string | null; user_phone: string | null }>();
  return results.map(r => ({ ...toApp(r), userName: r.user_name ?? '(탈퇴 회원)', userEmail: r.user_email ?? '', userPhone: r.user_phone ?? '' }));
}

export type AppUpdate = { id: string; status: AppStatus; adminMemo?: string; startedAt?: string };

export async function updateApplication(u: AppUpdate, adminName: string): Promise<void> {
  if (!(u.status in APP_STATUS)) throw new MembershipError('상태를 선택해 주세요.');
  const db = await getDB();
  const cur = await db.prepare('SELECT * FROM membership_applications WHERE id = ?').bind(String(u.id ?? '')).first<AppRow>();
  if (!cur) throw new MembershipError('신청을 찾을 수 없습니다.', 404);

  let startedAt = cur.started_at;
  let expiresAt = cur.expires_at;
  if (u.status === 'active') {
    // 가입 확정: 시작일부터 1년 (시작일을 비우면 오늘)
    const start = u.startedAt && isValidDate(u.startedAt) ? u.startedAt : cur.started_at ?? kstToday();
    if (start !== cur.started_at || !expiresAt) {
      startedAt = start;
      expiresAt = addDays(addMonths(start, 12), -1);
    }
    // 같은 회원이 이미 이용 중인 다른 멤버십이 있으면 막는다
    const other = (await myApplications(cur.user_id)).find(a => a.id !== cur.id && a.status === 'active' && (!a.expiresAt || a.expiresAt >= kstToday()));
    if (other) throw new MembershipError(`이 회원은 이미 ${other.tierName} 멤버십을 이용 중입니다.`);
  }
  await db.prepare(
    'UPDATE membership_applications SET status = ?, admin_memo = ?, started_at = ?, expires_at = ?, updated_at = ?, updated_by = ? WHERE id = ?',
  ).bind(u.status, String(u.adminMemo ?? cur.admin_memo).slice(0, 1000), startedAt, expiresAt, new Date().toISOString(), adminName, cur.id).run();
}
