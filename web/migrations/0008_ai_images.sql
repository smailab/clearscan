-- AI 이미지 생성 기록 (관리자별 하루 생성 한도 확인 · 이력 조회)
CREATE TABLE IF NOT EXISTS ai_images (
  id          TEXT PRIMARY KEY,
  admin_name  TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  size        TEXT NOT NULL,
  quality     TEXT NOT NULL,
  model       TEXT NOT NULL,
  url         TEXT,              -- 성공 시 /media/… 주소
  error       TEXT,              -- 실패 사유
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_images_created ON ai_images (created_at);
