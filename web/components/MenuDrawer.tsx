'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { site } from '@/lib/data';
import Logo from './Logo';
import { LineCalendar, LineCard, LineCrown, LineHelp, LineHome, LinePen, LinePin, LineScan } from './icons';

const LINKS = [
  { href: '/', label: '홈', Icon: LineHome },
  { href: '/membership', label: '멤버십 가입', Icon: LineCrown },
  { href: '/booking', label: '검진 예약', Icon: LineCalendar },
  { href: '/#plans', label: '검진 상품 · 요금', Icon: LineCard },
  { href: '/how-it-works', label: '이용 방법 · 검사 장기', Icon: LineScan },
  { href: '/centers', label: '검진 센터', Icon: LinePin },
  { href: '/posts', label: '건강 칼럼', Icon: LinePen },
  { href: '/#faq', label: '자주 묻는 질문', Icon: LineHelp },
];

// 헤더 오른쪽 햄버거 버튼 + 오른쪽에서 열리는 바로가기 메뉴
export default function MenuDrawer({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // 열려 있는 동안 뒤 화면 스크롤 잠금 + ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setOpen(false);
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <button type="button" className="hamburger" aria-label="메뉴 열기" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(true)}>
        <span /><span /><span />
      </button>

      {open && (
        <div className="drawer-bg" onClick={() => setOpen(false)}>
          <div className="drawer-frame">
          <nav id="site-menu" className="drawer" aria-label="바로가기 메뉴" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <Link href="/" className="drawer-logo" onClick={() => setOpen(false)}><Logo size={28} /></Link>
              <button type="button" className="drawer-close" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="drawer-member">
              {loggedIn ? (
                <>
                  <Link href="/my" className="btn btn-primary" onClick={() => setOpen(false)}>내 페이지</Link>
                  <button type="button" className="btn btn-line" onClick={logout}>로그아웃</button>
                </>
              ) : (
                <>
                  <Link href="/signup" className="btn btn-primary" onClick={() => setOpen(false)}>회원가입</Link>
                  <Link href="/login" className="btn btn-line" onClick={() => setOpen(false)}>로그인</Link>
                </>
              )}
            </div>

            <ul className="drawer-links">
              {LINKS.map(l => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)}>
                    <span className="ic" aria-hidden="true"><l.Icon /></span>{l.label}<span className="chev" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>

            <a className="drawer-call" href={`tel:${site.phone}`}>
              <span>상담 전화</span>
              <b>{site.phone}</b>
            </a>
          </nav>
          </div>
        </div>
      )}
    </>
  );
}
