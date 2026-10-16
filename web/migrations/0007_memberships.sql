-- 멤버십 티어 (관리자 '멤버십'에서 수정). 연 회비는 회원에게만 보이고, 비워 두면 '상담 후 안내'
CREATE TABLE IF NOT EXISTS membership_tiers (
  id           TEXT PRIMARY KEY,              -- 고정 ID (영문 소문자·숫자·-)
  name         TEXT NOT NULL,                 -- 예: ESSENTIAL
  name_ko      TEXT NOT NULL,                 -- 예: 에센셜
  tagline      TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  price        INTEGER,                       -- 연 회비 (원). NULL이면 상담 후 안내
  seats        INTEGER NOT NULL DEFAULT 1,    -- 기본 포함 인원 (가족형은 2 이상)
  benefits     TEXT NOT NULL DEFAULT '[]',    -- 혜택 목록 JSON (문자열 배열)
  featured     INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL,
  updated_by   TEXT
);

INSERT OR IGNORE INTO membership_tiers (id, name, name_ko, tagline, description, price, seats, benefits, featured, active, sort_order, updated_at) VALUES
('essential', 'ESSENTIAL', '에센셜', '나의 건강 기준점을 세우는 연간 멤버십',
 '1년에 한 번 정밀 영상 검진으로 현재 상태를 정확히 확인하고, 전문의 결과 상담과 맞춤 건강 리포트로 다음 1년을 계획합니다.',
 NULL, 1,
 '["연 1회 전신 MRI 정밀 검진 (연간 MRI)","영상의학과 전문의 판독 및 1:1 결과 상담","개인 맞춤 건강 리포트와 생활 관리 가이드","회원 전용 페이지에서 검사 결과 상시 조회","검진 우선 예약"]',
 0, 1, 10, '2026-10-16T00:00:00.000Z'),
('signature', 'SIGNATURE', '시그니처', '전담 컨시어지와 함께하는 프리미엄 장수 관리',
 '확장 정밀 검진에 전담 메디컬 컨시어지가 1년 내내 함께합니다. 결과에 따른 추적 검사와 전문 진료 연계까지 한 번에 관리합니다.',
 NULL, 1,
 '["에센셜의 모든 혜택","척추 포함 확장 MRI와 심장·폐 CT 중 선택 검사","전담 메디컬 컨시어지 배정 및 연중 1:1 상담","연 2회 추적 상담과 맞춤 건강 플랜 업데이트","이상 소견 시 전문 진료·추가 검사 우선 연계","회원 전용 건강 세미나 초대"]',
 1, 1, 20, '2026-10-16T00:00:00.000Z'),
('family', 'FAMILY', '패밀리', '가족이 함께 지키는 건강 수명',
 '배우자와 부모님, 성인 자녀까지 가족 단위로 가입해 같은 기준으로 검진하고, 가족 건강 이력을 함께 관리합니다.',
 NULL, 2,
 '["가족 구성원별 연 1회 전신 MRI 정밀 검진","구성원별 전문의 1:1 결과 상담","가족 건강 이력 통합 관리와 가족력 기반 맞춤 가이드","가족 동반 예약 (같은 날 연이어 검진)","인원 추가 시 1인당 회비 할인"]',
 0, 1, 30, '2026-10-16T00:00:00.000Z');

-- 멤버십 가입 신청 (신청 → 컨시어지 상담 → 가입 확정). 결제는 상담 후 별도 진행
CREATE TABLE IF NOT EXISTS membership_applications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  tier_id       TEXT NOT NULL,
  tier_name     TEXT NOT NULL,               -- 신청 당시 티어 이름
  seats         INTEGER NOT NULL DEFAULT 1,
  contact_time  TEXT NOT NULL,               -- 연락 희망 시간대
  goals         TEXT NOT NULL DEFAULT '[]',  -- 관심 분야 JSON
  memo          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL,               -- requested | contacted | active | cancelled
  admin_memo    TEXT NOT NULL DEFAULT '',
  started_at    TEXT,                        -- 가입 확정일 (YYYY-MM-DD)
  expires_at    TEXT,                        -- 만료일 (YYYY-MM-DD)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  updated_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_membership_apps_user ON membership_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_membership_apps_status ON membership_applications (status, created_at);
