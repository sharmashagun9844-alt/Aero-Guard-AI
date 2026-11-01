export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="9" fill="none" stroke="#19212c" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="3.2" fill="#0a6bd6" />
      <path d="M16 3v5M16 24v5M3 16h5M24 16h5" stroke="#19212c" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
