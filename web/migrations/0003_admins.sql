-- 관리자 계정 (회원과 분리. 공개 가입 경로 없음 — 대표 관리자가 추가하거나 scripts/create-admin.mjs로 생성)
CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,             -- 'owner' | 'staff'
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT
);

-- 관리자 세션 (쿠키에는 원본 토큰, DB에는 SHA-256 해시만 저장)
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions (admin_id);

-- 검사 결과를 마지막으로 수정한 관리자
ALTER TABLE results ADD COLUMN updated_by TEXT;
