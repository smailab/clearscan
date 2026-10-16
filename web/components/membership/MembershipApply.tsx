'use client';

import Link from 'next/link';
import { useState } from 'react';
import { won } from '@/lib/data';
import { CONTACT_TIMES, GOALS, MAX_SEATS, type Tier } from '@/lib/memberships-shared';

type Props = {
  tiers: (Tier & { price: number | null })[]; // 이 화면은 로그인한 회원에게만 보여서 회비를 함께 받는다
  initialTier: string;
  member: { name: string; phone: string; email: string };
};

// 멤버십 상담 신청 — 티어 · 인원 · 관심 분야 · 연락 시간 · 메모
export default function MembershipApply({ tiers, initialTier, member }: Props) {
  const [tierId, setTierId] = useState(initialTier);
  const tier = tiers.find(t => t.id === tierId);
  const [seats, setSeats] = useState(tier?.seats ?? 1);
  const [goals, setGoals] = useState<string[]>([]);
  const [contactTime, setContactTime] = useState('');
  const [memo, setMemo] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ tierName: string; contactTime: string } | null>(null);

  function pickTier(id: string) {
    setTierId(id);
    setSeats(tiers.find(t => t.id === id)?.seats ?? 1);
  }
  const toggleGoal = (g: string) => setGoals(gs => (gs.includes(g) ? gs.filter(x => x !== g) : [...gs, g]));

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/membership/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, seats, goals, contactTime, memo, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? '신청하지 못했습니다.'); return; }
      setDone({ tierName: data.tierName, contactTime: data.contactTime });
      window.scrollTo({ top: 0 });
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="sec bk-done" style={{ marginTop: 0 }}>
        <div className="bk-check">✓</div>
        <h1>상담 신청이 접수되었습니다</h1>
        <p className="sub">전담 컨시어지가 <b>{done.contactTime}</b>에 {member.phone}로 연락드립니다.</p>
        <dl className="bk-summary">
          <div><dt>멤버십</dt><dd>{done.tierName}{seats > 1 ? ` · ${seats}인` : ''}</dd></div>
          <div><dt>신청자</dt><dd>{member.name} · {member.phone}</dd></div>
          {goals.length > 0 && <div><dt>관심 분야</dt><dd>{goals.join(', ')}</dd></div>}
        </dl>
        <div className="box">
          <p className="title">다음 단계</p>
          <p>상담에서 건강 이력과 목표를 확인하고 멤버십 구성을 정합니다. 결제는 상담 후에 안내해 드리며, 가입이 확정된 날부터 1년간 이용합니다.</p>
        </div>
        <div className="bk-actions">
          <Link className="btn btn-line" href="/membership">멤버십 안내</Link>
          <Link className="btn btn-primary" href="/my#membership">내 페이지</Link>
        </div>
      </section>
    );
  }

  const ready = Boolean(tier && contactTime && consent);

  return (
    <>
      <section className="sec" style={{ marginTop: 0 }}>
        <h1 className="bk-h ms-apply-h">멤버십 상담 신청</h1>
        <p className="sec-sub" style={{ marginTop: 0 }}>신청에는 결제가 필요 없어요. 컨시어지 상담 후 구성과 회비를 확정합니다.</p>

        <h2 className="bk-h">멤버십 선택</h2>
        <div className="ms-pick">
          {tiers.map(t => (
            <label key={t.id} className={`ms-pick-item${tierId === t.id ? ' on' : ''}`}>
              <input type="radio" name="tier" checked={tierId === t.id} onChange={() => pickTier(t.id)} />
              <span className="nm">{t.name}<small>{t.nameKo}</small></span>
              <span className="tg">{t.tagline}</span>
              <span className="pr">{t.price === null ? '상담 후 안내' : `연 ${won(t.price)}원`}</span>
            </label>
          ))}
        </div>

        {tier && tier.seats > 1 && (
          <div className="ms-seats-row">
            <span>가입 인원 <small>(본인 포함)</small></span>
            <div className="ms-stepper">
              <button type="button" aria-label="인원 줄이기" disabled={seats <= tier.seats} onClick={() => setSeats(seats - 1)}>−</button>
              <b>{seats}명</b>
              <button type="button" aria-label="인원 늘리기" disabled={seats >= MAX_SEATS} onClick={() => setSeats(seats + 1)}>+</button>
            </div>
          </div>
        )}
      </section>

      <section className="sec">
        <h2 className="bk-h">관심 있는 건강 분야 <small className="ms-opt">(선택, 여러 개 가능)</small></h2>
        <div className="organ-chips">
          {GOALS.map(g => (
            <button key={g} type="button" className={goals.includes(g) ? 'on' : ''} aria-pressed={goals.includes(g)} onClick={() => toggleGoal(g)}>{g}</button>
          ))}
        </div>

        <h2 className="bk-h" style={{ marginTop: 26 }}>연락 받을 시간</h2>
        <div className="ms-times">
          {CONTACT_TIMES.map(c => (
            <button key={c} type="button" className={contactTime === c ? 'on' : ''} aria-pressed={contactTime === c} onClick={() => setContactTime(c)}>{c}</button>
          ))}
        </div>

        <label className="bk-field" style={{ marginTop: 22 }}>
          <span>컨시어지에게 전할 말 (선택)</span>
          <textarea rows={3} maxLength={500} value={memo} onChange={e => setMemo(e.target.value)} placeholder="가족력, 걱정되는 증상, 원하는 검사 등" />
        </label>

        <dl className="bk-summary bk-member" style={{ marginTop: 18 }}>
          <div><dt>신청자</dt><dd>{member.name}</dd></div>
          <div><dt>연락처</dt><dd>{member.phone}</dd></div>
          <div><dt>이메일</dt><dd>{member.email}</dd></div>
        </dl>

        <div className="bk-consent">
          <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />[필수] 멤버십 상담을 위한 개인정보 이용 동의</label>
          <p>이용 항목: 이름, 휴대폰 번호, 이메일, 관심 분야, 전달 사항 · 목적: 멤버십 상담 및 안내 · 보유 기간: 상담 종료 후 1년 (가입 시 멤버십 기간 동안)</p>
        </div>
      </section>

      {error && <p className="bk-error" role="alert">{error}</p>}

      <div className="bottom-cta">
        <Link className="btn btn-line" href="/membership">이전</Link>
        <button type="button" className="btn btn-primary" disabled={!ready || busy} onClick={submit}>
          {busy ? '신청 중…' : tier ? `${tier.nameKo} 상담 신청하기` : '상담 신청하기'}
        </button>
      </div>
    </>
  );
}
