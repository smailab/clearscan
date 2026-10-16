// 멤버십 — 클라이언트와 서버가 함께 쓰는 타입·상수

export type Tier = {
  id: string;
  name: string;      // 예: SIGNATURE
  nameKo: string;    // 예: 시그니처
  tagline: string;
  description: string;
  seats: number;     // 기본 포함 인원 (2 이상이면 가족형)
  benefits: string[];
  featured: boolean;
  active: boolean;
  sortOrder: number;
};

export type TierWithPrice = Tier & { price: number | null }; // null이면 상담 후 안내

export const TIER_ID_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

export const APP_STATUS = {
  requested: { label: '상담 대기', tone: 'warn' },
  contacted: { label: '상담 중', tone: 'info' },
  active: { label: '멤버십 이용 중', tone: 'ok' },
  cancelled: { label: '취소', tone: 'off' },
} as const;
export type AppStatus = keyof typeof APP_STATUS;

export const CONTACT_TIMES = ['평일 오전 (9~12시)', '평일 오후 (13~18시)', '평일 저녁 (18~20시)', '토요일 오전'] as const;

export const GOALS = ['암 조기 발견', '심혈관 건강', '뇌 건강', '대사·체중 관리', '척추·관절', '가족력 관리', '전반적인 건강 수명'] as const;

export const MAX_SEATS = 6;
