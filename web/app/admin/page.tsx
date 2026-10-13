import type { Metadata } from 'next';
import { adminToken, isAdmin } from '@/lib/booking/admin';
import { listBookings } from '@/lib/booking/service';
import { formatDateKo, formatPhone, getPlan, kstToday } from '@/lib/booking/schedule';
import { won } from '@/lib/data';
import AdminLogin, { AdminLogout } from '@/components/booking/AdminLogin';

export const metadata: Metadata = { title: '예약 관리 | 클리어스캔', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  if (!adminToken()) {
    return <div className="admin"><h1>예약 관리</h1><p>관리자 페이지를 쓰려면 <code>web/.env.local</code>에 <code>ADMIN_PASSWORD</code>를 설정하고 서버를 다시 시작하세요.</p></div>;
  }
  if (!(await isAdmin())) return <div className="admin"><h1>예약 관리</h1><AdminLogin /></div>;

  const { all } = await searchParams;
  const today = kstToday();
  const list = (await listBookings()).filter(b => all === '1' || b.date >= today);
  const confirmed = list.filter(b => b.status === 'confirmed');

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>예약 관리</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href={all === '1' ? '/admin' : '/admin?all=1'}>{all === '1' ? '예정 예약만' : '지난 예약 포함'}</a>
          <AdminLogout />
        </div>
      </div>
      <p className="admin-stat">확정 {confirmed.length}건 · 취소 {list.length - confirmed.length}건</p>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>일시</th><th>상품</th><th>예약자</th><th>연락처</th><th>생년월일/성별</th><th>문진</th><th>금액</th><th>상태</th><th>예약번호</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>예약이 없습니다.</td></tr>}
            {list.map(b => {
              const flags = [b.survey.metalImplant && '금속', b.survey.claustrophobia && '폐소', b.survey.pregnant && '임신'].filter(Boolean);
              return (
                <tr key={b.code} className={b.status === 'cancelled' ? 'cancelled' : ''}>
                  <td>{formatDateKo(b.date)}<br /><b>{b.time}</b></td>
                  <td>{getPlan(b.planId)?.name}{b.couple && <><br /><small>커플</small></>}</td>
                  <td>{b.person.name}{b.partner && <><br /><small>+ {b.partner.name}</small></>}</td>
                  <td>{formatPhone(b.person.phone)}{b.partner && <><br /><small>{formatPhone(b.partner.phone)}</small></>}</td>
                  <td>{b.person.birth} / {b.person.sex === 'F' ? '여' : '남'}</td>
                  <td>{flags.length ? <span className="warn">{flags.join(' · ')}</span> : '-'}{b.survey.memo && <><br /><small>{b.survey.memo}</small></>}</td>
                  <td>{won(b.price)}</td>
                  <td>{b.status === 'confirmed' ? '확정' : '취소'}</td>
                  <td><code>{b.code}</code></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
