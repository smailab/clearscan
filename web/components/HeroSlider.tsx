'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { slides } from '@/lib/data';
import { LogoMark } from './Logo';

const INTERVAL = 4500;

// THOR 브랜드 슬라이드 (이미지 대신 HTML로 그려서 어느 화면에서나 선명하게)
const ACRONYM = [
  { l: 'T', w: 'Total' },
  { l: 'H', w: 'Health' },
  { l: 'O', w: 'Optimization' },
  { l: 'R', w: 'Rejuvenation' },
];

function BrandSlide() {
  return (
    <div className="brand-slide" role="img" aria-label="THOR SCAN — Total Health Optimization & Rejuvenation, 통합적 건강 최적화와 건강 수명 관리">
      <span className="bs-scan" aria-hidden="true" />
      <p className="bs-eyebrow">PRECISION LONGEVITY · PREVENTIVE MEDICINE</p>
      <p className="bs-title"><LogoMark size={30} /> THOR SCAN</p>
      <ul className="bs-acronym" aria-hidden="true">
        {ACRONYM.map(a => (
          <li key={a.l}><b>{a.l}</b><span>—</span>{a.w}</li>
        ))}
      </ul>
      <p className="bs-en">Total Health Optimization &amp; Rejuvenation</p>
      <p className="bs-ko">통합적 건강 최적화와 건강 수명 관리</p>
    </div>
  );
}

export default function HeroSlider() {
  const total = slides.length + 1; // 브랜드 슬라이드 + 기존 슬라이드
  const [idx, setIdx] = useState(0);
  const startX = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const restart = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setIdx(i => (i + 1) % total), INTERVAL);
  }, [total]);

  useEffect(() => {
    restart();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [restart]);

  const go = (n: number) => {
    setIdx((n + total) % total);
    restart();
  };

  return (
    <div
      className="slider"
      onPointerDown={e => { startX.current = e.clientX; }}
      onPointerUp={e => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
        startX.current = null;
      }}
    >
      <div className="slides" style={{ transform: `translateX(-${idx * 100}%)` }}>
        <div className="slide slide-brand" aria-hidden={idx !== 0}>
          <BrandSlide />
        </div>
        {slides.map((s, i) => (
          <div className="slide" key={s.l2} aria-hidden={i + 1 !== idx}>
            <div className="slide-copy">
              <p className="eyebrow">{s.eyebrow}</p>
              <p className="l1">{s.l1}</p>
              <p className="l2">{s.l2}</p>
            </div>
            <div className="slide-art">
              <Image src={s.image} alt={s.alt} fill sizes="168px" draggable={false} />
              <span className="scan-line" />
            </div>
          </div>
        ))}
      </div>
      <div className="dots">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} type="button" className={i === idx ? 'on' : ''} aria-label={`${i + 1}번 슬라이드`} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}
