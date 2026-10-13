'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CancelButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    if (!confirm('이 예약을 취소하시겠어요?')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? '취소하지 못했습니다.'); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="my-cancel" disabled={busy} onClick={cancel}>{busy ? '취소 중…' : '예약 취소'}</button>
      {error && <p className="bk-error">{error}</p>}
    </>
  );
}
