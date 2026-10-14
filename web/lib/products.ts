import 'server-only';
import { cache } from 'react';
import { getDB } from '@/lib/db';
import { PRODUCT_ID_RE, type PlanGroup, type Product, type ProductWithPrice } from './products-shared';

// 검진 상품 (D1 products). 가격이 포함된 정보는 서버에서만 다루고,
// 비회원에게는 toPublic()으로 가격을 뺀 정보만 내려보낸다.

type Row = {
  id: string; kind: 'MRI' | 'CT'; name: string; time_label: string; description: string; price: number;
  couple_discount: number | null; slots: number; featured: number; image: string; groups: string;
  active: number; sort_order: number; updated_at: string; updated_by: string | null;
};

const toProduct = (r: Row): ProductWithPrice => ({
  id: r.id, kind: r.kind, name: r.name, time: r.time_label, desc: r.description, featured: Boolean(r.featured),
  image: r.image, groups: safeGroups(r.groups), slots: r.slots, couple: r.couple_discount !== null,
  active: Boolean(r.active), sortOrder: r.sort_order, price: r.price, coupleDiscount: r.couple_discount,
});

function safeGroups(json: string): PlanGroup[] {
  try {
    const g = JSON.parse(json);
    return Array.isArray(g) ? g : [];
  } catch {
    return [];
  }
}

export function toPublic(p: ProductWithPrice): Product {
  const { price: _p, coupleDiscount: _c, ...rest } = p;
  return rest;
}

// 한 요청 안에서는 한 번만 조회한다
export const listProducts = cache(async (opts: { includeInactive?: boolean } = {}): Promise<ProductWithPrice[]> => {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT * FROM products ${opts.includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort_order, name`,
  ).all<Row>();
  return results.map(toProduct);
});

export async function getProduct(id: string, opts: { includeInactive?: boolean } = {}): Promise<ProductWithPrice | null> {
  const all = await listProducts({ includeInactive: true });
  const p = all.find(x => x.id === id) ?? null;
  return p && (p.active || opts.includeInactive) ? p : null;
}

// 상품 ID → 이름 (지난 예약 표시용, 판매 중지 상품 포함)
export async function productNames(): Promise<Map<string, string>> {
  return new Map((await listProducts({ includeInactive: true })).map(p => [p.id, p.name]));
}

export class ProductError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type ProductInput = {
  id: string; kind: 'MRI' | 'CT'; name: string; time: string; desc: string; price: number;
  coupleDiscount: number | null; slots: number; featured: boolean; image: string; groups: PlanGroup[];
  active: boolean; sortOrder: number;
};

function validate(input: ProductInput): ProductInput {
  const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const id = s(input.id, 32).toLowerCase();
  if (!PRODUCT_ID_RE.test(id)) throw new ProductError('상품 ID는 영문 소문자·숫자·하이픈(-) 2~31자로 입력해 주세요.');
  if (input.kind !== 'MRI' && input.kind !== 'CT') throw new ProductError('구분(MRI/CT)을 선택해 주세요.');
  const name = s(input.name, 40);
  if (name.length < 2) throw new ProductError('상품명을 입력해 주세요.');
  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price < 0 || price > 100_000_000) throw new ProductError('가격을 확인해 주세요.');
  let coupleDiscount: number | null = null;
  if (input.coupleDiscount !== null && input.coupleDiscount !== undefined && String(input.coupleDiscount) !== '') {
    coupleDiscount = Math.round(Number(input.coupleDiscount));
    if (!Number.isFinite(coupleDiscount) || coupleDiscount < 0 || coupleDiscount > price * 2) throw new ProductError('커플 할인액을 확인해 주세요.');
  }
  const slots = Math.round(Number(input.slots));
  if (!(slots >= 1 && slots <= 16)) throw new ProductError('장비 점유 시간을 확인해 주세요.');
  const image = s(input.image, 200);
  if (!image.startsWith('/images/')) throw new ProductError('대표 이미지를 선택해 주세요.');
  const groups = (Array.isArray(input.groups) ? input.groups : []).slice(0, 12).map(g => ({
    label: s(g.label, 40),
    items: (Array.isArray(g.items) ? g.items : []).map(it => s(it, 80)).filter(Boolean).slice(0, 40),
    ...(g.excluded ? { excluded: true } : {}),
  })).filter(g => g.label && g.items.length);
  return {
    id, kind: input.kind, name, time: s(input.time, 40), desc: s(input.desc, 300), price, coupleDiscount, slots,
    featured: Boolean(input.featured), image, groups, active: Boolean(input.active),
    sortOrder: Math.round(Number(input.sortOrder) || 0),
  };
}

export async function saveProduct(raw: ProductInput, mode: 'create' | 'update', adminName: string): Promise<void> {
  const p = validate(raw);
  const db = await getDB();
  const now = new Date().toISOString();
  if (mode === 'create') {
    try {
      await db.prepare(
        `INSERT INTO products (id, kind, name, time_label, description, price, couple_discount, slots, featured, image, groups, active, sort_order, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(p.id, p.kind, p.name, p.time, p.desc, p.price, p.coupleDiscount, p.slots, p.featured ? 1 : 0, p.image,
        JSON.stringify(p.groups), p.active ? 1 : 0, p.sortOrder, now, adminName).run();
    } catch (e) {
      if (String((e as Error).message).includes('products.id')) throw new ProductError('이미 사용 중인 상품 ID입니다.', 409);
      throw e;
    }
    return;
  }
  const r = await db.prepare(
    `UPDATE products SET kind = ?, name = ?, time_label = ?, description = ?, price = ?, couple_discount = ?, slots = ?,
       featured = ?, image = ?, groups = ?, active = ?, sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
  ).bind(p.kind, p.name, p.time, p.desc, p.price, p.coupleDiscount, p.slots, p.featured ? 1 : 0, p.image,
    JSON.stringify(p.groups), p.active ? 1 : 0, p.sortOrder, now, adminName, p.id).run();
  if (!r.meta?.changes) throw new ProductError('상품을 찾을 수 없습니다.', 404);
}
