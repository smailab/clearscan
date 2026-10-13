'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { site } from '@/lib/data';

// 히어로 위에서는 파란 배경, 스크롤하면 흰 배경으로 전환. back이 있으면 뒤로가기 버튼을 보여준다
export default function Header({ solid = false, back }: { solid?: boolean; back?: string }) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(solid);

  useEffect(() => {
    if (solid) return;
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [solid]);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(back ?? '/');
  };

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}`}>
      <div className="header-left">
        {back && (
          <button type="button" className="back" aria-label="뒤로 가기" onClick={goBack}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 5 8 12l7 7" /></svg>
          </button>
        )}
        <Link className="logo" href="/">
          <span className="logo-mark" />
          {site.name}
        </Link>
      </div>
      <div className="header-right">
        <a className="tel" href={`tel:${site.phone}`}>{site.phone}</a>
        <Link href="/booking/lookup">예약조회</Link>
      </div>
    </header>
  );
}
