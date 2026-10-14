-- 검진 상품 (관리자 '상품 관리'에서 수정). 가격은 회원에게만 노출된다
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,          -- URL·예약에 쓰는 고정 ID (영문 소문자·숫자·-)
  kind            TEXT NOT NULL,             -- 'MRI' | 'CT'
  name            TEXT NOT NULL,
  time_label      TEXT NOT NULL,             -- 예: 촬영 약 22분
  description     TEXT NOT NULL DEFAULT '',
  price           INTEGER NOT NULL,
  couple_discount INTEGER,                   -- NULL이면 커플 플랜 불가
  slots           INTEGER NOT NULL DEFAULT 1,-- 장비 점유 시간 (30분 단위)
  featured        INTEGER NOT NULL DEFAULT 0,
  image           TEXT NOT NULL,
  groups          TEXT NOT NULL DEFAULT '[]',-- 검사 구성 JSON
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL,
  updated_by      TEXT
);

INSERT OR IGNORE INTO products (id, kind, name, time_label, description, price, couple_discount, slots, featured, image, groups, active, sort_order, updated_at) VALUES ('annual', 'MRI', '연간 MRI', '촬영 약 22분', '매년 한 번, 초기 암 징후를 포함해 수백 가지 질환을 폭넓게 살펴보는 기본 검진', 1390000, 240000, 1, 1, '/images/fullbody.webp', '[{"label":"검사 부위","items":["머리 · 목 · 복부 · 골반","뇌 · 갑상선","간 · 담낭 · 췌장 · 비장","신장 · 부신 · 방광","난소 · 자궁 / 전립선"]},{"label":"함께 확인하는 소견","items":["과거 뇌졸중 흔적","부비동염","지방간","자궁근종","복부대동맥류"]},{"label":"제외 부위","excluded":true,"items":["흉부 · 폐 · 심장 · 유방","팔 · 다리 · 척추","식도 · 소장 · 대장"]}]', 1, 10, '2026-10-14T14:00:53.072Z');
INSERT OR IGNORE INTO products (id, kind, name, time_label, description, price, couple_discount, slots, featured, image, groups, active, sort_order, updated_at) VALUES ('spine', 'MRI', '척추 포함 MRI', '촬영 약 47분', '연간 MRI의 모든 항목에 척추 정밀 평가를 더한 검진', 2360000, 310000, 2, 0, '/images/scan-man.png', '[{"label":"검사 부위","items":["연간 MRI 전 항목","척추 (경추 · 흉추 · 요추)"]},{"label":"척추에서 확인하는 소견","items":["척추 병변","종양","추간판 탈출증 (디스크)","경추 척추관 협착증","척추증","골절","척추측만증","관절염","퇴행성 변화"]},{"label":"제외 부위","excluded":true,"items":["흉부 · 폐 · 심장 · 유방","팔 · 다리","식도 · 소장 · 대장"]}]', 1, 20, '2026-10-14T14:00:53.072Z');
INSERT OR IGNORE INTO products (id, kind, name, time_label, description, price, couple_discount, slots, featured, image, groups, active, sort_order, updated_at) VALUES ('neuro', 'MRI', '근골격·신경 정밀 MRI', '촬영 약 120분 (2회 방문)', '척추 포함 MRI에 신경계와 근골격계 심층 분석까지 더한 가장 포괄적인 검진', 5560000, 420000, 4, 0, '/images/brain-mri.png', '[{"label":"검사 부위","items":["척추 포함 MRI 전 항목","고관절 · 무릎","머리 · 목 동맥 (MR 혈관조영)","뇌 나이 분석","체성분 분석"]},{"label":"신경계 소견","items":["신경 퇴행 가능성","동맥 협착"]},{"label":"근골격계 소견","items":["관절와순 손상 여부","연골 건강 상태","반월상 연골판 손상","전방십자인대(ACL) 손상","내측측부인대(MCL) 손상"]},{"label":"제외 부위","excluded":true,"items":["흉부 · 폐 · 심장 · 유방","팔 · 종아리","식도 · 소장 · 대장"]}]', 1, 30, '2026-10-14T14:00:53.072Z');
INSERT OR IGNORE INTO products (id, kind, name, time_label, description, price, couple_discount, slots, featured, image, groups, active, sort_order, updated_at) VALUES ('heart-ct', 'CT', '심장 CT', '촬영 약 5분', '관상동맥 석회화 수치로 심혈관 질환 위험도를 평가하는 검사', 490000, NULL, 1, 0, '/images/consult.png', '[{"label":"측정 항목","items":["관상동맥 석회화 점수 (심전도 동기화 촬영)"]},{"label":"제외 부위","excluded":true,"items":["유방 · 흉부 · 폐","췌장 · 간 · 신장","식도 · 소장 · 대장"]}]', 1, 40, '2026-10-14T14:00:53.072Z');
INSERT OR IGNORE INTO products (id, kind, name, time_label, description, price, couple_discount, slots, featured, image, groups, active, sort_order, updated_at) VALUES ('lung-ct', 'CT', '폐 CT', '촬영 약 3분', '폐암을 초기 단계에서 찾아내기 위한 선별 검사', 550000, NULL, 1, 0, '/images/lobby.png', '[{"label":"검사 부위","items":["폐 및 주변 흉부 구조"]},{"label":"확인하는 소견","items":["폐결절","종괴","폐기종","기도 이상","심장 크기"]},{"label":"제외 부위","excluded":true,"items":["유방","췌장 · 간 · 신장","식도 · 소장 · 대장"]}]', 1, 50, '2026-10-14T14:00:53.072Z');

-- 쿠폰
CREATE TABLE IF NOT EXISTS coupons (
  code           TEXT PRIMARY KEY,           -- 사용자가 입력하는 코드 (대문자)
  name           TEXT NOT NULL,              -- 관리용 이름 (예: 오픈 기념 10% 할인)
  product_id     TEXT,                       -- NULL이면 전체 상품
  discount_type  TEXT NOT NULL,              -- 'amount'(원) | 'percent'(%)
  discount_value INTEGER NOT NULL,
  max_uses       INTEGER,                    -- NULL이면 무제한
  used_count     INTEGER NOT NULL DEFAULT 0,
  user_id        TEXT,                       -- 특정 회원 전용 발급
  valid_from     TEXT NOT NULL,              -- YYYY-MM-DD (한국 시간, 포함)
  valid_until    TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1,
  batch_id       TEXT,                       -- 같은 발급 묶음
  memo           TEXT NOT NULL DEFAULT '',
  created_by     TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coupons_user ON coupons (user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_batch ON coupons (batch_id);

-- 쿠폰 사용 기록 (예약 1건당 쿠폰 1개, 같은 쿠폰은 회원당 1회)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  booking_code TEXT PRIMARY KEY,
  coupon_code  TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  discount     INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  UNIQUE (coupon_code, user_id)
);
