'use client';

import { useState } from 'react';
import { site, won } from '@/lib/data';
import { canCancel, formatDateKo, formatPhone, getPlan } from '@/lib/booking/schedule';
import type { Booking } from '@/lib/booking/types';

export default function Lookup() {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(url: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, phone }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setBooking(data.booking);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const plan = booking && getPlan(booking.planId);

  return (
    <section className="sec" style={{ marginTop: 0 }}>
      <h1 className="bk-h">예약 조회 · 취소</h1>
      <form className="bk-fields" onSubmit={e => { e.preventDefault(); call('/api/bookings/lookup'); }}>
        <label className="bk-field"><span>예약번호</span>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CS-XXXXXX" autoCapitalize="characters" />
        </label>
        <label className="bk-field"><span>예약자 휴대폰 번호</span>
          <input value={formatPhone(phone)} inputMode="numeric" onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="010-0000-0000" />
        </label>
        <button className="btn btn-primary" disabled={busy || !code || phone.length < 10}>조회하기</button>
      </form>

      {error && <p className="bk-error" role="alert">{error}</p>}

      {booking && plan && (
        <div style={{ marginTop: 24 }}>
          <dl className="bk-summary">
            <div><dt>상태</dt><dd><span className={`badge ${booking.status === 'confirmed' ? 'done' : 'ing'}`}>{booking.status === 'confirmed' ? '예약 확정' : '취소됨'}</span></dd></div>
            <div><dt>예약번호</dt><dd>{booking.code}</dd></div>
            <div><dt>검진</dt><dd>{plan.name}{booking.couple && ' · 커플 플랜'}</dd></div>
            <div><dt>일시</dt><dd>{formatDateKo(booking.date)} {booking.time}</dd></div>
            <div><dt>예약자</dt><dd>{booking.person.name}{booking.partner && `, ${booking.partner.name}`}</dd></div>
            <div><dt>결제 예정</dt><dd>{won(booking.price)}원</dd></div>
          </dl>
          {booking.status === 'confirmed' && (canCancel(booking.date) ? (
            <button type="button" className="btn btn-line" style={{ width: '100%', marginTop: 14 }} disabled={busy}
              onClick={() => { if (confirm('예약을 취소하시겠어요?')) call('/api/bookings/cancel'); }}>
              예약 취소하기
            </button>
          ) : (
            <p className="note">검진 2일 전부터는 온라인 취소가 어렵습니다. 대표번호 {site.phone}로 문의해 주세요.</p>
          ))}
        </div>
      )}
    </section>
  );
}
