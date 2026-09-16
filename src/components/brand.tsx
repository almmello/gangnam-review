import Link from "next/link";
export function Brand() {
  return <Link className="brand" href="/" aria-label="Gangnam Review home">
    <svg className="brand-symbol" width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="currentColor"/>
      <path d="M29 22a12 12 0 1 0 0 20V32h-8M37 44V20h5c12 0 12 14 0 14h-5m7 0 9 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span className="brand-name">gangnam<span>review</span><small>REVIEW QUALITY WORKBENCH</small></span>
  </Link>;
}

