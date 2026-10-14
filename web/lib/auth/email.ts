import 'server-only';

// 인증 메일 발송. 발송 업체에 묶이지 않도록 여기 한 곳에서만 처리한다.
// - RESEND_API_KEY + EMAIL_FROM 이 설정되어 있으면 Resend API로 발송
// - EMAIL_DEV_MODE=1 이면 메일을 보내지 않고 인증번호를 응답/로그로 돌려준다 (로컬 테스트 전용, 운영 금지)
// - 둘 다 없으면 발송 불가 오류

export type SendResult = { sent: true } | { sent: false; devCode: string };

export class EmailNotConfiguredError extends Error {}
export class EmailRejectedError extends Error {}

export function emailDevMode(): boolean {
  return process.env.EMAIL_DEV_MODE === '1';
}

export async function sendVerificationEmail(to: string, code: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `[THOR SCAN LONGEVITY] 이메일 인증번호 ${code}`,
        text: `THOR SCAN LONGEVITY 회원가입 이메일 인증번호는 ${code} 입니다.\n10분 안에 입력해 주세요.\n\n본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.`,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6">
          <p>THOR SCAN LONGEVITY 회원가입 이메일 인증번호입니다.</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>
          <p>10분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p></div>`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // 도메인 미인증(테스트 모드)에서는 계정 소유자 이메일 외의 수신자를 Resend가 403으로 거절한다
      if (res.status === 403 || res.status === 422) throw new EmailRejectedError(`메일 발송 거절: ${res.status} ${detail}`);
      throw new Error(`메일 발송 실패: ${res.status} ${detail}`);
    }
    return { sent: true };
  }

  if (emailDevMode()) {
    console.log(`[EMAIL_DEV_MODE] ${to} 인증번호: ${code}`);
    return { sent: false, devCode: code };
  }

  throw new EmailNotConfiguredError('메일 발송 설정(RESEND_API_KEY, EMAIL_FROM)이 없습니다.');
}
