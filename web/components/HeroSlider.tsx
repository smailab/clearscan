'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { slides } from '@/lib/data';

const INTERVAL = 4000;

export default function HeroSlider() {
  const [idx, setIdx] = useState(0);
  const startX = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const restart = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setIdx(i => (i + 1) % slides.length), INTERVAL);
  }, []);

  useEffect(() => {
    restart();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [restart]);

  const go = (n: number) => {
    setIdx((n + slides.length) % slides.length);
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
        {slides.map((s, i) => (
          <div className="slide" key={s.l2} aria-hidden={i !== idx}>
            <div className="slide-copy">
              <p className="eyebrow">{s.eyebrow}</p>
              <p className="l1">{s.l1}</p>
              <p className="l2">{s.l2}</p>
            </div>
            <div className="slide-art">
              <Image src={s.image} alt={s.alt} fill sizes="168px" priority={i === 0} draggable={false} />
              <span className="scan-line" />
            </div>
          </div>
        ))}
      </div>
      <div className="dots">
        {slides.map((s, i) => (
          <button key={s.l2} type="button" className={i === idx ? 'on' : ''} aria-label={`${i + 1}번 슬라이드`} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}
