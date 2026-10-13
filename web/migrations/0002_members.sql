-- 회원 (이메일이 로그인 아이디)
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  email_verified_at TEXT NOT NULL,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  birth             TEXT NOT NULL,
  sex               TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  password_salt     TEXT NOT NULL,
  marketing_opt_in  INTEGER NOT NULL DEFAULT 0,
  consent_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  failed_logins     INTEGER NOT NULL DEFAULT 0,
  locked_until      TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

-- 이메일 인증번호 (인증번호는 해시만 저장)
CREATE TABLE IF NOT EXISTS email_verifications (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  sent_count  INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL,
  last_sent_at TEXT NOT NULL,
  verified_at TEXT
);

-- 로그인 세션 (쿠키에는 원본 토큰, DB에는 SHA-256 해시만 저장)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- 예약과 회원 연결
ALTER TABLE bookings ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id);

-- 검사 결과 (텍스트, 예약 1건당 1건, 관리자가 공개해야 회원에게 보인다)
CREATE TABLE IF NOT EXISTS results (
  booking_code   TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  status         TEXT NOT NULL,
  summary        TEXT NOT NULL,
  findings       TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT '',
  published      INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_results_user ON results (user_id);
