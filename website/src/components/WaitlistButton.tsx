import { site } from '@/lib/site';

/** The one call to action while wya is in development: opens the waitlist form in a new tab. */
export default function WaitlistButton({ size = 'lg', label = 'Join the waitlist', className = '' }: { size?: 'sm' | 'lg'; label?: string; className?: string }) {
  return (
    <a className={`btn btn-primary btn-${size} magnetic ${className}`} href={site.waitlistUrl} target="_blank" rel="noopener noreferrer">
      {label}
      {size === 'lg' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 17 17 7m0 0H9m8 0v8" />
        </svg>
      )}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
