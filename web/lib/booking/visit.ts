// 한 번 방문에 여러 검사를 연이어 받는 일정 계산 — 클라이언트와 서버가 함께 쓴다.
// 순서: MRI 검사 먼저, 그다음 CT. 각 검사는 자기 장비(resource)를 점유한다.
import { SLOT_MIN, toHHMM } from './schedule';
import { slotsNeeded, type Product } from '@/lib/products-shared';

export const MAX_ITEMS = 5;

export type Segment = { planId: string; resource: 'MRI' | 'CT'; start: number; slots: number };

type P = Pick<Product, 'id' | 'kind' | 'slots' | 'sortOrder'>;

export function orderItems<T extends P>(items: T[]): T[] {
  const rank = (k: string) => (k === 'MRI' ? 0 : 1);
  return [...items].sort((a, b) => rank(a.kind) - rank(b.kind) || a.sortOrder - b.sortOrder);
}

// 시작 시각(분)부터 검사를 차례로 배치한다
export function buildSegments(items: P[], couple: boolean, start: number): Segment[] {
  let cursor = start;
  return orderItems(items).map(p => {
    const slots = slotsNeeded(p, couple);
    const seg: Segment = { planId: p.id, resource: p.kind, start: cursor, slots };
    cursor += slots * SLOT_MIN;
    return seg;
  });
}

export function totalSlots(items: Pick<Product, 'slots'>[], couple: boolean): number {
  return items.reduce((n, p) => n + slotsNeeded(p, couple), 0);
}

// 각 검사가 점유하는 30분 슬롯 시작 시각들
export function segmentSlotStarts(seg: Pick<Segment, 'start' | 'slots'>): number[] {
  return Array.from({ length: seg.slots }, (_, i) => seg.start + i * SLOT_MIN);
}

export function describeSegments(segs: Segment[], names: (id: string) => string): string {
  return segs.map(s => `${toHHMM(s.start)} ${names(s.planId)}`).join(' → ');
}
