import { verifyEmailCode } from '@/lib/auth/members';
import { body, handle } from '@/lib/booking/http';

export async function POST(req: Request) {
  return handle(async () => {
    const { email, code } = await body<{ email: string; code: string }>(req);
    await verifyEmailCode(email, code);
    return { ok: true };
  });
}
