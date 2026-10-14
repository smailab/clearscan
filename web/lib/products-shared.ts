// 상품 타입·계산 — 클라이언트와 서버가 함께 쓴다. (가격은 여기 없음: 서버 전용 lib/products.ts)

export type PlanGroup = { label: string; items: string[]; excluded?: boolean };

// 공개용 상품 정보 (비회원에게도 내려가도 되는 정보만)
export type Product = {
  id: string;
  kind: 'MRI' | 'CT';
  name: string;
  time: string;
  desc: string;
  featured: boolean;
  image: string;
  groups: PlanGroup[];
  slots: number;          // 장비 점유 시간 (30분 단위)
  couple: boolean;        // 커플 플랜 가능 여부
  active: boolean;
  sortOrder: number;
};

// 회원·관리자에게만 내려가는 가격 정보
export type ProductPrice = { price: number; coupleDiscount: number | null };

export type ProductWithPrice = Product & ProductPrice;

export function slotsNeeded(p: Pick<Product, 'slots'>, couple: boolean): number {
  return Math.max(1, p.slots) * (couple ? 2 : 1);
}

export function priceOf(p: ProductPrice, couple: boolean): number {
  return couple ? p.price * 2 - (p.coupleDiscount ?? 0) : p.price;
}

// 관리자 상품 편집에서 고를 수 있는 대표 이미지 (public/images)
export const PRODUCT_IMAGES = [
  '/images/fullbody.webp',
  '/images/scan-man.png',
  '/images/scan-woman.png',
  '/images/brain-mri.png',
  '/images/consult.png',
  '/images/lobby.png',
  '/images/app-report.png',
  '/images/centers/iro/interior1.png',
  '/images/centers/iro/interior2.png',
  '/images/centers/iro/interior3.png',
];

export const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
