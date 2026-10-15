import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import PostCards from '@/components/post/PostCards';
import { currentAdmin } from '@/lib/auth/admins';
import { getPostBySlug, listPosts } from '@/lib/posts';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await getPostBySlug((await params).slug);
  if (!p) return { title: '건강 칼럼 | BOSCO LONGEVITY' };
  return { title: `${p.title} | BOSCO LONGEVITY`, description: p.summary, openGraph: { title: p.title, description: p.summary, images: p.coverImage ? [p.coverImage] : [] } };
}

export default async function PostPage({ params, searchParams }: Params) {
  const { slug } = await params;
  // 관리자는 ?preview=1 로 임시 저장 글도 미리 볼 수 있다
  const preview = (await searchParams).preview === '1' && Boolean(await currentAdmin());
  const post = await getPostBySlug(slug, { includeDrafts: preview });
  if (!post) notFound();
  const others = (await listPosts({ limit: 4 })).filter(p => p.id !== post.id).slice(0, 3);
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <Shell heroHeader={false} back="/posts">
      <article className="sec po-article" style={{ marginTop: 0 }}>
        {post.status !== 'published' && <p className="po-preview">미리보기 · 아직 공개되지 않은 글입니다</p>}
        <p className="po-eyebrow">건강 칼럼</p>
        <h1>{post.title}</h1>
        {date && <p className="po-date">{date}</p>}
        {post.coverImage && (
          <div className="po-cover">
            {/^https:/.test(post.coverImage)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={post.coverImage} alt="" />
              : <Image src={post.coverImage} alt="" fill sizes="(max-width: 500px) 100vw, 468px" />}
          </div>
        )}
        {/* 본문 HTML은 저장할 때 서버에서 허용 태그만 남기도록 정제됨 (lib/posts.ts sanitizeHtml) */}
        <div className="post-body" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </article>

      {others.length > 0 && (
        <section className="sec">
          <div className="sec-head"><h2>다른 글</h2><Link className="more" href="/posts">전체 보기 ›</Link></div>
          <PostCards posts={others} />
        </section>
      )}
    </Shell>
  );
}
