import 'server-only';
import { getDB } from '@/lib/db';
import type { Booking } from './types';

// 예약 저장소 (Cloudflare D1). 로컬 개발도 wrangler/next dev가 만드는 로컬 D1을 쓴다.
// 슬롯 중복은 booking_slots의 PRIMARY KEY로 원자적으로 막는다: insert는 겹치면 SlotConflictError를 던진다.

export class SlotConflictError extends Error {}
export class DuplicateCodeError extends Error {}

const SLOT_MIN = 30;
const slotStarts = (b: Booking) => {
  const [h, m] = b.time.split(':').map(Number);
  return Array.from({ length: b.slots }, (_, i) => h * 60 + m + i * SLOT_MIN);
};
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

export async function insert(b: Booking): Promise<void> {
  const db = await getDB();
  // batch는 하나의 트랜잭션 — 슬롯 하나라도 충돌하면 예약 본문까지 모두 롤백된다
  const stmts = [
    db.prepare('INSERT INTO bookings (code, date, time, resource, status, phone, created_at, user_id, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(b.code, b.date, b.time, b.resource, b.status, b.person.phone, b.createdAt, b.userId ?? null, JSON.stringify(b)),
    ...slotStarts(b).map(s =>
      db.prepare('INSERT INTO booking_slots (resource, date, slot_start, code) VALUES (?, ?, ?, ?)').bind(b.resource, b.date, s, b.code),
    ),
  ];
  try {
    await db.batch(stmts);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('booking_slots')) throw new SlotConflictError(msg);
    if (msg.includes('bookings.code')) throw new DuplicateCodeError(msg);
    throw e;
  }
}

export async function saveCancelled(b: Booking): Promise<void> {
  const db = await getDB();
  await db.batch([
    db.prepare('UPDATE bookings SET status = ?, data = ? WHERE code = ?').bind(b.status, JSON.stringify(b), b.code),
    db.prepare('DELETE FROM booking_slots WHERE code = ?').bind(b.code),
  ]);
}
