import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import PostCards from '@/components/post/PostCards';
import { listPosts } from '@/lib/posts';

export const metadata: Metadata = {
  title: '건강 칼럼 | THOR SCAN LONGEVITY',
  description: '전신 MRI와 조기 검진에 대해 알아 두면 좋은 이야기.',
};
export const dynamic = 'force-dynamic';

export default async function PostsPage() {
  const posts = await listPosts();
  return (
    <Shell heroHeader={false} back="/">
      <section className="sec" style={{ marginTop: 0 }}>
        <h1 className="ct-h">왜 전신 MRI인가요?</h1>
        <p className="sec-sub">전신 MRI와 조기 검진에 대해 알아 두면 좋은 이야기를 모았어요.</p>
        {posts.length ? <PostCards posts={posts} /> : <p className="bk-empty">아직 등록된 글이 없어요.</p>}
      </section>
    </Shell>
  );
}
