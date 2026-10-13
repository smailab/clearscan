'use client';

import { useState } from 'react';
import { organs } from '@/lib/data';

export default function OrganGuide() {
  const [sel, setSel] = useState(0);
  const o = organs[sel];

  return (
    <>
      <div className="organ-chips" role="tablist">
        {organs.map((org, i) => (
          <button key={org.name} type="button" role="tab" aria-selected={i === sel} className={i === sel ? 'on' : ''} onClick={() => setSel(i)}>
            {org.name}
          </button>
        ))}
      </div>
      <div className="organ-panel" role="tabpanel">
        <h3>{o.name} {o.badge && <span className="badge-sm">{o.badge}</span>}</h3>
        <p className="lbl">주요 확인 질환</p>
        <div className="pill-list">{o.diseases.map(d => <span key={d} className="pill strong">{d}</span>)}</div>
        <p className="lbl">관련 증상</p>
        <div className="pill-list">{o.symptoms.map(s => <span key={s} className="pill">{s}</span>)}</div>
      </div>
      <p className="note">※ 증상이 있다면 검진보다 먼저 진료를 받으세요.</p>
    </>
  );
}
