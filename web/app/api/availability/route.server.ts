import { getAvailability } from '@/lib/booking/service';
import { handle } from '@/lib/booking/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return handle(async () => ({
    slots: await getAvailability(q.get('plan') ?? '', q.get('couple') === '1', q.get('date') ?? ''),
  }));
}
