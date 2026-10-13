// 정적 배포용 이미지 로더: 최적화 서버가 없으므로 원본 파일을 그대로 쓰고, basePath만 앞에 붙인다
export default function imageLoader({ src }: { src: string; width: number; quality?: number }) {
  if (/^https?:\/\//.test(src)) return src;
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${src}`;
}
