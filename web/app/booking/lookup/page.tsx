import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import Lookup from '@/components/booking/Lookup';

export const metadata: Metadata = { title: '예약 조회 | 클리어스캔' };

export default function LookupPage() {
  return (
    <Shell heroHeader={false} cta={false}>
      <Lookup />
    </Shell>
  );
}
