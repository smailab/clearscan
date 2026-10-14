import Image from 'next/image';
import Link from 'next/link';
import type { Post } from '@/lib/posts';

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }) : '');

// 건강 칼럼 글 목록 (메인·목록 페이지 공용)
export default function PostCards({ posts }: { posts: Post[] }) {
  return (
    <ul className="po-list">
      {posts.map(p => (
        <li key={p.id}>
          <Link href={`/posts/${p.slug}`} className="po-card">
            {p.coverImage && (
              <div className="thumb">
                {/^https:/.test(p.coverImage)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.coverImage} alt="" />
                  : <Image src={p.coverImage} alt="" fill sizes="96px" />}
              </div>
            )}
            <div className="body">
              <p className="t">{p.title}</p>
              <p className="s">{p.summary}</p>
              <p className="d">{date(p.publishedAt)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
