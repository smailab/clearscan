// LongeviTube 초기 데이터 → D1 마이그레이션 SQL 생성
// 사용: node scripts/longevitube-seed.mjs <data.js 경로> > migrations/0009_longevitube.sql
// data.js 는 smailab.github.io 저장소의 longevitube/js/data.js (CATEGORIES, CATEGORY_ALIAS, VIDEOS 를 선언하는 파일)
// D1 은 SQL 문 하나가 100KB 를 넘으면 거부하므로 영상은 여러 INSERT 로 나눈다.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('사용: node scripts/longevitube-seed.mjs <data.js 경로>');
  process.exit(1);
}
const src = readFileSync(file, 'utf8');
const { cats, alias, videos } = new Function(
  `${src}\n;return { cats: CATEGORIES, alias: (typeof CATEGORY_ALIAS === 'object' ? CATEGORY_ALIAS : {}), videos: VIDEOS };`,
)();

const q = s => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const out = [];
out.push(`-- LongeviTube (장수·건강수명 영상 큐레이션, /longevitube) — 카테고리·영상은 관리자 페이지(/admin/longevitube/)에서 편집한다
CREATE TABLE IF NOT EXISTS lt_categories (
  id     TEXT PRIMARY KEY,           -- 주소에 쓰이는 id (#/c/<id>)
  sort   INTEGER NOT NULL,
  name   TEXT NOT NULL,
  icon   TEXT NOT NULL DEFAULT '',
  colors TEXT                         -- 썸네일 그라디언트 색 JSON ["#hex","#hex"] (없으면 기본색)
);
-- 통합·삭제된 예전 카테고리 id → 새 id (예전 링크 호환)
CREATE TABLE IF NOT EXISTS lt_aliases (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
);
-- 영상: 순서(sort)가 사이트의 '인기순'. 항목 전체는 JSON 으로 보관
CREATE TABLE IF NOT EXISTS lt_videos (
  id   TEXT PRIMARY KEY,
  sort INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lt_videos_sort ON lt_videos (sort);
-- version: 게시할 때마다 1씩 증가 (동시 편집 충돌 감지), updated_at/updated_by: 마지막 게시
CREATE TABLE IF NOT EXISTS lt_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- 게시 이력 (되돌리기용 스냅샷, 최근 30개 보관)
CREATE TABLE IF NOT EXISTS lt_history (
  version  INTEGER PRIMARY KEY,
  data     TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  saved_by TEXT,
  summary  TEXT
);
-- 동시 편집 보호용: 버전이 다르면 이 표에 0 을 넣으려다 CHECK 로 실패해 게시 전체가 취소된다
CREATE TABLE IF NOT EXISTS lt_guard (ok INTEGER NOT NULL CHECK (ok = 1));
`);

out.push(`INSERT INTO lt_categories (id, sort, name, icon, colors) VALUES\n` +
  cats.map((c, i) => `  (${q(c.id)}, ${i}, ${q(c.name)}, ${q(c.icon || '')}, ${c.colors ? q(JSON.stringify(c.colors)) : 'NULL'})`).join(',\n') + ';');

const aliasKeys = Object.keys(alias);
if (aliasKeys.length) {
  out.push(`INSERT INTO lt_aliases (old_id, new_id) VALUES\n` +
    aliasKeys.map(k => `  (${q(k)}, ${q(alias[k])})`).join(',\n') + ';');
}

const rows = videos.map((v, i) => `  (${q(v.id)}, ${i}, ${q(JSON.stringify(v))})`);
const MAX = 50_000; // 바이트 (한글은 3바이트)
let chunk = [];
let size = 0;
const flush = () => {
  if (!chunk.length) return;
  out.push(`INSERT INTO lt_videos (id, sort, data) VALUES\n${chunk.join(',\n')};`);
  chunk = [];
  size = 0;
};
for (const r of rows) {
  const bytes = Buffer.byteLength(r, 'utf8') + 2;
  if (size + bytes > MAX) flush();
  chunk.push(r);
  size += bytes;
}
flush();

const now = new Date().toISOString();
out.push(`INSERT INTO lt_meta (key, value) VALUES ('version', '1'), ('updated_at', ${q(now)}), ('updated_by', '초기 데이터');`);
process.stdout.write(out.join('\n\n') + '\n');
console.error(`카테고리 ${cats.length}개, 별칭 ${aliasKeys.length}개, 영상 ${videos.length}개`);
