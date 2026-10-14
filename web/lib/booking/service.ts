import 'server-only';
import { randomInt } from 'crypto';
import type { User } from '@/lib/auth/members';
import { CouponError, checkCoupon, redemptionStmt, releaseCouponUse, reserveCouponUse, restoreStmts } from '@/lib/coupons';
import { listProducts } from '@/lib/products';
import { priceOf, slotsNeeded, type ProductWithPrice } from '@/lib/products-shared';
import {
  CouponUsedError, DuplicateCodeError, SlotConflictError, getByCode, insertMany, listAll, listByUser, listGroup, saveCancelled, saveRescheduled, takenSlots,
} from './store';
import { addMonths, canCancel, candidateStarts, isValidDate, isBookableDate, kstToday, normalizePhone, overlaps, toHHMM, toMin } from './schedule';
import { MAX_ITEMS, buildSegments, orderItems, segmentSlotStarts, totalSlots } from './visit';
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

// 요청한 상품 ID들 → 판매 중인 상품 (중복 제거, 최대 MAX_ITEMS개)
async function resolveProducts(planIds: string[]): Promise<ProductWithPrice[]> {
  const ids = [...new Set(planIds.map(s => String(s ?? '').trim()).filter(Boolean))];
  if (!ids.length) throw new BookingError('검진 상품을 선택해 주세요.');
  if (ids.length > MAX_ITEMS) throw new BookingError(`한 번에 ${MAX_ITEMS}개 상품까지 예약할 수 있습니다.`);
  const all = await listProducts();
  const products = ids.map(id => all.find(p => p.id === id));
  if (products.some(p => !p)) throw new BookingError('예약할 수 없는 검진 상품이 포함되어 있습니다.');
  return orderItems(products as ProductWithPrice[]);
}

// 커플 플랜은 선택한 상품이 모두 커플 가능할 때만
const coupleOk = (products: ProductWithPrice[]) => products.every(p => p.couple);

// 시작 시각 t에 모든 검사를 이어서 배치할 수 있는지 (장비별로 빈 슬롯인지)
function fits(products: ProductWithPrice[], couple: boolean, t: number, taken: Map<string, Set<number>>): boolean {
  return buildSegments(products, couple, t).every(seg =>
    segmentSlotStarts(seg).every(s => !taken.get(seg.resource)?.has(s)),
  );
}

export async function getAvailability(planIds: string[], coupleReq: boolean, date: string): Promise<SlotInfo[]> {
  const products = await resolveProducts(planIds);
  if (!isValidDate(date) || !isBookableDate(date)) return [];
  const couple = coupleReq && coupleOk(products);
  const taken = await takenSlots(date);
  return candidateStarts(date, totalSlots(products, couple)).map(t => ({
    time: toHHMM(t),
    available: fits(products, couple, t, taken),
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
const itemPrices = (products: ProductWithPrice[], couple: boolean) => products.map(p => ({ product: p, price: priceOf(p, couple) }));
const planIdsOf = (req: { planIds?: string[]; planId?: string; items?: { planId: string }[] }) =>
  req.items?.length ? req.items.map(it => it.planId) : req.planIds?.length ? req.planIds : req.planId ? [req.planId] : [];

// 상품별 일정: 새 방식은 상품마다 날짜·시간을 받고, 예전 방식은 한 시작 시각부터 이어서 배치한다
type Plan = { product: ProductWithPrice; date: string; start: number; slots: number };
function plansOf(req: BookingRequest, products: ProductWithPrice[], couple: boolean): Plan[] {
  const hhmm = (t: unknown) => (/^\d{2}:\d{2}$/.test(String(t ?? '')) ? toMin(String(t)) : -1);
  if (req.items?.length) {
    return products.map(p => {
      const it = req.items!.find(x => String(x.planId).trim() === p.id)!;
      return { product: p, date: String(it.date ?? ''), start: hhmm(it.time), slots: slotsNeeded(p, couple) };
    });
  }
  const date = String(req.date ?? '');
  const start = hhmm(req.time);
  if (start < 0 || !candidateStarts(date, totalSlots(products, couple)).includes(start)) throw new BookingError('예약할 수 없는 시간입니다.');
  return buildSegments(products, couple, start).map(seg => ({
    product: products.find(p => p.id === seg.planId)!, date, start: seg.start, slots: seg.slots,
  }));
}

// 쿠폰 할인액을 예약(상품)별로 나눈다 — 상품 전용 쿠폰은 그 상품에, 전체 쿠폰은 금액 비율대로 (백원 단위)
function splitDiscount(prices: number[], total: number, onlyIndex: number): number[] {
  if (onlyIndex >= 0) return prices.map((_, i) => (i === onlyIndex ? total : 0));
  const sum = prices.reduce((n, p) => n + p, 0) || 1;
  const out = prices.map(p => Math.floor((total * p) / sum / 100) * 100);
  let rest = total - out.reduce((n, d) => n + d, 0);
  for (let i = 0; i < out.length && rest > 0; i++) {
    const add = Math.min(rest, prices[i] - out[i]);
    out[i] += add;
    rest -= add;
  }
  return out;
}

// 예약 화면의 쿠폰 확인 (할인 금액 미리보기)
export async function previewCoupon(user: User, code: string, planIds: string[], coupleReq: boolean) {
  const products = await resolveProducts(planIds);
  const items = itemPrices(products, coupleReq && coupleOk(products));
  const listPrice = items.reduce((n, it) => n + it.price, 0);
  try {
    const { coupon, discount } = await checkCoupon(code, user.id, items);
    return { code: coupon.code, name: coupon.name, discount, listPrice, price: listPrice - discount };
  } catch (e) {
    if (e instanceof CouponError) throw new BookingError(e.message, e.status);
    throw e;
  }
}

// 예약자 본인 정보는 클라이언트 입력이 아니라 로그인한 회원 정보로 채운다.
// 여러 상품을 함께 신청하면 상품마다 예약을 따로 만들고(예약번호·시간·검사 결과가 각각), groupCode로 묶는다.
export async function createBooking(req: BookingRequest, user: User): Promise<Booking[]> {
  const products = await resolveProducts(planIdsOf(req));
  if (!req.consent?.privacy || !req.consent?.sensitive) throw new BookingError('개인정보 및 민감정보 수집·이용에 동의해 주세요.');

  const couple = Boolean(req.couple) && coupleOk(products);
  const person: Person = { name: user.name, phone: user.phone, birth: user.birth, sex: user.sex };
  const partner = couple ? validPerson(req.partner, '동반자') : undefined;
  const plans = plansOf(req, products, couple);

  for (const pl of plans) {
    if (!isValidDate(pl.date) || !isBookableDate(pl.date)) throw new BookingError(`${pl.product.name}: 예약할 수 없는 날짜입니다.`);
    if (!candidateStarts(pl.date, pl.slots).includes(pl.start)) throw new BookingError(`${pl.product.name}: 예약할 수 없는 시간입니다.`);
  }
  // 같은 날 두 검사를 같은 시간에 받을 수는 없다
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const x = plans[i], y = plans[j];
      if (x.date === y.date && overlaps(x.start, x.slots, y.start, y.slots)) {
        throw new BookingError(`${x.product.name}과(와) ${y.product.name}의 시간이 겹칩니다. 시간을 다시 선택해 주세요.`);
      }
    }
  }

  const survey = {
    metalImplant: Boolean(req.survey?.metalImplant),
    claustrophobia: Boolean(req.survey?.claustrophobia),
    pregnant: Boolean(req.survey?.pregnant),
    memo: String(req.survey?.memo ?? '').slice(0, 500),
  };

  // 빠른 실패: 이미 찬 시간이면 바로 안내 (최종 판단은 저장소의 원자적 insert가 한다)
  const takenByDate = new Map<string, Map<string, Set<number>>>();
  for (const pl of plans) {
    if (!takenByDate.has(pl.date)) takenByDate.set(pl.date, await takenSlots(pl.date));
    const taken = takenByDate.get(pl.date)!.get(pl.product.kind);
    if (segmentSlotStarts(pl).some(t => taken?.has(t))) throw new BookingError(`${pl.product.name}: ${TAKEN_MSG}`, 409);
  }

  const prices = itemPrices(products, couple);
  let coupon: { code: string; discount: number; shares: number[] } | null = null;
  if (req.couponCode && String(req.couponCode).trim()) {
    try {
      const c = await checkCoupon(req.couponCode, user.id, prices);
      const only = c.coupon.productId ? products.findIndex(p => p.id === c.coupon.productId) : -1;
      coupon = { code: c.coupon.code, discount: c.discount, shares: splitDiscount(prices.map(p => p.price), c.discount, only) };
    } catch (e) {
      if (e instanceof CouponError) throw new BookingError(e.message, e.status);
      throw e;
    }
    // 사용 한도 선점 — 예약 저장이 실패하면 아래에서 되돌린다
    if (!(await reserveCouponUse(coupon.code))) throw new BookingError('발급 수량이 모두 사용된 쿠폰입니다.');
  }

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const codes = plans.map(() => newCode());
      if (new Set(codes).size < codes.length) continue;
      const groupCode = plans.length > 1 ? codes[0] : undefined;
      const createdAt = new Date().toISOString();
      const list: Booking[] = plans.map((pl, i) => {
        const listPrice = prices[i].price;
        const share = coupon?.shares[i] ?? 0;
        return {
          code: codes[i],
          userId: user.id,
          ...(groupCode ? { groupCode } : {}),
          planId: pl.product.id,
          planName: pl.product.name,
          resource: pl.product.kind,
          date: pl.date,
          time: toHHMM(pl.start),
          slots: pl.slots,
          couple,
          person,
          partner,
          survey,
          listPrice,
          price: listPrice - share,
          ...(coupon && share > 0 ? { couponCode: coupon.code, discount: share } : {}),
          status: 'confirmed',
          createdAt,
        };
      });
      // 쿠폰 사용 기록은 묶음 대표 예약번호로 한 건만 남긴다
      const extra = coupon ? [await redemptionStmt(coupon.code, user.id, groupCode ?? codes[0], coupon.discount)] : [];
      try {
        await insertMany(list, extra);
        coupon = null; // 성공 — 되돌리지 않는다
        return list;
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
  // 쿠폰을 썼다면 다시 쓸 수 있게 되돌린다 — 묶음 예약은 쿠폰 할인을 받은 예약이 모두 취소됐을 때만
  let restore = Boolean(b.couponCode);
  if (restore && b.groupCode) {
    const others = (await listGroup(b.groupCode)).filter(x => x.code !== b.code && x.status === 'confirmed' && x.couponCode);
    restore = others.length === 0;
  }
  await saveCancelled(updated, restore ? await restoreStmts(b.groupCode ?? b.code, b.couponCode!) : []);
  return updated;
}

// ---------- 관리자 일정 변경 ----------

// 예약이 점유하는 검사 구간 (시작 시각 기준 상대 위치). 예전 묶음 예약은 검사들이 함께 움직인다
function partsOf(b: Booking): { resource: string; offset: number; slots: number }[] {
  if (b.items?.length) {
    const base = toMin(b.time);
    return b.items.map(it => ({ resource: it.resource, offset: toMin(it.start) - base, slots: it.slots }));
  }
  return [{ resource: b.resource, offset: 0, slots: b.slots }];
}

// 관리자는 오늘부터 12개월 뒤까지 옮길 수 있다 (운영 시간 안에서만)
const adminDateOk = (date: string) => isValidDate(date) && date >= kstToday() && date <= addMonths(kstToday(), 12);

async function confirmedBooking(code: string): Promise<Booking> {
  const b = await getByCode(String(code ?? '').trim().toUpperCase());
  if (!b) throw new BookingError('예약을 찾을 수 없습니다.', 404);
  if (b.status !== 'confirmed') throw new BookingError('취소된 예약은 일정을 바꿀 수 없습니다.');
  return b;
}

// 이 예약을 옮길 수 있는 시간 (자기 자신이 쓰던 슬롯은 빈 것으로 본다)
export async function rescheduleOptions(code: string, date: string): Promise<SlotInfo[]> {
  const b = await confirmedBooking(code);
  if (!adminDateOk(date)) return [];
  const taken = await takenSlots(date, b.code);
  const parts = partsOf(b);
  return candidateStarts(date, b.slots).map(t => ({
    time: toHHMM(t),
    available: parts.every(p => segmentSlotStarts({ start: t + p.offset, slots: p.slots }).every(s => !taken.get(p.resource)?.has(s))),
  }));
}

export async function rescheduleBooking(code: string, date: string, time: string, adminName: string): Promise<Booking> {
  const b = await confirmedBooking(code);
  if (!adminDateOk(date)) throw new BookingError('오늘부터 12개월 안의 날짜로만 바꿀 수 있습니다.');
  const start = /^\d{2}:\d{2}$/.test(String(time)) ? toMin(time) : -1;
  if (!candidateStarts(date, b.slots).includes(start)) throw new BookingError('운영 시간 안의 시간을 선택해 주세요.');
  if (b.date === date && b.time === toHHMM(start)) throw new BookingError('지금 일정과 같습니다.');

  // 함께 예약한 다른 검사와 같은 날 시간이 겹치면 안 된다 (한 사람이 동시에 받을 수 없다)
  if (b.groupCode) {
    const clash = (await listGroup(b.groupCode)).find(x =>
      x.code !== b.code && x.status === 'confirmed' && x.date === date && overlaps(start, b.slots, toMin(x.time), x.slots));
    if (clash) throw new BookingError(`함께 예약한 ${clash.planName ?? clash.planId}(${clash.code}) ${clash.time} 일정과 겹칩니다.`);
  }

  const delta = start - toMin(b.time);
  const updated: Booking = {
    ...b,
    date,
    time: toHHMM(start),
    ...(b.items?.length ? { items: b.items.map(it => ({ ...it, start: toHHMM(toMin(it.start) + delta) })) } : {}),
    history: [...(b.history ?? []), { at: new Date().toISOString(), by: adminName, from: { date: b.date, time: b.time }, to: { date, time: toHHMM(start) } }],
  };
  try {
    await saveRescheduled(updated);
  } catch (e) {
    if (e instanceof SlotConflictError) throw new BookingError('그 시간에는 이미 다른 예약이 있습니다. 다른 시간을 선택해 주세요.', 409);
    throw e;
  }
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
