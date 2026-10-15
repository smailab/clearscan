import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/AdminParts';
import Logo from '@/components/Logo';
import { currentAdmin } from '@/lib/auth/admins';
import { safeNext } from '@/lib/auth/http';

export const metadata: Metadata = { title: '관리자 로그인 | BOSCO LONGEVITY', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, '/admin');
  if (!next.startsWith('/admin')) redirect('/admin/login');
  if (await currentAdmin()) redirect(next);
  return (
    <div className="admin admin-login-page">
      <div className="admin-brand"><Logo size={40} /></div>
      <h1>관리자 로그인</h1>
      <p className="admin-stat">관리자 계정으로 로그인하세요. 계정이 없으면 대표 관리자에게 요청하세요.</p>
      <AdminLoginForm next={next} />
    </div>
  );
}
