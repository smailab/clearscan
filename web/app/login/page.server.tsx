import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { LoginForm } from '@/components/auth/AuthForms';
import { currentUser } from '@/lib/auth/members';
import { safeNext } from '@/lib/auth/http';

export const metadata: Metadata = { title: '로그인 | BOSCO LONGEVITY', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return (
    <Shell heroHeader={false} cta={false}>
      <section className="sec au-sec" style={{ marginTop: 0 }}>
        <h1 className="bk-h">로그인</h1>
        <p className="sec-sub">검진 예약과 결과 조회는 회원만 이용할 수 있어요.</p>
        <LoginForm next={next} />
      </section>
    </Shell>
  );
}
