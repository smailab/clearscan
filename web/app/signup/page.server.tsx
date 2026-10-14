import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { SignupForm } from '@/components/auth/AuthForms';
import { currentUser } from '@/lib/auth/members';
import { safeNext } from '@/lib/auth/http';

export const metadata: Metadata = { title: '회원가입 | Scan Longevity', robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, '/booking');
  if (await currentUser()) redirect(next);
  return (
    <Shell heroHeader={false} cta={false}>
      <section className="sec au-sec" style={{ marginTop: 0 }}>
        <h1 className="bk-h">회원가입</h1>
        <p className="sec-sub">가입하면 예약 내역과 검사 결과를 내 페이지에서 확인할 수 있어요.</p>
        <SignupForm next={next} />
      </section>
    </Shell>
  );
}
