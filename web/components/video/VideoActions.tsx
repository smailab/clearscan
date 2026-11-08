'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ConfirmButton, { postJson } from '@/components/ConfirmButton';

const mark = (videoId: string, kind: 'like' | 'save' | 'history', on: boolean) =>
  fetch('/api/videos/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, kind, on }) });

// 영상 화면의 좋아요 · 나중에 보기 · 유튜브에서 열기 · 공유
export function VideoActions({ videoId, yt, title, loggedIn, initial }: {
  videoId: string; yt: string; title: string; loggedIn: boolean; initial: { like: boolean; save: boolean };
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [toast, setToast] = useState('');

  function say(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  async function toggle(kind: 'like' | 'save') {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/videos/${videoId}`)}`);
      return;
    }
    const on = !state[kind];
    setState(s => ({ ...s, [kind]: on }));
    const res = await mark(videoId, kind, on).catch(() => null);
    if (!res?.ok) { setState(s => ({ ...s, [kind]: !on })); say('저장하지 못했습니다. 다시 시도해 주세요.'); return; }
    say(kind === 'save' ? (on ? '나중에 볼 영상에 담았어요' : '나중에 볼 영상에서 뺐어요') : on ? '좋아요를 눌렀어요' : '좋아요를 취소했어요');
  }

  async function share() {
    const url = `${location.origin}/videos/${videoId}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); say('링크를 복사했어요'); }
    } catch { /* 공유 창을 닫은 경우 */ }
  }

  return (
    <div className="vd-actions">
      <button type="button" className={state.like ? 'on' : ''} aria-pressed={state.like} onClick={() => toggle('like')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.3-8.8A5.3 5.3 0 0 1 12 6.2a5.3 5.3 0 0 1 9.3 5c-2.3 4.4-9.3 8.8-9.3 8.8z" /></svg>좋아요
      </button>
      <button type="button" className={state.save ? 'on' : ''} aria-pressed={state.save} onClick={() => toggle('save')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z" /></svg>{state.save ? '저장됨' : '나중에 보기'}
      </button>
      <a href={`https://www.youtube.com/watch?v=${yt}`} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></svg>유튜브에서 열기
      </a>
      <button type="button" onClick={share}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5l7 7-7 7M21 12H9a6 6 0 0 0-6 6" /></svg>공유
      </button>
      {toast && <span className="vd-toast" role="status">{toast}</span>}
    </div>
  );
}

// 회원이 영상 화면을 열면 시청 기록에 남긴다
export function RecordHistory({ videoId }: { videoId: string }) {
  useEffect(() => { mark(videoId, 'history', true).catch(() => {}); }, [videoId]);
  return null;
}

export function HistoryClearButton() {
  const router = useRouter();
  return (
    <ConfirmButton
      className="vd-clear"
      label="기록 모두 지우기"
      message="시청 기록을 모두 지울까요?"
      confirmLabel="모두 지우기"
      danger
      onConfirm={async () => {
        const err = await postJson('/api/videos/history-clear', {});
        if (!err) router.refresh();
        return err;
      }}
    />
  );
}
