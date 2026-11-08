import { requireAdmin } from '@/lib/auth/admins';
import { BookingError } from '@/lib/booking/service';
import { body, handle } from '@/lib/booking/http';
import { LtError, loadLongevitube, saveLongevitube } from '@/lib/longevitube';

// LongeviTube 관리자 — 카테고리·영상 전체를 불러오고(GET) 통째로 게시한다(PUT). ClearScan 관리자 계정으로 로그인해야 한다.
export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    const state = await loadLongevitube();
    return { ...state, admin: { name: admin.name, role: admin.role } };
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { version, data, log } = await body<{ version: number; data: unknown; log?: unknown }>(req);
    const summary = Array.isArray(log) ? log.map(String).join(' / ') : '';
    try {
      return { ok: true, ...(await saveLongevitube(data, Number(version), admin.name, summary)) };
    } catch (e) {
      if (e instanceof LtError) throw new BookingError(e.message, e.status);
      throw e;
    }
  });
}
