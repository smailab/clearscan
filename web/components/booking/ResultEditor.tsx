'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Status = 'normal' | 'followup' | 'detail';
export type ResultInitial = { status: Status; summary: string; findings: string; recommendation: string; published: boolean } | null;

const LABEL: Record<Status, string> = { normal: '정상', followup: '추적 관찰', detail: '정밀검사 권고' };

type Props = {
  code: string;
  colSpan: number;
  cells: React.ReactNode;          // 예약 정보 칸들 (서버에서 렌더링)
  rowClassName?: string;
  editable: boolean;               // 회원 예약 + 확정 상태일 때만 결과 입력 가능
  initial: ResultInitial;
  meta?: string;                   // 마지막 수정자 · 시각
  summaryLabel: string;            // 예: "2026년 10월 21일 10:00 · 연간 MRI · 홍길동"
  reschedule?: { date: string; time: string; history: string[] }; // 확정 예약이면 일정 변경 가능
};

// 관리자 예약 표의 한 줄 + 그 아래 표 전체 폭으로 펼쳐지는 검사 결과 입력 / 일정 변경 박스
export default function BookingResultRow({ code, colSpan, cells, rowClassName, editable, initial, meta, summaryLabel, reschedule }: Props) {
  const router = useRouter();
  const [panel, setPanel] = useState<'result' | 'time' | null>(null);
  const open = panel === 'result';
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setPanel(p => ((typeof v === 'function' ? v(p === 'result') : v) ? 'result' : null));
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
    setMsg(f.published ? '저장했습니다. 회원 내 페이지에 공개됩니다.' : '초안으로 저장했습니다. 회원에게는 보이지 않습니다.');
    router.refresh();
  }

  return (
    <>
      <tr className={`${rowClassName ?? ''}${panel ? ' re-open' : ''}`}>
        {cells}
        <td>
          {editable ? (
            <>
              <button type="button" className={`re-toggle ${initial ? (initial.published ? 'pub' : 'draft') : ''}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
                {initial ? `${LABEL[initial.status]}${initial.published ? ' · 공개' : ' · 미공개'}` : '결과 입력'} {open ? '▴' : '▾'}
              </button>
              {meta && <small className="admin-msg">{meta}</small>}
            </>
          ) : <small>-</small>}
          {reschedule && (
            <button type="button" className="re-toggle rs-toggle" aria-expanded={panel === 'time'} onClick={() => setPanel(p => (p === 'time' ? null : 'time'))}>
              시간 변경 {panel === 'time' ? '▴' : '▾'}
            </button>
          )}
        </td>
      </tr>
      {reschedule && panel === 'time' && (
        <tr className="re-row">
          <td colSpan={colSpan}>
            <RescheduleBox code={code} summaryLabel={summaryLabel} {...reschedule} onClose={() => setPanel(null)} />
          </td>
        </tr>
      )}
      {editable && open && (
        <tr className="re-row">
          <td colSpan={colSpan}>
            <div className="re-box">
              <div className="re-box-head">
                <b>검사 결과 입력</b>
                <span>{summaryLabel} · <code>{code}</code></span>
              </div>

              <div className="re-grid-top">
                <label>판정
                  <div className="re-status">
                    {(Object.keys(LABEL) as Status[]).map(s => (
                      <button key={s} type="button" className={`${s}${f.status === s ? ' on' : ''}`} onClick={() => setF({ ...f, status: s })}>{LABEL[s]}</button>
                    ))}
                  </div>
                </label>
                <label>결과 요약 <em>(필수 · 회원 목록에 표시)</em>
                  <input value={f.summary} maxLength={500} onChange={e => setF({ ...f, summary: e.target.value })} placeholder="예: 특이 소견 없음 / 갑상선 우측 5mm 결절, 추적 관찰 필요" />
                </label>
              </div>

              <div className="re-grid-2">
                <label>판독 소견
                  <textarea rows={8} maxLength={5000} value={f.findings} onChange={e => setF({ ...f, findings: e.target.value })} placeholder="장기별 판독 내용을 자세히 입력하세요." />
                  <small>{f.findings.length} / 5000</small>
                </label>
                <label>권고 사항
                  <textarea rows={8} maxLength={2000} value={f.recommendation} onChange={e => setF({ ...f, recommendation: e.target.value })} placeholder="예: 6개월 후 갑상선 초음파 재검사 권장" />
                  <small>{f.recommendation.length} / 2000</small>
                </label>
              </div>

              <div className="re-foot">
                <label className="re-pub"><input type="checkbox" checked={f.published} onChange={e => setF({ ...f, published: e.target.checked })} />회원에게 공개 <small>(체크하지 않으면 초안으로 저장)</small></label>
                <div className="re-actions">
                  {msg && <span>{msg}</span>}
                  <button type="button" className="btn btn-line" onClick={() => setOpen(false)}>닫기</button>
                  <button type="button" className="btn btn-primary" disabled={busy || !f.summary.trim()} onClick={save}>{busy ? '저장 중…' : '저장'}</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

type Slot = { time: string; available: boolean };

// 관리자 일정 변경: 날짜를 고르면 옮길 수 있는 시간이 나온다 (이 예약이 쓰던 시간은 빈 것으로 표시)
function RescheduleBox({ code, summaryLabel, date: curDate, time: curTime, history, onClose }: {
  code: string; summaryLabel: string; date: string; time: string; history: string[]; onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(curDate);
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTime('');
    setSlots(null);
    if (!date) return;
    let alive = true;
    fetch(`/api/admin/bookings/reschedule?code=${encodeURIComponent(code)}&date=${date}`)
      .then(r => r.json())
      .then(d => { if (alive) setSlots(d.slots ?? []); })
      .catch(() => { if (alive) setSlots([]); });
    return () => { alive = false; };
  }, [code, date]);

  async function save() {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/bookings/reschedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, date, time }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json.error ?? '변경하지 못했습니다.'); return; }
    onClose();
    router.refresh();
  }

  return (
    <div className="re-box">
      <div className="re-box-head">
        <b>예약 시간 변경</b>
        <span>{summaryLabel} · <code>{code}</code></span>
      </div>
      <div className="rs-grid">
        <label>날짜
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <div className="rs-times-wrap">
          <span className="rs-label">시간 <em>(현재 {curDate} {curTime})</em></span>
          {!date ? <p className="admin-msg">날짜를 선택하세요.</p>
            : slots === null ? <p className="admin-msg">불러오는 중…</p>
            : slots.length === 0 ? <p className="admin-msg">운영하지 않는 날이거나 바꿀 수 없는 날짜입니다.</p>
            : (
              <div className="rs-times">
                {slots.map(s => {
                  const current = date === curDate && s.time === curTime;
                  return (
                    <button key={s.time} type="button" disabled={!s.available || current} className={`${time === s.time ? 'on' : ''}${current ? ' cur' : ''}`}
                      title={current ? '지금 예약된 시간' : !s.available ? '다른 예약이 있음' : undefined} onClick={() => setTime(s.time)}>
                      {s.time}
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      </div>
      {history.length > 0 && (
        <ul className="rs-history">{history.map(h => <li key={h}>{h}</li>)}</ul>
      )}
      <div className="re-foot">
        <span className="admin-msg">{time ? `${curDate} ${curTime} → ${date} ${time} 로 변경합니다. 회원 내 페이지에도 바로 반영됩니다.` : '바꿀 시간을 선택하세요.'}</span>
        <div className="re-actions">
          {msg && <span className="rs-err">{msg}</span>}
          <button type="button" className="btn btn-line" onClick={onClose}>닫기</button>
          <button type="button" className="btn btn-primary" disabled={busy || !time} onClick={save}>{busy ? '변경 중…' : '시간 변경'}</button>
        </div>
      </div>
    </div>
  );
}
