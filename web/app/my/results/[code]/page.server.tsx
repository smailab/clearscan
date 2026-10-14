import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { currentUser } from '@/lib/auth/members';
import { RESULT_STATUS, resultByCode } from '@/lib/booking/results';
import { formatDateKo } from '@/lib/booking/schedule';
import { BookingError, myBooking, planNameOf } from '@/lib/booking/service';
import { site } from '@/lib/data';
import { listCenters } from '@/lib/centers';

export const metadata: Metadata = { title: '검사 결과 | Scan Longevity', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/my/results/${encodeURIComponent(code)}`);

  // 본인 예약이 아니거나, 공개되지 않은 결과는 보여주지 않는다
  let booking;
  try {
    booking = await myBooking(user, code);
  } catch (e) {
    if (e instanceof BookingError) notFound();
    throw e;
  }
  const result = await resultByCode(booking.code);
  if (!result || !result.published || result.userId !== user.id) notFound();

  const s = RESULT_STATUS[result.status];
  const [planName, centers] = await Promise.all([planNameOf(booking), listCenters()]);

  return (
    <Shell heroHeader={false} back="/my">
      <section className="sec rs-head" style={{ marginTop: 0 }}>
        <p className="rs-eyebrow">검사 결과</p>
        <h1>{planName}</h1>
        <p className="rs-meta">{formatDateKo(booking.date)} · {centers[0]?.name} · {booking.code}</p>
        <div className={`rs-status ${s.tone}`}>
          <span>종합 판정</span>
          <b>{s.label}</b>
        </div>
        <p className="rs-summary">{result.summary}</p>
      </section>

      {result.findings && (
        <section className="sec">
          <h2 className="ct-h">판독 소견</h2>
          <p className="rs-text">{result.findings}</p>
        </section>
      )}

      {result.recommendation && (
        <section className="sec">
          <h2 className="ct-h">권고 사항</h2>
          <p className="rs-text">{result.recommendation}</p>
        </section>
      )}

      <section className="sec">
        <p className="note">
          이 결과는 검진 결과 안내이며 확정 진단이 아닙니다. 궁금한 점이나 상담이 필요하시면 상담 전화 {site.phone}로 문의해 주세요.
          최종 수정 {new Date(result.updatedAt).toLocaleDateString('ko-KR')}
        </p>
        <div style={{ marginTop: 12 }}><Link className="btn btn-line" href="/my" style={{ width: '100%' }}>내 페이지로</Link></div>
      </section>
    </Shell>
  );
}
