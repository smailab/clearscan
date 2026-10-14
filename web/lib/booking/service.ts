import 'server-only';
import { randomInt } from 'crypto';
import type { User } from '@/lib/auth/members';
import { CouponError, checkCoupon, redemptionStmt, releaseCouponUse, reserveCouponUse, restoreStmts } from '@/lib/coupons';
import { getProduct, listProducts } from '@/lib/products';
import { priceOf, slotsNeeded } from '@/lib/products-shared';
import {
  CouponUsedError, DuplicateCodeError, SlotConflictError, getByCode, insert, listActive, listAll, listByUser, saveCancelled,
} from './store';
import {
  canCancel, candidateStarts, isBookableDate, isValidDate, kstToday, normalizePhone, overlaps, toHHMM, toMin,
} from './schedule';
import type { Booking, BookingRequest, Person, SlotInfo } from './types';

export class BookingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외

function newCode(): string {
  let c = 'CS-';
  for (let i = 0; i < 6; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return c;
}

export async function getAvailability(planId: string, coupleReq: boolean, date: string): Promise<SlotInfo[]> {
  const product = await getProduct(planId);
  if (!product) throw new BookingError('존재하지 않는 검진 상품입니다.');
  if (!isValidDate(date) || !isBookableDate(date)) return [];
  const need = slotsNeeded(product, coupleReq && product.couple);
  const taken = await listActive(product.kind, date);
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

const TAKEN_MSG = '방금 다른 예약이 들어온 시간입니다. 다른 시간을 선택해 주세요.';

// 예약 화면의 쿠폰 확인 (할인 금액 미리보기)
export async function previewCoupon(user: User, code: string, planId: string, coupleReq: boolean) {
  const product = await getProduct(planId);
  if (!product) throw new BookingError('존재하지 않는 검진 상품입니다.');
  const listPrice = priceOf(product, coupleReq && product.couple);
  try {
    const { coupon, discount } = await checkCoupon(code, user.id, product, listPrice);
    return { code: coupon.code, name: coupon.name, discount, listPrice, price: listPrice - discount };
  } catch (e) {
    if (e instanceof CouponError) throw new BookingError(e.message, e.status);
    throw e;
  }
}

// 예약자 본인 정보는 클라이언트 입력이 아니라 로그인한 회원 정보로 채운다
export async function createBooking(req: BookingRequest, user: User): Promise<Booking> {
  const product = await getProduct(req.planId);
  if (!product) throw new BookingError('예약할 수 없는 검진 상품입니다.');
  if (!req.consent?.privacy || !req.consent?.sensitive) throw new BookingError('개인정보 및 민감정보 수집·이용에 동의해 주세요.');
  if (!isValidDate(req.date) || !isBookableDate(req.date)) throw new BookingError('예약할 수 없는 날짜입니다.');

  const couple = Boolean(req.couple) && product.couple;
  const person: Person = { name: user.name, phone: user.phone, birth: user.birth, sex: user.sex };
  const partner = couple ? validPerson(req.partner, '동반자') : undefined;
  const need = slotsNeeded(product, couple);
  const start = /^\d{2}:\d{2}$/.test(req.time) ? toMin(req.time) : -1;
  if (!candidateStarts(req.date, need).includes(start)) throw new BookingError('예약할 수 없는 시간입니다.');

  const survey = {
    metalImplant: Boolean(req.survey?.metalImplant),
    claustrophobia: Boolean(req.survey?.claustrophobia),
    pregnant: Boolean(req.survey?.pregnant),
    memo: String(req.survey?.memo ?? '').slice(0, 500),
  };

  // 빠른 실패: 이미 찬 시간이면 바로 안내 (최종 판단은 저장소의 원자적 insert가 한다)
  const taken = await listActive(product.kind, req.date);
  if (taken.some(b => overlaps(start, need, toMin(b.time), b.slots))) throw new BookingError(TAKEN_MSG, 409);

  const listPrice = priceOf(product, couple);
  let coupon: { code: string; discount: number } | null = null;
  if (req.couponCode && String(req.couponCode).trim()) {
    try {
      const c = await checkCoupon(req.couponCode, user.id, product, listPrice);
      coupon = { code: c.coupon.code, discount: c.discount };
    } catch (e) {
      if (e instanceof CouponError) throw new BookingError(e.message, e.status);
      throw e;
    }
    // 사용 한도 선점 — 예약 저장이 실패하면 아래에서 되돌린다
    if (!(await reserveCouponUse(coupon.code))) throw new BookingError('발급 수량이 모두 사용된 쿠폰입니다.');
  }

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const booking: Booking = {
        code: newCode(),
        userId: user.id,
        planId: product.id,
        planName: product.name,
        resource: product.kind,
        date: req.date,
        time: toHHMM(start),
        slots: need,
        couple,
        person,
        partner,
        survey,
        listPrice,
        price: listPrice - (coupon?.discount ?? 0),
        ...(coupon ? { couponCode: coupon.code, discount: coupon.discount } : {}),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };
      const extra = coupon ? [await redemptionStmt(coupon.code, user.id, booking.code, coupon.discount)] : [];
      try {
        await insert(booking, extra);
        coupon = null; // 성공 — 되돌리지 않는다
        return booking;
      } catch (e) {
        if (e instanceof SlotConflictError) throw new BookingError(TAKEN_MSG, 409);
        if (e instanceof CouponUsedError) throw new BookingError('이미 사용한 쿠폰입니다.');
        if (e instanceof DuplicateCodeError) continue; // 예약번호가 겹치면 새 번호로 다시 시도
        throw e;
      }
    }
    throw new BookingError('예약번호 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500);
  } finally {
    if (coupon) await releaseCouponUse(coupon.code);
  }
}

export async function myBookings(user: User): Promise<Booking[]> {
  return listByUser(user.id);
}

// 본인 예약만 조회 (다른 회원의 예약번호로는 찾을 수 없다)
export async function myBooking(user: User, code: string): Promise<Booking> {
  const b = await getByCode(String(code).trim().toUpperCase());
  if (!b || b.userId !== user.id) throw new BookingError('예약 정보를 찾을 수 없습니다.', 404);
  return b;
}

export async function cancelMyBooking(user: User, code: string): Promise<Booking> {
  const b = await myBooking(user, code);
  if (b.status === 'cancelled') throw new BookingError('이미 취소된 예약입니다.');
  if (!canCancel(b.date)) throw new BookingError('검진 2일 전부터는 온라인 취소가 어렵습니다. 상담 전화로 문의해 주세요.');
  const updated: Booking = { ...b, status: 'cancelled', cancelledAt: new Date().toISOString() };
  // 쿠폰을 썼다면 다시 쓸 수 있게 되돌린다
  await saveCancelled(updated, b.couponCode ? await restoreStmts(b.code, b.couponCode) : []);
  return updated;
}

export async function listBookings(): Promise<Booking[]> {
  return listAll();
}

// 예약에 표시할 상품명 (예약 당시 이름 우선)
export async function planNameOf(b: Booking): Promise<string> {
  if (b.planName) return b.planName;
  const p = (await listProducts({ includeInactive: true })).find(x => x.id === b.planId);
  return p?.name ?? b.planId;
}
