import type { NextConfig } from 'next';

// Cloudflare Workers(OpenNext) 배포용 설정 (BUILD_TARGET=node이면 일반 Node 서버용)
const nextConfig: NextConfig = {
  // API·관리자 등 서버 라우트는 *.server.ts(x)로 이름을 구분한다
  pageExtensions: ['server.tsx', 'server.ts', 'tsx', 'ts'],
  // Cloudflare Workers에는 이미지 최적화 서버가 없으므로 원본을 그대로 제공
  images: { unoptimized: true },
  // Oracle Cloud 등 일반 Node 서버 배포: BUILD_TARGET=node로 빌드하면 .next/standalone에 실행 파일을 만든다
  ...(process.env.BUILD_TARGET === 'node' ? { output: 'standalone' as const } : {}),
};

export default nextConfig;

// 로컬 next dev에서 Cloudflare 바인딩(D1 등)을 쓸 수 있게 한다 (로컬 D1은 .wrangler/에 저장)
if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
