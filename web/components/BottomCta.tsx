import Link from 'next/link';
import { site } from '@/lib/data';
import { Chevron } from './icons';

export default function BottomCta() {
  return (
    <div className="bottom-cta">
      <a className="btn btn-line" href={`tel:${site.phone}`}>전화 문의</a>
      <Link className="btn btn-primary" href="/booking">검진 예약하기 <Chevron /></Link>
    </div>
  );
}
