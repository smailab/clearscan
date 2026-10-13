import { EmailNotConfiguredError, EmailRejectedError } from '@/lib/auth/email';
import { AuthError, sendEmailCode } from '@/lib/auth/members';
import { body, handle } from '@/lib/booking/http';

export async function POST(req: Request) {
  return handle(async () => {
    const { email } = await body<{ email: string }>(req);
    try {
      const r = await sendEmailCode(email);
      // 개발 모드(EMAIL_DEV_MODE=1)에서만 인증번호를 응답에 포함한다
      return r.sent ? { ok: true } : { ok: true, devCode: r.devCode };
    } catch (e) {
      if (e instanceof EmailRejectedError) {
        console.error(e.message);
        throw new AuthError('현재 테스트 운영 중이라 이 주소로는 인증 메일을 보낼 수 없어요. 상담 전화로 문의해 주세요.', 503);
      }
      if (e instanceof EmailNotConfiguredError) {
        console.error(e.message);
        throw new AuthError('지금은 인증 메일을 보낼 수 없습니다. 상담 전화로 문의해 주세요.', 503);
      }
      throw e;
    }
  });
}
