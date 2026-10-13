import { isAdmin } from '@/lib/booking/admin';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';
import { getByCode } from '@/lib/booking/store';
import { RESULT_STATUS, saveResult, type ResultStatus } from '@/lib/booking/results';

type Input = { code: string; status: ResultStatus; summary: string; findings?: string; recommendation?: string; published?: boolean };

export async function POST(req: Request) {
  return handle(async () => {
    if (!(await isAdmin())) throw new BookingError('관리자 로그인이 필요합니다.', 401);
    const r = await body<Input>(req);
    const b = await getByCode(String(r.code ?? ''));
    if (!b) throw new BookingError('예약을 찾을 수 없습니다.', 404);
    if (!b.userId) throw new BookingError('회원과 연결되지 않은 예약입니다.');
    if (!(r.status in RESULT_STATUS)) throw new BookingError('판정을 선택해 주세요.');
    const summary = String(r.summary ?? '').trim();
    if (!summary) throw new BookingError('결과 요약을 입력해 주세요.');
    await saveResult({
      bookingCode: b.code,
      userId: b.userId,
      status: r.status,
      summary: summary.slice(0, 500),
      findings: String(r.findings ?? '').slice(0, 5000),
      recommendation: String(r.recommendation ?? '').slice(0, 2000),
      published: Boolean(r.published),
    });
    return { ok: true };
  });
}
