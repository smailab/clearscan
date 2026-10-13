import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import Lookup from '@/components/booking/Lookup';
import { site } from '@/lib/data';
import { STATIC_SITE } from '@/lib/env';

export const metadata: Metadata = { title: '예약 조회 | 클리어스캔' };

export default function LookupPage() {
  return (
    <Shell heroHeader={false} cta={STATIC_SITE}>
      {STATIC_SITE ? (
        <section className="sec" style={{ marginTop: 0 }}>
          <h1 className="bk-h">예약 조회 · 변경</h1>
          <p className="sec-sub">예약 확인과 변경·취소는 대표번호로 문의해 주세요.</p>
          <a className="btn btn-primary" style={{ width: '100%' }} href={`tel:${site.phone}`}>전화 문의 · {site.phone}</a>
        </section>
      ) : (
        <Lookup />
      )}
    </Shell>
  );
}
