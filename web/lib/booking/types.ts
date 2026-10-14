export type Person = {
  name: string;
  phone: string; // 숫자만
  birth: string; // YYYY-MM-DD
  sex: 'M' | 'F';
};

export type Survey = {
  metalImplant: boolean; // 심박조율기 등 체내 금속 장치
  claustrophobia: boolean;
  pregnant: boolean;
  memo: string;
};

// 예전(분리 전) 여러 상품 예약에 담긴 검사 하나 — 지금은 상품마다 예약을 따로 만든다
export type BookingItem = {
  planId: string;
  planName: string;
  resource: 'MRI' | 'CT';
  start: string;   // HH:MM — 이 검사의 시작 시각
  slots: number;   // 장비 점유 슬롯 수 (30분 단위)
  price: number;   // 이 검사 금액 (커플이면 2인 금액)
};

export type Booking = {
  code: string;
  userId?: string;
  planId: string;
  resource: 'MRI' | 'CT';
  date: string;
  time: string;
  slots: number;            // 방문 전체 길이 (30분 단위)
  couple: boolean;
  items?: BookingItem[];     // 예전 묶음 예약에만 있음 (새 예약은 상품 1개 = 예약 1건)
  groupCode?: string;        // 함께 예약한 묶음의 대표 예약번호 (같은 신청에서 만든 예약끼리 같은 값)
  person: Person;
  partner?: Person;
  survey: Survey;
  price: number;           // 최종 결제 예정 금액 (쿠폰 할인 후)
  planName?: string;       // 예약 당시 상품명
  listPrice?: number;      // 할인 전 금액
  couponCode?: string;
  discount?: number;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  cancelledAt?: string;
};

export type BookingRequest = {
  planId?: string;          // 예전 단일 상품 요청 호환
  planIds?: string[];
  items?: { planId: string; date: string; time: string }[]; // 상품별 날짜·시간 (새 방식)
  couple: boolean;
  date?: string;            // items가 없을 때: 모든 상품을 이 날짜·시간부터 이어서 배치
  time?: string;
  partner?: Person; // 예약자 본인 정보는 로그인한 회원 정보에서 가져온다
  couponCode?: string;
  survey: Survey;
  consent: { privacy: boolean; sensitive: boolean };
};

export type SlotInfo = { time: string; available: boolean };
