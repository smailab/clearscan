import Image from 'next/image';
import Link from 'next/link';
import Shell from '@/components/Shell';
import HeroSlider from '@/components/HeroSlider';
import Plans from '@/components/Plans';
import OrganGuide from '@/components/OrganGuide';
import CenterList from '@/components/center/CenterList';
import { Chevron, IconCalendar, IconPin, IconScan, IconWon } from '@/components/icons';
import { facts, factsNote, faqs, reviews, reviewsNote, site, steps, won } from '@/lib/data';
import { currentUser } from '@/lib/auth/members';
import { getPricing } from '@/lib/pricing';

// 요금은 회원에게만 보여주므로 요청마다 로그인 여부를 확인한다
export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUser();
  const pricing = user ? getPricing() : null;

  return (
    <Shell>
      <section className="hero">
        <div className="notice"><span className="chip">🎉 이벤트</span><span className="msg">{site.notice}</span></div>
        {user ? (
          <Link className="member-strip" href="/my">
            <span><b>{user.name}</b>님, 반가워요</span>
            <b>내 예약·결과 보기 ›</b>
          </Link>
        ) : (
          <Link className="member-strip join" href="/signup">
            <span>회원가입하고 <b>검진 요금·예약</b> 확인하기</span>
            <b>회원가입 ›</b>
          </Link>
        )}
        <HeroSlider />
        <div className="stat-row">
          <span className="stat-pill">📌 연 1회 MRI · 월 분할 결제 가능</span>
          {pricing
            ? <span className="stat-right"><b>{won(pricing.from)}</b>원부터</span>
            : <Link className="stat-right locked" href="/signup?next=%2F%23plans">🔒 요금은 회원 전용</Link>}
        </div>
      </section>

      <nav className="quick" aria-label="빠른 메뉴">
        <Link href="/booking"><IconCalendar /><span>검진<br />예약하기</span><Chevron className="chev" /></Link>
        <Link href="#plans"><IconWon /><span>요금<br />안내</span><Chevron className="chev" /></Link>
        <Link href="#center"><IconPin /><span>검진 센터<br />위치</span><Chevron className="chev" /></Link>
        <Link href="/how-it-works"><IconScan /><span>이용 방법 /<br />검사 장기</span><Chevron className="chev" /></Link>
      </nav>

      {/* 이용 방법 */}
      <section className="sec first" id="how">
        <div className="sec-head"><h2>이용 방법</h2><Link className="more" href="/how-it-works">더보기 ›</Link></div>
        {steps.map(s => (
          <Link className="step-row" href="/how-it-works" key={s.n}>
            <div className="thumb">
              <span className="num">{s.n}</span>
              <Image src={s.image} alt="" fill sizes="84px" />
            </div>
            <div style={{ minWidth: 0 }}>
              <span className="tag">#{s.tag}</span>
              <p className="title">{s.title}</p>
              <p className="body">{s.body}</p>
            </div>
          </Link>
        ))}
        <div className="box">
          <p className="title">부담 없는 월 분할 결제</p>
          <p>검진 비용을 매달 나눠서 낼 수 있습니다. 카드사 무이자 할부도 이용할 수 있습니다.</p>
        </div>
      </section>

      {/* 검진 상품 */}
      <section className="sec" id="plans">
        <Plans prices={pricing?.prices ?? null} />
      </section>

      {/* 커플 플랜 */}
      <section className="sec" id="couple">
        <div className="couple">
          <p className="t">커플 플랜 · 함께 지키는 두 사람의 미래</p>
          <p>배우자, 가족, 친구와 같은 날 연이어 예약하면 한 번 방문으로 둘 다 검진을 마치고 할인도 받을 수 있습니다.</p>
          <ul>
            {pricing
              ? pricing.coupleOffers.map(c => <li key={c.name}><b>{c.save} 할인</b>{c.name}</li>)
              : ['연간 MRI', '척추 포함 MRI', '척추 포함 MRI + CT', '근골격·신경 정밀'].map(n => <li key={n}><b>🔒 회원 전용</b>{n}</li>)}
          </ul>
        </div>
      </section>

      {/* 왜 전신 MRI */}
      <section className="sec" id="why">
        <div className="sec-head"><h2>왜 전신 MRI인가요?</h2></div>
        <p className="sec-sub">건강이 걱정될 때, 막연한 불안 대신 확실한 정보로 다음 단계를 결정하세요.</p>
        <div className="facts">
          {facts.map(f => <div className="fact" key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}
        </div>
        <p className="note">{factsNote}</p>
      </section>

      {/* 이용 후기 */}
      <section className="sec" id="reviews">
        <div className="sec-head"><h2>이용 후기</h2></div>
        <div className="hscroll">
          {reviews.map(r => (
            <article className="review" key={r.who + r.meta}>
              <div className="thumb">
                <Image src={r.image} alt="" fill sizes="150px" />
                <span className="cap">{r.plan}</span>
              </div>
              <p>“{r.text}”</p>
              <span className="meta"><span className="stars">★★★★★</span>{r.who} · {r.meta}</span>
            </article>
          ))}
        </div>
        <p className="note">{reviewsNote}</p>
      </section>

      {/* 장기별 안내 */}
      <section className="sec" id="organs">
        <div className="sec-head"><h2>장기별로 무엇을 확인하나요?</h2></div>
        <OrganGuide />
      </section>

      {/* 검진 센터 */}
      <section className="sec" id="center">
        <div className="sec-head"><h2>검진 센터</h2><Link className="more" href="/centers">더보기 ›</Link></div>
        <CenterList />
      </section>

      {/* FAQ */}
      <section className="sec faq" id="faq">
        <div className="sec-head"><h2>자주 묻는 질문</h2></div>
        {faqs.map(f => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </Shell>
  );
}
