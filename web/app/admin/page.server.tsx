import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin, listAdmins, type Admin } from '@/lib/auth/admins';
import { listBookings } from '@/lib/booking/service';
import { allResults } from '@/lib/booking/results';
import { formatDateKo, formatPhone, getPlan, kstToday } from '@/lib/booking/schedule';
import { listUsers } from '@/lib/auth/members';
import { won } from '@/lib/data';
import { AdminLogout, AdminRowActions, ChangePasswordForm, NewAdminForm } from '@/components/admin/AdminParts';
import BookingResultRow from '@/components/booking/ResultEditor';

export const metadata: Metadata = { title: '관리자 | Scan Longevity', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Search = { all?: string; tab?: string; q?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');

  const { all, tab = 'bookings', q = '' } = await searchParams;

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>관리자</h1>
        <div className="admin-who">
          <span><b>{admin.name}</b> · {admin.role === 'owner' ? '대표 관리자' : '일반 관리자'}</span>
          <AdminLogout />
        </div>
      </div>
      <nav className="admin-tabs">
        <a href="/admin" className={tab === 'bookings' ? 'on' : ''}>예약 · 검사 결과</a>
        <a href="/admin?tab=members" className={tab === 'members' ? 'on' : ''}>회원 관리</a>
        {admin.role === 'owner' && <a href="/admin?tab=admins" className={tab === 'admins' ? 'on' : ''}>관리자 계정</a>}
        <a href="/admin?tab=account" className={tab === 'account' ? 'on' : ''}>내 계정</a>
      </nav>
      {tab === 'members' ? <Members q={q} />
        : tab === 'admins' && admin.role === 'owner' ? <Admins me={admin} />
        : tab === 'account' ? <ChangePasswordForm />
        : <Bookings all={all === '1'} />}
    </div>
  );
}

async function Bookings({ all }: { all: boolean }) {
  const today = kstToday();
  const [bookings, results] = await Promise.all([listBookings(), allResults()]);
  const list = bookings.filter(b => all || b.date >= today || (b.status === 'confirmed' && !results.get(b.code)?.published));
  const confirmed = list.filter(b => b.status === 'confirmed');

  return (
    <>
      <div className="admin-bar">
        <p className="admin-stat">확정 {confirmed.length}건 · 취소 {list.length - confirmed.length}건 {!all && '(예정 예약 + 결과 미공개 예약)'}</p>
        <a href={all ? '/admin' : '/admin?all=1'}>{all ? '예정·미처리만' : '전체 보기'}</a>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>일시</th><th>상품</th><th>예약자</th><th>연락처</th><th>생년월일/성별</th><th>문진</th><th>금액</th><th>상태</th><th>검사 결과</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>예약이 없습니다.</td></tr>}
            {list.map(b => {
              const flags = [b.survey.metalImplant && '금속', b.survey.claustrophobia && '폐소', b.survey.pregnant && '임신'].filter(Boolean);
              const r = results.get(b.code);
              return (
                <BookingResultRow
                  key={b.code}
                  code={b.code}
                  colSpan={9}
                  rowClassName={b.status === 'cancelled' ? 'cancelled' : ''}
                  editable={b.status === 'confirmed' && Boolean(b.userId)}
                  initial={r ? { status: r.status, summary: r.summary, findings: r.findings, recommendation: r.recommendation, published: r.published } : null}
                  meta={r?.updatedBy ? `${r.updatedBy} · ${new Date(r.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : undefined}
                  summaryLabel={`${formatDateKo(b.date)} ${b.time} · ${getPlan(b.planId)?.name ?? ''} · ${b.person.name}`}
                  cells={<>
                      <td>{formatDateKo(b.date)}<br /><b>{b.time}</b><br /><code>{b.code}</code></td>
                      <td>{getPlan(b.planId)?.name}{b.couple && <><br /><small>커플</small></>}</td>
                      <td>{b.person.name}{b.partner && <><br /><small>+ {b.partner.name}</small></>}{!b.userId && <><br /><small>(비회원)</small></>}</td>
                      <td>{formatPhone(b.person.phone)}{b.partner && <><br /><small>{formatPhone(b.partner.phone)}</small></>}</td>
                      <td>{b.person.birth} / {b.person.sex === 'F' ? '여' : '남'}</td>
                      <td>{flags.length ? <span className="warn">{flags.join(' · ')}</span> : '-'}{b.survey.memo && <><br /><small>{b.survey.memo}</small></>}</td>
                      <td>{won(b.price)}</td>
                      <td>{b.status === 'confirmed' ? '확정' : '취소'}</td>
                      </>}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function Members({ q }: { q: string }) {
  const users = await listUsers();
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const list = term
    ? users.filter(u => u.name.toLowerCase().includes(term) || u.email.includes(term) || (digits.length >= 3 && u.phone.includes(digits)))
    : users;

  return (
    <>
      <div className="admin-bar">
        <p className="admin-stat">회원 {users.length}명{term && ` · 검색 결과 ${list.length}명`}</p>
        <form className="admin-search" action="/admin">
          <input type="hidden" name="tab" value="members" />
          <input name="q" defaultValue={q} placeholder="이름·이메일·전화번호" />
          <button className="btn btn-line">검색</button>
        </form>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>가입일</th><th>이름</th><th>이메일</th><th>휴대폰</th><th>생년월일/성별</th><th>예약</th><th>마케팅 수신</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}>회원이 없습니다.</td></tr>}
            {list.map(u => (
              <tr key={u.id}>
                <td>{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                <td><b>{u.name}</b></td>
                <td>{u.email}</td>
                <td>{formatPhone(u.phone)}</td>
                <td>{u.birth} / {u.sex === 'F' ? '여' : '남'}</td>
                <td>{u.bookingCount}건</td>
                <td>{u.marketing ? '동의' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function Admins({ me }: { me: Admin }) {
  const admins = await listAdmins();
  return (
    <>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>이름</th><th>이메일</th><th>권한</th><th>상태</th><th>최근 로그인</th><th>관리</th></tr>
          </thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.id} className={a.active ? '' : 'cancelled'}>
                <td><b>{a.name}</b></td>
                <td>{a.email}</td>
                <td>{a.role === 'owner' ? '대표' : '일반'}</td>
                <td>{a.active ? '사용 중' : '비활성'}</td>
                <td>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</td>
                <td><AdminRowActions id={a.id} active={a.active} role={a.role} isSelf={a.id === me.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NewAdminForm />
    </>
  );
}
