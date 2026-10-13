import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import BookingFlow from '@/components/booking/BookingFlow';
import BookingStatic from '@/components/booking/BookingStatic';
import { STATIC_SITE } from '@/lib/env';

export const metadata: Metadata = {
  title: '검진 예약 | 클리어스캔',
  description: '원하는 검진 상품과 날짜·시간을 골라 예약하세요.',
};

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  // 정적 배포에서는 searchParams를 읽지 않아야 정적 페이지로 생성된다
  if (STATIC_SITE) {
    return (
      <Shell heroHeader={false}>
        <BookingStatic />
      </Shell>
    );
  }
  const { plan } = await searchParams;
  return (
    <Shell heroHeader={false} cta={false}>
      <BookingFlow initialPlan={plan} />
    </Shell>
  );
}
