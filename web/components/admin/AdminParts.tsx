'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ConfirmButton, { postJson } from '@/components/ConfirmButton';

async function post(url: string, data: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? '요청에 실패했습니다.' };
  } catch {
    return { ok: false, error: '네트워크 오류가 발생했습니다.' };
  }
}

const pwRule = (pw: string) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await post('/api/admin/login', { email, password });
    setBusy(false);
    if (!r.ok) { setError(r.error!); return; }
    router.replace(next);
    router.refresh();
  }

  return (
    <form className="admin-login-box" onSubmit={submit}>
      <label>이메일<input type="email" value={email} autoComplete="username" autoFocus onChange={e => setEmail(e.target.value)} /></label>
      <label>비밀번호<input type="password" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} /></label>
      {error && <p className="bk-error">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !email || !password}>{busy ? '로그인 중…' : '관리자 로그인'}</button>
    </form>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button type="button" className="admin-linkbtn" onClick={async () => { await post('/api/admin/logout', {}); router.replace('/admin/login'); router.refresh(); }}>
      로그아웃
    </button>
  );
}

export function NewAdminForm() {
  const router = useRouter();
  const [f, setF] = useState({ email: '', name: '', role: 'staff' as 'owner' | 'staff', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const r = await post('/api/admin/admins', f);
    setBusy(false);
    if (!r.ok) { setMsg(r.error!); return; }
    setMsg(`${f.name} 계정을 만들었습니다. 초기 비밀번호를 본인에게 안전하게 전달하고, 첫 로그인 후 바꾸도록 안내해 주세요.`);
    setF({ email: '', name: '', role: 'staff', password: '' });
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <h3>관리자 추가</h3>
      <div className="admin-form-row">
        <label>이름<input value={f.name} maxLength={20} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <label>이메일 (로그인 아이디)<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
        <label>권한
          <select value={f.role} onChange={e => setF({ ...f, role: e.target.value as 'owner' | 'staff' })}>
            <option value="staff">일반 관리자 (예약·결과·회원 관리)</option>
            <option value="owner">대표 관리자 (+ 관리자 계정 관리)</option>
          </select>
        </label>
        <label>초기 비밀번호<input type="text" value={f.password} autoComplete="off" onChange={e => setF({ ...f, password: e.target.value })} placeholder="영문·숫자 포함 8자 이상" /></label>
      </div>
      <div className="re-actions">
        <button className="btn btn-primary" disabled={busy || !f.name || !f.email || !pwRule(f.password)}>{busy ? '추가 중…' : '추가'}</button>
        {msg && <span>{msg}</span>}
      </div>
    </form>
  );
}

// 관리자 목록의 한 줄에서 쓰는 조작 버튼 (대표 관리자만 보인다)
export function AdminRowActions({ id, active, role, isSelf }: { id: string; active: boolean; role: 'owner' | 'staff'; isSelf: boolean }) {
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');

  const update = async (change: Record<string, unknown>) => {
    const err = await postJson('/api/admin/admins/update', { id, ...change });
    if (!err) router.refresh();
    return err;
  };

  async function resetPassword() {
    if (!pwRule(pw)) { setMsg('영문과 숫자를 포함해 8자 이상 입력해 주세요.'); return; }
    const err = await postJson('/api/admin/admins/update', { id, password: pw });
    setMsg(err ?? '비밀번호를 바꿨습니다. 해당 관리자의 기존 로그인은 해제됐습니다.');
    if (!err) { setPw(''); setPwOpen(false); }
  }

  if (isSelf) return <small>본인 계정</small>;
  return (
    <div className="admin-actions">
      <ConfirmButton
        label={role === 'owner' ? '일반으로' : '대표로'}
        message={role === 'owner' ? '일반 관리자로 바꿀까요?' : '대표 관리자로 바꿀까요? 관리자 계정 관리 권한이 생깁니다.'}
        onConfirm={() => update({ role: role === 'owner' ? 'staff' : 'owner' })}
      />
      <button type="button" onClick={() => { setPwOpen(o => !o); setMsg(''); }}>비밀번호 초기화</button>
      <ConfirmButton
        label={active ? '비활성화' : '활성화'}
        className={active ? 'danger' : ''}
        danger={active}
        message={active ? '이 관리자 계정을 비활성화할까요? 즉시 로그아웃됩니다.' : '이 관리자 계정을 다시 활성화할까요?'}
        onConfirm={() => update({ active: !active })}
      />
      {pwOpen && (
        <div className="cb-ask">
          <div className="cb-msg">새 비밀번호 <small>(영문·숫자 포함 8자 이상)</small></div>
          <input type="text" value={pw} autoComplete="off" onChange={e => setPw(e.target.value)} className="cb-input" />
          <div className="cb-actions">
            <button type="button" className="cb-cancel" onClick={() => { setPwOpen(false); setPw(''); }}>취소</button>
            <button type="button" className="cb-ok" onClick={resetPassword}>변경</button>
          </div>
        </div>
      )}
      {msg && <small className="admin-msg">{msg}</small>}
    </div>
  );
}

export function ChangePasswordForm() {
  const [f, setF] = useState({ current: '', next: '', next2: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const r = await post('/api/admin/password', { current: f.current, next: f.next });
    setBusy(false);
    setMsg(r.ok ? '비밀번호를 바꿨습니다. 다른 기기의 로그인은 해제됐습니다.' : r.error!);
    if (r.ok) setF({ current: '', next: '', next2: '' });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <h3>비밀번호 변경</h3>
      <div className="admin-form-row">
        <label>현재 비밀번호<input type="password" value={f.current} autoComplete="current-password" onChange={e => setF({ ...f, current: e.target.value })} /></label>
        <label>새 비밀번호<input type="password" value={f.next} autoComplete="new-password" onChange={e => setF({ ...f, next: e.target.value })} placeholder="영문·숫자 포함 8자 이상" /></label>
        <label>새 비밀번호 확인<input type="password" value={f.next2} autoComplete="new-password" onChange={e => setF({ ...f, next2: e.target.value })} /></label>
      </div>
      <div className="re-actions">
        <button className="btn btn-primary" disabled={busy || !f.current || !pwRule(f.next) || f.next !== f.next2}>{busy ? '변경 중…' : '변경'}</button>
        {msg && <span>{msg}</span>}
      </div>
    </form>
  );
}
