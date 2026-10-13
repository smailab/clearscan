import { redirect } from 'next/navigation';

// 예약 조회는 내 페이지로 옮겼다
export default function LookupPage() {
  redirect('/my');
}
