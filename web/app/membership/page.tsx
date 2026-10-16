import type { Metadata } from 'next';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { Chevron, LineLock } from '@/components/icons';
import { currentUser } from '@/lib/auth/members';
import { currentMembership, listTiers } from '@/lib/memberships';
import { APP_STATUS } from '@/lib/memberships-shared';
import { site, won } from '@/lib/data';

export const metadata: Metadata = {
  title: '멤버십 | ORAE LONGEVITY CLUB',
  description: '정밀 검진과 전담 메디컬 컨시어지가 1년 내내 함께하는 ORAE LONGEVITY CLUB 연간 멤버십. 에센셜 · 시그니처 · 패밀리.',
};
export const dynamic = 'force-dynamic';

const JOURNEY = [
  { t: '상담 신청', d: '원하는 멤버십을 고르고 연락 받을 시간을 남겨 주세요. 결제는 아직 필요 없습니다.' },
  { t: '컨시어지 상담', d: '전담 컨시어지가 건강 이력과 목표를 듣고, 나에게 맞는 멤버십과 검사 구성을 제안합니다.' },
  { t: '가입 확정 · 정밀 검진', d: '가입이 확정되면 1년 멤버십이 시작되고, 원하는 날짜에 정밀 영상 검진을 받습니다.' },
  { t: '결과 리뷰와 맞춤 플랜', d: '전문의가 결과를 1:1로 설명하고, 다음 1년을 위한 건강 관리 플랜을 함께 세웁니다.' },
  { t: '연중 관리 · 연간 갱신', d: '추적 상담과 필요한 진료 연계를 이어가고, 1년 뒤 같은 기준으로 다시 확인합니다.' },
];

const FAQ = [
  { q: '결제는 언제 하나요?', a: '상담 신청에는 결제가 필요 없습니다. 컨시어지 상담에서 멤버십과 검사 구성을 정한 뒤 결제 방법을 안내해 드립니다.' },
  { q: '멤버십 기간은 어떻게 되나요?', a: '가입이 확정된 날부터 1년입니다. 만료 전에 갱신 상담을 도와드립니다.' },
  { q: '멤버십 없이 검진만 받을 수도 있나요?', a: '네. 검진 상품은 멤버십과 관계없이 예약할 수 있습니다. 멤버십은 검진에 전문의 상담과 연중 관리를 더한 서비스입니다.' },
  { q: '신청을 취소하고 싶어요.', a: '상담 대기 중인 신청은 내 페이지에서 바로 취소할 수 있습니다. 상담이 시작된 뒤에는 컨시어지에게 말씀해 주세요.' },
];

export default async function MembershipPage() {
  const user = await currentUser();
  const [tiers, mine] = await Promise.all([listTiers(), user ? currentMembership(user.id) : null]);

  return (
    <Shell heroHeader={false} cta={false}>
      <section className="page-hero ms-hero">
        <p className="eyebrow">ORAE MEMBERSHIP</p>
        <h1>1년 내내 곁에 있는<br />프라이빗 장수 의학</h1>
        <p>한 번의 검진으로 끝나지 않습니다. 정밀 영상 검진, 전문의 결과 상담, 전담 메디컬 컨시어지의 연중 관리까지 하나의 멤버십으로 이어집니다.</p>
      </section>

      {mine && (
        <section className="sec ms-mine-bar" style={{ marginTop: 0 }}>
          <span className={`ms-status ${APP_STATUS[mine.status].tone}`}>{APP_STATUS[mine.status].label}</span>
          <p><b>{mine.tierName}</b> 멤버십{mine.status === 'active' && mine.expiresAt ? ` · ${mine.expiresAt}까지` : ' 상담을 신청하셨어요'}</p>
          <Link href="/my#membership">내 페이지 <Chevron size={14} /></Link>
        </section>
      )}

      <section className="sec" id="tiers" style={mine ? undefined : { marginTop: 0 }}>
        <div className="sec-head"><h2>멤버십 안내</h2></div>
        <p className="sec-sub">연간 멤버십입니다. 상담 신청 후 전담 컨시어지가 연락드려 구성을 함께 정합니다.</p>
        <div className="ms-tiers">
          {tiers.map(t => (
            <article key={t.id} className={`ms-tier${t.featured ? ' featured' : ''}`}>
              {t.featured && <span className="ms-badge">추천</span>}
              <p className="ms-name">{t.name}<small>{t.nameKo}</small></p>
              <p className="ms-tag">{t.tagline}</p>
              <div className="ms-price">
                {!user
                  ? <Link href={`/signup?next=${encodeURIComponent('/membership')}`} className="ms-locked"><LineLock />회원 전용 요금 보기</Link>
                  : t.price === null
                    ? <span className="ms-ask">연 회비 · 상담 후 안내</span>
                    : <span><b>{won(t.price)}</b>원 <small>/ 연{t.seats > 1 ? ` · ${t.seats}인 기준` : ''}</small></span>}
              </div>
              <p className="ms-desc">{t.description}</p>
              <ul className="ms-benefits">{t.benefits.map(b => <li key={b}>{b}</li>)}</ul>
              {t.seats > 1 && <p className="ms-seats">기본 {t.seats}인 · 최대 6인까지 함께 가입</p>}
              <Link className={`btn ${t.featured ? 'ms-btn-light' : 'btn-primary'}`} href={`/membership/apply?tier=${t.id}`}>
                {t.nameKo} 상담 신청 <Chevron size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="sec" id="journey">
        <div className="sec-head"><h2>가입부터 1년 관리까지</h2></div>
        <ol className="ms-journey">
          {JOURNEY.map((s, i) => (
            <li key={s.t}>
              <span className="n">{i + 1}</span>
              <div><b>{s.t}</b><p>{s.d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sec faq" id="ms-faq">
        <div className="sec-head"><h2>자주 묻는 질문</h2></div>
        {FAQ.map(f => (
          <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
        ))}
        <p className="note">더 궁금한 점은 상담 전화 {site.phone}로 문의해 주세요.</p>
      </section>

      <div className="bottom-cta">
        <a className="btn btn-line" href={`tel:${site.phone}`}>전화 문의</a>
        <Link className="btn btn-primary" href="/membership/apply">멤버십 상담 신청 <Chevron size={16} /></Link>
      </div>
    </Shell>
  );
}
