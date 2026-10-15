// 아이콘 — 한 가지 스타일 (남색 1.7px 선 + 하늘색 포인트). 색은 CSS 토큰을 따른다.
export function Chevron({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// 빠른 메뉴용 34px 타일 아이콘 (연한 하늘 바탕 + 남색 선 + 하늘색 포인트)
function Tile({ children }: { children: React.ReactNode }) {
  return (
    <svg className="ico" viewBox="0 0 34 34" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="34" height="34" rx="10" fill="var(--primary-soft)" />
      {children}
    </svg>
  );
}

export function IconCalendar() {
  return (
    <Tile>
      <rect x="9" y="10.5" width="16" height="14" rx="3" stroke="var(--navy)" strokeWidth="1.7" />
      <path d="M9 15h16M13.5 8.5v4M20.5 8.5v4" stroke="var(--navy)" strokeWidth="1.7" />
      <path d="m14 19.5 2 2 4-4" stroke="var(--scan)" strokeWidth="1.9" />
    </Tile>
  );
}

export function IconWon() {
  return (
    <Tile>
      <circle cx="17" cy="17" r="8" stroke="var(--navy)" strokeWidth="1.7" />
      <path d="m12.8 13.5 1.8 6.5 2.4-5 2.4 5 1.8-6.5" stroke="var(--navy)" strokeWidth="1.5" />
      <path d="M12 16.8h10" stroke="var(--scan)" strokeWidth="1.5" />
    </Tile>
  );
}

export function IconPin() {
  return (
    <Tile>
      <path d="M17 26s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" stroke="var(--navy)" strokeWidth="1.7" />
      <circle cx="17" cy="15" r="2.4" fill="var(--scan)" />
    </Tile>
  );
}

export function IconScan() {
  return (
    <Tile>
      <circle cx="17" cy="17" r="8" stroke="var(--navy)" strokeWidth="1.7" />
      <circle cx="17" cy="17" r="4" fill="var(--sky)" />
      <path d="M7.5 17h19" stroke="var(--scan)" strokeWidth="2" />
    </Tile>
  );
}

// ---------- 선 아이콘 (currentColor, 글자 옆·메뉴용) ----------
type LP = { size?: number; className?: string };
function Line({ size = 20, className, children }: LP & { children: React.ReactNode }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const LineHome = (p: LP) => <Line {...p}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></Line>;
export const LineCalendar = (p: LP) => <Line {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Line>;
export const LineCard = (p: LP) => <Line {...p}><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10h17M7 14.5h4" /></Line>;
export const LineScan = (p: LP) => <Line {...p}><circle cx="12" cy="12" r="7.5" /><path d="M2.5 12h19" /><circle cx="12" cy="12" r="3" /></Line>;
export const LinePin = (p: LP) => <Line {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></Line>;
export const LinePen = (p: LP) => <Line {...p}><path d="M5 19.5h14M6.5 15.5 15.8 6.2a1.9 1.9 0 0 1 2.7 2.7l-9.3 9.3-3.6.9z" /></Line>;
export const LineHelp = (p: LP) => <Line {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17h.01" /></Line>;
export const LineLock = (p: LP) => <Line size={14} {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Line>;
export const LineSpark = (p: LP) => <Line size={14} {...p}><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M7 7l2.2 2.2M14.8 14.8 17 17M17 7l-2.2 2.2M9.2 14.8 7 17" /></Line>;
