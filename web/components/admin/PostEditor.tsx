'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import ConfirmButton, { postJson } from '@/components/ConfirmButton';
import { EDITOR_IMAGES } from './HtmlEditor';
import { ACCEPT, uploadImage } from './uploadImage';

// 에디터는 브라우저에서만 불러온다 (서버 렌더링 제외)
const HtmlEditor = dynamic(() => import('./HtmlEditor'), { ssr: false, loading: () => <div className="he he-loading">에디터를 불러오는 중…</div> });

export type PostRowData = {
  id: string; slug: string; title: string; summary: string; coverImage: string; contentHtml: string;
  status: 'draft' | 'published'; publishedAt: string | null; updatedAt: string; author: string | null; updatedBy: string | null;
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }) : '-');

function PostForm({ initial, onDone }: { initial?: PostRowData; onDone?: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: initial?.title ?? '', slug: initial?.slug ?? '', summary: initial?.summary ?? '',
    coverImage: initial?.coverImage ?? '', contentHtml: initial?.contentHtml ?? '<p></p>',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedSlug, setSavedSlug] = useState(initial?.slug ?? '');
  const [coverBusy, setCoverBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  // 대표 이미지 직접 올리기
  async function uploadCover(file: File) {
    setCoverBusy(true);
    setMsg('');
    try {
      const url = await uploadImage(file);
      setF(x => ({ ...x, coverImage: url }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCoverBusy(false);
    }
  }
  const uploadedCover = f.coverImage && !EDITOR_IMAGES.includes(f.coverImage) ? f.coverImage : '';

  async function save(status: 'draft' | 'published') {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post: { id: initial?.id, ...f, status } }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json.error ?? '저장하지 못했습니다.'); return; }
    setSavedSlug(json.slug);
    setF(x => ({ ...x, slug: json.slug }));
    setMsg(status === 'published' ? '공개했습니다. 메인 페이지에 바로 보입니다.' : '임시 저장했습니다. 방문자에게는 보이지 않습니다.');
    router.refresh();
    if (!initial) { setF({ title: '', slug: '', summary: '', coverImage: '', contentHtml: '<p></p>' }); onDone?.(); }
  }

  return (
    <div className="re-box pe-box">
      <div className="re-box-head">
        <b>{initial ? `글 수정 · ${initial.title}` : '새 글 쓰기'}</b>
        {savedSlug && <a className="ce-view" href={`/posts/${savedSlug}?preview=1`} target="_blank" rel="noopener noreferrer">미리보기 ↗</a>}
      </div>
      <label>제목<input value={f.title} maxLength={120} onChange={e => setF({ ...f, title: e.target.value })} placeholder="예: 전신 MRI는 누구에게 필요할까요?" className="po-title" /></label>
      <div className="pe-grid">
        <label>주소 <em>(/posts/주소 · 영문 소문자·숫자·-, 비우면 자동)</em>
          <input value={f.slug} maxLength={80} onChange={e => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="예: who-needs-whole-body-mri" />
        </label>
        <label>요약 <em>(목록에 표시, 비우면 본문 앞부분)</em>
          <input value={f.summary} maxLength={300} onChange={e => setF({ ...f, summary: e.target.value })} />
        </label>
      </div>
      <div className="pe-images">
        <span>대표 이미지 <em className="ce-em">(목록 썸네일 · 선택 안 하면 이미지 없이 표시)</em></span>
        <div>
          <button type="button" className={!f.coverImage ? 'on po-none' : 'po-none'} onClick={() => setF({ ...f, coverImage: '' })}>없음</button>
          <button type="button" className="po-none po-upload" disabled={coverBusy} onClick={() => coverInput.current?.click()}>{coverBusy ? '올리는 중…' : '+ 직접 올리기'}</button>
          <input ref={coverInput} type="file" accept={ACCEPT} hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadCover(file); }} />
          {uploadedCover && (
            <button type="button" className="on" title={uploadedCover}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedCover} alt="" />
            </button>
          )}
          {EDITOR_IMAGES.map(src => (
            <button key={src} type="button" className={f.coverImage === src ? 'on' : ''} onClick={() => setF({ ...f, coverImage: src })} title={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="po-editor-label">본문</div>
      <HtmlEditor value={f.contentHtml} onChange={html => setF(x => ({ ...x, contentHtml: html }))} />

      <div className="re-foot">
        <span className="admin-msg">{msg}</span>
        <div className="re-actions">
          {onDone && <button type="button" className="btn btn-line" onClick={onDone}>닫기</button>}
          <button type="button" className="btn btn-line" disabled={busy || f.title.trim().length < 2} onClick={() => save('draft')}>임시 저장</button>
          <button type="button" className="btn btn-primary" disabled={busy || f.title.trim().length < 2} onClick={() => save('published')}>{busy ? '저장 중…' : '공개'}</button>
        </div>
      </div>
    </div>
  );
}

export function PostRow({ p }: { p: PostRowData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const published = p.status === 'published';
  return (
    <>
      <tr className={`${published ? '' : 'po-draft'}${open ? ' re-open' : ''}`}>
        <td>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.coverImage ? <img className="pe-thumb" src={p.coverImage} alt="" /> : <span className="po-noimg">글</span>}
        </td>
        <td><b>{p.title}</b><br /><small><code>/posts/{p.slug}</code></small></td>
        <td><span className={`po-status ${published ? 'pub' : ''}`}>{published ? '공개' : '임시 저장'}</span></td>
        <td>{fmt(p.publishedAt)}</td>
        <td>{p.updatedBy ?? p.author ?? '-'}<br /><small>{fmt(p.updatedAt)}</small></td>
        <td>
          <div className="admin-actions">
            <button type="button" className="re-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>수정 {open ? '▴' : '▾'}</button>
            <a className="ce-view" href={`/posts/${p.slug}${published ? '' : '?preview=1'}`} target="_blank" rel="noopener noreferrer">보기</a>
            <ConfirmButton
              label={published ? '비공개' : '공개'}
              message={published ? '이 글을 비공개로 바꿀까요? 방문자에게 보이지 않습니다.' : '이 글을 공개할까요? 메인 페이지에 바로 보입니다.'}
              onConfirm={async () => {
                const err = await postJson('/api/admin/posts/status', { id: p.id, status: published ? 'draft' : 'published' });
                if (!err) router.refresh();
                return err;
              }}
            />
            <ConfirmButton
              label="삭제"
              className="danger"
              danger
              confirmLabel="삭제"
              message={<><b>&lsquo;{p.title}&rsquo; 글을 삭제할까요?</b><ul><li>되돌릴 수 없습니다.</li><li>잠시 숨기려면 &lsquo;비공개&rsquo;를 쓰세요.</li></ul></>}
              onConfirm={async () => {
                const err = await postJson('/api/admin/posts/delete', { id: p.id });
                if (!err) router.refresh();
                return err;
              }}
            />
          </div>
        </td>
      </tr>
      {open && <tr className="re-row"><td colSpan={6}><PostForm initial={p} onDone={() => setOpen(false)} /></td></tr>}
    </>
  );
}

export function NewPostBox() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn-primary pe-new" onClick={() => setOpen(true)}>+ 새 글 쓰기</button>;
  return <div style={{ marginTop: 16 }}><PostForm onDone={() => setOpen(false)} /></div>;
}
