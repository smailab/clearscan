import Image from 'next/image';
import Link from 'next/link';
import { centers } from '@/lib/data';
import { Chevron } from '../icons';

export default function CenterList() {
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
                <span className="dist">{c.region}</span>
                {[...new Set(c.doctors.map(d => d.specialty?.split(' ')[0]).filter(Boolean))].map(s => <span key={s} className="eq">{s}</span>)}
              </p>
            </div>
            <Chevron className="chev" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
