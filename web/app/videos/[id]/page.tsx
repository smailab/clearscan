import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import { Chevron } from '@/components/icons';
import { RecordHistory, VideoActions } from '@/components/video/VideoActions';
import { currentUser } from '@/lib/auth/members';
import { listProducts } from '@/lib/products';
import { getVideo, listCategories, myMarks, relatedVideos } from '@/lib/videos';
import { catsOf, isKorean, thumbUrl } from '@/lib/videos-shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const v = await getVideo(id);
  if (!v) return { title: 'LongeviTube | ORAE LONGEVITY CLUB' };
  return {
    title: `${v.title} | LongeviTube`,
    description: v.desc.slice(0, 160),
    openGraph: { title: v.title, description: v.desc.slice(0, 160), images: [thumbUrl(v.yt, true)] },
  };
}

// 영상 주제와 맞닿은 ORAE 검진 안내 (주제 → 검진 상품, 없으면 멤버십)
const CTA_PLAN: Record<string, string> = { heart: 'heart-ct', mental: 'neuro', prevention: 'annual', cancer: 'annual', aging: 'annual', metabolism: 'annual' };

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getVideo(id);
  if (!v) notFound();

  const user = await currentUser();
  const [cats, related, marks, products] = await Promise.all([
    listCategories(), relatedVideos(v, 10), user ? myMarks(user.id, v.id) : { like: false, save: false }, listProducts(),
  ]);
  const catName = new Map(cats.map(c => [c.id, c.name]));
  const ko = isKorean(v);
  const planId = catsOf(v).map(c => CTA_PLAN[c]).find(Boolean);
  const plan = planId ? products.find(p => p.id === planId) : undefined;
  const src = `https://www.youtube-nocookie.com/embed/${v.yt}?rel=0&hl=ko${ko ? '' : '&cc_load_policy=1&cc_lang_pref=ko'}`;

  return (
    <Shell heroHeader={false} back="/videos">
      {user && <RecordHistory videoId={v.id} />}
      <div className="vd-player">
        <iframe src={src} title={v.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>

      <section className="sec vd-watch" style={{ marginTop: 0 }}>
        <p className="vd-cats">
          {catsOf(v).map(c => <Link key={c} href={`/videos?c=${c}`}>{catName.get(c) ?? c}</Link>)}
        </p>
        <h1>{v.title}</h1>
        <p className="vd-by">
          <Link href={`/videos?s=${encodeURIComponent(v.speaker)}`}><b>{v.speaker}</b></Link>
          {v.channel && <> · {v.channel}</>} · {v.level}{v.format && ` · ${v.format}`}
        </p>
        <VideoActions videoId={v.id} yt={v.yt} title={v.title} loggedIn={Boolean(user)} initial={marks} />

        {!ko && (
          <details className="vd-subs">
            <summary>한국어 자막이 안 나오나요?</summary>
            <p>플레이어 오른쪽 아래 설정(톱니바퀴) → <b>자막</b> → <b>자동 번역</b> → <b>한국어</b>를 고르세요. 휴대폰 유튜브 앱에서 열면 자막·더빙이 더 잘 적용되기도 합니다.</p>
          </details>
        )}

        <div className="vd-desc">
          {v.orig && v.orig !== v.title && <p className="vd-orig">원제: {v.orig}</p>}
          {v.desc && <p>{v.desc}</p>}
          {v.points.length > 0 && <ul className="ms-benefits">{v.points.map(p => <li key={p}>{p}</li>)}</ul>}
          {v.tags.length > 0 && (
            <p className="vd-tags">{v.tags.map(t => <Link key={t} href={`/videos?q=${encodeURIComponent(t)}`}>#{t}</Link>)}</p>
          )}
          <p className="note">※ 교육용 정보입니다. 약물·보충제 복용이나 식단·운동 변화는 의료진과 상의하세요.</p>
        </div>

        <Link className="ms-join-card vd-cta" href={plan ? `/booking?plan=${plan.id}` : '/membership'}>
          <span>
            <b>{plan ? `관련 검진 · ${plan.name}` : 'ORAE 멤버십'}</b>
            {plan ? plan.desc : '정밀 검진과 전문의 상담, 연중 관리로 나의 건강수명을 지킵니다.'}
          </span>
          <Chevron size={18} />
        </Link>
      </section>

      {related.length > 0 && (
        <section className="sec">
          <div className="sec-head"><h2>함께 보면 좋은 영상</h2><Link className="more" href={`/videos?c=${v.cat}`}>더보기 ›</Link></div>
          <ul className="vd-related">
            {related.map(r => (
              <li key={r.id}>
                <Link href={`/videos/${r.id}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl(r.yt)} alt="" loading="lazy" width={160} height={90} />
                  <span><b>{r.title}</b><small>{r.speaker} · {catName.get(r.cat)}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
