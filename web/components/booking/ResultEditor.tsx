'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Status = 'normal' | 'followup' | 'detail';
type Initial = { status: Status; summary: string; findings: string; recommendation: string; published: boolean } | null;

const LABEL: Record<Status, string> = { normal: '정상', followup: '추적 관찰', detail: '정밀검사 권고' };

// 관리자: 예약별 검사 결과 입력(텍스트). '회원에게 공개'를 체크해야 내 페이지에 보인다
export default function ResultEditor({ code, initial }: { code: string; initial: Initial }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(initial ?? { status: 'normal' as Status, summary: '', findings: '', recommendation: '', published: false });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, ...f }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json.error ?? '저장하지 못했습니다.'); return; }
    setMsg('저장했습니다.');
    router.refresh();
  }

  return (
    <div className="re">
      <button type="button" className={`re-toggle ${initial ? (initial.published ? 'pub' : 'draft') : ''}`} onClick={() => setOpen(o => !o)}>
        {initial ? `${LABEL[initial.status]}${initial.published ? ' · 공개' : ' · 미공개'}` : '결과 입력'}
      </button>
      {open && (
        <div className="re-form">
          <label>판정
            <select value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}>
              {(Object.keys(LABEL) as Status[]).map(s => <option key={s} value={s}>{LABEL[s]}</option>)}
            </select>
          </label>
          <label>결과 요약 (필수)
            <input value={f.summary} maxLength={500} onChange={e => setF({ ...f, summary: e.target.value })} placeholder="예: 특이 소견 없음" />
          </label>
          <label>판독 소견
            <textarea rows={4} maxLength={5000} value={f.findings} onChange={e => setF({ ...f, findings: e.target.value })} />
          </label>
          <label>권고 사항
            <textarea rows={3} maxLength={2000} value={f.recommendation} onChange={e => setF({ ...f, recommendation: e.target.value })} />
          </label>
          <label className="re-pub"><input type="checkbox" checked={f.published} onChange={e => setF({ ...f, published: e.target.checked })} />회원에게 공개</label>
          <div className="re-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !f.summary.trim()} onClick={save}>{busy ? '저장 중…' : '저장'}</button>
            {msg && <span>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
