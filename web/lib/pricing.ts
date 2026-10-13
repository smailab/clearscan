import 'server-only';

// 검진 요금 — 회원에게만 보여준다.
// 서버 전용 모듈이라 클라이언트 번들(공개 JS)에는 포함되지 않고, 로그인한 회원 요청에만 props로 내려간다.

const PRICES: Record<string, number> = {
  annual: 1_390_000,
  spine: 2_360_000,
  neuro: 5_560_000,
  'heart-ct': 490_000,
  'lung-ct': 550_000,
};

// 커플 플랜 할인액 (같은 날 연이어 두 명)
const COUPLE_DISCOUNT: Record<string, number> = { annual: 240_000, spine: 310_000, neuro: 420_000 };

// 커플 플랜 할인 안내 (메인 페이지)
const COUPLE_OFFERS = [
  { name: '연간 MRI', save: '24만원' },
  { name: '척추 포함 MRI', save: '31만원' },
  { name: '척추 포함 MRI + CT', save: '35만원' },
  { name: '근골격·신경 정밀', save: '42만원' },
];

export type Pricing = {
  prices: Record<string, number>;
  coupleDiscount: Record<string, number>;
  coupleOffers: { name: string; save: string }[];
  from: number; // 최저가 ("~원부터")
};

export function getPricing(): Pricing {
  return {
    prices: { ...PRICES },
    coupleDiscount: { ...COUPLE_DISCOUNT },
    coupleOffers: COUPLE_OFFERS.map(o => ({ ...o })),
    from: PRICES.annual,
  };
}

export function priceFor(planId: string, couple: boolean): number {
  const p = PRICES[planId] ?? 0;
  return couple ? p * 2 - (COUPLE_DISCOUNT[planId] ?? 0) : p;
}
