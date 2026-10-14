// Scan Longevity 로고 — 원형 심볼(남색 원 + 하늘색 원 + 스캔 막대) + 두 줄 워드마크
// 워드마크 색은 currentColor라서 배경에 따라 바뀐다 (파란 히어로 위: 흰색, 흰 배경: 남색)
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-svg">
      <circle cx="24" cy="24" r="23" fill="#14284b" />
      <circle cx="24" cy="24" r="14.5" fill="#a9cdf0" />
      <rect x="4.5" y="21.2" width="39" height="5.6" rx="2.8" fill="#7aa6dc" />
    </svg>
  );
}

export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="brand">
      <LogoMark size={size} />
      <span className="brand-word" style={{ fontSize: Math.round(size * 0.42) }}>
        <span>SCAN</span>
        <span>LONGEVITY</span>
      </span>
    </span>
  );
}
