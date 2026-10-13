'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Center } from '@/lib/data';
import { dayOfWeek, kstToday } from '@/lib/booking/schedule';

// 사진 갤러리: 스와이프/스크롤 + 좌우 버튼 + 1/N 표시
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const go = (n: number) => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(images.length - 1, n));
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="ct-gallery">
      <div className="ct-track" ref={ref} onScroll={e => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {images.map((src, i) => (
          <div className="ct-slide" key={src}>
            <Image src={src} alt={`${name} 사진 ${i + 1}`} fill sizes="(max-width: 500px) 100vw, 500px" priority={i === 0} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" className="ct-nav prev" aria-label="이전 사진" disabled={idx === 0} onClick={() => go(idx - 1)}>‹</button>
          <button type="button" className="ct-nav next" aria-label="다음 사진" disabled={idx === images.length - 1} onClick={() => go(idx + 1)}>›</button>
          <span className="ct-count">{idx + 1} / {images.length}</span>
        </>
      )}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ct-copy"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* 클립보드 권한 없음 */ }
      }}
    >
      {done ? '복사됨' : '복사'}
    </button>
  );
}

// 오늘 운영시간을 보여주고, 누르면 전체 운영시간을 펼친다 (요일은 한국 시간 기준)
export function Hours({ hours }: { hours: Center['hours'] }) {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<string | null>(null);

  // hours 순서: [평일, 토요일, 일요일]
  useEffect(() => {
    const dow = dayOfWeek(kstToday());
    const row = dow === 0 ? hours[2] : dow === 6 ? hours[1] : hours[0];
    setToday(row ? row.value + (row.note ? ` (${row.note})` : '') : null);
  }, [hours]);

  return (
    <div className="ct-hours">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span><b>오늘</b> {today ?? hours[0].value}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <dl>
          {hours.map(h => <div key={h.label}><dt>{h.label}</dt><dd>{h.value}{h.note && <small>{h.note}</small>}</dd></div>)}
        </dl>
      )}
    </div>
  );
}

// 섹션 이동 탭 — 스크롤 위치에 따라 활성 탭이 바뀐다
export function SectionTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const [active, setActive] = useState(tabs[0].id);

  useEffect(() => {
    const onScroll = () => {
      let cur = tabs[0].id;
      for (const t of tabs) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top <= 120) cur = t.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [tabs]);

  return (
    <nav className="ct-tabs">
      {tabs.map(t => (
        <a key={t.id} href={`#${t.id}`} className={active === t.id ? 'on' : ''}>{t.label}</a>
      ))}
    </nav>
  );
}
