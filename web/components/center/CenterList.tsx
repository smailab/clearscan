import Image from 'next/image';
import Link from 'next/link';
import { listCenters } from '@/lib/centers';
import { specialtiesOf } from '@/lib/centers-shared';
import { Chevron } from '../icons';

// 공개 중인 검진 센터 목록 (DB)
export default async function CenterList() {
  const centers = await listCenters();
  if (!centers.length) return <p className="bk-empty">등록된 검진 센터가 없습니다.</p>;
  return (
    <ul className="ct-list">
      {centers.map(c => (
        <li key={c.id}>
          <Link href={`/centers/${c.id}`}>
            <div className="thumb"><Image src={c.image} alt="" fill sizes="72px" /></div>
            <div className="body">
              <p className="nm">{c.name}</p>
              <p className="addr">{c.address}</p>
              <p className="tags">
                {c.region && <span className="dist">{c.region}</span>}
                {specialtiesOf(c).map(s => <span key={s} className="eq">{s}</span>)}
              </p>
            </div>
            <Chevron className="chev" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
