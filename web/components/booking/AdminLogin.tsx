'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) router.refresh();
    else setError((await res.json()).error ?? '로그인에 실패했습니다.');
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="관리자 비밀번호" autoFocus />
      <button className="btn btn-primary">로그인</button>
      {error && <p className="bk-error">{error}</p>}
    </form>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button type="button" onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.refresh(); }}>로그아웃</button>
  );
}
