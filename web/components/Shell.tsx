import Image from 'next/image';
import Link from 'next/link';
import Header from './Header';
import Footer from './Footer';
import BottomCta from './BottomCta';
import { Chevron } from './icons';

type Props = {
  children: React.ReactNode;
  heroHeader?: boolean;
  cta?: boolean;
  back?: string; // 헤더에 뒤로가기 버튼 표시 (히스토리가 없을 때 이동할 경로)
};

// 데스크톱에서는 좌측 프로모 카드 + 500px 모바일 컬럼, 모바일에서는 컬럼만 노출
export default function Shell({ children, heroHeader = true, cta = true, back }: Props) {
  return (
    <div className="shell">
      <aside className="promo" aria-hidden="true">
        <Link className="promo-card" href="/#plans" tabIndex={-1}>
          <Image className="img" src="/images/fullbody.webp" alt="" fill sizes="344px" priority />
          <div className="copy">
            <p>방사선 없이, 머리부터 골반까지</p>
            <strong>전신 MRI,<br />22분이면 충분합니다</strong>
          </div>
          <span className="promo-btn">검진 상품 보기 <Chevron size={16} /></span>
        </Link>
      </aside>

      <main className="col">
        <Header solid={!heroHeader} back={back} />
        {children}
        <Footer />
        {cta && <BottomCta />}
      </main>
    </div>
  );
}
