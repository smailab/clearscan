-- ORAE 디자인 LongeviTube(/videos): 회원별 좋아요 · 나중에 볼 영상 · 시청 기록
-- 영상 자체는 lt_videos(유튜브형 LongeviTube와 공용)에 있다
CREATE TABLE IF NOT EXISTS video_marks (
  user_id     TEXT NOT NULL,
  video_id    TEXT NOT NULL,
  kind        TEXT NOT NULL,                 -- like | save | history
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, video_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_video_marks_user ON video_marks (user_id, kind, created_at);
