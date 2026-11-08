// LongeviTube 영상 — 클라이언트와 서버가 함께 쓰는 타입·도우미

export type VideoCategory = { id: string; name: string; sortOrder: number };

export type Video = {
  id: string;
  yt: string;
  title: string;
  orig: string;
  speaker: string;
  channel: string;
  cat: string;
  cats: string[];      // 추가 카테고리
  level: string;
  format: string;
  desc: string;
  tags: string[];
  points: string[];
  sortOrder: number;
  active: boolean;
};

export type MarkKind = 'like' | 'save' | 'history';

export const VIDEO_ID_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;
export const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const LEVELS = ['입문', '중급', '심화'] as const;
export const FORMATS = ['강연', '팟캐스트', '인터뷰', '애니메이션', '다큐', '클립', '토론'] as const;

export const thumbUrl = (yt: string, big = false) => `https://i.ytimg.com/vi/${yt}/${big ? 'hqdefault' : 'mqdefault'}.jpg`;
export const isKorean = (v: Pick<Video, 'id' | 'tags'>) => v.id.startsWith('ko-') || v.tags.includes('한국어');
export const catsOf = (v: Pick<Video, 'cat' | 'cats'>) => [v.cat, ...v.cats.filter(c => c !== v.cat)];

// 유튜브 주소(watch?v= / youtu.be / shorts / embed) 또는 11자 ID에서 영상 ID를 꺼낸다
export function parseYt(input: string): string | null {
  const s = String(input ?? '').trim();
  if (YT_ID_RE.test(s)) return s;
  try {
    const u = new URL(s);
    if (/youtu\.be$/.test(u.hostname)) return YT_ID_RE.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    const v = u.searchParams.get('v');
    if (v && YT_ID_RE.test(v)) return v;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}
