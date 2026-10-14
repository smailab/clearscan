'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ConfirmButton, { postJson } from '@/components/ConfirmButton';
import { CENTER_ID_RE, CENTER_IMAGES, DOCTOR_IMAGES, type Center, type Doctor } from '@/lib/centers-shared';

type DoctorForm = { name: string; title: string; specialty: string; photo: string; education: string; career: string; societies: string };
type Form = {
  id: string; name: string; region: string; address: string; addressDetail: string; phone: string; homepage: string;
  notice: string; intro: string; image: string; gallery: string[];
  hours: { label: string; value: string; note: string }[];
  links: string; equipment: string; highlights: string; planIds: string[]; doctors: DoctorForm[];
  active: boolean; sortOrder: string;
};

const DEFAULT_HOURS = [
  { label: '평일', value: '', note: '' },
  { label: '토요일', value: '', note: '' },
  { label: '일요일', value: '휴진', note: '' },
];

const toDoctorForm = (d?: Doctor): DoctorForm => ({
  name: d?.name ?? '', title: d?.title ?? '원장', specialty: d?.specialty ?? '', photo: d?.photo ?? '',
  education: (d?.education ?? []).join('\n'), career: (d?.career ?? []).join('\n'), societies: (d?.societies ?? []).join('\n'),
});

const toForm = (c?: Center): Form => ({
  id: c?.id ?? '', name: c?.name ?? '', region: c?.region ?? '', address: c?.address ?? '', addressDetail: c?.addressDetail ?? '',
  phone: c?.phone ?? '', homepage: c?.homepage ?? '', notice: c?.notice ?? '', intro: c?.intro ?? '',
  image: c?.image ?? CENTER_IMAGES[0], gallery: c?.gallery ?? [],
  hours: [0, 1, 2].map(i => ({ label: c?.hours[i]?.label ?? DEFAULT_HOURS[i].label, value: c?.hours[i]?.value ?? DEFAULT_HOURS[i].value, note: c?.hours[i]?.note ?? '' })),
  links: (c?.links ?? []).map(l => `${l.label} | ${l.url}`).join('\n'),
  equipment: (c?.equipment ?? []).join('\n'), highlights: (c?.highlights ?? []).join('\n'),
  planIds: c?.planIds ?? [], doctors: (c?.doctors ?? []).map(toDoctorForm),
  active: c?.active ?? true, sortOrder: String(c?.sortOrder ?? 100),
});

const splitLines = (v: string) => v.split('\n').map(x => x.trim()).filter(Boolean);

function CenterForm({ initial, mode, products, onDone }: {
  initial?: Center; mode: 'create' | 'update'; products: { id: string; name: string }[]; onDone?: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState<Form>(toForm(initial));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const setDoc = (i: number, d: Partial<DoctorForm>) => setF({ ...f, doctors: f.doctors.map((x, j) => (j === i ? { ...x, ...d } : x)) });
  const moveDoc = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= f.doctors.length) return;
    const ds = [...f.doctors];
    [ds[i], ds[j]] = [ds[j], ds[i]];
    setF({ ...f, doctors: ds });
  };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  async function save() {
    setBusy(true);
    setMsg('');
    const center = {
      ...f,
      sortOrder: Number(f.sortOrder) || 0,
      hours: f.hours.filter(h => h.label.trim() && h.value.trim()),
      links: splitLines(f.links).map(line => {
        const [label, ...rest] = line.split('|');
        return { label: label.trim(), url: rest.join('|').trim() };
      }),
      equipment: splitLines(f.equipment),
      highlights: splitLines(f.highlights),
      doctors: f.doctors.map(d => ({
        name: d.name, title: d.title, specialty: d.specialty, photo: d.photo,
        education: splitLines(d.education), career: splitLines(d.career), societies: splitLines(d.societies),
      })),
    };
    const err = await postJson('/api/admin/centers', { mode, center });
    setBusy(false);
    if (err) { setMsg(err); return; }
    setMsg('저장했습니다. 사이트에 바로 반영됩니다.');
    if (mode === 'create') setF(toForm());
    router.refresh();
  }

  const ready = CENTER_ID_RE.test(f.id) && f.name.trim().length >= 2 && f.address.trim().length >= 5 && f.image;

  return (
    <div className="re-box pe-box">
      <div className="re-box-head">
        <b>{mode === 'create' ? '새 검진 센터 추가' : `센터 수정 · ${initial?.name}`}</b>
        {mode === 'update' && <span>센터 ID <code>{f.id}</code> · 주소 /centers/{f.id} (변경 불가)</span>}
      </div>

      <h4 className="ce-h">기본 정보</h4>
      <div className="pe-grid">
        {mode === 'create' && (
          <label>센터 ID <em>(영문 소문자·숫자·-, 페이지 주소에 쓰임)</em>
            <input value={f.id} maxLength={31} onChange={e => setF({ ...f, id: e.target.value.toLowerCase() })} placeholder="예: gangnam" />
          </label>
        )}
        <label>센터 이름<input value={f.name} maxLength={40} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <label>지역 <em>(목록 태그)</em><input value={f.region} maxLength={30} onChange={e => setF({ ...f, region: e.target.value })} placeholder="예: 서울 서대문구" /></label>
        <label>전화번호<input value={f.phone} maxLength={20} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
        <label>주소<input value={f.address} maxLength={120} onChange={e => setF({ ...f, address: e.target.value })} /></label>
        <label>상세 주소 <em>(건물명 등)</em><input value={f.addressDetail} maxLength={80} onChange={e => setF({ ...f, addressDetail: e.target.value })} /></label>
        <label>홈페이지 <em>(비우면 &lsquo;준비 중&rsquo;)</em><input value={f.homepage} maxLength={200} onChange={e => setF({ ...f, homepage: e.target.value })} placeholder="https://" /></label>
        <label>노출 순서 <em>(작을수록 앞)</em><input value={f.sortOrder} inputMode="numeric" onChange={e => setF({ ...f, sortOrder: e.target.value.replace(/[^\d-]/g, '') })} /></label>
      </div>
      <label>센터 소개<textarea rows={3} maxLength={1000} value={f.intro} onChange={e => setF({ ...f, intro: e.target.value })} /></label>
      <label>안내 문구 <em>(파란 박스로 강조, 선택)</em><input value={f.notice} maxLength={200} onChange={e => setF({ ...f, notice: e.target.value })} /></label>

      <h4 className="ce-h">진료 시간 <em>(평일·토요일·일요일 순 — 상세 페이지 &lsquo;오늘&rsquo; 표시에 사용)</em></h4>
      <div className="ce-hours">
        {f.hours.map((h, i) => (
          <div key={i} className="ce-hour">
            <input value={h.label} maxLength={20} onChange={e => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <input value={h.value} maxLength={60} placeholder="예: 08:30 – 17:30" onChange={e => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
            <input value={h.note} maxLength={80} placeholder="비고 (예: 점심시간 12:00 – 13:00)" onChange={e => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
          </div>
        ))}
      </div>

      <div className="re-grid-2">
        <label>특징 <em>(한 줄에 하나)</em><textarea rows={4} value={f.highlights} onChange={e => setF({ ...f, highlights: e.target.value })} /></label>
        <label>의료장비 <em>(한 줄에 하나)</em><textarea rows={4} value={f.equipment} onChange={e => setF({ ...f, equipment: e.target.value })} /></label>
      </div>
      <label>외부 링크 <em>(한 줄에 &lsquo;이름 | 주소&rsquo;, 예: 네이버 예약 | https://...)</em>
        <textarea rows={3} value={f.links} onChange={e => setF({ ...f, links: e.target.value })} />
      </label>

      <div className="pe-images">
        <span>대표 사진 <em className="ce-em">(목록·상세 상단)</em></span>
        <div>
          {CENTER_IMAGES.map(src => (
            <button key={src} type="button" className={f.image === src ? 'on' : ''} onClick={() => setF({ ...f, image: src })} title={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      </div>
      <div className="pe-images">
        <span>갤러리 사진 <em className="ce-em">(여러 장 선택, {f.gallery.length}장 선택됨 · 선택한 순서대로 표시)</em></span>
        <div>
          {CENTER_IMAGES.map(src => (
            <button key={src} type="button" className={f.gallery.includes(src) ? 'on' : ''} onClick={() => setF({ ...f, gallery: toggleIn(f.gallery, src) })} title={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              {f.gallery.includes(src) && <i className="ce-num">{f.gallery.indexOf(src) + 1}</i>}
            </button>
          ))}
        </div>
      </div>

      <div className="ce-plans">
        <span>이 센터에서 받을 수 있는 검진 <em className="ce-em">(센터 상세 페이지에 표시)</em></span>
        <div>
          {products.map(p => (
            <label key={p.id} className="re-pub">
              <input type="checkbox" checked={f.planIds.includes(p.id)} onChange={() => setF({ ...f, planIds: toggleIn(f.planIds, p.id) })} />{p.name}
            </label>
          ))}
        </div>
      </div>

      <h4 className="ce-h">의료진 <em>({f.doctors.length}명)</em></h4>
      <div className="ce-doctors">
        {f.doctors.map((d, i) => (
          <div key={i} className="ce-doctor">
            <div className="ce-doc-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.photo ? <img src={d.photo} alt="" /> : <span>{d.name.slice(0, 1) || '?'}</span>}
              <select value={d.photo} onChange={e => setDoc(i, { photo: e.target.value })}>
                <option value="">사진 없음</option>
                {DOCTOR_IMAGES.map((src, n) => <option key={src} value={src}>사진 {n + 1}</option>)}
              </select>
            </div>
            <div className="ce-doc-body">
              <div className="ce-doc-row">
                <input value={d.name} maxLength={20} placeholder="이름" onChange={e => setDoc(i, { name: e.target.value })} />
                <input value={d.title} maxLength={20} placeholder="직함 (예: 원장)" onChange={e => setDoc(i, { title: e.target.value })} />
                <input value={d.specialty} maxLength={40} placeholder="전문 분야 (예: 영상의학과 전문의)" onChange={e => setDoc(i, { specialty: e.target.value })} />
              </div>
              <div className="ce-doc-row three">
                <textarea rows={3} value={d.education} placeholder="학력 (한 줄에 하나)" onChange={e => setDoc(i, { education: e.target.value })} />
                <textarea rows={3} value={d.career} placeholder="주요 경력 (한 줄에 하나)" onChange={e => setDoc(i, { career: e.target.value })} />
                <textarea rows={3} value={d.societies} placeholder="학회 활동 (한 줄에 하나)" onChange={e => setDoc(i, { societies: e.target.value })} />
              </div>
            </div>
            <div className="ce-doc-actions">
              <button type="button" disabled={i === 0} onClick={() => moveDoc(i, -1)} aria-label="위로">▲</button>
              <button type="button" disabled={i === f.doctors.length - 1} onClick={() => moveDoc(i, 1)} aria-label="아래로">▼</button>
              <button type="button" className="danger" onClick={() => setF({ ...f, doctors: f.doctors.filter((_, j) => j !== i) })}>삭제</button>
            </div>
          </div>
        ))}
        <button type="button" className="pe-add ce-add" onClick={() => setF({ ...f, doctors: [...f.doctors, toDoctorForm()] })}>+ 의료진 추가</button>
      </div>

      <div className="re-foot">
        <label className="re-pub"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />공개 <small>(끄면 사이트 목록·상세에서 숨김)</small></label>
        <div className="re-actions">
          {msg && <span>{msg}</span>}
          {onDone && <button type="button" className="btn btn-line" onClick={onDone}>닫기</button>}
          <button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={save}>{busy ? '저장 중…' : mode === 'create' ? '센터 추가' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

export function CenterRow({ c, meta, canDelete, products }: { c: Center; meta?: string; canDelete: boolean; products: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={`${c.active ? '' : 'cancelled'}${open ? ' re-open' : ''}`}>
        <td>{c.sortOrder}</td>
        <td>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pe-thumb" src={c.image} alt="" />
        </td>
        <td><b>{c.name}</b><br /><small><code>{c.id}</code> · {c.region}</small></td>
        <td>{c.address}<br /><small>{c.phone}</small></td>
        <td>{c.doctors.length}명</td>
        <td>{c.planIds.length}개</td>
        <td>{c.active ? '공개' : '숨김'}{meta && <small className="admin-msg">{meta}</small>}</td>
        <td>
          <div className="admin-actions">
            <button type="button" className="re-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>수정 {open ? '▴' : '▾'}</button>
            <a className="ce-view" href={`/centers/${c.id}`} target="_blank" rel="noopener noreferrer">보기</a>
            {canDelete && (
              <ConfirmButton
                label="삭제"
                className="danger"
                danger
                confirmLabel="삭제"
                message={<><b>&lsquo;{c.name}&rsquo; 센터를 삭제할까요?</b><ul><li>되돌릴 수 없습니다.</li><li>잠시 숨기려면 &lsquo;공개&rsquo;를 끄세요.</li></ul></>}
                onConfirm={async () => {
                  const err = await postJson('/api/admin/centers/delete', { id: c.id });
                  if (!err) router.refresh();
                  return err;
                }}
              />
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="re-row"><td colSpan={8}><CenterForm initial={c} mode="update" products={products} onDone={() => setOpen(false)} /></td></tr>
      )}
    </>
  );
}

export function NewCenterBox({ products }: { products: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn-primary pe-new" onClick={() => setOpen(true)}>+ 새 검진 센터 추가</button>;
  return <div style={{ marginTop: 16 }}><CenterForm mode="create" products={products} onDone={() => setOpen(false)} /></div>;
}
