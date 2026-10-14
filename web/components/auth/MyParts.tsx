'use client';

import { useRouter } from 'next/navigation';
import ConfirmButton, { postJson } from '@/components/ConfirmButton';

export function CancelButton({ code }: { code: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="예약 취소"
      className="my-cancel"
      danger
      confirmLabel="예약 취소"
      message="이 예약을 취소하시겠어요? 사용한 쿠폰은 다시 쓸 수 있게 돌아갑니다."
      onConfirm={async () => {
        const err = await postJson('/api/bookings/cancel', { code });
        if (!err) router.refresh();
        return err;
      }}
    />
  );
}
