import Link from 'next/link';
import { centers, plans, site, won } from '@/lib/data';
import { HOURS_NOTE } from '@/lib/booking/schedule';
import { Chevron } from '../icons';

// 정적 배포용 예약 안내 — 온라인 예약 서버가 없을 때 전화·네이버 예약으로 연결한다
export default function BookingStatic() {
  const naver = centers[0]?.links?.find(l => l.label === '네이버 예약')?.url;

  return (
    <>
      <section className="sec bk-static" style={{ marginTop: 0 }}>
        <h1 className="bk-h">검진 예약 안내</h1>
        <p className="sec-sub" style={{ marginTop: -6 }}>전화 또는 네이버 예약으로 원하는 검진과 날짜를 예약하세요.</p>

        <div className="bk-static-actions">
          <a className="btn btn-primary" href={`tel:${site.phone}`}>전화로 예약하기 · {site.phone}</a>
          {naver && <a className="btn btn-line" href={naver} target="_blank" rel="noopener noreferrer">네이버 예약 바로가기</a>}
        </div>
        <p className="note">{HOURS_NOTE}</p>
      </section>

      <section className="sec">
        <h2 className="bk-h">검진 상품</h2>
        <ul className="ct-plans">
          {plans.map(p => (
            <li key={p.id}>
              <Link href="/#plans">
                <span className="kind">{p.kind}</span>
                <span className="txt"><b>{p.name}</b><small>{p.time}</small></span>
                <span className="pr">{won(p.price)}원</span>
                <Chevron className="chev" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="sec">
        <h2 className="bk-h">검진 전 안내</h2>
        <ul className="care">
          <li><span className="ck">✓</span>촬영 4시간 전부터 금식해 주세요.</li>
          <li><span className="ck">✓</span>금속 액세서리는 착용하지 말고 방문해 주세요.</li>
          <li><span className="ck">✓</span>심박조율기 등 체내 금속 장치가 있으면 예약 시 꼭 알려주세요.</li>
          <li><span className="ck">✓</span>검진 2일 전까지 무료로 변경·취소할 수 있습니다.</li>
        </ul>
      </section>
    </>
  );
}
