'use client';

import { useState } from 'react';

// 브라우저 확인창(confirm) 대신 쓰는 페이지 안 확인 버튼.
// 일부 브라우저·앱 내장 브라우저는 confirm()을 띄우지 않고 바로 '취소'로 처리하기 때문에 직접 그린다.
// 처음 누르면 안내 문구와 [확인]/[취소]가 펼쳐지고, [확인]을 눌러야 실행된다.
type Props = {
  label: React.ReactNode;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<string | void>; // 오류 메시지를 돌려주면 화면에 표시
  className?: string;
  danger?: boolean;
  disabled?: boolean;
};

export default function ConfirmButton({ label, message, confirmLabel = '확인', onConfirm, className, danger, disabled }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const err = await onConfirm();
      if (err) setError(err);
      else setAsking(false);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <span className="cb">
        <button type="button" className={className} disabled={disabled} onClick={() => { setError(''); setAsking(true); }}>{label}</button>
        {error && <span className="cb-error" role="alert">{error}</span>}
      </span>
    );
  }

  return (
    <div className={`cb-ask${danger ? ' danger' : ''}`} role="alertdialog">
      <div className="cb-msg">{message}</div>
      {error && <p className="cb-error" role="alert">{error}</p>}
      <div className="cb-actions">
        <button type="button" className="cb-cancel" disabled={busy} onClick={() => { setAsking(false); setError(''); }}>취소</button>
        <button type="button" className="cb-ok" disabled={busy} onClick={run}>{busy ? '처리 중…' : confirmLabel}</button>
      </div>
    </div>
  );
}

// fetch 결과를 오류 메시지로 바꾸는 도우미
export async function postJson(url: string, data: unknown): Promise<string | void> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (res.ok) return;
  const json = await res.json().catch(() => ({}));
  return json.error ?? '처리하지 못했습니다.';
}
