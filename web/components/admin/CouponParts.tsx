'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'shared' | 'batch' | 'members';
const MODE_LABEL: Record<Mode, string> = { shared: '공용 코드 1개', batch: '1회용 코드 여러 개', members: '회원 지정 발급' };

const addDays = (n: number) => {
  const d = new Date(Date.now() + 9 * 3_600_000 + n * 86_400_000); // 한국 시간 기준
  return d.toISOString().slice(0, 10);
};

// 쿠폰 발급 박스
export function IssueCouponBox({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    mode: 'shared' as Mode, name: '', productId: '', discountType: 'percent' as 'amount' | 'percent', discountValue: '10',
    validFrom: addDays(0), validUntil: addDays(30), code: '', maxUses: '', count: '10', emails: '', memo: '',
  });
  const [msg, setMsg] = useState('');
  const [issued, setIssued] = useState<{ codes: string[]; skipped: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue() {
    setBusy(true);
    setMsg('');
    setIssued(null);
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, productId: f.productId || null, discountValue: Number(f.discountValue), maxUses: f.maxUses === '' ? null : Number(f.maxUses), count: Number(f.count) }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json.error ?? '발급하지 못했습니다.'); return; }
    setIssued(json);
    setMsg(`${json.codes.length}개 발급했습니다.${json.skipped?.length ? ` 가입하지 않은 이메일 ${json.skipped.length}개는 건너뛰었습니다.` : ''}`);
    router.refresh();
  }

  const ready = f.name.trim().length >= 2 && Number(f.discountValue) > 0 && f.validFrom && f.validUntil
    && (f.mode !== 'batch' || Number(f.count) >= 1) && (f.mode !== 'members' || f.emails.trim());

  return (
    <div className="re-box">
      <div className="re-box-head"><b>쿠폰 발급</b><span>같은 쿠폰은 회원당 1회만 사용할 수 있어요</span></div>

      <label>발급 방식
        <div className="re-status">
          {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
            <button key={m} type="button" className={`normal${f.mode === m ? ' on' : ''}`} onClick={() => setF({ ...f, mode: m })}>{MODE_LABEL[m]}</button>
          ))}
        </div>
      </label>

      <div className="pe-grid">
        <label>쿠폰 이름 <em>(회원에게 보임)</em><input value={f.name} maxLength={60} onChange={e => setF({ ...f, name: e.target.value })} placeholder="예: 오픈 기념 10% 할인" /></label>
        <label>적용 상품
          <select value={f.productId} onChange={e => setF({ ...f, productId: e.target.value })}>
            <option value="">전체 상품</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>할인
          <div className="cp-discount">
            <select value={f.discountType} onChange={e => setF({ ...f, discountType: e.target.value as 'amount' | 'percent' })}>
              <option value="percent">% 할인</option>
              <option value="amount">원 할인</option>
            </select>
            <input value={f.discountValue} inputMode="numeric" onChange={e => setF({ ...f, discountValue: e.target.value.replace(/[^\d]/g, '') })} />
            <span>{f.discountType === 'percent' ? '%' : '원'}</span>
          </div>
        </label>
        <label>사용 시작일<input type="date" value={f.validFrom} onChange={e => setF({ ...f, validFrom: e.target.value })} /></label>
        <label>사용 종료일<input type="date" value={f.validUntil} onChange={e => setF({ ...f, validUntil: e.target.value })} /></label>
        {f.mode === 'shared' && (
          <>
            <label>쿠폰 코드 <em>(비우면 자동 생성)</em><input value={f.code} maxLength={24} onChange={e => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="예: OPEN2026" /></label>
            <label>전체 사용 한도 <em>(비우면 무제한)</em><input value={f.maxUses} inputMode="numeric" onChange={e => setF({ ...f, maxUses: e.target.value.replace(/[^\d]/g, '') })} placeholder="예: 100" /></label>
          </>
        )}
        {f.mode === 'batch' && (
          <label>발급 수량 <em>(코드마다 1회용, 최대 500)</em><input value={f.count} inputMode="numeric" onChange={e => setF({ ...f, count: e.target.value.replace(/[^\d]/g, '') })} /></label>
        )}
      </div>

      {f.mode === 'members' && (
        <label>회원 이메일 <em>(줄바꿈·쉼표로 구분, 회원마다 전용 1회용 쿠폰이 내 페이지에 표시됨)</em>
          <textarea rows={4} value={f.emails} onChange={e => setF({ ...f, emails: e.target.value })} placeholder={'member1@example.com\nmember2@example.com'} />
        </label>
      )}
      <label>관리 메모 <em>(선택, 관리자만 보임)</em><input value={f.memo} maxLength={200} onChange={e => setF({ ...f, memo: e.target.value })} /></label>

      <div className="re-foot">
        <span className="admin-msg">{msg}</span>
        <div className="re-actions">
          <button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={issue}>{busy ? '발급 중…' : '발급'}</button>
        </div>
      </div>

      {issued && issued.codes.length > 0 && (
        <div className="cp-issued">
          <b>발급된 코드 {issued.codes.length}개</b>
          <textarea readOnly rows={Math.min(8, issued.codes.length + 1)} value={issued.codes.join('\n')} onFocus={e => e.currentTarget.select()} />
          {issued.skipped.length > 0 && <small>가입하지 않은 이메일: {issued.skipped.join(', ')}</small>}
        </div>
      )}
    </div>
  );
}

export function CouponToggle({ code, active }: { code: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={`re-toggle${active ? '' : ' draft'}`} disabled={busy}
      onClick={async () => {
        if (!confirm(active ? '이 쿠폰을 사용 중지할까요? 회원이 더 이상 쓸 수 없습니다.' : '이 쿠폰을 다시 사용할 수 있게 할까요?')) return;
        setBusy(true);
        await fetch('/api/admin/coupons/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, active: !active }) });
        setBusy(false);
        router.refresh();
      }}>
      {active ? '사용 중지' : '다시 사용'}
    </button>
  );
}
