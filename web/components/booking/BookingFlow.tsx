'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { site, won } from '@/lib/data';
import type { Product } from '@/lib/products-shared';
import { MAX_ITEMS, buildSegments } from '@/lib/booking/visit';
import {
  BOOKING_WINDOW_MONTHS, HOURS_NOTE, WEEKDAYS, addDays, addMonths, dayOfWeek, firstBookableDate,
  formatDateKo, formatPhone, isBookableDate, kstToday, lastBookableDate, toHHMM, toMin,
} from '@/lib/booking/schedule';
import type { Person, SlotInfo, Survey } from '@/lib/booking/types';

const STEPS = ['상품', '일정', '정보', '확인'];
const emptyPerson: Person = { name: '', phone: '', birth: '', sex: 'F' };

type Done = { code: string; date: string; time: string; planId: string; planName?: string; couple: boolean; price: number; discount?: number };
type AppliedCoupon = { code: string; name: string; discount: number; price: number };

export type Member = Person & { email: string };

// 예약자 본인 정보는 로그인한 회원 정보(member)를 그대로 쓴다
export type BookingPricing = { prices: Record<string, number>; coupleDiscount: Record<string, number> };

export type MyCoupon = { code: string; name: string };

export default function BookingFlow({ initialPlan, member, pricing, products, myCoupons = [] }: { initialPlan?: string; member: Member; pricing: BookingPricing; products: Product[]; myCoupons?: MyCoupon[] }) {
  const getPlan = (id: string) => products.find(p => p.id === id);
  // 요금은 서버가 회원에게만 내려준다 (lib/pricing.ts)
  const priceFor = (id: string, couple: boolean) => {
    const p = pricing.prices[id] ?? 0;
    return couple ? p * 2 - (pricing.coupleDiscount[id] ?? 0) : p;
  };
  const [step, setStep] = useState(0);
  // 여러 상품 선택 (?plan=a,b 로 미리 선택 가능)
  const [planIds, setPlanIds] = useState<string[]>(() => {
    const pre = String(initialPlan ?? '').split(',').filter(id => getPlan(id));
    return pre.length ? pre : products[0] ? [products[0].id] : [];
  });
  const togglePlan = (id: string) => setPlanIds(ids => {
    if (ids.includes(id)) return ids.length > 1 ? ids.filter(x => x !== id) : ids; // 최소 1개
    return ids.length >= MAX_ITEMS ? ids : [...ids, id];
  });
  const planKey = planIds.join(',');
  const [couple, setCouple] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [partner, setPartner] = useState<Person>({ ...emptyPerson, sex: 'M' });
  const [survey, setSurvey] = useState<Survey>({ metalImplant: false, claustrophobia: false, pregnant: false, memo: '' });
  const [consent, setConsent] = useState({ privacy: false, sensitive: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMsg, setCouponMsg] = useState('');

  const selected = planIds.map(getPlan).filter((p): p is Product => Boolean(p));
  const coupleAllowed = selected.length > 0 && selected.every(p => p.couple);
  const isCouple = couple && coupleAllowed;
  const totalPrice = selected.reduce((n, p) => n + priceFor(p.id, isCouple), 0);
  const coupleSave = selected.reduce((n, p) => n + (pricing.coupleDiscount[p.id] ?? 0), 0);

  // 예약 가능 기간: 내일 ~ 6개월 뒤 같은 날
  const [range] = useState(() => ({ first: firstBookableDate(), last: lastBookableDate() }));
  const firstMonth = range.first.slice(0, 7);
  const lastMonth = range.last.slice(0, 7);
  const [month, setMonth] = useState(firstMonth); // 'YYYY-MM'

  // 보고 있는 달의 달력 격자 (앞쪽 빈칸은 null)
  const calendar = useMemo(() => {
    const start = `${month}-01`;
    const cells: (string | null)[] = Array(dayOfWeek(start)).fill(null);
    for (let d = start; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
    return cells;
  }, [month]);

  useEffect(() => { if (!coupleAllowed) setCouple(false); }, [coupleAllowed]);

  // 상품·커플 여부가 바뀌면 적용한 쿠폰은 다시 확인해야 한다
  useEffect(() => { setCoupon(null); setCouponMsg(''); }, [planKey, isCouple]);

  async function applyCoupon() {
    setCouponMsg('');
    try {
      const res = await fetch('/api/coupons/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: couponInput, planIds, couple: isCouple }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCoupon(null); setCouponMsg(data.error ?? '쿠폰을 적용하지 못했습니다.'); return; }
      setCoupon(data);
    } catch {
      setCouponMsg('네트워크 오류가 발생했습니다.');
    }
  }

  // 상품·커플 여부·날짜가 바뀌면 시간 다시 조회
  useEffect(() => {
    setTime('');
    if (!date) { setSlots(null); return; }
    let alive = true;
    setSlots(null);
    fetch(`/api/availability?plans=${encodeURIComponent(planKey)}&couple=${isCouple ? 1 : 0}&date=${date}`)
      .then(r => r.json())
      .then(d => { if (alive) setSlots(d.slots ?? []); })
      .catch(() => { if (alive) setSlots([]); });
    return () => { alive = false; };
  }, [planKey, isCouple, date]);

  // 단계가 바뀐 직후의 클릭(더블클릭 등)은 무시해서 확인 화면을 건너뛰고 바로 예약되지 않게 한다
  const stepAt = useRef(0);
  useEffect(() => { stepAt.current = Date.now(); window.scrollTo({ top: 0 }); setError(''); }, [step]);

  const personOk = (p: Person) => p.name.trim().length >= 2 && /^01[016789]\d{7,8}$/.test(p.phone.replace(/\D/g, '')) && /^\d{4}-\d{2}-\d{2}$/.test(p.birth);
  const canNext = [
    planIds.length > 0,
    Boolean(date && time),
    (!isCouple || personOk(partner)) && consent.privacy && consent.sensitive,
    true,
  ][step];

  async function submit() {
    if (busy || Date.now() - stepAt.current < 600) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planIds, couple: isCouple, date, time, partner: isCouple ? partner : undefined, survey, consent, couponCode: coupon?.code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '예약에 실패했습니다.');
        if (res.status === 409) { setStep(1); setSlots(null); setTime(''); refetch(); }
        return;
      }
      setDone(data);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  function refetch() {
    fetch(`/api/availability?plans=${encodeURIComponent(planKey)}&couple=${isCouple ? 1 : 0}&date=${date}`).then(r => r.json()).then(d => setSlots(d.slots ?? []));
  }

  if (done) {
    const doneName = done.planName ?? getPlan(done.planId)?.name ?? done.planId;
    return (
      <section className="sec bk-done" style={{ marginTop: 0 }}>
        <div className="bk-check">✓</div>
        <h1>예약이 완료되었습니다</h1>
        <p className="sub">예약번호는 조회·취소할 때 필요하니 꼭 저장해 두세요.</p>
        <div className="bk-code">{done.code}</div>
        <dl className="bk-summary">
          <div><dt>검진</dt><dd>{doneName}{done.couple && ' · 커플 플랜'}</dd></div>
          <div><dt>일시</dt><dd>{formatDateKo(done.date)} {done.time}</dd></div>
          <div><dt>장소</dt><dd>{site.clinic}<br />{site.address}</dd></div>
          <div><dt>결제 예정</dt><dd>{won(done.price)}원 <small>(현장 결제{done.discount ? ` · 쿠폰 ${won(done.discount)}원 할인` : ''})</small></dd></div>
        </dl>
        <div className="box">
          <p className="title">검진 전 안내</p>
          <p>촬영 4시간 전부터 금식해 주시고, 금속 액세서리는 착용하지 말고 방문해 주세요. 예약 시간 15분 전까지 도착해 주세요.</p>
        </div>
        <div className="bk-actions">
          <Link className="btn btn-line" href="/my">내 예약 보기</Link>
          <Link className="btn btn-primary" href="/">홈으로</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="bk-steps">
        {STEPS.map((s, i) => (
          <span key={s} className={i === step ? 'on' : i < step ? 'past' : ''}><b>{i + 1}</b>{s}</span>
        ))}
      </div>

      {step === 0 && (
        <section className="sec" style={{ marginTop: 0 }}>
          <h2 className="bk-h">어떤 검진을 받으시겠어요?</h2>
          <p className="bk-plans-hint">여러 개를 함께 선택하면 같은 날 한 번 방문으로 이어서 받을 수 있어요. (최대 {MAX_ITEMS}개)</p>
          <div className="bk-plans">
            {products.map(p => (
              <label key={p.id} className={`bk-plan${planIds.includes(p.id) ? ' on' : ''}`}>
                <input type="checkbox" checked={planIds.includes(p.id)} onChange={() => togglePlan(p.id)} />
                <span className="kind">{p.kind}</span>
                <span className="nm">{p.name}</span>
                <span className="tm">{p.time}</span>
                <span className="pr">{won(pricing.prices[p.id])}원</span>
              </label>
            ))}
          </div>
          {!coupleAllowed && selected.length > 1 && selected.some(p => p.couple) && (
            <p className="note">커플 플랜은 선택한 상품이 모두 커플 할인 대상일 때만 이용할 수 있어요.</p>
          )}
          {coupleAllowed && (
            <label className={`bk-couple${couple ? ' on' : ''}`}>
              <input type="checkbox" checked={couple} onChange={e => setCouple(e.target.checked)} />
              <span className="box-ck" aria-hidden="true">{couple && '✓'}</span>
              <span>
                <b>커플 플랜으로 함께 예약</b>
                <small>같은 날 두 분이 함께 검진 · {won(coupleSave)}원 할인</small>
              </span>
            </label>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="sec" style={{ marginTop: 0 }}>
          <h2 className="bk-h">날짜를 선택하세요</h2>
          <div className="bk-cal-head">
            <button type="button" aria-label="이전 달" disabled={month <= firstMonth} onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}>‹</button>
            <strong>{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</strong>
            <button type="button" aria-label="다음 달" disabled={month >= lastMonth} onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}>›</button>
          </div>
          <div className="bk-cal" role="grid" aria-label="예약 날짜">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={`wd${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{w}</span>
            ))}
            {calendar.map((d, i) => {
              if (!d) return <span key={`blank-${i}`} />;
              const inRange = d >= range.first && d <= range.last;
              const ok = inRange && isBookableDate(d);
              const dow = dayOfWeek(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!ok}
                  aria-pressed={date === d}
                  aria-label={formatDateKo(d)}
                  className={`${date === d ? 'on' : ''}${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}${inRange ? '' : ' out'}`}
                  onClick={() => setDate(d)}
                >
                  <b>{Number(d.slice(8))}</b>
                </button>
              );
            })}
          </div>
          <p className="note">{formatDateKo(range.first)}부터 {formatDateKo(range.last)}까지 ({BOOKING_WINDOW_MONTHS}개월) 예약할 수 있어요.</p>
          <p className="note">{HOURS_NOTE}</p>

          {date && (
            <>
              <h2 className="bk-h" style={{ marginTop: 24 }}>{formatDateKo(date)} 시간 선택</h2>
              {slots === null ? (
                <p className="bk-empty">예약 가능한 시간을 불러오는 중…</p>
              ) : slots.every(s => !s.available) ? (
                <p className="bk-empty">이 날은 예약이 모두 찼어요. 다른 날짜를 선택해 주세요.</p>
              ) : (
                <div className="bk-times">
                  {slots.map(s => (
                    <button key={s.time} type="button" disabled={!s.available} className={time === s.time ? 'on' : ''} onClick={() => setTime(s.time)}>
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
              {isCouple && <p className="note">커플 플랜은 두 분이 연이어 촬영하므로 시작 시간을 기준으로 표시합니다.</p>}
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="sec" style={{ marginTop: 0 }}>
          <h2 className="bk-h">예약자 정보</h2>
          <dl className="bk-summary bk-member">
            <div><dt>이름</dt><dd>{member.name}</dd></div>
            <div><dt>휴대폰</dt><dd>{formatPhone(member.phone)}</dd></div>
            <div><dt>생년월일</dt><dd>{member.birth} · {member.sex === 'F' ? '여성' : '남성'}</dd></div>
            <div><dt>이메일</dt><dd>{member.email}</dd></div>
          </dl>
          <p className="note">회원 정보로 예약됩니다. 정보 변경은 상담 전화로 문의해 주세요.</p>
          {isCouple && (
            <>
              <h2 className="bk-h" style={{ marginTop: 28 }}>동반자 정보</h2>
              <PersonFields value={partner} onChange={setPartner} />
            </>
          )}

          <h2 className="bk-h" style={{ marginTop: 28 }}>사전 문진</h2>
          <p className="sec-sub" style={{ marginTop: -6 }}>안전한 촬영을 위해 해당하는 항목을 체크해 주세요.</p>
          <div className="bk-checks">
            <label><input type="checkbox" checked={survey.metalImplant} onChange={e => setSurvey({ ...survey, metalImplant: e.target.checked })} />심박조율기·인공와우 등 체내 금속 장치가 있어요</label>
            <label><input type="checkbox" checked={survey.claustrophobia} onChange={e => setSurvey({ ...survey, claustrophobia: e.target.checked })} />폐쇄공포증이 있어요</label>
            <label><input type="checkbox" checked={survey.pregnant} onChange={e => setSurvey({ ...survey, pregnant: e.target.checked })} />임신 중이거나 임신 가능성이 있어요</label>
          </div>
          <label className="bk-field">
            <span>기타 전달 사항 (선택)</span>
            <textarea rows={3} maxLength={500} value={survey.memo} onChange={e => setSurvey({ ...survey, memo: e.target.value })} placeholder="복용 중인 약, 수술 이력 등" />
          </label>

          <div className="bk-consent">
            <label><input type="checkbox" checked={consent.privacy && consent.sensitive} onChange={e => setConsent({ privacy: e.target.checked, sensitive: e.target.checked })} /><b>전체 동의</b></label>
            <label><input type="checkbox" checked={consent.privacy} onChange={e => setConsent({ ...consent, privacy: e.target.checked })} />[필수] 개인정보 수집·이용 동의</label>
            <p>수집 항목: 이름, 휴대폰 번호, 생년월일, 성별 · 이용 목적: 검진 예약 및 안내 · 보유 기간: 검진 완료 후 관련 법령에 따른 기간</p>
            <label><input type="checkbox" checked={consent.sensitive} onChange={e => setConsent({ ...consent, sensitive: e.target.checked })} />[필수] 민감정보(건강정보) 처리 동의</label>
            <p>수집 항목: 사전 문진 응답 · 이용 목적: 안전한 검사 진행 및 판독 참고</p>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="sec" style={{ marginTop: 0 }}>
          <h2 className="bk-h">예약 내용을 확인하세요</h2>
          <dl className="bk-summary">
            <div><dt>검진</dt><dd>
              {buildSegments(selected, isCouple, toMin(time || '00:00')).map(seg => {
                const p = getPlan(seg.planId)!;
                return <span key={seg.planId} className="bk-item-line"><b>{toHHMM(seg.start)}</b> {p.name} <small>{p.time} · {won(priceFor(p.id, isCouple))}원</small></span>;
              })}
              {isCouple && <small>커플 플랜 (두 분 모두 검진)</small>}
            </dd></div>
            <div><dt>일시</dt><dd>{formatDateKo(date)} {time}</dd></div>
            <div><dt>예약자</dt><dd>{member.name} · {formatPhone(member.phone)}</dd></div>
            {isCouple && <div><dt>동반자</dt><dd>{partner.name} · {formatPhone(partner.phone)}</dd></div>}
            <div><dt>장소</dt><dd>{site.clinic}<br /><small>{site.address}</small></dd></div>
            {coupon && <div><dt>쿠폰 할인</dt><dd className="bk-discount">−{won(coupon.discount)}원 <small>({coupon.name})</small></dd></div>}
            <div className="total"><dt>결제 예정 금액</dt><dd>{coupon && <s className="bk-list">{won(totalPrice)}원</s>}{won(coupon ? coupon.price : totalPrice)}원</dd></div>
          </dl>
          <div className="bk-coupon">
            <label htmlFor="coupon">쿠폰</label>
            <div className="bk-coupon-row">
              <input id="coupon" value={couponInput} placeholder="쿠폰 코드 입력" autoCapitalize="characters"
                onChange={e => { setCouponInput(e.target.value.toUpperCase()); if (coupon) setCoupon(null); setCouponMsg(''); }} />
              {coupon
                ? <button type="button" className="btn btn-line" onClick={() => { setCoupon(null); setCouponInput(''); }}>취소</button>
                : <button type="button" className="btn btn-line" disabled={!couponInput.trim()} onClick={applyCoupon}>적용</button>}
            </div>
            {coupon && <p className="bk-coupon-ok">✓ {coupon.name} — {won(coupon.discount)}원 할인이 적용됐어요</p>}
            {couponMsg && <p className="bk-error">{couponMsg}</p>}
            {myCoupons.length > 0 && !coupon && (
              <div className="bk-my-coupons">
                <span>보유 쿠폰</span>
                {myCoupons.map(c => (
                  <button key={c.code} type="button" onClick={() => setCouponInput(c.code)}>{c.name}</button>
                ))}
              </div>
            )}
          </div>
          <p className="note">결제는 검진 당일 현장에서 진행됩니다. 검진 2일 전까지 온라인으로 무료 취소할 수 있습니다.</p>
        </section>
      )}

      {error && <p className="bk-error" role="alert">{error}</p>}

      <div className="bottom-cta">
        {step > 0 && <button type="button" className="btn btn-line" onClick={() => setStep(step - 1)}>이전</button>}
        {step < 3 ? (
          <button key="next" type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            다음 {step === 0 && `· ${selected.length > 1 ? `${selected.length}개 ` : ''}${won(totalPrice)}원`}
          </button>
        ) : (
          <button key="submit" type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? '예약 중…' : '예약 확정하기'}</button>
        )}
      </div>
    </>
  );
}

function PersonFields({ value, onChange }: { value: Person; onChange: (p: Person) => void }) {
  return (
    <div className="bk-fields">
      <label className="bk-field"><span>이름</span>
        <input value={value.name} maxLength={20} autoComplete="name" onChange={e => onChange({ ...value, name: e.target.value })} placeholder="홍길동" />
      </label>
      <label className="bk-field"><span>휴대폰 번호</span>
        <input value={formatPhone(value.phone)} inputMode="numeric" autoComplete="tel" onChange={e => onChange({ ...value, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="010-0000-0000" />
      </label>
      <label className="bk-field"><span>생년월일</span>
        <input type="date" value={value.birth} max={kstToday()} min="1900-01-01" onChange={e => onChange({ ...value, birth: e.target.value })} />
      </label>
      <div className="bk-field"><span>성별</span>
        <div className="bk-seg">
          {(['F', 'M'] as const).map(s => (
            <button key={s} type="button" className={value.sex === s ? 'on' : ''} onClick={() => onChange({ ...value, sex: s })}>{s === 'F' ? '여성' : '남성'}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
