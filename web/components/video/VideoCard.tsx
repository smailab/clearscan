import Link from 'next/link';
import { thumbUrl, type Video } from '@/lib/videos-shared';

// LongeviTube 영상 카드 (썸네일은 유튜브 이미지 서버에서 바로 불러온다)
export default function VideoCard({ v, catName }: { v: Video; catName?: string }) {
  return (
    <article className="vd-card">
      <Link href={`/videos/${v.id}`} className="vd-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbUrl(v.yt)} alt="" loading="lazy" width={320} height={180} />
        <span className="vd-level">{v.level}</span>
        {v.format && <span className="vd-format">{v.format}</span>}
      </Link>
      <h3><Link href={`/videos/${v.id}`}>{v.title}</Link></h3>
      <p className="vd-meta">
        <Link href={`/videos?s=${encodeURIComponent(v.speaker)}`}>{v.speaker}</Link>
        {catName && <> · {catName}</>}
      </p>
    </article>
  );
}
