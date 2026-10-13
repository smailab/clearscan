'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatPhone, kstToday } from '@/lib/booking/schedule';
import { site } from '@/lib/data';

type PostResult = { ok: boolean; error?: string; data?: Record<string, unknown> };

async function post(url: string, data: unknown): Promise<PostResult> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? '요청에 실패했습니다.' };
  } catch {
    return { ok: false, error: '네트워크 오류가 발생했습니다. 다시 시도해 주세요.' };
  }
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await post('/api/auth/login', { email, password });
    setBusy(false);
    if (!r.ok) { setError(r.error!); return; }
    router.replace(next);
    router.refresh();
  }

  return (
    <form className="bk-fields au-form" onSubmit={submit}>
      <label className="bk-field"><span>이메일</span>
        <input type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
      </label>
      <label className="bk-field"><span>비밀번호</span>
        <input type="password" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} />
      </label>
      {error && <p className="bk-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !emailOk(email) || !password}>{busy ? '로그인 중…' : '로그인'}</button>
      <p className="au-alt">아직 회원이 아니신가요? <Link href={`/signup?next=${encodeURIComponent(next)}`}>회원가입</Link></p>
      <p className="note" style={{ textAlign: 'center' }}>비밀번호를 잊으셨다면 상담 전화 {site.phone}로 문의해 주세요.</p>
    </form>
  );
}

// 가입 3단계: ① 이메일 입력 → ② 인증번호 확인 → ③ 비밀번호·개인정보 입력
export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [f, setF] = useState({ password: '', password2: '', name: '', phone: '', birth: '', sex: 'F' as 'M' | 'F' });
  const [consent, setConsent] = useState({ terms: false, privacy: false, marketing: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setError('');
    const r = await post('/api/auth/email/send', { email });
    setBusy(false);
    if (!r.ok) { setError(r.error!); return; }
    setDevCode(typeof r.data?.devCode === 'string' ? r.data.devCode : '');
    setCode('');
    setCooldown(60);
    setStep(2);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await post('/api/auth/email/verify', { email, code });
    setBusy(false);
    if (!r.ok) { setError(r.error!); return; }
    setStep(3);
  }

  const pwOk = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password);
  const ready = pwOk && f.password === f.password2 && f.name.trim().length >= 2 && /^01[016789]\d{7,8}$/.test(f.phone)
    && /^\d{4}-\d{2}-\d{2}$/.test(f.birth) && consent.terms && consent.privacy;
  const all = consent.terms && consent.privacy && consent.marketing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError('');
    const r = await post('/api/auth/signup', { email, ...f, consent });
    setBusy(false);
    if (!r.ok) { setError(r.error!); return; }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="au-form">
      <ol className="au-steps">
        <li className={step >= 1 ? 'on' : ''}>이메일</li>
        <li className={step >= 2 ? 'on' : ''}>인증</li>
        <li className={step >= 3 ? 'on' : ''}>정보 입력</li>
      </ol>

      {step === 1 && (
        <form className="bk-fields" onSubmit={e => { e.preventDefault(); if (emailOk(email)) sendCode(); }}>
          <label className="bk-field"><span>이메일 <small>(로그인 아이디)</small></span>
            <input type="email" value={email} autoComplete="email" autoFocus onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <p className="note" style={{ marginTop: -6 }}>입력한 이메일로 6자리 인증번호를 보내드려요.</p>
          {error && <p className="bk-error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy || !emailOk(email)}>{busy ? '보내는 중…' : '인증번호 받기'}</button>
        </form>
      )}

      {step === 2 && (
        <form className="bk-fields" onSubmit={verify}>
          <p className="au-sent"><b>{email}</b>으로 인증번호를 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요.</p>
          {devCode && <p className="au-dev">개발 모드: 인증번호 <b>{devCode}</b> (운영에서는 표시되지 않음)</p>}
          <label className="bk-field"><span>인증번호 6자리</span>
            <input value={code} inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="au-code" />
          </label>
          {error && <p className="bk-error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? '확인 중…' : '인증 확인'}</button>
          <div className="au-row">
            <button type="button" className="au-link" onClick={() => { setStep(1); setError(''); }}>이메일 다시 입력</button>
            <button type="button" className="au-link" disabled={busy || cooldown > 0} onClick={sendCode}>
              {cooldown > 0 ? `${cooldown}초 후 재발송` : '인증번호 다시 받기'}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form className="bk-fields" onSubmit={submit}>
          <p className="au-sent">✓ <b>{email}</b> 인증 완료</p>
          <label className="bk-field"><span>비밀번호</span>
            <input type="password" value={f.password} autoComplete="new-password" onChange={e => setF({ ...f, password: e.target.value })} placeholder="영문·숫자 포함 8자 이상" />
            {f.password && !pwOk && <small className="au-hint">영문과 숫자를 포함해 8자 이상 입력해 주세요.</small>}
          </label>
          <label className="bk-field"><span>비밀번호 확인</span>
            <input type="password" value={f.password2} autoComplete="new-password" onChange={e => setF({ ...f, password2: e.target.value })} />
            {f.password2 && f.password !== f.password2 && <small className="au-hint">비밀번호가 일치하지 않습니다.</small>}
          </label>
          <label className="bk-field"><span>이름</span>
            <input value={f.name} maxLength={20} autoComplete="name" onChange={e => setF({ ...f, name: e.target.value })} placeholder="홍길동" />
          </label>
          <label className="bk-field"><span>휴대폰 번호</span>
            <input value={formatPhone(f.phone)} inputMode="numeric" autoComplete="tel" onChange={e => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="010-0000-0000" />
          </label>
          <label className="bk-field"><span>생년월일</span>
            <input type="date" value={f.birth} max={kstToday()} min="1900-01-01" onChange={e => setF({ ...f, birth: e.target.value })} />
          </label>
          <div className="bk-field"><span>성별</span>
            <div className="bk-seg">
              {(['F', 'M'] as const).map(s => (
                <button key={s} type="button" className={f.sex === s ? 'on' : ''} onClick={() => setF({ ...f, sex: s })}>{s === 'F' ? '여성' : '남성'}</button>
              ))}
            </div>
          </div>

          <div className="bk-consent">
            <label><input type="checkbox" checked={all} onChange={e => setConsent({ terms: e.target.checked, privacy: e.target.checked, marketing: e.target.checked })} /><b>전체 동의</b></label>
            <label><input type="checkbox" checked={consent.terms} onChange={e => setConsent({ ...consent, terms: e.target.checked })} />[필수] 서비스 이용약관 동의</label>
            <label><input type="checkbox" checked={consent.privacy} onChange={e => setConsent({ ...consent, privacy: e.target.checked })} />[필수] 개인정보 수집·이용 동의</label>
            <p>수집 항목: 이메일, 이름, 휴대폰 번호, 생년월일, 성별 · 이용 목적: 회원 관리, 검진 예약 및 결과 안내 · 보유 기간: 회원 탈퇴 시까지(관련 법령에 따른 보존 기간 제외)</p>
            <label><input type="checkbox" checked={consent.marketing} onChange={e => setConsent({ ...consent, marketing: e.target.checked })} />[선택] 검진 소식·이벤트 안내 수신 동의</label>
          </div>

          {error && <p className="bk-error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy || !ready}>{busy ? '가입 중…' : '가입 완료'}</button>
        </form>
      )}

      <p className="au-alt">이미 회원이신가요? <Link href={`/login?next=${encodeURIComponent(next)}`}>로그인</Link></p>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-line" style={{ width: '100%' }} onClick={async () => { await post('/api/auth/logout', {}); router.replace('/'); router.refresh(); }}>
      로그아웃
    </button>
  );
}
