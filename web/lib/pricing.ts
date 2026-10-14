import 'server-only';
import { listProducts } from './products';
import { priceOf } from './products-shared';

// 검진 요금 — 회원에게만 보여준다. 가격은 DB(products)에 있고, 로그인한 회원 요청에만 props로 내려간다.

export type Pricing = {
  prices: Record<string, number>;
  coupleDiscount: Record<string, number>;
  coupleOffers: { name: string; save: string }[];
  from: number; // 최저가 ("~원부터")
};

const manwon = (n: number) => (n % 10_000 === 0 ? `${n / 10_000}만원` : `${n.toLocaleString('ko-KR')}원`);

export async function getPricing(): Promise<Pricing> {
  const products = await listProducts();
  const prices: Record<string, number> = {};
  const coupleDiscount: Record<string, number> = {};
  for (const p of products) {
    prices[p.id] = p.price;
    if (p.coupleDiscount !== null) coupleDiscount[p.id] = p.coupleDiscount;
  }
  return {
    prices,
    coupleDiscount,
    coupleOffers: products.filter(p => p.coupleDiscount).map(p => ({ name: p.name, save: manwon(p.coupleDiscount!) })),
    from: products.length ? Math.min(...products.map(p => p.price)) : 0,
  };
}

export { priceOf };
