import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import CenterList from '@/components/center/CenterList';

export const metadata: Metadata = { title: '검진 센터 | THOR SCAN LONGEVITY' };
export const dynamic = 'force-dynamic';

export default function CentersPage() {
  return (
    <Shell heroHeader={false} back="/">
      <section className="sec" style={{ marginTop: 0 }}>
        <div className="sec-head"><h1 className="ct-h" style={{ margin: 0 }}>검진 센터</h1></div>
        <p className="sec-sub">센터를 선택하면 의료진, 위치, 운영 시간을 확인할 수 있어요.</p>
        <CenterList />
      </section>
    </Shell>
  );
}
