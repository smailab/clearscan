'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { APP_STATUS, MAX_SEATS, TIER_ID_RE, type AppStatus, type TierWithPrice } from '@/lib/memberships-shared';

const won = (n: number) => n.toLocaleString('ko-KR');

async function post(url: string, data: unknown): Promise<string | null> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json().catch(() => ({}));
  return res.ok ? null : json.error ?? '저장하지 못했습니다.';
}

// ---------- 가입 신청 ----------

export type AppRowData = {
  id: string; tierName: string; seats: number; contactTime: string; goals: string[]; memo: string; status: AppStatus;
  adminMemo: string; startedAt: string | null; expiresAt: string | null; createdAt: string; updatedAt: string; updatedBy: string | null;
  userName: string; userEmail: string; userPhone: string;
};

const NEXT: Record<AppStatus, AppStatus[]> = {
  requested: ['contacted', 'active', 'cancelled'],
  contacted: ['active', 'cancelled', 'requested'],
  active: ['cancelled'],
  cancelled: ['requested'],
};
const ACTION: Record<AppStatus, string> = { requested: '상담 대기로', contacted: '상담 시작', active: '가입 확정', cancelled: '취소 처리' };

export function ApplicationRow({ a, today }: { a: AppRowData; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState(a.adminMemo);
  const [start, setStart] = useState(a.startedAt ?? today);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const expired = a.status === 'active' && a.expiresAt !== null && a.expiresAt < today;

  async function save(status: AppStatus) {
    setBusy(true);
    setMsg('');
    const err = await post('/api/admin/memberships/applications', { id: a.id, status, adminMemo: memo, startedAt: start });
    setBusy(false);
    if (err) { setMsg(err); return; }
    setMsg('저장했습니다.');
    router.refresh();
  }

  const st = APP_STATUS[a.status];
  return (
    <>
      <tr className={`${a.status === 'cancelled' ? 'cancelled' : ''}${open ? ' re-open' : ''}`}>
        <td>{new Date(a.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
        <td><b>{a.userName}</b><br /><small>{a.userEmail}</small><br /><small>{a.userPhone}</small></td>
        <td><b>{a.tierName}</b>{a.seats > 1 && <><br /><small>{a.seats}인</small></>}</td>
        <td>{a.contactTime}</td>
        <td>{a.goals.length ? a.goals.join(', ') : '-'}{a.memo && <><br /><small>“{a.memo}”</small></>}</td>
        <td>
          <span className={`ms-status ${expired ? 'off' : st.tone}`}>{expired ? '만료' : st.label}</span>
          {a.status === 'active' && <><br /><small>{a.startedAt} ~ {a.expiresAt}</small></>}
          {a.updatedBy && <><br /><small>{a.updatedBy}</small></>}
        </td>
        <td>
          <button type="button" className="re-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>처리 {open ? '▴' : '▾'}</button>
        </td>
      </tr>
      {open && (
        <tr className="re-row">
          <td colSpan={7}>
            <div className="re-box">
              <div className="re-box-head"><b>멤버십 신청 처리</b><span>{a.userName} · {a.tierName}</span></div>
              <div className="re-grid-2">
                <label>상담 메모 <em>(관리자만 보임)</em>
                  <textarea rows={4} maxLength={1000} value={memo} onChange={e => setMemo(e.target.value)} placeholder="상담 내용, 결제 안내 여부, 검진 일정 등" />
                </label>
                <label>멤버십 시작일 <em>(가입 확정 시 적용, 1년)</em>
                  <input type="date" value={start} onChange={e => setStart(e.target.value)} />
                </label>
              </div>
              <div className="re-foot">
                <span className="admin-msg">{msg || '상태를 바꾸면 회원 내 페이지에 바로 반영됩니다.'}</span>
                <div className="re-actions">
                  <button type="button" className="btn btn-line" disabled={busy} onClick={() => save(a.status)}>메모 저장</button>
                  {NEXT[a.status].map(s => (
                    <button key={s} type="button" className={`btn ${s === 'active' ? 'btn-primary' : 'btn-line'}${s === 'cancelled' ? ' ms-danger' : ''}`} disabled={busy} onClick={() => save(s)}>
                      {ACTION[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- 티어 편집 ----------

type Form = { id: string; name: string; nameKo: string; tagline: string; description: string; price: string; seats: number; benefits: string; featured: boolean; active: boolean; sortOrder: string };

const toForm = (t?: TierWithPrice): Form => ({
  id: t?.id ?? '', name: t?.name ?? '', nameKo: t?.nameKo ?? '', tagline: t?.tagline ?? '', description: t?.description ?? '',
  price: t?.price != null ? String(t.price) : '', seats: t?.seats ?? 1, benefits: t?.benefits.join('\n') ?? '',
  featured: t?.featured ?? false, active: t?.active ?? true, sortOrder: String(t?.sortOrder ?? 100),
});

function TierForm({ initial, mode, onDone }: { initial?: TierWithPrice; mode: 'create' | 'update'; onDone?: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(toForm(initial));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg('');
    const err = await post('/api/admin/memberships', {
      mode,
      tier: { ...f, price: f.price === '' ? null : Number(f.price), sortOrder: Number(f.sortOrder) || 0, benefits: f.benefits.split('\n').map(s => s.trim()).filter(Boolean) },
    });
    setBusy(false);
    if (err) { setMsg(err); return; }
    setMsg('저장했습니다. 멤버십 페이지에 바로 반영됩니다.');
    if (mode === 'create') setF(toForm());
    router.refresh();
    onDone?.();
  }

  const ready = TIER_ID_RE.test(f.id) && f.name.trim().length >= 2 && f.nameKo.trim() && f.benefits.trim();
  return (
    <div className="re-box pe-box">
      <div className="re-box-head">
        <b>{mode === 'create' ? '새 멤버십 티어' : `티어 수정 · ${initial?.name}`}</b>
        {mode === 'update' && <span>티어 ID <code>{f.id}</code> (변경 불가)</span>}
      </div>
      <div className="pe-grid">
        {mode === 'create' && (
          <label>티어 ID <em>(영문 소문자·숫자·-)</em><input value={f.id} maxLength={31} onChange={e => setF({ ...f, id: e.target.value.toLowerCase() })} placeholder="예: private" /></label>
        )}
        <label>영문 이름<input value={f.name} maxLength={30} onChange={e => setF({ ...f, name: e.target.value.toUpperCase() })} placeholder="예: SIGNATURE" /></label>
        <label>한글 이름<input value={f.nameKo} maxLength={20} onChange={e => setF({ ...f, nameKo: e.target.value })} placeholder="예: 시그니처" /></label>
        <label>연 회비 (원) <em>(비우면 &lsquo;상담 후 안내&rsquo;)</em>
          <input value={f.price} inputMode="numeric" onChange={e => setF({ ...f, price: e.target.value.replace(/[^\d]/g, '') })} />
          {f.price && <small>{won(Number(f.price))}원 / 연</small>}
        </label>
        <label>기본 인원 <em>(2명 이상이면 가족형)</em>
          <select value={f.seats} onChange={e => setF({ ...f, seats: Number(e.target.value) })}>
            {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}명</option>)}
          </select>
        </label>
        <label>노출 순서 <em>(작을수록 앞)</em><input value={f.sortOrder} inputMode="numeric" onChange={e => setF({ ...f, sortOrder: e.target.value.replace(/[^\d-]/g, '') })} /></label>
      </div>
      <label>한 줄 소개<input value={f.tagline} maxLength={80} onChange={e => setF({ ...f, tagline: e.target.value })} /></label>
      <label>설명<textarea rows={2} maxLength={400} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
      <label>혜택 <em>(한 줄에 하나씩)</em><textarea rows={6} value={f.benefits} onChange={e => setF({ ...f, benefits: e.target.value })} /></label>
      <div className="re-foot">
        <div className="pe-flags">
          <label className="re-pub"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />공개 <small>(끄면 멤버십 페이지에서 숨김)</small></label>
          <label className="re-pub"><input type="checkbox" checked={f.featured} onChange={e => setF({ ...f, featured: e.target.checked })} />&lsquo;추천&rsquo; 표시</label>
        </div>
        <div className="re-actions">
          {msg && <span>{msg}</span>}
          {onDone && <button type="button" className="btn btn-line" onClick={onDone}>닫기</button>}
          <button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={save}>{busy ? '저장 중…' : mode === 'create' ? '티어 추가' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

export function TierRow({ t }: { t: TierWithPrice }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={`${t.active ? '' : 'cancelled'}${open ? ' re-open' : ''}`}>
        <td>{t.sortOrder}</td>
        <td><b>{t.name}</b> · {t.nameKo}{t.featured && <span className="pe-pop">추천</span>}<br /><small>{t.tagline}</small></td>
        <td>{t.price === null ? <small>상담 후 안내</small> : `${won(t.price)}원`}</td>
        <td>{t.seats}명</td>
        <td><small>{t.benefits.length}개</small></td>
        <td>{t.active ? '공개' : '숨김'}</td>
        <td><button type="button" className="re-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>수정 {open ? '▴' : '▾'}</button></td>
      </tr>
      {open && (
        <tr className="re-row"><td colSpan={7}><TierForm initial={t} mode="update" onDone={() => setOpen(false)} /></td></tr>
      )}
    </>
  );
}

export function NewTierBox() {
  const [open, setOpen] = useState(false);
  return open
    ? <div style={{ marginTop: 16 }}><TierForm mode="create" onDone={() => setOpen(false)} /></div>
    : <button type="button" className="btn btn-primary pe-new" onClick={() => setOpen(true)}>+ 새 멤버십 티어</button>;
}
