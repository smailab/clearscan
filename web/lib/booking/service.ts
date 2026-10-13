import 'server-only';
import { randomInt } from 'crypto';
import { readAll, withLock, writeAll } from './store';
import {
  canCancel, candidateStarts, getPlan, isBookableDate, isValidDate, kstToday, normalizePhone,
  overlaps, priceFor, slotsNeeded, supportsCouple, toHHMM, toMin,
} from './schedule';
import type { Booking, BookingRequest, Person, SlotInfo } from './types';

export class BookingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외

function newCode(existing: Set<string>): string {
  for (;;) {
    let c = 'CS-';
    for (let i = 0; i < 6; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (!existing.has(c)) return c;
  }
}

function resourceBookings(list: Booking[], resource: string, date: string) {
  return list.filter(b => b.status === 'confirmed' && b.resource === resource && b.date === date);
}

export async function getAvailability(planId: string, couple: boolean, date: string): Promise<SlotInfo[]> {
  const plan = getPlan(planId);
  if (!plan) throw new BookingError('존재하지 않는 검진 상품입니다.');
  if (!isValidDate(date) || !isBookableDate(date)) return [];
  const need = slotsNeeded(planId, couple && supportsCouple(planId));
  const taken = resourceBookings(await readAll(), plan.kind, date);
  return candidateStarts(date, need).map(t => ({
    time: toHHMM(t),
    available: !taken.some(b => overlaps(t, need, toMin(b.time), b.slots)),
  }));
}

function validPerson(p: Person | undefined, label: string): Person {
  if (!p) throw new BookingError(`${label} 정보를 입력해 주세요.`);
  const name = String(p.name ?? '').trim();
  const phone = normalizePhone(String(p.phone ?? ''));
  const birth = String(p.birth ?? '');
  if (name.length < 2 || name.length > 20) throw new BookingError(`${label} 이름을 확인해 주세요.`);
  if (!/^01[016789]\d{7,8}$/.test(phone)) throw new BookingError(`${label} 휴대폰 번호를 확인해 주세요.`);
  if (!isValidDate(birth) || birth < '1900-01-01' || birth > kstToday()) throw new BookingError(`${label} 생년월일을 확인해 주세요.`);
  if (p.sex !== 'M' && p.sex !== 'F') throw new BookingError(`${label} 성별을 선택해 주세요.`);
  return { name, phone, birth, sex: p.sex };
}

export async function createBooking(req: BookingRequest): Promise<Booking> {
  const plan = getPlan(req.planId);
  if (!plan) throw new BookingError('존재하지 않는 검진 상품입니다.');
  if (!req.consent?.privacy || !req.consent?.sensitive) throw new BookingError('개인정보 및 민감정보 수집·이용에 동의해 주세요.');
  if (!isValidDate(req.date) || !isBookableDate(req.date)) throw new BookingError('예약할 수 없는 날짜입니다.');

  const couple = Boolean(req.couple) && supportsCouple(plan.id);
  const person = validPerson(req.person, '예약자');
  const partner = couple ? validPerson(req.partner, '동반자') : undefined;
  const need = slotsNeeded(plan.id, couple);
  const start = /^\d{2}:\d{2}$/.test(req.time) ? toMin(req.time) : -1;
  if (!candidateStarts(req.date, need).includes(start)) throw new BookingError('예약할 수 없는 시간입니다.');

  const survey = {
    metalImplant: Boolean(req.survey?.metalImplant),
    claustrophobia: Boolean(req.survey?.claustrophobia),
    pregnant: Boolean(req.survey?.pregnant),
    memo: String(req.survey?.memo ?? '').slice(0, 500),
  };

  return withLock(async () => {
    const list = await readAll();
    const taken = resourceBookings(list, plan.kind, req.date);
    if (taken.some(b => overlaps(start, need, toMin(b.time), b.slots))) {
      throw new BookingError('방금 다른 예약이 들어온 시간입니다. 다른 시간을 선택해 주세요.', 409);
    }
    const booking: Booking = {
      code: newCode(new Set(list.map(b => b.code))),
      planId: plan.id,
      resource: plan.kind,
      date: req.date,
      time: toHHMM(start),
      slots: need,
      couple,
      person,
      partner,
      survey,
      price: priceFor(plan.id, couple),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    list.push(booking);
    await writeAll(list);
    return booking;
  });
}

async function findOwned(list: Booking[], code: string, phone: string): Promise<Booking> {
  const b = list.find(x => x.code === String(code).trim().toUpperCase());
  if (!b || b.person.phone !== normalizePhone(phone)) throw new BookingError('예약 정보를 찾을 수 없습니다. 예약번호와 휴대폰 번호를 확인해 주세요.', 404);
  return b;
}

export async function lookupBooking(code: string, phone: string): Promise<Booking> {
  return findOwned(await readAll(), code, phone);
}

export async function cancelBooking(code: string, phone: string): Promise<Booking> {
  return withLock(async () => {
    const list = await readAll();
    const b = await findOwned(list, code, phone);
    if (b.status === 'cancelled') throw new BookingError('이미 취소된 예약입니다.');
    if (!canCancel(b.date)) throw new BookingError('검진 2일 전부터는 온라인 취소가 어렵습니다. 대표번호로 문의해 주세요.');
    b.status = 'cancelled';
    b.cancelledAt = new Date().toISOString();
    await writeAll(list);
    return b;
  });
}

export async function listBookings(): Promise<Booking[]> {
  const list = await readAll();
  return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
