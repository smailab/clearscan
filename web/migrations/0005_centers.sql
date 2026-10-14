-- 검진 센터 (관리자 '검진 센터' 탭에서 관리). 목록형 정보는 JSON으로 저장
CREATE TABLE IF NOT EXISTS centers (
  id             TEXT PRIMARY KEY,        -- 주소에 쓰는 고정 ID (/centers/<id>)
  name           TEXT NOT NULL,
  region         TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL,
  address_detail TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  homepage       TEXT NOT NULL DEFAULT '',
  notice         TEXT NOT NULL DEFAULT '',
  intro          TEXT NOT NULL DEFAULT '',
  image          TEXT NOT NULL,           -- 대표 사진
  gallery        TEXT NOT NULL DEFAULT '[]',
  hours          TEXT NOT NULL DEFAULT '[]', -- [{label, value, note}] 평일·토요일·일요일 순
  links          TEXT NOT NULL DEFAULT '[]', -- [{label, url}]
  equipment      TEXT NOT NULL DEFAULT '[]',
  highlights     TEXT NOT NULL DEFAULT '[]',
  plan_ids       TEXT NOT NULL DEFAULT '[]', -- 이 센터에서 받을 수 있는 검진 상품
  doctors        TEXT NOT NULL DEFAULT '[]',
  active         INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL,
  updated_by     TEXT
);

INSERT OR IGNORE INTO centers (id, name, region, address, address_detail, phone, homepage, notice, intro, image, gallery, hours, links, equipment, highlights, plan_ids, doctors, active, sort_order, updated_at) VALUES ('iro', '이로영상의학과의원', '서울 서대문구', '서울특별시 서대문구 신촌로37길 10, 7층 701호', '(북아현동, 아현메디컬)', '02-393-0010', 'https://www.iroclinic.com', '투석 혈관 시술은 365일 응급 대기로 당일 시술이 가능합니다.', '영상의학과 인터벤션 전문의 3인과 혈관외과 전문의 1인이 함께 진료하는 영상의학과입니다. 대학병원급 혈관조영장비로 진단부터 시술까지 하루 안에 진행하며, 투석혈관·말초혈관·정맥류 등 혈관 질환 치료에 집중하고 있습니다.', '/images/centers/iro/interior1.png', '["/images/centers/iro/interior1.png","/images/centers/iro/interior2.png","/images/centers/iro/interior3.png","/images/centers/iro/interior4.png","/images/centers/iro/interior5.png","/images/centers/iro/interior6.png","/images/centers/iro/interior7.png"]', '[{"label":"평일","value":"08:30 – 17:30","note":"점심시간 12:00 – 13:00"},{"label":"토요일","value":"08:30 – 12:30","note":"점심시간 없이 12:00 접수 마감"},{"label":"일요일","value":"휴진"}]', '[{"label":"네이버 예약","url":"https://m.booking.naver.com/booking/13/bizes/1363743"},{"label":"유튜브","url":"https://www.youtube.com/@%EC%9D%B4%EB%A1%9C%EC%98%81%EC%83%81%EC%9D%98%ED%95%99%EA%B3%BC"},{"label":"인스타그램","url":"https://www.instagram.com/iroclinic_official/"},{"label":"블로그","url":"https://blog.naver.com/rakqzj2891"}]', '["MRI (자기공명영상)","CT (컴퓨터단층촬영)","혈관조영장비 (Philips Azurion)","X-ray","초음파"]', '["영상의학과·혈관외과 전문의 협진","대학병원 교수 출신 전문의 4인","서울대학교병원·세브란스병원 협력 의료기관","당일 예약·당일 시술"]', '["annual","spine","neuro","heart-ct","lung-ct"]', '[{"name":"김준곤","photo":"/images/centers/iro/doctor1.png","title":"대표원장","specialty":"영상의학과 인터벤션 전문의","education":["성균관대학교 의과대학 석사, 박사","연세대학교 원주의과대학 졸업","KAIST 전기전자공학과"],"career":["전) 삼성서울병원 영상의학과 조교수","전) 삼성서울병원 인터벤션 전임의","전) 서울지구병원 영상의학과 과장"],"societies":["대한영상의학회","대한인터벤션영상의학회","대한투석혈관학회","SIR 북미인터벤션영상의학회","CIRSE 유럽인터벤션학회"]},{"name":"임재현","photo":"/images/centers/iro/doctor2.png","title":"대표원장","specialty":"영상의학과 인터벤션 전문의","education":["성균관대학교 의과대학 석사","연세대학교 원주의과대학"],"career":["현) 삼성서울병원 영상의학과 외래교수","전) 분당차병원 영상의학과 임상조교수","전) 삼성서울병원 인터벤션 전임의"],"societies":["대한영상의학회","대한인터벤션영상의학회","대한투석혈관학회","SIR 북미인터벤션영상의학회"]},{"name":"문성모","photo":"/images/centers/iro/doctor3.png","title":"원장","specialty":"영상의학과 인터벤션 전문의","education":["차의과대학교 의학전문대학원","분당차병원 영상의학과 전공의"],"career":["전) 세브란스병원 영상의학과 외래교수","전) 해운대백병원 영상의학과 인터벤션 진료교수","전) 세브란스병원 영상의학과 인터벤션 영상조교수","전) 세브란스병원 영상의학과 인터벤션 전임의"],"societies":["인터벤션 시술인증의","대한인터벤션영상의학회","대한투석혈관학회","SIR 북미인터벤션영상의학회","CIRSE 유럽인터벤션학회"]},{"name":"이승훈","photo":"/images/centers/iro/doctor4.png","title":"원장","specialty":"혈관외과 전문의","education":["가톨릭대학교 의과대학 졸업","가톨릭중앙의료원 외과 전공의"],"career":["현) 서울성모병원 혈관이식외과 외래교수","전) 세이브외과 원장","전) 서울성모병원 혈관이식외과 임상강사"],"societies":["대한혈관외과학회","대한투석혈관학회","대한이식학회","Society for Vascular Surgery","Vascular & Endovascular Surgery Society"]}]', 1, 10, '2026-10-14T14:41:38.811Z');
