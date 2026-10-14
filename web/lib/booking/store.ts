import 'server-only';
import { getDB, type D1Stmt } from '@/lib/db';
import type { Booking } from './types';

// 예약 저장소 (Cloudflare D1). 로컬 개발도 wrangler/next dev가 만드는 로컬 D1을 쓴다.
// 슬롯 중복은 booking_slots의 PRIMARY KEY로 원자적으로 막는다: insert는 겹치면 SlotConflictError를 던진다.

export class SlotConflictError extends Error {}
export class DuplicateCodeError extends Error {}
export class CouponUsedError extends Error {}

const SLOT_MIN = 30;
// 예약이 점유하는 (장비, 슬롯 시작) 목록 — 여러 상품 예약은 검사별로, 예전 예약은 하나로
const occupied = (b: Booking): { resource: string; start: number }[] => {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const segs = b.items?.length
    ? b.items.map(it => ({ resource: it.resource, start: toMin(it.start), slots: it.slots }))
    : [{ resource: b.resource, start: toMin(b.time), slots: b.slots }];
  return segs.flatMap(s => Array.from({ length: s.slots }, (_, i) => ({ resource: s.resource, start: s.start + i * SLOT_MIN })));
};

// 날짜별로 이미 찬 슬롯 (장비 → 슬롯 시작 시각들)
// excludeCode: 일정 변경 중인 예약 자신의 슬롯은 빈 것으로 본다
export async function takenSlots(date: string, excludeCode = ''): Promise<Map<string, Set<number>>> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT resource, slot_start FROM booking_slots WHERE date = ? AND code != ?')
    .bind(date, excludeCode).all<{ resource: string; slot_start: number }>();
  const map = new Map<string, Set<number>>();
  for (const r of results) {
    if (!map.has(r.resource)) map.set(r.resource, new Set());
    map.get(r.resource)!.add(r.slot_start);
  }
  return map;
}
const parse = (rows: { data: string }[]) => rows.map(r => JSON.parse(r.data) as Booking);

export async function listAll(): Promise<Booking[]> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT data FROM bookings ORDER BY date, time').all<{ data: string }>();
  return parse(results);
}

export async function listByUser(userId: string): Promise<Booking[]> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT data FROM bookings WHERE user_id = ? ORDER BY date DESC, time DESC')
    .bind(userId).all<{ data: string }>();
  return parse(results);
}

export async function listActive(resource: string, date: string): Promise<Booking[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT data FROM bookings WHERE resource = ? AND date = ? AND status = 'confirmed'")
    .bind(resource, date)
    .all<{ data: string }>();
  return parse(results);
}

export async function getByCode(code: string): Promise<Booking | null> {
  const db = await getDB();
  const row = await db.prepare('SELECT data FROM bookings WHERE code = ?').bind(code).first<{ data: string }>();
  return row ? (JSON.parse(row.data) as Booking) : null;
}

// 같은 묶음(함께 예약)의 예약들
export async function listGroup(groupCode: string): Promise<Booking[]> {
  const db = await getDB();
  const { results } = await db.prepare("SELECT data FROM bookings WHERE json_extract(data, '$.groupCode') = ? ORDER BY date, time")
    .bind(groupCode).all<{ data: string }>();
  return parse(results);
}

// 여러 예약을 한 번에 저장 (함께 예약한 상품들). extra: 같은 트랜잭션에서 함께 실행할 문장 (예: 쿠폰 사용 기록)
export async function insertMany(list: Booking[], extra: D1Stmt[] = []): Promise<void> {
  const db = await getDB();
  // batch는 하나의 트랜잭션 — 슬롯 하나라도 충돌하면 모든 예약이 함께 롤백된다
  const stmts = [
    ...list.flatMap(b => [
      db.prepare('INSERT INTO bookings (code, date, time, resource, status, phone, created_at, user_id, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(b.code, b.date, b.time, b.resource, b.status, b.person.phone, b.createdAt, b.userId ?? null, JSON.stringify(b)),
      ...occupied(b).map(o =>
        db.prepare('INSERT INTO booking_slots (resource, date, slot_start, code) VALUES (?, ?, ?, ?)').bind(o.resource, b.date, o.start, b.code),
      ),
    ]),
    ...extra,
  ];
  try {
    await db.batch(stmts);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('booking_slots')) throw new SlotConflictError(msg);
    if (msg.includes('bookings.code')) throw new DuplicateCodeError(msg);
    if (msg.includes('coupon_redemptions')) throw new CouponUsedError(msg);
    throw e;
  }
}

export const insert = (b: Booking, extra: D1Stmt[] = []) => insertMany([b], extra);

// 일정 변경: 기존 슬롯을 지우고 새 슬롯을 잡는다 (한 트랜잭션 — 새 시간이 겹치면 전부 롤백되어 원래 일정 유지)
export async function saveRescheduled(b: Booking): Promise<void> {
  const db = await getDB();
  try {
    await db.batch([
      db.prepare('DELETE FROM booking_slots WHERE code = ?').bind(b.code),
      ...occupied(b).map(o =>
        db.prepare('INSERT INTO booking_slots (resource, date, slot_start, code) VALUES (?, ?, ?, ?)').bind(o.resource, b.date, o.start, b.code),
      ),
      db.prepare('UPDATE bookings SET date = ?, time = ?, data = ? WHERE code = ?').bind(b.date, b.time, JSON.stringify(b), b.code),
    ]);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('booking_slots')) throw new SlotConflictError(msg);
    throw e;
  }
}

export async function saveCancelled(b: Booking, extra: D1Stmt[] = []): Promise<void> {
  const db = await getDB();
  await db.batch([
    db.prepare('UPDATE bookings SET status = ?, data = ? WHERE code = ?').bind(b.status, JSON.stringify(b), b.code),
    db.prepare('DELETE FROM booking_slots WHERE code = ?').bind(b.code),
    ...extra,
  ]);
}
