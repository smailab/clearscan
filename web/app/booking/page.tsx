import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import BookingFlow from '@/components/booking/BookingFlow';
import { currentUser } from '@/lib/auth/members';
import { getPricing } from '@/lib/pricing';

export const metadata: Metadata = {
  title: '검진 예약 | Scan Longevity',
  description: '원하는 검진 상품과 날짜·시간을 골라 예약하세요.',
};
export const dynamic = 'force-dynamic';

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;

  // 예약은 회원만 가능 — 비회원은 바로 회원가입으로 보내고, 가입·로그인 후 이 페이지로 돌아온다
  const user = await currentUser();
  if (!user) {
    const back = `/booking${plan ? `?plan=${encodeURIComponent(plan)}` : ''}`;
    redirect(`/signup?next=${encodeURIComponent(back)}`);
  }

  const { prices, coupleDiscount } = getPricing();
  return (
    <Shell heroHeader={false} cta={false}>
      <BookingFlow
        initialPlan={plan}
        member={{ name: user.name, phone: user.phone, birth: user.birth, sex: user.sex, email: user.email }}
        pricing={{ prices, coupleDiscount }}
      />
    </Shell>
  );
}
