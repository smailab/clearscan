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

// 한 예약에 담긴 검사 하나 (여러 상품 동시 예약)
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
  items?: BookingItem[];     // 여러 상품 예약 시 검사별 일정 (없으면 planId 하나짜리 예전 예약)
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
  couple: boolean;
  date: string;
  time: string;
  partner?: Person; // 예약자 본인 정보는 로그인한 회원 정보에서 가져온다
  couponCode?: string;
  survey: Survey;
  consent: { privacy: boolean; sensitive: boolean };
};

export type SlotInfo = { time: string; available: boolean };
