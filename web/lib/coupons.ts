import 'server-only';
import { getDB, type D1Stmt } from '@/lib/db';
import { randomToken } from '@/lib/auth/crypto';
import { isValidDate, kstToday } from '@/lib/booking/schedule';
import type { ProductWithPrice } from './products-shared';

// 쿠폰: 금액(원)/비율(%) 할인, 상품 전용 또는 전체 상품, 기간·사용 횟수 제한, 특정 회원 지정.
// 같은 쿠폰은 회원당 1회 (coupon_redemptions UNIQUE(coupon_code, user_id))

export type Coupon = {
  code: string;
  name: string;
  productId: string | null;
  discountType: 'amount' | 'percent';
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  userId: string | null;
  validFrom: string;
  validUntil: string;
  active: boolean;
  batchId: string | null;
  memo: string;
  createdBy: string | null;
  createdAt: string;
};

type Row = {
  code: string; name: string; product_id: string | null; discount_type: 'amount' | 'percent'; discount_value: number;
  max_uses: number | null; used_count: number; user_id: string | null; valid_from: string; valid_until: string;
  active: number; batch_id: string | null; memo: string; created_by: string | null; created_at: string;
};

const toCoupon = (r: Row): Coupon => ({
  code: r.code, name: r.name, productId: r.product_id, discountType: r.discount_type, discountValue: r.discount_value,
  maxUses: r.max_uses, usedCount: r.used_count, userId: r.user_id, validFrom: r.valid_from, validUntil: r.valid_until,
  active: Boolean(r.active), batchId: r.batch_id, memo: r.memo, createdBy: r.created_by, createdAt: r.created_at,
});

export class CouponError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const normalizeCode = (v: string) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');

export function describeDiscount(c: Pick<Coupon, 'discountType' | 'discountValue'>): string {
  return c.discountType === 'percent' ? `${c.discountValue}% 할인` : `${c.discountValue.toLocaleString('ko-KR')}원 할인`;
}

// 할인 금액 (백원 단위 내림, 결제 금액을 넘지 않음)
export function discountFor(c: Pick<Coupon, 'discountType' | 'discountValue'>, price: number): number {
  const raw = c.discountType === 'percent' ? (price * c.discountValue) / 100 : c.discountValue;
  return Math.max(0, Math.min(price, Math.floor(raw / 100) * 100));
}

// 이 회원이 이 상품 예약에 쓸 수 있는 쿠폰인지 확인하고 할인액을 돌려준다
export async function checkCoupon(codeRaw: string, userId: string, product: ProductWithPrice, price: number): Promise<{ coupon: Coupon; discount: number }> {
  const code = normalizeCode(codeRaw);
  if (!code) throw new CouponError('쿠폰 코드를 입력해 주세요.');
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first<Row>();
  const c = row ? toCoupon(row) : null;
  const today = kstToday();
  if (!c || !c.active || (c.userId && c.userId !== userId)) throw new CouponError('사용할 수 없는 쿠폰입니다. 코드를 확인해 주세요.');
  if (today < c.validFrom) throw new CouponError(`${c.validFrom}부터 사용할 수 있는 쿠폰입니다.`);
  if (today > c.validUntil) throw new CouponError('사용 기간이 지난 쿠폰입니다.');
  if (c.productId && c.productId !== product.id) throw new CouponError('이 상품에는 쓸 수 없는 쿠폰입니다.');
  if (c.maxUses !== null && c.usedCount >= c.maxUses) throw new CouponError('발급 수량이 모두 사용된 쿠폰입니다.');
  if (await db.prepare('SELECT 1 FROM coupon_redemptions WHERE coupon_code = ? AND user_id = ?').bind(code, userId).first()) {
    throw new CouponError('이미 사용한 쿠폰입니다.');
  }
  return { coupon: c, discount: discountFor(c, price) };
}

// 사용 횟수 선점 (동시에 여러 명이 써도 한도를 넘지 않게 조건부로 올린다)
export async function reserveCouponUse(code: string): Promise<boolean> {
  const db = await getDB();
  const r = await db.prepare(
    'UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND active = 1 AND (max_uses IS NULL OR used_count < max_uses)',
  ).bind(code).run();
  return Boolean(r.meta?.changes);
}

export async function releaseCouponUse(code: string): Promise<void> {
  const db = await getDB();
  await db.prepare('UPDATE coupons SET used_count = MAX(used_count - 1, 0) WHERE code = ?').bind(code).run();
}

// 예약 저장과 같은 트랜잭션에 넣을 사용 기록 / 취소 시 되돌리기
export async function redemptionStmt(code: string, userId: string, bookingCode: string, discount: number): Promise<D1Stmt> {
  const db = await getDB();
  return db.prepare('INSERT INTO coupon_redemptions (booking_code, coupon_code, user_id, discount, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(bookingCode, code, userId, discount, new Date().toISOString());
}

export async function restoreStmts(bookingCode: string, code: string): Promise<D1Stmt[]> {
  const db = await getDB();
  return [
    db.prepare('DELETE FROM coupon_redemptions WHERE booking_code = ?').bind(bookingCode),
    db.prepare('UPDATE coupons SET used_count = MAX(used_count - 1, 0) WHERE code = ?').bind(code),
  ];
}

// ---------- 관리자 ----------

export async function listCoupons(): Promise<(Coupon & { userEmail: string | null; userName: string | null })[]> {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT c.*, u.email AS user_email, u.name AS user_name FROM coupons c LEFT JOIN users u ON u.id = c.user_id
     ORDER BY c.created_at DESC, c.code`,
  ).all<Row & { user_email: string | null; user_name: string | null }>();
  return results.map(r => ({ ...toCoupon(r), userEmail: r.user_email, userName: r.user_name }));
}

export async function myCoupons(userId: string): Promise<Coupon[]> {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT c.* FROM coupons c
     WHERE c.user_id = ? AND c.active = 1 AND c.valid_until >= ?
       AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
       AND NOT EXISTS (SELECT 1 FROM coupon_redemptions r WHERE r.coupon_code = c.code AND r.user_id = c.user_id)
     ORDER BY c.valid_until`,
  ).bind(userId, kstToday()).all<Row>();
  return results.map(toCoupon);
}

export type IssueInput = {
  mode: 'shared' | 'batch' | 'members';
  name: string;
  productId: string | null;
  discountType: 'amount' | 'percent';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  memo?: string;
  code?: string;          // shared: 직접 정한 코드 (비우면 자동)
  maxUses?: number | null; // shared: 전체 사용 한도 (비우면 무제한)
  count?: number;         // batch: 만들 코드 수
  emails?: string;        // members: 회원 이메일 (줄바꿈·쉼표 구분)
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(prefix = 'SL'): string {
  let s = '';
  for (const b of crypto.getRandomValues(new Uint8Array(8))) s += CODE_CHARS[b % CODE_CHARS.length];
  return `${prefix}-${s}`;
}

export async function issueCoupons(input: IssueInput, adminName: string, products: ProductWithPrice[]): Promise<{ codes: string[]; skipped: string[] }> {
  const name = String(input.name ?? '').trim().slice(0, 60);
  if (name.length < 2) throw new CouponError('쿠폰 이름을 입력해 주세요.');
  const productId = input.productId || null;
  if (productId && !products.some(p => p.id === productId)) throw new CouponError('상품을 확인해 주세요.');
  if (input.discountType !== 'amount' && input.discountType !== 'percent') throw new CouponError('할인 방식을 선택해 주세요.');
  const value = Math.round(Number(input.discountValue));
  if (input.discountType === 'percent' && !(value >= 1 && value <= 100)) throw new CouponError('할인율은 1~100% 사이로 입력해 주세요.');
  if (input.discountType === 'amount' && !(value >= 100 && value <= 10_000_000)) throw new CouponError('할인 금액을 확인해 주세요.');
  if (!isValidDate(input.validFrom) || !isValidDate(input.validUntil) || input.validFrom > input.validUntil) {
    throw new CouponError('사용 기간을 확인해 주세요.');
  }
  const memo = String(input.memo ?? '').slice(0, 200);
  const batchId = `b_${randomToken(8)}`;
  const now = new Date().toISOString();
  const db = await getDB();

  const insert = (code: string, maxUses: number | null, userId: string | null) =>
    db.prepare(
      `INSERT INTO coupons (code, name, product_id, discount_type, discount_value, max_uses, used_count, user_id, valid_from, valid_until, active, batch_id, memo, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).bind(code, name, productId, input.discountType, value, maxUses, userId, input.validFrom, input.validUntil, batchId, memo, adminName, now);

  if (input.mode === 'shared') {
    const code = input.code ? normalizeCode(input.code) : genCode();
    if (!/^[A-Z0-9-]{4,24}$/.test(code)) throw new CouponError('쿠폰 코드는 영문 대문자·숫자·하이픈 4~24자로 입력해 주세요.');
    const maxUses = input.maxUses === null || input.maxUses === undefined || String(input.maxUses) === '' ? null : Math.round(Number(input.maxUses));
    if (maxUses !== null && !(maxUses >= 1 && maxUses <= 100_000)) throw new CouponError('사용 한도를 확인해 주세요.');
    try {
      await insert(code, maxUses, null).run();
    } catch (e) {
      if (String((e as Error).message).includes('coupons.code')) throw new CouponError('이미 있는 쿠폰 코드입니다.', 409);
      throw e;
    }
    return { codes: [code], skipped: [] };
  }

  if (input.mode === 'batch') {
    const count = Math.round(Number(input.count));
    if (!(count >= 1 && count <= 500)) throw new CouponError('발급 수량은 1~500개로 입력해 주세요.');
    const codes = new Set<string>();
    while (codes.size < count) codes.add(genCode());
    await db.batch([...codes].map(c => insert(c, 1, null)));
    return { codes: [...codes], skipped: [] };
  }

  // members: 회원 이메일마다 그 회원 전용 1회용 쿠폰
  const emails = [...new Set(String(input.emails ?? '').split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) throw new CouponError('회원 이메일을 입력해 주세요.');
  if (emails.length > 500) throw new CouponError('한 번에 500명까지 발급할 수 있습니다.');
  const found = new Map<string, string>();
  for (let i = 0; i < emails.length; i += 50) {
    const part = emails.slice(i, i + 50);
    const { results } = await db.prepare(`SELECT id, email FROM users WHERE email IN (${part.map(() => '?').join(',')})`)
      .bind(...part).all<{ id: string; email: string }>();
    results.forEach(r => found.set(r.email, r.id));
  }
  const skipped = emails.filter(e => !found.has(e));
  const codes: string[] = [];
  const stmts = [...found.values()].map(uid => { const c = genCode(); codes.push(c); return insert(c, 1, uid); });
  if (stmts.length) await db.batch(stmts);
  return { codes, skipped };
}

export async function setCouponActive(code: string, active: boolean): Promise<void> {
  const db = await getDB();
  const r = await db.prepare('UPDATE coupons SET active = ? WHERE code = ?').bind(active ? 1 : 0, normalizeCode(code)).run();
  if (!r.meta?.changes) throw new CouponError('쿠폰을 찾을 수 없습니다.', 404);
}
