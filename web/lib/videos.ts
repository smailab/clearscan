import 'server-only';
import { cache } from 'react';
import { getDB } from '@/lib/db';
import { loadLongevitube } from '@/lib/longevitube';
import { catsOf, isKorean, type MarkKind, type Video, type VideoCategory } from './videos-shared';

// ORAE 디자인 LongeviTube(/videos). 영상·카테고리는 유튜브형 LongeviTube(/longevitube/)와 같은 표(lt_*)를 읽고,
// 편집은 /admin/longevitube/ 한 곳에서 한다. 회원별 좋아요·나중에 보기·시청 기록만 video_marks에 따로 저장.

export class VideoError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const load = cache(() => loadLongevitube());

export const listCategories = cache(async (): Promise<VideoCategory[]> =>
  (await load()).data.cats.map((c, i) => ({ id: c.id, name: c.name, sortOrder: i })));

export const listVideos = cache(async (): Promise<Video[]> => {
  const { data } = await load();
  const fix = (c: string) => data.alias[c] ?? c;
  return data.videos.map((v, i) => ({
    id: v.id, yt: v.yt, title: v.title, orig: v.orig ?? '', speaker: v.speaker ?? '', channel: v.channel ?? '',
    cat: fix(v.cat), cats: (v.cats ?? []).map(fix), level: v.level || '입문', format: v.format ?? '', desc: v.desc ?? '',
    tags: v.tags ?? [], points: [], sortOrder: i, active: true,
  }));
});

export async function getVideo(id: string): Promise<Video | null> {
  return (await listVideos()).find(v => v.id === id) ?? null;
}

export type VideoQuery = { cat?: string; speaker?: string; q?: string; sort?: 'popular' | 'ko' | 'title' };

export async function queryVideos(o: VideoQuery): Promise<Video[]> {
  let list = await listVideos();
  if (o.cat) list = list.filter(v => catsOf(v).includes(o.cat!));
  if (o.speaker) list = list.filter(v => v.speaker === o.speaker);
  const q = (o.q ?? '').trim().toLowerCase();
  if (q) {
    list = list.filter(v => [v.title, v.orig, v.speaker, v.channel, v.desc, ...v.tags].some(s => s.toLowerCase().includes(q)));
  }
  if (o.sort === 'ko') list = [...list].sort((a, b) => Number(isKorean(b)) - Number(isKorean(a)) || a.sortOrder - b.sortOrder);
  if (o.sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  return list;
}

// 연사별 영상 수 (많은 순)
export async function speakers(): Promise<{ name: string; count: number }[]> {
  const m = new Map<string, number>();
  for (const v of await listVideos()) if (v.speaker) m.set(v.speaker, (m.get(v.speaker) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
}

// 관련 영상: 같은 대표 카테고리 3점, 겹치는 카테고리 1점, 같은 연사 2점, 같은 태그 1점씩
export async function relatedVideos(v: Video, n = 10): Promise<Video[]> {
  const mine = catsOf(v);
  return (await listVideos())
    .filter(x => x.id !== v.id)
    .map(x => ({
      x,
      s: (x.cat === v.cat ? 3 : catsOf(x).some(c => mine.includes(c)) ? 1 : 0) + (x.speaker && x.speaker === v.speaker ? 2 : 0)
        + x.tags.filter(t => v.tags.includes(t)).length,
    }))
    .sort((a, b) => b.s - a.s || a.x.sortOrder - b.x.sortOrder)
    .slice(0, n)
    .map(r => r.x);
}

// ---------- 회원 표시 (좋아요 · 나중에 보기 · 시청 기록) ----------

export async function myMarks(userId: string, videoId: string): Promise<{ like: boolean; save: boolean }> {
  const db = await getDB();
  const { results } = await db.prepare("SELECT kind FROM video_marks WHERE user_id = ? AND video_id = ? AND kind IN ('like', 'save')")
    .bind(userId, videoId).all<{ kind: string }>();
  return { like: results.some(r => r.kind === 'like'), save: results.some(r => r.kind === 'save') };
}

export async function setMark(userId: string, videoId: string, kind: MarkKind, on: boolean): Promise<void> {
  if (!['like', 'save', 'history'].includes(kind)) throw new VideoError('잘못된 요청입니다.');
  if (!(await getVideo(videoId))) throw new VideoError('영상을 찾을 수 없습니다.', 404);
  const db = await getDB();
  if (on) {
    // 시청 기록은 다시 보면 시각만 새로 고친다
    await db.prepare(
      'INSERT INTO video_marks (user_id, video_id, kind, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, video_id, kind) DO UPDATE SET created_at = excluded.created_at',
    ).bind(userId, videoId, kind, new Date().toISOString()).run();
    if (kind === 'history') {
      // 시청 기록은 최근 100개만 남긴다
      await db.prepare(
        "DELETE FROM video_marks WHERE user_id = ? AND kind = 'history' AND video_id NOT IN (SELECT video_id FROM video_marks WHERE user_id = ? AND kind = 'history' ORDER BY created_at DESC LIMIT 100)",
      ).bind(userId, userId).run();
    }
  } else {
    await db.prepare('DELETE FROM video_marks WHERE user_id = ? AND video_id = ? AND kind = ?').bind(userId, videoId, kind).run();
  }
}

export async function clearHistory(userId: string): Promise<void> {
  const db = await getDB();
  await db.prepare("DELETE FROM video_marks WHERE user_id = ? AND kind = 'history'").bind(userId).run();
}

export async function markedVideos(userId: string, kind: MarkKind): Promise<Video[]> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT video_id FROM video_marks WHERE user_id = ? AND kind = ? ORDER BY created_at DESC')
    .bind(userId, kind).all<{ video_id: string }>();
  const byId = new Map((await listVideos()).map(v => [v.id, v]));
  return results.map(r => byId.get(r.video_id)).filter((v): v is Video => Boolean(v));
}

export async function markCounts(userId: string): Promise<Record<MarkKind, number>> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT kind, count(*) AS n FROM video_marks WHERE user_id = ? GROUP BY kind').bind(userId).all<{ kind: MarkKind; n: number }>();
  const out = { like: 0, save: 0, history: 0 };
  for (const r of results) out[r.kind] = r.n;
  return out;
}
