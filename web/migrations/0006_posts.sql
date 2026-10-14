-- 건강 칼럼 (메인 '왜 전신 MRI인가요?' 섹션의 블로그 글). 관리자 에디터로 작성한 HTML을 저장 시 정제해서 보관한다
CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,     -- 주소 (/posts/<slug>)
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL DEFAULT '', -- 목록·검색 결과에 보이는 요약
  cover_image  TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '', -- 정제된 HTML
  status       TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  published_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  author       TEXT,
  updated_by   TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts (status, published_at);
