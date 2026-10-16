import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import MembershipApply from '@/components/membership/MembershipApply';
import { currentUser } from '@/lib/auth/members';
import { formatPhone } from '@/lib/booking/schedule';
import { currentMembership, listTiers, toPublicTier } from '@/lib/memberships';
import { APP_STATUS } from '@/lib/memberships-shared';

export const metadata: Metadata = { title: '멤버십 상담 신청 | ORAE LONGEVITY CLUB', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function MembershipApplyPage({ searchParams }: { searchParams: Promise<{ tier?: string }> }) {
  const { tier } = await searchParams;
  const user = await currentUser();
  if (!user) {
    const back = `/membership/apply${tier ? `?tier=${encodeURIComponent(tier)}` : ''}`;
    redirect(`/signup?next=${encodeURIComponent(back)}`);
  }

  const [tiers, mine] = await Promise.all([listTiers(), currentMembership(user.id)]);

  return (
    <Shell heroHeader={false} cta={false} back="/membership">
      {mine ? (
        <section className="sec bk-done" style={{ marginTop: 0 }}>
          <span className={`ms-status ${APP_STATUS[mine.status].tone}`}>{APP_STATUS[mine.status].label}</span>
          <h1 style={{ marginTop: 12 }}>{mine.status === 'active' ? '이미 멤버십을 이용 중이에요' : '이미 상담을 신청하셨어요'}</h1>
          <p className="sub">{mine.tierName} 멤버십 · {mine.status === 'active' ? `${mine.expiresAt}까지` : `연락 희망: ${mine.contactTime}`}</p>
          <div className="bk-actions">
            <Link className="btn btn-line" href="/membership">멤버십 안내</Link>
            <Link className="btn btn-primary" href="/my#membership">내 페이지</Link>
          </div>
        </section>
      ) : (
        <MembershipApply
          tiers={tiers.map(t => ({ ...toPublicTier(t), price: t.price }))}
          initialTier={tiers.some(t => t.id === tier) ? tier! : (tiers.find(t => t.featured) ?? tiers[0])?.id ?? ''}
          member={{ name: user.name, phone: formatPhone(user.phone), email: user.email }}
        />
      )}
    </Shell>
  );
}
