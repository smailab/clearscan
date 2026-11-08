import { loadLongevitube, toScript } from '@/lib/longevitube';

// LongeviTube 사이트(/longevitube/)가 <script>로 불러가는 카테고리·영상 데이터 (공개)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data } = await loadLongevitube();
    return new Response(toScript(data), {
      headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    console.error(e);
    return new Response('console.error("LongeviTube 데이터를 불러오지 못했습니다.");\nconst CATEGORIES = [], CATEGORY_ALIAS = {}, VIDEOS = [];\n', {
      status: 500,
      headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
