import 'server-only';
import type { Booking } from './types';

// 예약 저장소. Cloudflare에 배포되면 D1(DB 바인딩), 그 외(로컬 next dev 등)는 JSON 파일을 쓴다.
// 슬롯 중복은 저장소가 원자적으로 막는다: insertBooking은 겹치는 슬롯이 있으면 SlotConflictError를 던진다.

export class SlotConflictError extends Error {}
export class DuplicateCodeError extends Error {}

export interface BookingStore {
  list(): Promise<Booking[]>;
  listActive(resource: string, date: string): Promise<Booking[]>;
  get(code: string): Promise<Booking | null>;
  insert(b: Booking): Promise<void>;
  cancel(b: Booking): Promise<void>;
}

const SLOT_MIN = 30;
const slotStarts = (b: Booking) => {
  const [h, m] = b.time.split(':').map(Number);
  return Array.from({ length: b.slots }, (_, i) => h * 60 + m + i * SLOT_MIN);
};

// ---------- D1 ----------
type D1 = {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown>;
};
type D1Stmt = {
  bind(...v: unknown[]): D1Stmt;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
};

function d1Store(db: D1): BookingStore {
  const parse = (rows: { data: string }[]) => rows.map(r => JSON.parse(r.data) as Booking);
  return {
    async list() {
      const { results } = await db.prepare('SELECT data FROM bookings ORDER BY date, time').all<{ data: string }>();
      return parse(results);
    },
    async listActive(resource, date) {
      const { results } = await db
        .prepare("SELECT data FROM bookings WHERE resource = ? AND date = ? AND status = 'confirmed'")
        .bind(resource, date)
        .all<{ data: string }>();
      return parse(results);
    },
    async get(code) {
      const row = await db.prepare('SELECT data FROM bookings WHERE code = ?').bind(code).first<{ data: string }>();
      return row ? (JSON.parse(row.data) as Booking) : null;
    },
    async insert(b) {
      // batch는 하나의 트랜잭션 — 슬롯 하나라도 충돌하면 예약 본문까지 모두 롤백된다
      const stmts = [
        db.prepare('INSERT INTO bookings (code, date, time, resource, status, phone, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(b.code, b.date, b.time, b.resource, b.status, b.person.phone, b.createdAt, JSON.stringify(b)),
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
    },
    async cancel(b) {
      await db.batch([
        db.prepare('UPDATE bookings SET status = ?, data = ? WHERE code = ?').bind(b.status, JSON.stringify(b), b.code),
        db.prepare('DELETE FROM booking_slots WHERE code = ?').bind(b.code),
      ]);
    },
  };
}

// ---------- JSON 파일 (로컬 개발용) ----------
async function fileStore(): Promise<BookingStore> {
  const { promises: fs } = await import('fs');
  const path = await import('path');
  const dir = process.env.BOOKING_DATA_DIR || path.join(process.cwd(), 'data');
  const file = path.join(dir, 'bookings.json');

  const readAll = async (): Promise<Booking[]> => {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8')) as Booking[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  };
  const writeAll = async (list: Booking[]) => {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
    await fs.rename(tmp, file);
  };
  // 한 프로세스 안에서 쓰기를 직렬화해 슬롯 중복을 막는다
  const g = globalThis as unknown as { __bookingLock?: Promise<unknown> };
  const withLock = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = (g.__bookingLock ?? Promise.resolve()).then(fn, fn);
    g.__bookingLock = run.catch(() => undefined);
    return run;
  };
  const active = (list: Booking[], resource: string, date: string) =>
    list.filter(b => b.status === 'confirmed' && b.resource === resource && b.date === date);

  return {
    list: readAll,
    async listActive(resource, date) { return active(await readAll(), resource, date); },
    async get(code) { return (await readAll()).find(b => b.code === code) ?? null; },
    insert: b => withLock(async () => {
      const list = await readAll();
      if (list.some(x => x.code === b.code)) throw new DuplicateCodeError(b.code);
      const mine = new Set(slotStarts(b));
      if (active(list, b.resource, b.date).some(x => slotStarts(x).some(s => mine.has(s)))) throw new SlotConflictError(b.code);
      list.push(b);
      await writeAll(list);
    }),
    cancel: b => withLock(async () => {
      const list = await readAll();
      const i = list.findIndex(x => x.code === b.code);
      if (i >= 0) list[i] = b;
      await writeAll(list);
    }),
  };
}

let cached: Promise<BookingStore> | null = null;

export function getStore(): Promise<BookingStore> {
  cached ??= (async () => {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const { env } = await getCloudflareContext({ async: true });
      const db = (env as unknown as { DB?: D1 }).DB;
      if (db) return d1Store(db);
    } catch {
      // Cloudflare 환경이 아님 → 파일 저장소
    }
    return fileStore();
  })();
  return cached;
}
