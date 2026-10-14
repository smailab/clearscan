import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import { CopyButton, Gallery, Hours, SectionTabs } from '@/components/center/CenterParts';
import { Chevron } from '@/components/icons';
import { won } from '@/lib/data';
import { getCenter } from '@/lib/centers';
import { mapLinks, specialtiesOf } from '@/lib/centers-shared';
import { listProducts } from '@/lib/products';
import { currentUser } from '@/lib/auth/members';
import { getPricing } from '@/lib/pricing';

type Params = { params: Promise<{ id: string }> };

// 요금은 회원에게만 보여주므로 요청마다 로그인 여부를 확인한다
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = await getCenter((await params).id);
  if (!c) return {};
  return {
    title: `${c.name} | Scan Longevity 검진 센터`,
    description: `${c.region} ${c.name} — ${c.intro}`,
  };
}

const TABS = [
  { id: 'info', label: '센터정보' },
  { id: 'doctors', label: '의료진' },
  { id: 'center-plans', label: '검진상품' },
];

export default async function CenterPage({ params }: Params) {
  const c = await getCenter((await params).id);
  if (!c) notFound();

  const prices = (await currentUser()) ? (await getPricing()).prices : null;
  const links = mapLinks(c);
  const centerPlans = (await listProducts()).filter(p => c.planIds.includes(p.id));
  const fullAddress = `${c.address} ${c.addressDetail}`;
  const specialties = specialtiesOf(c);

  return (
    <Shell heroHeader={false} cta={false} back="/centers">
      <Gallery images={c.gallery} name={c.name} />

      {/* 기본 정보 */}
      <section className="sec ct-info" style={{ marginTop: 0 }}>
        <div className="ct-title">
          <h1>{c.name}</h1>
          <span className="ct-region">{c.region}</span>
        </div>
        <div className="ct-badges">
          {specialties.map(s => <span key={s} className="badge-sm">{s}</span>)}
          <span className="badge-sm ok">전문의 {c.doctors.length}인</span>
        </div>
        <ul className="ct-rows">
          <li>
            <PinIcon />
            <span className="grow">{c.address}<br /><small>{c.addressDetail}</small></span>
            <CopyButton text={fullAddress} />
          </li>
          <li>
            <PhoneIcon />
            <a className="grow" href={`tel:${c.phone}`}>{c.phone}</a>
          </li>
          <li>
            <ClockIcon />
            <span className="grow"><Hours hours={c.hours} /></span>
          </li>
          <li>
            <GlobeIcon />
            {c.homepage
              ? <a className="grow link" href={c.homepage} target="_blank" rel="noopener noreferrer">{c.homepage.replace(/^https?:\/\//, '')}</a>
              : <span className="grow muted">홈페이지 준비 중</span>}
          </li>
        </ul>
        {c.links?.length ? (
          <div className="ct-links">
            {c.links.map(l => <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
          </div>
        ) : null}
        {c.notice && <p className="ct-notice">{c.notice}</p>}
      </section>

      {/* 위치 */}
      <section className="sec ct-map" aria-label="위치">
        <div className="ct-map-frame">
          <iframe
            title={`${c.name} 위치`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(c.address)}&output=embed&hl=ko`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="ct-map-actions">
          <a href={links.naver} target="_blank" rel="noopener noreferrer">네이버 지도</a>
          <a href={links.kakao} target="_blank" rel="noopener noreferrer">카카오맵</a>
          <a className="primary" href={links.google} target="_blank" rel="noopener noreferrer">길찾기</a>
        </div>
      </section>

      <SectionTabs tabs={TABS} />

      {/* 센터 소개 */}
      <section className="sec" id="info" style={{ marginTop: 0 }}>
        <h2 className="ct-h">센터 소개</h2>
        <p className="ct-intro">{c.intro}</p>
        <ul className="ct-highlights">
          {c.highlights.map(h => <li key={h}><span className="ck">✓</span>{h}</li>)}
        </ul>
        <h3 className="ct-sub">진료 시간</h3>
        <dl className="ct-hours-table">
          {c.hours.map(h => <div key={h.label}><dt>{h.label}</dt><dd>{h.value}{h.note && <small>{h.note}</small>}</dd></div>)}
        </dl>
        <h3 className="ct-sub">의료장비</h3>
        <div className="pill-list">
          {c.equipment.map(e => <span key={e} className="pill strong">{e}</span>)}
        </div>
      </section>

      {/* 의료진 */}
      <section className="sec" id="doctors">
        <h2 className="ct-h">의료진</h2>
        <ul className="ct-doctors">
          {c.doctors.map(d => (
            <li key={d.name}>
              <div className={`avatar${d.photo ? ' photo' : ''}`}>
                {d.photo ? <Image src={d.photo} alt={`${d.name} ${d.title}`} fill sizes="64px" /> : <span>{d.name.slice(0, 1)}</span>}
              </div>
              <div className="body">
                <p className="nm">{d.name} <span>{d.title}</span></p>
                {d.specialty && <p className="sp">{d.specialty}</p>}
                {d.career?.length
                  ? <ul className="career">{d.career.slice(0, 2).map(x => <li key={x}>{x}</li>)}</ul>
                  : <p className="career-empty">약력 정보 준비 중</p>}
                {(d.education?.length || (d.career?.length ?? 0) > 2 || d.societies?.length) ? (
                  <details className="ct-more">
                    <summary>약력 전체 보기</summary>
                    {d.education?.length ? <><p className="lbl">학력</p><ul className="career">{d.education.map(x => <li key={x}>{x}</li>)}</ul></> : null}
                    {d.career?.length ? <><p className="lbl">주요 경력</p><ul className="career">{d.career.map(x => <li key={x}>{x}</li>)}</ul></> : null}
                    {d.societies?.length ? <><p className="lbl">학회 활동 (정회원)</p><ul className="career">{d.societies.map(x => <li key={x}>{x}</li>)}</ul></> : null}
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 이 센터의 검진 상품 */}
      <section className="sec" id="center-plans">
        <h2 className="ct-h">이 센터에서 받을 수 있는 검진</h2>
        <ul className="ct-plans">
          {centerPlans.map(p => (
            <li key={p.id}>
              <Link href={`/booking?plan=${p.id}`}>
                <span className="kind">{p.kind}</span>
                <span className="txt"><b>{p.name}</b><small>{p.time}</small></span>
                {prices ? <span className="pr">{won(prices[p.id])}원</span> : <span className="pr locked">🔒 회원 전용</span>}
                <Chevron className="chev" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="bottom-cta">
        <a className="btn btn-line" href={`tel:${c.phone}`}>전화하기</a>
        <Link className="btn btn-primary" href="/booking">이 센터 예약하기 <Chevron /></Link>
      </div>
    </Shell>
  );
}

const PinIcon = () => (
  <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
);
const PhoneIcon = () => (
  <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
);
const ClockIcon = () => (
  <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const GlobeIcon = () => (
  <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
);
