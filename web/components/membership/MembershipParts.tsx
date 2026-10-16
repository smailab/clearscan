'use client';

import { useRouter } from 'next/navigation';
import ConfirmButton, { postJson } from '@/components/ConfirmButton';

// 내 페이지: 상담 대기 중인 멤버십 신청 취소
export function MembershipCancel({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      className="my-link ms-cancel"
      label="신청 취소"
      message="멤버십 상담 신청을 취소할까요?"
      confirmLabel="신청 취소"
      danger
      onConfirm={async () => {
        const err = await postJson('/api/membership/cancel', { id });
        if (!err) router.refresh();
        return err;
      }}
    />
  );
}
