-- 예약 본문 (전체 내용은 data에 JSON으로 저장, 조회용 열만 따로 둔다)
CREATE TABLE IF NOT EXISTS bookings (
  code       TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  time       TEXT NOT NULL,
  resource   TEXT NOT NULL,
  status     TEXT NOT NULL,
  phone      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date, time);

-- 장비 점유 슬롯: (장비, 날짜, 30분 슬롯 시작) 하나당 예약 한 건만 들어갈 수 있다
-- 동시에 같은 시간을 예약해도 이 PRIMARY KEY 때문에 한 건만 저장된다
CREATE TABLE IF NOT EXISTS booking_slots (
  resource   TEXT NOT NULL,
  date       TEXT NOT NULL,
  slot_start INTEGER NOT NULL,
  code       TEXT NOT NULL,
  PRIMARY KEY (resource, date, slot_start)
);
CREATE INDEX IF NOT EXISTS idx_booking_slots_code ON booking_slots (code);
