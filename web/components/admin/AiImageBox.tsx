'use client';

import { useEffect, useRef, useState } from 'react';

// 관리자 칼럼 에디터: OpenAI로 이미지 만들기 → 본문에 넣기 / 대표 이미지로 쓰기
type Size = 'landscape' | 'square' | 'portrait';
const SIZES: { id: Size; label: string }[] = [
  { id: 'landscape', label: '가로 3:2' },
  { id: 'square', label: '정사각형' },
  { id: 'portrait', label: '세로 2:3' },
];
const IDEAS = [
  'MRI 촬영실에서 편안한 표정으로 검진을 기다리는 50대 여성',
  '전문의가 태블릿으로 검진 결과를 차분하게 설명하는 상담실 장면',
  '이른 아침 공원을 함께 산책하는 건강한 60대 부부',
  '밝은 자연광이 드는 프리미엄 검진센터 라운지 인테리어',
];

export default function AiImageBox({ onInsert, onCover }: { onInsert: (url: string, alt: string) => void; onCover?: (url: string) => void }) {
  const [status, setStatus] = useState<{ configured: boolean; usedToday: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<Size>('landscape');
  const [quality, setQuality] = useState<'medium' | 'high'>('medium');
  const [brandStyle, setBrandStyle] = useState(true);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; remaining: number } | null>(null);
  const [done, setDone] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/admin/ai-image').then(r => r.json()).then(setStatus).catch(() => setStatus({ configured: false, usedToday: 0 }));
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError('');
    setDone('');
    setResult(null);
    setSecs(0);
    timer.current = setInterval(() => setSecs(s => s + 1), 1000);
    try {
      const res = await fetch('/api/admin/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size, quality, brandStyle }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? '이미지를 만들지 못했습니다.');
      else setResult(json);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  }

  if (status && !status.configured) {
    return <p className="ai-note">OpenAI API 키가 아직 설정되지 않아 AI 이미지 만들기를 쓸 수 없습니다. 개발 담당자에게 키 등록을 요청해 주세요.</p>;
  }

  return (
    <div className="ai-box">
      <label className="ai-prompt">
        <span>어떤 이미지를 만들까요? <em>(한국어로 자세히 쓸수록 좋아요)</em></span>
        <textarea rows={3} maxLength={2000} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="예: 밝은 상담실에서 전문의가 MRI 영상을 보며 중년 남성에게 결과를 설명하는 장면" />
      </label>
      <div className="ai-ideas">
        {IDEAS.map(i => <button key={i} type="button" onClick={() => setPrompt(i)}>{i}</button>)}
      </div>
      <div className="ai-opts">
        <div className="ai-seg" role="group" aria-label="비율">
          {SIZES.map(s => <button key={s.id} type="button" className={size === s.id ? 'on' : ''} aria-pressed={size === s.id} onClick={() => setSize(s.id)}>{s.label}</button>)}
        </div>
        <div className="ai-seg" role="group" aria-label="품질">
          <button type="button" className={quality === 'medium' ? 'on' : ''} aria-pressed={quality === 'medium'} onClick={() => setQuality('medium')}>보통 (빠름)</button>
          <button type="button" className={quality === 'high' ? 'on' : ''} aria-pressed={quality === 'high'} onClick={() => setQuality('high')}>고화질</button>
        </div>
        <label className="re-pub"><input type="checkbox" checked={brandStyle} onChange={e => setBrandStyle(e.target.checked)} />ORAE 브랜드 톤 적용 <small>(남색·하늘색, 사진 스타일, 글자 없음)</small></label>
      </div>
      <div className="ai-run">
        <button type="button" className="he-ok" disabled={busy || prompt.trim().length < 5} onClick={generate}>
          {busy ? `만드는 중… ${secs}초` : result ? '다시 만들기' : '이미지 만들기'}
        </button>
        <span>{busy ? '보통 20초~1분, 길면 2분까지 걸려요. 창을 닫지 마세요.' : status ? `오늘 ${status.usedToday + (result ? 1 : 0)}장 생성` : ''}</span>
      </div>
      {error && <p className="ai-err" role="alert">{error}</p>}
      {result && (
        <div className="ai-result">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="" />
          <div className="ai-actions">
            <button type="button" className="he-ok" onClick={() => { onInsert(result.url, prompt.slice(0, 120)); setDone('본문에 넣었습니다.'); }}>본문에 넣기</button>
            {onCover && <button type="button" onClick={() => { onCover(result.url); setDone('대표 이미지로 정했습니다.'); }}>대표 이미지로</button>}
            {done && <span>{done}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
