import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin, listAdmins, type Admin } from '@/lib/auth/admins';
import { listBookings } from '@/lib/booking/service';
import { allResults } from '@/lib/booking/results';
import { formatDateKo, formatPhone, kstToday } from '@/lib/booking/schedule';
import { listProducts, productNames } from '@/lib/products';
import { describeDiscount, listCoupons } from '@/lib/coupons';
import { NewProductBox, ProductRow } from '@/components/admin/ProductEditor';
import { CouponToggle, IssueCouponBox } from '@/components/admin/CouponParts';
import { CenterRow, NewCenterBox } from '@/components/admin/CenterEditor';
import { NewPostBox, PostRow } from '@/components/admin/PostEditor';
import { listPosts } from '@/lib/posts';
import { listCenters } from '@/lib/centers';
import { listUsers } from '@/lib/auth/members';
import { won } from '@/lib/data';
import { AdminLogout, AdminRowActions, ChangePasswordForm, NewAdminForm } from '@/components/admin/AdminParts';
import BookingResultRow from '@/components/booking/ResultEditor';

export const metadata: Metadata = { title: '관리자 | THOR SCAN LONGEVITY', robots: { index: false } };
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
        <a href="/admin?tab=products" className={tab === 'products' ? 'on' : ''}>상품 관리</a>
        <a href="/admin?tab=coupons" className={tab === 'coupons' ? 'on' : ''}>쿠폰</a>
        <a href="/admin?tab=centers" className={tab === 'centers' ? 'on' : ''}>검진 센터</a>
        <a href="/admin?tab=posts" className={tab === 'posts' ? 'on' : ''}>건강 칼럼</a>
        <a href="/admin?tab=members" className={tab === 'members' ? 'on' : ''}>회원 관리</a>
        {admin.role === 'owner' && <a href="/admin?tab=admins" className={tab === 'admins' ? 'on' : ''}>관리자 계정</a>}
        <a href="/admin?tab=account" className={tab === 'account' ? 'on' : ''}>내 계정</a>
      </nav>
      {tab === 'members' ? <Members q={q} />
        : tab === 'products' ? <Products owner={admin.role === 'owner'} />
        : tab === 'coupons' ? <Coupons />
        : tab === 'centers' ? <Centers owner={admin.role === 'owner'} />
        : tab === 'posts' ? <Posts />
        : tab === 'admins' && admin.role === 'owner' ? <Admins me={admin} />
        : tab === 'account' ? <ChangePasswordForm />
        : <Bookings all={all === '1'} />}
    </div>
  );
}

async function Bookings({ all }: { all: boolean }) {
  const today = kstToday();
  const [bookings, results, names] = await Promise.all([listBookings(), allResults(), productNames()]);
  const list = bookings.filter(b => all || b.date >= today || (b.status === 'confirmed' && !results.get(b.code)?.published));
  const confirmed = list.filter(b => b.status === 'confirmed');
  const groupSize = new Map<string, number>();
  for (const b of bookings) if (b.groupCode) groupSize.set(b.groupCode, (groupSize.get(b.groupCode) ?? 0) + 1);

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
                  summaryLabel={`${formatDateKo(b.date)} ${b.time} · ${b.planName ?? names.get(b.planId) ?? b.planId} · ${b.person.name}`}
                  reschedule={b.status === 'confirmed' ? {
                    date: b.date,
                    time: b.time,
                    history: (b.history ?? []).map(h =>
                      `${new Date(h.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${h.by} · ${h.from.date} ${h.from.time} → ${h.to.date} ${h.to.time}`),
                  } : undefined}
                  cells={<>
                      <td>{formatDateKo(b.date)}<br /><b>{b.time}</b><br /><code>{b.code}</code>{b.history?.length ? <><br /><span className="grp">일정 변경됨</span></> : null}</td>
                      <td>
                        {b.planName ?? names.get(b.planId) ?? b.planId}{b.couple && <><br /><small>커플</small></>}
                        {b.items && b.items.length > 1 && <><br /><small>{b.items.map(it => `${it.start} ${it.planName}`).join(' → ')}</small></>}
                        {b.groupCode && <><br /><span className="grp" title="같은 신청에서 함께 예약한 검사">함께 예약 {groupSize.get(b.groupCode)}건 · {b.groupCode}</span></>}
                      </td>
                      <td>{b.person.name}{b.partner && <><br /><small>+ {b.partner.name}</small></>}{!b.userId && <><br /><small>(비회원)</small></>}</td>
                      <td>{formatPhone(b.person.phone)}{b.partner && <><br /><small>{formatPhone(b.partner.phone)}</small></>}</td>
                      <td>{b.person.birth} / {b.person.sex === 'F' ? '여' : '남'}</td>
                      <td>{flags.length ? <span className="warn">{flags.join(' · ')}</span> : '-'}{b.survey.memo && <><br /><small>{b.survey.memo}</small></>}</td>
                      <td>{won(b.price)}{b.couponCode && <><br /><small>쿠폰 −{won(b.discount ?? 0)}</small></>}</td>
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

async function Products({ owner }: { owner: boolean }) {
  const products = await listProducts({ includeInactive: true });
  return (
    <>
      <div className="admin-bar">
        <p className="admin-stat">상품 {products.length}개 · 판매 중 {products.filter(p => p.active).length}개 — 수정하면 사이트·예약에 바로 반영됩니다. 잠시 숨기려면 판매 중지를, 완전히 없애려면 삭제(대표 관리자)를 쓰세요. 예정된 예약이 있는 상품은 삭제할 수 없습니다.</p>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>순서</th><th>이미지</th><th>상품</th><th>가격</th><th>커플 할인</th><th>점유 시간</th><th>상태</th><th>관리</th></tr>
          </thead>
          <tbody>
            {products.map(p => <ProductRow key={p.id} p={p} canDelete={owner} />)}
          </tbody>
        </table>
      </div>
      <NewProductBox />
    </>
  );
}

async function Coupons() {
  const [coupons, products] = await Promise.all([listCoupons(), listProducts({ includeInactive: true })]);
  const names = new Map(products.map(p => [p.id, p.name]));
  const today = kstToday();
  return (
    <>
      <IssueCouponBox products={products.map(p => ({ id: p.id, name: p.name + (p.active ? '' : ' (판매 중지)') }))} />
      <div className="admin-bar" style={{ marginTop: 24 }}>
        <p className="admin-stat">발급된 쿠폰 {coupons.length}개 · 사용 {coupons.reduce((n, c) => n + c.usedCount, 0)}회</p>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>코드</th><th>쿠폰</th><th>적용 상품</th><th>할인</th><th>기간</th><th>사용</th><th>대상</th><th>상태</th></tr>
          </thead>
          <tbody>
            {coupons.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>발급된 쿠폰이 없습니다.</td></tr>}
            {coupons.map(c => {
              const expired = c.validUntil < today;
              const soldOut = c.maxUses !== null && c.usedCount >= c.maxUses;
              return (
                <tr key={c.code} className={!c.active || expired ? 'cancelled' : ''}>
                  <td><code>{c.code}</code></td>
                  <td><b>{c.name}</b>{c.memo && <><br /><small>{c.memo}</small></>}<br /><small>{c.createdBy} · {new Date(c.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</small></td>
                  <td>{c.productId ? names.get(c.productId) ?? c.productId : '전체 상품'}</td>
                  <td>{describeDiscount(c)}</td>
                  <td>{c.validFrom}<br />~ {c.validUntil}</td>
                  <td>{c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ' / 무제한'}</td>
                  <td>{c.userEmail ? <>{c.userName}<br /><small>{c.userEmail}</small></> : '누구나'}</td>
                  <td>
                    {expired ? '기간 만료' : soldOut ? '소진' : c.active ? '사용 가능' : '중지'}
                    {!expired && <div style={{ marginTop: 6 }}><CouponToggle code={c.code} active={c.active} /></div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function Centers({ owner }: { owner: boolean }) {
  const [centers, products] = await Promise.all([listCenters({ includeInactive: true }), listProducts({ includeInactive: true })]);
  const productOptions = products.map(p => ({ id: p.id, name: p.name + (p.active ? '' : ' (판매 중지)') }));
  return (
    <>
      <div className="admin-bar">
        <p className="admin-stat">검진 센터 {centers.length}곳 · 공개 {centers.filter(c => c.active).length}곳 — 수정하면 홈·센터 페이지에 바로 반영됩니다. 잠시 숨기려면 &lsquo;공개&rsquo;를 끄세요.</p>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>순서</th><th>사진</th><th>센터</th><th>주소·전화</th><th>의료진</th><th>검진 상품</th><th>상태</th><th>관리</th></tr>
          </thead>
          <tbody>
            {centers.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>등록된 센터가 없습니다.</td></tr>}
            {centers.map(c => (
              <CenterRow
                key={c.id}
                c={c}
                canDelete={owner}
                products={productOptions}
                meta={c.updatedBy ? `${c.updatedBy} · ${new Date(c.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>
      <NewCenterBox products={productOptions} />
    </>
  );
}

async function Posts() {
  const posts = await listPosts({ includeDrafts: true });
  return (
    <>
      <div className="admin-bar">
        <p className="admin-stat">글 {posts.length}개 · 공개 {posts.filter(p => p.status === 'published').length}개 — 공개한 글은 메인 &lsquo;왜 전신 MRI인가요?&rsquo;와 /posts에 최신순으로 보입니다.</p>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>이미지</th><th>제목</th><th>상태</th><th>공개일</th><th>최근 수정</th><th>관리</th></tr>
          </thead>
          <tbody>
            {posts.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>아직 글이 없습니다. 아래에서 첫 글을 써 보세요.</td></tr>}
            {posts.map(p => <PostRow key={p.id} p={p} />)}
          </tbody>
        </table>
      </div>
      <NewPostBox />
    </>
  );
}
