import type { NextConfig } from 'next';

const isStatic = process.env.NEXT_PUBLIC_STATIC_SITE === '1';

// 서버 전용 라우트(API, 관리자)는 *.server.ts(x)로 이름을 붙여 두고,
// 정적 배포(NEXT_PUBLIC_STATIC_SITE=1)에서는 pageExtensions에서 빼서 빌드에서 제외한다
const nextConfig: NextConfig = isStatic
  ? {
      output: 'export',
      pageExtensions: ['tsx', 'ts'],
      basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
      trailingSlash: true,
      images: { loader: 'custom', loaderFile: './lib/image-loader.ts' },
    }
  : {
      pageExtensions: ['server.tsx', 'server.ts', 'tsx', 'ts'],
      // Cloudflare Workers에는 이미지 최적화 서버가 없으므로 원본을 그대로 제공
      images: { unoptimized: true },
    };

export default nextConfig;

// 로컬 next dev에서 Cloudflare 바인딩(D1 등)을 쓸 수 있게 한다 (로컬 D1은 .wrangler/에 저장)
if (!isStatic && process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
