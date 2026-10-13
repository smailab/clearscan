import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import BookingFlow from '@/components/booking/BookingFlow';

export const metadata: Metadata = {
  title: '검진 예약 | 클리어스캔',
  description: '원하는 검진 상품과 날짜·시간을 골라 온라인으로 예약하세요.',
};

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <Shell heroHeader={false} cta={false}>
      <BookingFlow initialPlan={plan} />
    </Shell>
  );
}
