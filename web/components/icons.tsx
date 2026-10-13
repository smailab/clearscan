export function Chevron({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconCalendar() {
  return (
    <svg className="ico" viewBox="0 0 34 34" aria-hidden="true">
      <rect x="4" y="7" width="26" height="23" rx="5" fill="#5a8bff" />
      <rect x="4" y="7" width="26" height="8" rx="4" fill="#3d6bff" />
      <rect x="10" y="3" width="3" height="8" rx="1.5" fill="#0b1b3a" />
      <rect x="21" y="3" width="3" height="8" rx="1.5" fill="#0b1b3a" />
      <path d="m11 22 4 4 8-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWon() {
  return (
    <svg className="ico" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="14" fill="#ffc94d" />
      <circle cx="17" cy="17" r="10.5" fill="#ffb300" />
      <path d="M10.5 12.5 13 22l4-8 4 8 2.5-9.5M9.5 17h15" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPin() {
  return (
    <svg className="ico" viewBox="0 0 34 34" aria-hidden="true">
      <path d="M17 3c6 0 11 5 11 11 0 8-11 17-11 17S6 22 6 14C6 8 11 3 17 3z" fill="#2f8bff" />
      <circle cx="17" cy="14" r="5" fill="#fff" />
      <path d="M15 14h4M17 12v4" stroke="#2f8bff" strokeWidth="1.6" />
    </svg>
  );
}

export function IconScan() {
  return (
    <svg className="ico" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="14" fill="#0b1b3a" />
      <circle cx="17" cy="17" r="8" fill="#ecf1ff" />
      <rect x="5" y="15.5" width="24" height="3" rx="1.5" fill="#8fb0ff" />
    </svg>
  );
}
