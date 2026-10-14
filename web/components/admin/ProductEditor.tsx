'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PRODUCT_ID_RE, PRODUCT_IMAGES, type PlanGroup, type ProductWithPrice } from '@/lib/products-shared';

type Form = {
  id: string; kind: 'MRI' | 'CT'; name: string; time: string; desc: string; price: string; coupleDiscount: string;
  slots: number; featured: boolean; image: string; groups: PlanGroup[]; active: boolean; sortOrder: string;
};

const toForm = (p?: ProductWithPrice): Form => ({
  id: p?.id ?? '', kind: p?.kind ?? 'MRI', name: p?.name ?? '', time: p?.time ?? '', desc: p?.desc ?? '',
  price: p ? String(p.price) : '', coupleDiscount: p?.coupleDiscount != null ? String(p.coupleDiscount) : '',
  slots: p?.slots ?? 1, featured: p?.featured ?? false, image: p?.image ?? PRODUCT_IMAGES[0],
  groups: p?.groups?.length ? p.groups : [{ label: '검사 부위', items: [] }, { label: '제외 부위', items: [], excluded: true }],
  active: p?.active ?? true, sortOrder: String(p?.sortOrder ?? 100),
});

const won = (n: number) => n.toLocaleString('ko-KR');

// 상품 편집 박스 (새 상품 추가 / 기존 상품 수정 공용)
function ProductForm({ initial, mode, onDone }: { initial?: ProductWithPrice; mode: 'create' | 'update'; onDone?: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(toForm(initial));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const setGroup = (i: number, g: Partial<PlanGroup>) => setF({ ...f, groups: f.groups.map((x, j) => (j === i ? { ...x, ...g } : x)) });

  async function save() {
    setBusy(true);
    setMsg('');
    const product = {
      ...f,
      price: Number(f.price.replace(/[^\d]/g, '')),
      coupleDiscount: f.coupleDiscount.trim() === '' ? null : Number(f.coupleDiscount.replace(/[^\d]/g, '')),
      sortOrder: Number(f.sortOrder) || 0,
      groups: f.groups.map(g => ({ ...g, items: g.items.map(s => s.trim()).filter(Boolean) })),
    };
    const res = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, product }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json.error ?? '저장하지 못했습니다.'); return; }
    setMsg('저장했습니다. 사이트에 바로 반영됩니다.');
    if (mode === 'create') setF(toForm());
    router.refresh();
    onDone?.();
  }

  const idOk = PRODUCT_ID_RE.test(f.id);
  const ready = idOk && f.name.trim().length >= 2 && /^\d[\d,]*$/.test(f.price) && f.image;

  return (
    <div className="re-box pe-box">
      <div className="re-box-head">
        <b>{mode === 'create' ? '새 상품 추가' : `상품 수정 · ${initial?.name}`}</b>
        {mode === 'update' && <span>상품 ID <code>{f.id}</code> (변경 불가)</span>}
      </div>

      <div className="pe-grid">
        {mode === 'create' && (
          <label>상품 ID <em>(영문 소문자·숫자·-, 예약 주소에 쓰임)</em>
            <input value={f.id} maxLength={31} onChange={e => setF({ ...f, id: e.target.value.toLowerCase() })} placeholder="예: brain-mri" />
          </label>
        )}
        <label>구분
          <div className="re-status">
            {(['MRI', 'CT'] as const).map(k => (
              <button key={k} type="button" className={`normal${f.kind === k ? ' on' : ''}`} onClick={() => setF({ ...f, kind: k })}>{k}</button>
            ))}
          </div>
        </label>
        <label>상품명<input value={f.name} maxLength={40} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <label>촬영 시간 문구<input value={f.time} maxLength={40} onChange={e => setF({ ...f, time: e.target.value })} placeholder="예: 촬영 약 22분" /></label>
        <label>가격 (원)<input value={f.price} inputMode="numeric" onChange={e => setF({ ...f, price: e.target.value.replace(/[^\d]/g, '') })} />
          {f.price && <small>{won(Number(f.price))}원</small>}
        </label>
        <label>커플 할인액 (원) <em>(비우면 커플 플랜 불가)</em>
          <input value={f.coupleDiscount} inputMode="numeric" onChange={e => setF({ ...f, coupleDiscount: e.target.value.replace(/[^\d]/g, '') })} />
          {f.coupleDiscount && f.price && <small>2인 {won(Number(f.price) * 2 - Number(f.coupleDiscount))}원</small>}
        </label>
        <label>장비 점유 시간 <em>(예약 칸 길이)</em>
          <select value={f.slots} onChange={e => setF({ ...f, slots: Number(e.target.value) })}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n * 30}분</option>)}
          </select>
        </label>
        <label>노출 순서 <em>(작을수록 앞)</em><input value={f.sortOrder} inputMode="numeric" onChange={e => setF({ ...f, sortOrder: e.target.value.replace(/[^\d-]/g, '') })} /></label>
      </div>

      <label>상품 설명<textarea rows={2} maxLength={300} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} /></label>

      <div className="pe-images">
        <span>대표 이미지</span>
        <div>
          {PRODUCT_IMAGES.map(src => (
            <button key={src} type="button" className={f.image === src ? 'on' : ''} onClick={() => setF({ ...f, image: src })} title={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="pe-groups">
        <span>검사 구성 <em>(항목은 한 줄에 하나씩)</em></span>
        <div className="pe-group-list">
          {f.groups.map((g, i) => (
            <div key={i} className={`pe-group${g.excluded ? ' ex' : ''}`}>
              <div className="pe-group-head">
                <input value={g.label} maxLength={40} onChange={e => setGroup(i, { label: e.target.value })} placeholder="예: 검사 부위" />
                <label className="re-pub"><input type="checkbox" checked={Boolean(g.excluded)} onChange={e => setGroup(i, { excluded: e.target.checked })} />제외 항목</label>
                <button type="button" onClick={() => setF({ ...f, groups: f.groups.filter((_, j) => j !== i) })} aria-label="그룹 삭제">삭제</button>
              </div>
              <textarea rows={4} value={g.items.join('\n')} onChange={e => setGroup(i, { items: e.target.value.split('\n') })} />
            </div>
          ))}
          <button type="button" className="pe-add" onClick={() => setF({ ...f, groups: [...f.groups, { label: '', items: [] }] })}>+ 그룹 추가</button>
        </div>
      </div>

      <div className="re-foot">
        <div className="pe-flags">
          <label className="re-pub"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />판매 중 <small>(끄면 사이트·예약에서 숨김)</small></label>
          <label className="re-pub"><input type="checkbox" checked={f.featured} onChange={e => setF({ ...f, featured: e.target.checked })} />&lsquo;가장 인기&rsquo; 표시</label>
        </div>
        <div className="re-actions">
          {msg && <span>{msg}</span>}
          {onDone && <button type="button" className="btn btn-line" onClick={onDone}>닫기</button>}
          <button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={save}>{busy ? '저장 중…' : mode === 'create' ? '상품 추가' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

// 상품 목록의 한 줄 + 펼쳐지는 편집 박스
export function ProductRow({ p, meta, canDelete = false }: { p: ProductWithPrice; meta?: string; canDelete?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function remove() {
    const ok = confirm(`'${p.name}' 상품을 삭제할까요?

· 되돌릴 수 없습니다.
· 예정된 예약이 있으면 삭제되지 않습니다.
· 지난 예약 기록에는 상품명이 그대로 남습니다.
· 이 상품 전용 쿠폰은 사용 중지됩니다.

잠시 숨기려면 삭제 대신 '판매 중지'를 쓰세요.`);
    if (!ok) return;
    setBusy(true);
    setErr('');
    const res = await fetch('/api/admin/products/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(json.error ?? '삭제하지 못했습니다.'); return; }
    router.refresh();
  }
  return (
    <>
      <tr className={`${p.active ? '' : 'cancelled'}${open ? ' re-open' : ''}`}>
        <td>{p.sortOrder}</td>
        <td>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pe-thumb" src={p.image} alt="" />
        </td>
        <td><b>{p.name}</b>{p.featured && <span className="pe-pop">인기</span>}<br /><small><code>{p.id}</code> · {p.kind} · {p.time}</small></td>
        <td>{won(p.price)}원</td>
        <td>{p.coupleDiscount != null ? `${won(p.coupleDiscount)}원` : '-'}</td>
        <td>{p.slots * 30}분</td>
        <td>{p.active ? '판매 중' : '중지'}{meta && <small className="admin-msg">{meta}</small>}</td>
        <td>
          <div className="admin-actions">
            <button type="button" className="re-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>수정 {open ? '▴' : '▾'}</button>
            {canDelete && <button type="button" className="danger" disabled={busy} onClick={remove}>{busy ? '삭제 중…' : '삭제'}</button>}
          </div>
          {err && <small className="admin-msg pe-err">{err}</small>}
        </td>
      </tr>
      {open && (
        <tr className="re-row"><td colSpan={8}><ProductForm initial={p} mode="update" onDone={() => setOpen(false)} /></td></tr>
      )}
    </>
  );
}

export function NewProductBox() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn-primary pe-new" onClick={() => setOpen(true)}>+ 새 상품 추가</button>;
  return <div style={{ marginTop: 16 }}><ProductForm mode="create" onDone={() => setOpen(false)} /></div>;
}
