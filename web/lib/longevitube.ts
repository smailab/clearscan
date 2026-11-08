import 'server-only';
import { getDB, type D1Stmt } from '@/lib/db';

// LongeviTube (/longevitube) — 장수·건강수명 유튜브 영상 큐레이션.
// 카테고리·영상은 D1(lt_* 표)에 저장하고, 관리자 페이지(/admin/longevitube/)에서 통째로 편집·게시한다.

export type LtCategory = { id: string; name: string; icon: string; colors?: [string, string] };
export type LtVideo = {
  id: string; yt: string; cat: string; cats?: string[];
  level: string; format: string; title: string; orig: string; speaker: string; channel: string; desc: string; tags: string[];
};
export type LtData = { cats: LtCategory[]; alias: Record<string, string>; videos: LtVideo[] };
export type LtState = { version: number; updatedAt: string | null; updatedBy: string | null; data: LtData };

export class LtError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const LIMITS = { videos: 3000, cats: 40, title: 200, orig: 300, short: 80, desc: 3000, tags: 20, tag: 30 };
const CAT_ID = /^[a-z][a-z0-9-]{1,29}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{1,80}$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const LEVELS = ['입문', '중급', '심화'];

export async function loadLongevitube(): Promise<LtState> {
  const db = await getDB();
  const [cats, aliases, videos, meta] = await Promise.all([
    db.prepare('SELECT id, name, icon, colors FROM lt_categories ORDER BY sort').all<{ id: string; name: string; icon: string; colors: string | null }>(),
    db.prepare('SELECT old_id, new_id FROM lt_aliases ORDER BY old_id').all<{ old_id: string; new_id: string }>(),
    db.prepare('SELECT data FROM lt_videos ORDER BY sort').all<{ data: string }>(),
    db.prepare('SELECT key, value FROM lt_meta').all<{ key: string; value: string }>(),
  ]);
  const m = Object.fromEntries(meta.results.map(r => [r.key, r.value]));
  return {
    version: Number(m.version ?? 0),
    updatedAt: m.updated_at ?? null,
    updatedBy: m.updated_by ?? null,
    data: {
      cats: cats.results.map(c => {
        const out: LtCategory = { id: c.id, name: c.name, icon: c.icon };
        if (c.colors) { try { out.colors = JSON.parse(c.colors); } catch { /* 무시 */ } }
        return out;
      }),
      alias: Object.fromEntries(aliases.results.map(a => [a.old_id, a.new_id])),
      videos: videos.results.map(v => JSON.parse(v.data) as LtVideo),
    },
  };
}

// 사이트(/longevitube/js/app.js)가 읽는 전역 변수 형태의 JS
export function toScript(d: LtData): string {
  const j = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `/* LongeviTube 데이터 — D1에서 생성됨 */\nconst CATEGORIES = ${j(d.cats)};\nconst CATEGORY_ALIAS = ${j(d.alias)};\nconst VIDEOS = ${j(d.videos)};\n`;
}

// ---------- 저장 (관리자) ----------

const str = (v: unknown, max: number, what: string) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (s.length > max) throw new LtError(`${what}이(가) 너무 깁니다 (최대 ${max}자).`);
  return s;
};

export function sanitize(input: unknown): LtData {
  const d = input as Partial<LtData> | null;
  if (!d || !Array.isArray(d.cats) || !Array.isArray(d.videos) || typeof d.alias !== 'object' || d.alias === null) {
    throw new LtError('잘못된 데이터입니다.');
  }
  if (!d.cats.length) throw new LtError('카테고리가 하나 이상 있어야 합니다.');
  if (d.cats.length > LIMITS.cats) throw new LtError(`카테고리는 최대 ${LIMITS.cats}개입니다.`);
  if (d.videos.length > LIMITS.videos) throw new LtError(`영상은 최대 ${LIMITS.videos}개입니다.`);

  const catIds = new Set<string>();
  const cats: LtCategory[] = d.cats.map(raw => {
    const c = raw as Partial<LtCategory>;
    const id = str(c.id, 30, '카테고리 id');
    if (!CAT_ID.test(id)) throw new LtError(`카테고리 id ‘${id}’가 올바르지 않습니다.`);
    if (catIds.has(id)) throw new LtError(`카테고리 id ‘${id}’가 중복됩니다.`);
    catIds.add(id);
    const name = str(c.name, 20, '카테고리 이름');
    if (!name) throw new LtError(`카테고리 ‘${id}’의 이름이 비어 있습니다.`);
    const out: LtCategory = { id, name, icon: str(c.icon, 8, '아이콘') };
    if (Array.isArray(c.colors) && c.colors.length === 2 && c.colors.every(x => typeof x === 'string' && HEX.test(x))) {
      out.colors = [c.colors[0], c.colors[1]];
    }
    return out;
  });

  const alias: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.alias)) {
    if (!CAT_ID.test(k) || typeof v !== 'string' || !catIds.has(v) || catIds.has(k)) continue; // 쓸모없는 별칭은 버린다
    alias[k] = v;
  }

  const ids = new Set<string>();
  const yts = new Set<string>();
  const videos: LtVideo[] = d.videos.map((raw, i) => {
    const v = raw as Partial<LtVideo>;
    const n = `#${i + 1}`;
    const id = str(v.id, 80, `${n} id`);
    if (!VIDEO_ID.test(id)) throw new LtError(`${n} 영상 id가 올바르지 않습니다.`);
    if (ids.has(id)) throw new LtError(`${n} 영상 id ‘${id}’가 중복됩니다.`);
    ids.add(id);
    const yt = str(v.yt, 11, `${n} 유튜브 ID`);
    if (!YT_ID.test(yt)) throw new LtError(`${n} 유튜브 영상 ID가 올바르지 않습니다.`);
    if (yts.has(yt)) throw new LtError(`${n} 같은 유튜브 영상이 이미 있습니다.`);
    yts.add(yt);
    const cat = str(v.cat, 30, `${n} 카테고리`);
    if (!catIds.has(cat)) throw new LtError(`${n} 대표 카테고리 ‘${cat}’가 없습니다.`);
    const title = str(v.title, LIMITS.title, `${n} 제목`);
    if (!title) throw new LtError(`${n} 제목이 비어 있습니다.`);
    const extra = Array.isArray(v.cats) ? [...new Set(v.cats.map(x => String(x)).filter(x => catIds.has(x) && x !== cat))] : [];
    const tags = Array.isArray(v.tags) ? v.tags.map(t => str(t, LIMITS.tag, `${n} 태그`)).filter(Boolean).slice(0, LIMITS.tags) : [];
    const level = LEVELS.includes(String(v.level)) ? String(v.level) : '입문';
    const out: LtVideo = {
      id, yt, cat, level,
      format: str(v.format, 20, `${n} 형식`),
      title,
      orig: str(v.orig, LIMITS.orig, `${n} 원제`),
      speaker: str(v.speaker, LIMITS.short, `${n} 연사`),
      channel: str(v.channel, LIMITS.short, `${n} 채널`),
      desc: str(v.desc, LIMITS.desc, `${n} 설명`),
      tags,
    };
    if (extra.length) out.cats = extra;
    return out;
  });
  return { cats, alias, videos };
}

// 통째로 교체한다. expectedVersion 이 DB 버전과 다르면(그 사이 다른 관리자가 게시) 409.
export async function saveLongevitube(input: unknown, expectedVersion: number, by: string, summary: string): Promise<{ version: number }> {
  const data = sanitize(input);
  const db = await getDB();
  const now = new Date().toISOString();
  const next = Math.trunc(Number(expectedVersion)) + 1;
  if (!Number.isFinite(next) || next < 1) throw new LtError('버전 정보가 올바르지 않습니다.');
  const stmts: D1Stmt[] = [
    // 버전이 다르면 CHECK(ok = 1) 위반으로 이 batch 전체가 취소된다
    db.prepare("INSERT INTO lt_guard (ok) SELECT 0 WHERE (SELECT value FROM lt_meta WHERE key = 'version') IS NOT ?").bind(String(expectedVersion)),
    db.prepare('DELETE FROM lt_videos'),
    db.prepare('DELETE FROM lt_categories'),
    db.prepare('DELETE FROM lt_aliases'),
    db.prepare(`INSERT INTO lt_categories (id, sort, name, icon, colors)
      SELECT json_extract(value, '$.id'), CAST(key AS INTEGER), json_extract(value, '$.name'), json_extract(value, '$.icon'), json_extract(value, '$.colors')
      FROM json_each(?)`).bind(JSON.stringify(data.cats)),
    db.prepare('INSERT INTO lt_aliases (old_id, new_id) SELECT key, value FROM json_each(?)').bind(JSON.stringify(data.alias)),
    db.prepare(`INSERT INTO lt_videos (id, sort, data)
      SELECT json_extract(value, '$.id'), CAST(key AS INTEGER), value FROM json_each(?)`).bind(JSON.stringify(data.videos)),
    db.prepare(`INSERT INTO lt_meta (key, value) VALUES ('version', ?), ('updated_at', ?), ('updated_by', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(String(next), now, by),
    db.prepare('INSERT OR REPLACE INTO lt_history (version, data, saved_at, saved_by, summary) VALUES (?, ?, ?, ?, ?)')
      .bind(next, JSON.stringify(data), now, by, summary.slice(0, 500)),
    db.prepare('DELETE FROM lt_history WHERE version <= ?').bind(next - 30),
  ];
  try {
    await db.batch(stmts);
  } catch (e) {
    if (/CHECK constraint/i.test(String((e as Error).message))) {
      throw new LtError('그 사이 다른 관리자가 먼저 게시했습니다. 최신 내용을 다시 불러온 뒤 수정해 주세요.', 409);
    }
    throw e;
  }
  return { version: next };
}
