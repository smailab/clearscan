// 검진 센터 타입·도우미 — 클라이언트와 서버가 함께 쓴다 (DB 접근은 lib/centers.ts)

export type Doctor = {
  name: string;
  title: string;
  specialty?: string;
  education?: string[];
  career?: string[];
  societies?: string[];
  photo?: string;
};

export type CenterHours = { label: string; value: string; note?: string };
export type CenterLink = { label: string; url: string };

export type Center = {
  id: string;
  name: string;
  region: string;
  address: string;
  addressDetail: string;
  phone: string;
  homepage?: string;   // 비어 있으면 '준비 중'
  notice?: string;
  intro: string;
  image: string;
  gallery: string[];
  hours: CenterHours[]; // [평일, 토요일, 일요일] 순서 — 상세 페이지 '오늘' 표시에 사용
  links?: CenterLink[];
  equipment: string[];
  highlights: string[];
  planIds: string[];
  doctors: Doctor[];
  active: boolean;
  sortOrder: number;
};

export const CENTER_ID_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

export const mapLinks = (c: Pick<Center, 'name' | 'address'>) => {
  const q = encodeURIComponent(c.name);
  const addr = encodeURIComponent(c.address);
  return {
    naver: `https://map.naver.com/p/search/${q}`,
    kakao: `https://map.kakao.com/?q=${addr}`,
    google: `https://www.google.com/maps/search/?api=1&query=${addr}`,
  };
};

// 관리자 센터 편집에서 고를 수 있는 사진 (public/images)
export const CENTER_IMAGES = [
  ...[1, 2, 3, 4, 5, 6, 7].map(n => `/images/centers/iro/interior${n}.png`),
  '/images/lobby.png',
  '/images/consult.png',
  '/images/scan-woman.png',
  '/images/scan-man.png',
];

export const DOCTOR_IMAGES = [1, 2, 3, 4].map(n => `/images/centers/iro/doctor${n}.png`);

// 의료진 진료과 목록 (센터 목록 태그용)
export const specialtiesOf = (c: Pick<Center, 'doctors'>) =>
  [...new Set(c.doctors.map(d => d.specialty?.split(' ')[0]).filter(Boolean))] as string[];
