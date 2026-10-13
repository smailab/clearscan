import type { NextConfig } from 'next';

const isStatic = process.env.NEXT_PUBLIC_STATIC_SITE === '1';

// 서버 전용 라우트(API, 관리자)는 *.server.ts(x)로 이름을 붙여 두고,
// 정적 배포(Cloudflare Pages 등)에서는 pageExtensions에서 빼서 빌드에서 제외한다
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
    };

export default nextConfig;
