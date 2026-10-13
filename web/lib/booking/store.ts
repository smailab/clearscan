import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import type { Booking } from './types';

// 임시 저장소: JSON 파일. 운영 환경에서는 DB(예: Postgres)로 교체할 것 — 이 파일의 함수 시그니처만 유지하면 된다.
const DATA_DIR = process.env.BOOKING_DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'bookings.json');

// 동시에 들어온 예약이 같은 슬롯을 잡지 않도록 프로세스 단위로 쓰기를 직렬화한다
const g = globalThis as unknown as { __bookingLock?: Promise<unknown> };

export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__bookingLock ?? Promise.resolve();
  const run = prev.then(fn, fn);
  g.__bookingLock = run.catch(() => undefined);
  return run;
}

export async function readAll(): Promise<Booking[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Booking[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

export async function writeAll(list: Booking[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, FILE);
}
