import { getAvailability } from '@/lib/booking/service';
import { handle } from '@/lib/booking/http';

export const dynamic = 'force-dynamic';

// ?plans=annual,lung-ct (여러 상품) 또는 ?plan=annual (예전 단일 상품)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const planIds = (q.get('plans') ?? q.get('plan') ?? '').split(',');
  return handle(async () => ({
    slots: await getAvailability(planIds, q.get('couple') === '1', q.get('date') ?? ''),
  }));
}
