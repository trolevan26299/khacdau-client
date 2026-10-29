// Logo con dấu tròn đỏ có ngôi sao
export function SealIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
      <path
        d="M32 18.5l3.9 8.6 9.4 1-7 6.3 2 9.2L32 38.9l-8.3 4.7 2-9.2-7-6.3 9.4-1z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand${light ? ' brand-light' : ''}`}>
      <span className="brand-icon">
        <SealIcon />
      </span>
      <div>
        <div className="brand-name">Khắc Dấu Tâm Tín</div>
        <div className="brand-sub">Đơn đề nghị khắc dấu</div>
      </div>
    </div>
  );
}
