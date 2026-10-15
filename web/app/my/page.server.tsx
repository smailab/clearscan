import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { LogoutButton } from '@/components/auth/AuthForms';
import { CancelButton } from '@/components/auth/MyParts';
import { Chevron } from '@/components/icons';
import { currentUser } from '@/lib/auth/members';
import { RESULT_STATUS, resultsByUser } from '@/lib/booking/results';
import { canCancel, formatDateKo, formatPhone, kstToday } from '@/lib/booking/schedule';
import { productNames } from '@/lib/products';
import { describeDiscount, myCoupons } from '@/lib/coupons';
import { myBookings } from '@/lib/booking/service';
import { site, won } from '@/lib/data';
import type { Booking } from '@/lib/booking/types';

export const metadata: Metadata = { title: '내 페이지 | BOSCO LONGEVITY', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/my');

  const [bookings, results, names, coupons] = await Promise.all([myBookings(user), resultsByUser(user.id), productNames(), myCoupons(user.id)]);
  const nameOf = (b: Booking) => b.planName ?? names.get(b.planId) ?? b.planId;
  const today = kstToday();
  const upcoming = bookings.filter(b => b.status === 'confirmed' && b.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = bookings.filter(b => !upcoming.includes(b));
  const resultCodes = new Set(results.map(r => r.bookingCode));

  return (
    <Shell heroHeader={false}>
      <section className="sec my-profile" style={{ marginTop: 0 }}>
        <div className="my-hello">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div>
            <p className="nm">{user.name}님</p>
            <p className="sub">{user.email}</p>
            <p className="sub">{formatPhone(user.phone)} · {user.birth} · {user.sex === 'F' ? '여성' : '남성'}</p>
          </div>
        </div>
        <div className="my-stats">
          <div><b>{upcoming.length}</b><span>예정된 검진</span></div>
          <div><b>{bookings.filter(b => b.status === 'confirmed').length}</b><span>전체 예약</span></div>
          <div><b>{results.length}</b><span>검사 결과</span></div>
        </div>
      </section>

      <section className="sec" id="results">
        <div className="sec-head"><h2>검사 결과</h2></div>
        {results.length === 0 ? (
          <p className="bk-empty">아직 등록된 검사 결과가 없어요. 검진 후 판독이 끝나면 이곳에서 확인할 수 있어요.</p>
        ) : (
          <ul className="my-list">
            {results.map(r => {
              const b = bookings.find(x => x.code === r.bookingCode);
              const s = RESULT_STATUS[r.status];
              return (
                <li key={r.bookingCode}>
                  <Link href={`/my/results/${r.bookingCode}`} className="my-row">
                    <span className={`my-badge ${s.tone}`}>{s.label}</span>
                    <span className="txt">
                      <b>{b ? nameOf(b) : '검진'}</b>
                      <small>{b ? formatDateKo(b.date) : ''} · {r.summary}</small>
                    </span>
                    <Chevron className="chev" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {coupons.length > 0 && (
        <section className="sec" id="coupons">
          <div className="sec-head"><h2>내 쿠폰</h2><Link className="more" href="/booking">예약에 쓰기 ›</Link></div>
          <ul className="my-coupons">
            {coupons.map(c => (
              <li key={c.code}>
                <b>{describeDiscount(c)}</b>
                <span className="nm">{c.name}</span>
                <span className="meta">{c.productId ? names.get(c.productId) ?? '지정 상품' : '전체 상품'} · {c.validUntil}까지</span>
                <code>{c.code}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sec" id="bookings">
        <div className="sec-head"><h2>예약 내역</h2><Link className="more" href="/booking">새 예약 ›</Link></div>
        {bookings.length === 0 && <p className="bk-empty">예약 내역이 없어요. <Link href="/booking" style={{ color: 'var(--primary)', fontWeight: 600 }}>검진 예약하기</Link></p>}
        {upcoming.length > 0 && <h3 className="my-sub">예정된 검진</h3>}
        <ul className="my-list">{upcoming.map(b => <BookingItem key={b.code} b={b} name={nameOf(b)} today={today} hasResult={resultCodes.has(b.code)} />)}</ul>
        {past.length > 0 && <h3 className="my-sub">지난 예약 · 취소</h3>}
        <ul className="my-list">{past.map(b => <BookingItem key={b.code} b={b} name={nameOf(b)} today={today} hasResult={resultCodes.has(b.code)} />)}</ul>
      </section>

      <section className="sec">
        <p className="note">예약 변경이나 회원 정보 수정은 상담 전화 {site.phone}로 문의해 주세요.</p>
        <div style={{ marginTop: 12 }}><LogoutButton /></div>
      </section>
    </Shell>
  );
}

function BookingItem({ b, name, today, hasResult }: { b: Booking; name: string; today: string; hasResult: boolean }) {
  const cancelled = b.status === 'cancelled';
  const state = cancelled ? { label: '취소됨', cls: 'off' } : b.date >= today ? { label: '예약 확정', cls: 'ok' } : { label: '검진 완료', cls: 'done' };
  return (
    <li className={`my-booking${cancelled ? ' cancelled' : ''}`}>
      <div className="top">
        <span className={`my-state ${state.cls}`}>{state.label}</span>
        <span className="code">{b.code}</span>
      </div>
      <p className="nm">{name}{b.couple && ' · 커플 플랜'}</p>
      {b.groupCode && <p className="grp">함께 신청한 검사 · 묶음 {b.groupCode}</p>}
      {b.status === 'confirmed' && b.history?.length ? <p className="grp">일정이 변경되었습니다 (기존 {formatDateKo(b.history[0].from.date)} {b.history[0].from.time})</p> : null}
      <p className="when">{formatDateKo(b.date)} {b.time}</p>
      <p className="meta">{won(b.price)}원 · 현장 결제{b.discount ? ` · 쿠폰 ${won(b.discount)}원 할인` : ''}{b.partner && ` · 동반자 ${b.partner.name}`}</p>
      <div className="actions">
        {hasResult && <Link href={`/my/results/${b.code}`} className="my-link">검사 결과 보기 ›</Link>}
        {!cancelled && b.date >= today && (canCancel(b.date) ? <CancelButton code={b.code} /> : <span className="note">검진 2일 전부터는 전화로 변경·취소해 주세요.</span>)}
      </div>
    </li>
  );
}
