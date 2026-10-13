// 예약 일정 규칙 — 클라이언트와 서버가 함께 사용한다. 날짜는 'YYYY-MM-DD', 시간은 'HH:MM' (모두 한국 시간)
import { plans, type Plan } from '@/lib/data';

export const SLOT_MIN = 30;
export const BOOKING_WINDOW_MONTHS = 6; // 내일부터 6개월 뒤 같은 날까지 예약 가능
export const CANCEL_DEADLINE_DAYS = 2; // 검진 2일 전까지 변경·취소 가능

// 상품별 장비 점유 슬롯 수 (30분 단위)
const PLAN_SLOTS: Record<string, number> = { annual: 1, spine: 2, neuro: 4, 'heart-ct': 1, 'lung-ct': 1 };

// 커플 플랜이 가능한 상품 (할인액은 서버 전용 lib/pricing.ts)
const COUPLE_PLANS = new Set(['annual', 'spine', 'neuro']);

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function getPlan(id: string): Plan | undefined {
  return plans.find(p => p.id === id);
}

export function slotsNeeded(planId: string, couple: boolean): number {
  return (PLAN_SLOTS[planId] ?? 1) * (couple ? 2 : 1);
}

export function supportsCouple(planId: string): boolean {
  return COUPLE_PLANS.has(planId);
}

const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function dayOfWeek(date: string): number {
  return new Date(parse(date)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  return fmt(parse(date) + n * 86400000);
}

export function diffDays(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / 86400000);
}

export function kstToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && fmt(parse(date)) === date;
}

// 예약 가능 시간(분 단위 구간) — 이로영상의학과 진료시간 기준
// 평일 08:30–17:30 (점심 12:00–13:00) / 토 08:30–12:30, 12:00 접수 마감이므로 12:00까지 / 일 휴진
export const HOURS_NOTE = '평일 08:30–17:30 (점심 12:00–13:00) · 토요일 08:30–12:00 · 일요일 휴진';

export function openPeriods(date: string): [number, number][] {
  const dow = dayOfWeek(date);
  if (dow === 0) return [];
  if (dow === 6) return [[510, 720]];
  return [[510, 720], [780, 1050]];
}

export function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// 같은 운영 구간 안에서 need개 슬롯이 연속으로 들어가는 시작 시각들
export function candidateStarts(date: string, need: number): number[] {
  const out: number[] = [];
  for (const [s, e] of openPeriods(date)) {
    for (let t = s; t + need * SLOT_MIN <= e; t += SLOT_MIN) out.push(t);
  }
  return out;
}

export function isBookableDate(date: string, today = kstToday()): boolean {
  const d = diffDays(today, date);
  return d >= 1 && date <= lastBookableDate(today) && openPeriods(date).length > 0;
}

// 월 단위 더하기. 말일이 없는 달은 그 달 말일로 맞춘다 (8/31 + 6개월 → 2/28)
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return fmt(first.getTime());
}

export function firstBookableDate(today = kstToday()): string {
  return addDays(today, 1);
}

export function lastBookableDate(today = kstToday()): string {
  return addMonths(today, BOOKING_WINDOW_MONTHS);
}

export function canCancel(date: string, today = kstToday()): boolean {
  return diffDays(today, date) >= CANCEL_DEADLINE_DAYS;
}

export function overlaps(aStart: number, aSlots: number, bStart: number, bSlots: number): boolean {
  return aStart < bStart + bSlots * SLOT_MIN && bStart < aStart + aSlots * SLOT_MIN;
}

export function formatDateKo(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS[dayOfWeek(date)]})`;
}

export function normalizePhone(v: string): string {
  return v.replace(/\D/g, '');
}

export function formatPhone(v: string): string {
  const d = normalizePhone(v);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}
