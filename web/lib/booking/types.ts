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

export type Booking = {
  code: string;
  userId?: string;
  planId: string;
  resource: 'MRI' | 'CT';
  date: string;
  time: string;
  slots: number;
  couple: boolean;
  person: Person;
  partner?: Person;
  survey: Survey;
  price: number;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  cancelledAt?: string;
};

export type BookingRequest = {
  planId: string;
  couple: boolean;
  date: string;
  time: string;
  partner?: Person; // 예약자 본인 정보는 로그인한 회원 정보에서 가져온다
  survey: Survey;
  consent: { privacy: boolean; sensitive: boolean };
};

export type SlotInfo = { time: string; available: boolean };
