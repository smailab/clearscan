// 배포 모드
// - 서버 배포(기본): 온라인 예약·조회·관리자 기능 사용
// - 정적 배포(GitHub Pages): NEXT_PUBLIC_STATIC_SITE=1 — 서버 기능 없이 전화·네이버 예약으로 안내
export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === '1';
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
