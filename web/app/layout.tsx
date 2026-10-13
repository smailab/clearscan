import type { Metadata, Viewport } from 'next';
import './globals.css';
import './booking.css';
import './center.css';

export const metadata: Metadata = {
  title: '클리어스캔 | 전신 MRI 정밀 검진',
  description: '단 22분, 머리부터 골반까지 최대 13개 장기를 살펴보는 전신 MRI 검진. 방사선 노출 없이, 이해하기 쉬운 리포트로 결과를 받아보세요.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3d6bff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
