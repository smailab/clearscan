'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 가로 스크롤 목록 — 휴대폰은 손가락으로 밀고, PC는 좌우 화살표 버튼이나 마우스 휠로 넘긴다.
// 휠은 목록 위에서만 가로로 바꾸고, 끝에 닿으면 원래대로 페이지가 세로로 스크롤된다.
export default function HScroll({ children, label }: { children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // 세로 휠 → 가로 스크롤 (가로로 더 갈 수 있을 때만)
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // 트랙패드 가로 제스처는 그대로
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: 'auto' });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, [update, children]);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const card = first ? first.getBoundingClientRect().width + 8 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * Math.max(card, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  return (
    <div className="hs-wrap">
      <div className="hscroll" ref={ref} onScroll={update} role="list" aria-label={label}>
        {children}
      </div>
      {!edge.start && <button type="button" className="hs-nav prev" aria-label="이전" onClick={() => step(-1)}>‹</button>}
      {!edge.end && <button type="button" className="hs-nav next" aria-label="다음" onClick={() => step(1)}>›</button>}
    </div>
  );
}
