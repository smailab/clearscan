'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { plans, won, site, type Plan } from '@/lib/data';
import { Chevron } from './icons';

export default function Plans() {
  const [kind, setKind] = useState<Plan['kind']>('MRI');
  const [open, setOpen] = useState<Plan | null>(null);

  // 시트가 열려 있는 동안 배경 스크롤 잠금 + ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <div className="sec-head">
        <h2>검진 상품</h2>
        <div className="tabs" role="tablist">
          {(['MRI', 'CT'] as const).map(k => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={`tab${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
              {k} 검진
            </button>
          ))}
        </div>
      </div>
      <p className="sec-sub">내 몸속을 더 넓고 자세하게, 나에게 맞는 검진을 고르세요.</p>

      <div className="hscroll">
        {plans.filter(p => p.kind === kind).map(p => (
          <button key={p.id} type="button" className={`pcard${p.featured ? ' featured' : ''}`} onClick={() => setOpen(p)}>
            <div className="thumb">
              {p.featured && <span className="badge-pop">가장 인기</span>}
              <Image src={p.image} alt="" fill sizes="168px" />
            </div>
            <div className="body">
              <span className="name">{p.name}</span>
              <span className="time">{p.time}</span>
              <span className="price">{won(p.price)}<small>원</small></span>
              <span className="detail">구성 자세히 보기 ›</span>
            </div>
          </button>
        ))}
      </div>
      <p className="note">※ 가격은 원화 환산 예시(VAT 포함)입니다. 검진 결과는 진단이 아니며, 이상 소견이 있으면 전문 진료가 필요할 수 있습니다.</p>

      {open && (
        <div className="sheet-bg" onClick={() => setOpen(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={open.name} onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h3>{open.name}</h3>
            <p className="time">{open.time}</p>
            <p className="desc">{open.desc}</p>
            <p className="price">{won(open.price)}<small>원</small></p>
            {open.groups.map(g => (
              <div key={g.label} className={`grp${g.excluded ? ' ex' : ''}`}>
                <h4>{g.label}</h4>
                <ul>{g.items.map(it => <li key={it}>{it}</li>)}</ul>
              </div>
            ))}
            <div className="actions">
              <button type="button" className="btn btn-line" onClick={() => setOpen(null)}>닫기</button>
              <Link className="btn btn-primary" href={`/booking?plan=${open.id}`}>{open.name} 예약하기 <Chevron /></Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
