import type { Metadata } from 'next';
import Link from 'next/link';
import Shell from '@/components/Shell';
import HScroll from '@/components/HScroll';
import VideoCard from '@/components/video/VideoCard';
import { HistoryClearButton } from '@/components/video/VideoActions';
import { Chevron } from '@/components/icons';
import { currentUser } from '@/lib/auth/members';
import { listCategories, listVideos, markCounts, markedVideos, queryVideos, speakers } from '@/lib/videos';
import type { MarkKind } from '@/lib/videos-shared';

export const metadata: Metadata = {
  title: 'LongeviTube 건강수명 영상 | ORAE LONGEVITY CLUB',
  description: '노화 과학, 영양, 수면, 뇌 건강까지 — 오래, 건강하게 사는 법을 다루는 강의·인터뷰·다큐 영상을 주제별로 모았습니다.',
};
export const dynamic = 'force-dynamic';

type Search = { c?: string; s?: string; q?: string; sort?: string; list?: string };
const LISTS: Record<string, { kind: MarkKind; title: string; empty: string }> = {
  saved: { kind: 'save', title: '나중에 볼 영상', empty: "영상 화면에서 '나중에 보기'를 누르면 여기에 모입니다." },
  liked: { kind: 'like', title: '좋아요 표시한 영상', empty: "마음에 드는 영상에서 '좋아요'를 눌러 보세요." },
  history: { kind: 'history', title: '시청 기록', empty: '아직 본 영상이 없어요.' },
};
const SORTS = [
  { id: 'popular', label: '인기순' },
  { id: 'ko', label: '한국어 먼저' },
  { id: 'title', label: '가나다순' },
] as const;

export default async function VideosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await currentUser();
  const [cats, all] = await Promise.all([listCategories(), listVideos()]);
  const catName = new Map(cats.map(c => [c.id, c.name]));
  const list = sp.list && LISTS[sp.list] ? LISTS[sp.list] : null;
  const sort = SORTS.some(s => s.id === sp.sort) ? (sp.sort as 'popular' | 'ko' | 'title') : 'popular';
  const cat = sp.c && catName.has(sp.c) ? sp.c : undefined;
  const q = (sp.q ?? '').trim().slice(0, 60);

  const [videos, counts, topSpeakers] = await Promise.all([
    list ? (user ? markedVideos(user.id, list.kind) : Promise.resolve([])) : queryVideos({ cat, speaker: sp.s, q, sort }),
    user ? markCounts(user.id) : null,
    speakers(),
  ]);

  const heading = list ? list.title : sp.s ? sp.s : q ? `‘${q}’ 검색 결과` : cat ? catName.get(cat)! : '모든 영상';
  const qs = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const next = { c: cat, s: sp.s, q: q || undefined, sort: sort === 'popular' ? undefined : sort, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/videos?${s}` : '/videos';
  };

  return (
    <Shell heroHeader={false}>
      <section className="page-hero vd-hero">
        <p className="eyebrow">LONGEVITUBE</p>
        <h1>오래 사는 것보다,<br />건강하게 오래</h1>
        <p>노화 과학부터 영양·수면·뇌 건강까지, 건강수명을 늘리는 데 도움이 되는 강의와 인터뷰를 주제별로 모았습니다.</p>
        <form action="/videos" className="vd-search" role="search">
          <input name="q" defaultValue={q} placeholder="영상·연사·주제 검색 (예: 수면, Attia)" aria-label="영상 검색" />
          <button className="btn btn-primary" type="submit">검색</button>
        </form>
        <p className="vd-stats"><b>{all.length}</b> 영상 · <b>{cats.length}</b> 주제 · <b>{topSpeakers.length}</b> 연사·채널</p>
      </section>

      <section className="sec vd-nav" style={{ marginTop: 0 }}>
        <HScroll label="주제">
          <Link className={`vd-chip${!cat && !list && !sp.s && !q ? ' on' : ''}`} href="/videos">전체</Link>
          {cats.map(c => <Link key={c.id} className={`vd-chip${cat === c.id ? ' on' : ''}`} href={`/videos?c=${c.id}`}>{c.name}</Link>)}
        </HScroll>
        <div className="vd-mine">
          {user ? (
            <>
              <Link className={list?.kind === 'save' ? 'on' : ''} href="/videos?list=saved">나중에 볼 영상 <b>{counts?.save ?? 0}</b></Link>
              <Link className={list?.kind === 'like' ? 'on' : ''} href="/videos?list=liked">좋아요 <b>{counts?.like ?? 0}</b></Link>
              <Link className={list?.kind === 'history' ? 'on' : ''} href="/videos?list=history">시청 기록 <b>{counts?.history ?? 0}</b></Link>
            </>
          ) : (
            <Link href={`/signup?next=${encodeURIComponent('/videos')}`}>회원이 되면 좋아요 · 나중에 보기 · 시청 기록을 어디서나 이어 볼 수 있어요 ›</Link>
          )}
        </div>
      </section>

      <section className="sec" id="list">
        <div className="sec-head">
          <h2>{heading} <small className="vd-count">{videos.length}</small></h2>
          {!list && (
            <div className="vd-sorts">
              {SORTS.map(s => <Link key={s.id} className={sort === s.id ? 'on' : ''} href={qs({ sort: s.id === 'popular' ? undefined : s.id })}>{s.label}</Link>)}
            </div>
          )}
          {list?.kind === 'history' && videos.length > 0 && <HistoryClearButton />}
        </div>
        {sp.s && <p className="sec-sub">연사 · 채널별 영상 <Link href="/videos" className="vd-reset">전체 보기 ›</Link></p>}
        {list && !user ? (
          <p className="bk-empty">로그인하면 내 목록을 볼 수 있어요. <Link href={`/login?next=${encodeURIComponent(`/videos?list=${sp.list}`)}`}>로그인 ›</Link></p>
        ) : videos.length === 0 ? (
          <p className="bk-empty">{list ? list.empty : '찾는 영상이 없어요. 다른 검색어나 주제를 골라 보세요.'}</p>
        ) : (
          <div className="vd-grid">
            {videos.map(v => <VideoCard key={v.id} v={v} catName={catName.get(v.cat)} />)}
          </div>
        )}
      </section>

      {!list && !sp.s && !q && (
        <section className="sec" id="speakers">
          <div className="sec-head"><h2>연사 · 채널</h2></div>
          <div className="vd-speakers">
            {topSpeakers.slice(0, 24).map(s => (
              <Link key={s.name} href={`/videos?s=${encodeURIComponent(s.name)}`}>{s.name} <small>{s.count}</small></Link>
            ))}
          </div>
        </section>
      )}

      <section className="sec">
        <Link className="ms-join-card" href="/membership">
          <span><b>영상에서 본 건강 관리, 이제 직접 확인해 보세요</b>ORAE 멤버십은 정밀 검진과 전문의 상담으로 나의 건강수명을 관리합니다.</span>
          <Chevron size={18} />
        </Link>
        <p className="note">영상은 각 채널이 유튜브에 공개한 것으로, 교육용 정보입니다. 의학적 진단·치료를 대신하지 않습니다.</p>
      </section>
    </Shell>
  );
}

