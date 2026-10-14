import type { Metadata, Viewport } from 'next';
import './globals.css';
import './booking.css';
import './center.css';
import './member.css';

export const metadata: Metadata = {
  title: 'Scan Longevity | 전신 MRI 정밀 검진',
  description: '단 22분, 머리부터 골반까지 최대 13개 장기를 살펴보는 전신 MRI 검진. 방사선 노출 없이, 이해하기 쉬운 리포트로 결과를 받아보세요.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14284b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        {/* 로고 워드마크용 */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
