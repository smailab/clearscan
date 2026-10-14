import type { Metadata } from 'next';
import Image from 'next/image';
import Shell from '@/components/Shell';
import OrganGuide from '@/components/OrganGuide';
import { careTeam, organs, steps } from '@/lib/data';

export const metadata: Metadata = {
  title: '이용 방법 | THOR SCAN LONGEVITY',
  description: '예약부터 맞춤 건강 플랜까지, 네 단계로 끝나는 THOR SCAN LONGEVITY 전신 MRI 검진 이용 방법.',
};

export default function HowItWorks() {
  return (
    <Shell heroHeader={false}>
      <section className="page-hero">
        <p className="eyebrow">이용 방법</p>
        <h1>예약부터 맞춤 건강 플랜까지,<br />네 단계로 끝납니다</h1>
        <p>복잡한 병원 절차 없이 온라인으로 예약하고, 촬영 후에는 전담 케어팀이 결과를 함께 살펴봅니다.</p>
      </section>

      <section className="sec" style={{ marginTop: 0 }}>
        {steps.map(s => (
          <article className="step-card" key={s.n}>
            <div className="thumb"><Image src={s.image} alt="" fill sizes="(max-width: 500px) 100vw, 468px" /></div>
            <div className="body">
              <span className="tag">{s.n}. {s.tag}</span>
              <p className="title">{s.title}</p>
              <p>{s.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="sec" id="organs">
        <div className="sec-head"><h2>한 번의 검진으로 살펴보는 장기</h2></div>
        <p className="sec-sub">상품에 따라 검사 범위가 다릅니다. 자세한 구성은 요금 안내에서 확인하세요.</p>
        <div className="fullbody"><Image src="/images/fullbody.webp" alt="전신 MRI 영상" fill sizes="(max-width: 500px) 100vw, 468px" /></div>
        <div className="pill-list" style={{ marginBottom: 20 }}>
          {organs.map(o => <span className="pill" key={o.name}>{o.name}</span>)}
        </div>
        <OrganGuide />
      </section>

      <section className="sec" id="care">
        <div className="sec-head"><h2>처음부터 끝까지 함께하는 케어팀</h2></div>
        <p className="sec-sub">문진 작성부터 결과 상담까지, 궁금한 점이 생기면 언제든 케어팀에 물어보세요.</p>
        <div className="thumb" style={{ height: 200, marginBottom: 8 }}>
          <Image src="/images/consult.png" alt="결과 상담" fill sizes="(max-width: 500px) 100vw, 468px" />
        </div>
        <ul className="care">
          {careTeam.map(c => <li key={c}><span className="ck">✓</span>{c}</li>)}
        </ul>
      </section>
    </Shell>
  );
}
