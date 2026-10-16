'use client';

import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { useRef, useState } from 'react';
import { ACCEPT, imageFiles, uploadImage } from './uploadImage';

// 관리자 글쓰기용 HTML 문서 에디터 (TipTap)
// - 서식 도구 막대 + 'HTML 소스' 보기에서 직접 HTML 편집
// - 링크·이미지는 브라우저 팝업 대신 도구 막대 아래 입력 칸으로 받는다
// - 이미지 파일은 '내 PC에서 올리기' 버튼, 끌어다 놓기, 붙여넣기로 바로 올릴 수 있다 (R2 저장, /media/…)
// - 저장 시 서버에서 허용 태그만 남기도록 다시 정제한다 (lib/posts.ts)

export const EDITOR_IMAGES = [
  '/images/fullbody.webp', '/images/brain-mri.png', '/images/scan-woman.png', '/images/scan-man.png',
  '/images/consult.png', '/images/app-report.png', '/images/lobby.png',
  '/images/centers/iro/interior1.png', '/images/centers/iro/interior2.png', '/images/centers/iro/interior3.png',
];

type Panel = null | 'link' | 'image';

export default function HtmlEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [source, setSource] = useState(value);
  const [panel, setPanel] = useState<Panel>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [upMsg, setUpMsg] = useState('');
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  // 붙여넣기·끌어다 놓기에서 부르는 업로드 함수 (에디터가 만들어진 뒤 채운다)
  const uploadRef = useRef<(files: File[], pos?: number) => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false, // Next.js 서버 렌더링과 충돌하지 않게
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value,
    editorProps: {
      attributes: { class: 'he-content post-body' },
      handlePaste: (_view, e) => {
        const files = imageFiles(e.clipboardData);
        if (!files.length) return false;
        e.preventDefault();
        uploadRef.current(files);
        return true;
      },
      handleDrop: (view, e) => {
        const files = imageFiles(e.dataTransfer);
        if (!files.length) return false;
        e.preventDefault();
        uploadRef.current(files, view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // 도구 막대 버튼의 '켜짐' 상태
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      p: e?.isActive('paragraph') ?? false,
      h2: e?.isActive('heading', { level: 2 }) ?? false,
      h3: e?.isActive('heading', { level: 3 }) ?? false,
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      underline: e?.isActive('underline') ?? false,
      strike: e?.isActive('strike') ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      quote: e?.isActive('blockquote') ?? false,
      link: e?.isActive('link') ?? false,
      table: e?.isActive('table') ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });

  if (!editor) return <div className="he he-loading">에디터를 불러오는 중…</div>;
  const c = () => editor.chain().focus();

  function switchMode(next: 'visual' | 'html') {
    if (next === mode) return;
    if (next === 'html') setSource(editor!.getHTML());
    else {
      editor!.commands.setContent(source, { emitUpdate: true });
      onChange(editor!.getHTML());
    }
    setPanel(null);
    setMode(next);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) c().extendMarkRange('link').unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}` }).run();
    setPanel(null);
  }

  uploadRef.current = async (files, pos) => {
    setUpMsg('');
    setUploading(files.length);
    let done = 0;
    for (const f of files) {
      try {
        const src = await uploadImage(f);
        const chain = editor!.chain().focus();
        if (pos !== undefined && done === 0) chain.setTextSelection(pos);
        chain.setImage({ src, alt: imgAlt.trim() || undefined }).run();
        done++;
      } catch (e) {
        setUpMsg(`${f.name}: ${(e as Error).message}`);
      }
      setUploading(n => n - 1);
    }
    if (done) { setImgAlt(''); setPanel(null); }
  };

  function insertImage(src: string) {
    if (!src) return;
    c().setImage({ src, alt: imgAlt.trim() || undefined }).run();
    setImgUrl('');
    setImgAlt('');
    setPanel(null);
  }

  const B = ({ on, label, title, run, disabled }: { on?: boolean; label: React.ReactNode; title: string; run: () => void; disabled?: boolean }) => (
    <button type="button" className={on ? 'on' : ''} title={title} aria-label={title} aria-pressed={on} disabled={disabled || mode === 'html'} onMouseDown={e => e.preventDefault()} onClick={run}>{label}</button>
  );

  return (
    <div className="he">
      <div className="he-bar" role="toolbar" aria-label="서식">
        <B on={st?.p} label="본문" title="본문" run={() => c().setParagraph().run()} />
        <B on={st?.h2} label="제목" title="큰 제목 (H2)" run={() => c().toggleHeading({ level: 2 }).run()} />
        <B on={st?.h3} label="소제목" title="작은 제목 (H3)" run={() => c().toggleHeading({ level: 3 }).run()} />
        <span className="he-sep" />
        <B on={st?.bold} label={<b>B</b>} title="굵게" run={() => c().toggleBold().run()} />
        <B on={st?.italic} label={<i>I</i>} title="기울임" run={() => c().toggleItalic().run()} />
        <B on={st?.underline} label={<u>U</u>} title="밑줄" run={() => c().toggleUnderline().run()} />
        <B on={st?.strike} label={<s>S</s>} title="취소선" run={() => c().toggleStrike().run()} />
        <span className="he-sep" />
        <B on={st?.bullet} label="• 목록" title="글머리 목록" run={() => c().toggleBulletList().run()} />
        <B on={st?.ordered} label="1. 목록" title="번호 목록" run={() => c().toggleOrderedList().run()} />
        <B on={st?.quote} label="❝ 인용" title="인용" run={() => c().toggleBlockquote().run()} />
        <B label="― 구분선" title="구분선" run={() => c().setHorizontalRule().run()} />
        <span className="he-sep" />
        <B on={st?.link || panel === 'link'} label="링크" title="링크" run={() => { setLinkUrl(editor.getAttributes('link').href ?? ''); setPanel(panel === 'link' ? null : 'link'); }} />
        <B on={panel === 'image'} label="이미지" title="이미지" run={() => setPanel(panel === 'image' ? null : 'image')} />
        <B on={st?.table} label="▦ 표" title="표 넣기 (3×3)" run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        {st?.table && (
          <>
            <B label="+행" title="아래에 행 추가" run={() => c().addRowAfter().run()} />
            <B label="+열" title="오른쪽에 열 추가" run={() => c().addColumnAfter().run()} />
            <B label="−행" title="행 삭제" run={() => c().deleteRow().run()} />
            <B label="−열" title="열 삭제" run={() => c().deleteColumn().run()} />
            <B label="표 삭제" title="표 삭제" run={() => c().deleteTable().run()} />
          </>
        )}
        <span className="he-sep" />
        <B label="↶" title="실행 취소" disabled={!st?.canUndo} run={() => c().undo().run()} />
        <B label="↷" title="다시 실행" disabled={!st?.canRedo} run={() => c().redo().run()} />
        <span className="he-grow" />
        <div className="he-mode" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'visual'} className={mode === 'visual' ? 'on' : ''} onClick={() => switchMode('visual')}>편집</button>
          <button type="button" role="tab" aria-selected={mode === 'html'} className={mode === 'html' ? 'on' : ''} onClick={() => switchMode('html')}>HTML 소스</button>
        </div>
      </div>

      {panel === 'link' && (
        <div className="he-panel">
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://… (비우면 링크 해제)" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} />
          <button type="button" className="he-ok" onClick={applyLink}>적용</button>
          <button type="button" onClick={() => setPanel(null)}>닫기</button>
        </div>
      )}

      {panel === 'image' && (
        <div className="he-panel he-panel-img">
          <div className="he-upload">
            <button type="button" className="he-ok" disabled={uploading > 0} onClick={() => fileInput.current?.click()}>
              {uploading > 0 ? `올리는 중… (${uploading})` : '내 PC에서 올리기'}
            </button>
            <span>JPG · PNG · WEBP · GIF, 5MB 이하 · 여러 장 선택 가능 · 본문에 끌어다 놓거나 붙여넣어도 됩니다</span>
            <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden
              onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) uploadRef.current(fs); }} />
          </div>
          <p className="he-sub">사이트 기본 이미지</p>
          <div className="he-img-grid">
            {EDITOR_IMAGES.map(src => (
              <button key={src} type="button" title={src} onClick={() => insertImage(src)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </button>
            ))}
          </div>
          <div className="he-img-url">
            <input value={imgUrl} onChange={e => setImgUrl(e.target.value)} placeholder="또는 이미지 주소 https://…" />
            <input value={imgAlt} onChange={e => setImgAlt(e.target.value)} placeholder="대체 텍스트 (이미지 설명)" />
            <button type="button" className="he-ok" disabled={!/^https:\/\//i.test(imgUrl.trim())} onClick={() => insertImage(imgUrl.trim())}>넣기</button>
            <button type="button" onClick={() => setPanel(null)}>닫기</button>
          </div>
        </div>
      )}

      {(uploading > 0 || upMsg) && panel !== 'image' && (
        <div className={`he-up-status${upMsg ? ' err' : ''}`} role="status">{uploading > 0 ? `이미지 올리는 중… (${uploading})` : upMsg}</div>
      )}
      {panel === 'image' && upMsg && <div className="he-up-status err" role="alert">{upMsg}</div>}

      {mode === 'visual'
        ? <EditorContent editor={editor} className="he-area" />
        : <textarea className="he-source" value={source} spellCheck={false} onChange={e => { setSource(e.target.value); onChange(e.target.value); }} />}
    </div>
  );
}
