export const site = {
  name: 'THOR SCAN LONGEVITY',
  tagline: '전신 MRI 정밀 검진',
  notice: '신규 오픈 기념 — 첫 검진 예약 시 결과 상담 무료',
  phone: '070-5236-1099', // THOR SCAN LONGEVITY 상담 전화 (검진 센터 번호는 각 센터 정보에)
  clinic: '이로영상의학과의원',
  address: '서울특별시 서대문구 신촌로37길 10, 7층 701호',
  addressDetail: '(북아현동, 아현메디컬)',
  ceo: '김준곤, 임재현',
  bizNo: '154-45-01175',
  mapUrl: 'https://map.naver.com/p/search/%EC%9D%B4%EB%A1%9C%EC%98%81%EC%83%81%EC%9D%98%ED%95%99%EA%B3%BC%EC%9D%98%EC%9B%90',
};

export type Slide = { eyebrow: string; l1: string; l2: string; image: string; alt: string };

export const slides: Slide[] = [
  { eyebrow: '조기 발견을 위한', l1: '단 22분,', l2: '전신 MRI 검진', image: '/images/scan-woman.png', alt: 'MRI 촬영을 준비하는 수검자' },
  { eyebrow: '방사선 노출 없이', l1: '머리부터 골반까지', l2: '최대 13개 장기', image: '/images/fullbody.webp', alt: '전신 MRI 영상' },
  { eyebrow: '이해하기 쉬운 리포트', l1: '전문의 판독 후', l2: '1:1 결과 상담', image: '/images/app-report.png', alt: '앱으로 받는 검진 리포트' },
];

export const steps = [
  { n: 1, tag: '예약', title: '계정 만들고 온라인 예약', body: '검진 센터와 원하는 날짜·시간을 고르고, 간단한 건강 문진을 작성하세요. 5분이면 끝납니다.', image: '/images/lobby.png' },
  { n: 2, tag: '촬영', title: '약 22분 MRI 촬영', body: '편안한 가운으로 갈아입고 누워 있으면 됩니다. 조영제나 방사선 없이 최대 13개 장기를 살펴봅니다.', image: '/images/scan-man.png' },
  { n: 3, tag: '판독', title: '영상의학과 전문의 판독', body: '영상의학과 전문의가 촬영된 영상을 꼼꼼히 판독하고 이상 소견 여부를 확인합니다.', image: '/images/brain-mri.png' },
  { n: 4, tag: '플랜', title: '맞춤 리포트 & 1:1 상담', body: '10일 이내에 이해하기 쉬운 리포트를 앱으로 받고, 담당 의료진과 결과를 상담하세요.', image: '/images/app-report.png' },
];

export const facts = [
  { value: '22분', label: '촬영 시간 (연간 MRI)' },
  { value: '13개', label: '최대 검사 장기 수' },
  { value: '약 80%', label: '조기 발견 시 암 생존율' },
  { value: '20% 미만', label: '말기 발견 시 생존율' },
];
export const factsNote = '※ 생존율 수치 출처: American Cancer Society. 국내 자료(국가암정보센터 등)로 교체를 권장합니다.';

export const reviews = [
  { text: '건강검진에선 아무 말 없었는데, 작은 결절을 일찍 확인해서 바로 정밀 검사를 받을 수 있었어요.', who: '김○○', meta: '40대 · 서울', plan: '연간 MRI', image: '/images/brain-mri.png' },
  { text: '예약부터 결과까지 앱으로 다 돼서 편했어요. 리포트가 그림으로 설명돼 있어 이해하기 쉬웠습니다.', who: '이○○', meta: '30대 · 경기', plan: '연간 MRI', image: '/images/app-report.png' },
  { text: '아무 이상 없다는 결과를 받고 나니 마음이 정말 편해졌어요. 매년 받으려고요.', who: '박○○', meta: '50대 · 부산', plan: '척추 포함 MRI', image: '/images/consult.png' },
  { text: '남편과 같이 받았는데 대기 시간도 짧고 직원분들이 친절했어요.', who: '최○○', meta: '40대 · 서울', plan: '커플 플랜', image: '/images/lobby.png' },
  { text: '폐쇄공포증이 있어서 걱정했는데 촬영 중에도 계속 안내해 주셔서 무사히 마쳤습니다.', who: '정○○', meta: '60대 · 인천', plan: '연간 MRI', image: '/images/scan-woman.png' },
];
export const reviewsNote = '※ 아래 후기는 예시 문구입니다. 실제 동의받은 후기로 교체하세요.';

export type Organ = { name: string; badge?: string; diseases: string[]; symptoms: string[] };

export const organs: Organ[] = [
  { name: '뇌', diseases: ['뇌종양', '신경교종', '전이암'], symptoms: ['두통', '메스꺼움·구토', '시력·청력 이상', '균형 감각 저하', '언어 장애', '성격 변화', '발작'] },
  { name: '척추', diseases: ['척추 종양'], symptoms: ['통증', '저림', '근력 저하', '서거나 걷기 어려움', '마비'] },
  { name: '갑상선', diseases: ['양성·악성 병변'], symptoms: ['목 부종·멍울', '삼키기 어려움', '지속되는 기침', '목소리 변화'] },
  { name: '폐', badge: 'CT', diseases: ['폐암', '폐결절'], symptoms: ['객혈', '호흡 곤란', '가슴 통증', '원인 모를 체중 감소'] },
  { name: '간', diseases: ['간암'], symptoms: ['체중 감소', '식욕 저하', '복통', '메스꺼움', '황달'] },
  { name: '담낭', diseases: ['담낭암'], symptoms: ['복통·복부 팽만', '발열', '체중 감소', '황달'] },
  { name: '췌장', diseases: ['췌장암'], symptoms: ['상복부 통증', '식욕 저하', '체중 감소', '새로 생긴 당뇨', '황달'] },
  { name: '비장', diseases: ['비장 병변·질환'], symptoms: ['비장 비대', '왼쪽 윗배 통증', '체중 감소', '발열', '야간 발한', '무기력'] },
  { name: '신장', diseases: ['신장암'], symptoms: ['혈뇨', '허리·옆구리 통증', '식욕 저하', '체중 감소'] },
  { name: '부신', diseases: ['선종', '부신 병변'], symptoms: ['체중 증가', '근력 저하', '메스꺼움', '허리 통증', '호르몬 변화'] },
  { name: '방광', diseases: ['방광암', '방광 종양'], symptoms: ['혈뇨', '배뇨 시 통증', '골반 통증'] },
  { name: '난소', badge: '여성', diseases: ['난소암'], symptoms: ['복부 팽만·부종', '쉽게 배부름', '체중 감소', '골반 불편감', '배변 습관 변화', '잦은 소변'] },
  { name: '자궁', badge: '여성', diseases: ['자궁내막암'], symptoms: ['폐경 후 질 출혈', '생리 외 출혈', '비정상 분비물', '골반 통증'] },
  { name: '전립선', badge: '남성', diseases: ['전립선암', '전립선염', '전립선 비대증'], symptoms: ['배뇨 곤란', '약한 소변 줄기', '혈정액증', '뼈 통증', '발기 부전'] },
];

export const careTeam = ['건강 이력 및 문진 검토', '영상의학과 전문의 판독', '10일 이내 결과 리포트 제공', '1:1 결과 설명 및 상담', '결과 기반 맞춤 권고 사항 안내'];

export const faqs = [
  { q: 'MRI 촬영은 안전한가요?', a: 'MRI는 X선이 아닌 자기장과 고주파를 이용하므로 방사선 노출이 없습니다. 다만 심박조율기 등 체내 금속 장치가 있다면 사전 문진에서 꼭 알려주세요.' },
  { q: '검진 전 준비할 것이 있나요?', a: '촬영 4시간 전부터 금식을 권장합니다. 금속 액세서리는 착용하지 않고 방문해 주세요.' },
  { q: '결과는 언제 받을 수 있나요?', a: '촬영 후 영업일 기준 7일 이내에 앱과 이메일로 리포트를 보내드리며, 이후 의료진과의 상담 일정을 잡을 수 있습니다.' },
  { q: '건강보험이나 실손보험 적용이 되나요?', a: '증상 없는 예방 목적의 검진은 일반적으로 건강보험 적용 대상이 아닙니다. 실손보험 적용 여부는 가입하신 보험사에 확인해 주세요.' },
  { q: '예약 변경이나 취소가 가능한가요?', a: '검진 2일 전까지는 앱에서 무료로 변경·취소할 수 있습니다.' },
];

// 검진 센터 정보는 DB(centers)로 이동 — lib/centers.ts, lib/centers-shared.ts

export const won = (n: number) => n.toLocaleString('ko-KR');
