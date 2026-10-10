'use client';

import { useRef, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from '@/lib/gsap';

const LINKS = [
  { href: '#problem', label: 'Why' },
  { href: '#how', label: 'How it works' },
  { href: '#deposits', label: 'Deposits' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
];

type Mode = 'light' | 'dark';

export default function Nav() {
  const ref = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>('light');
  const [active, setActive] = useState('');

  useEffect(() => {
    setMode(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  useGSAP(
    () => {
      const nav = ref.current!;
      // Frosted background once you leave the top, and hide while scrolling down
      ScrollTrigger.create({
        start: 40,
        end: 'max',
        onToggle: (self) => nav.classList.toggle('is-scrolled', self.isActive),
      });

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(nav.querySelectorAll('.logo, .nav-links a, .nav-actions > *'), {
          y: -30,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'back.out(2)',
          stagger: 0.05,
          delay: 0.2,
        });
        const hide = gsap.to(nav, { yPercent: -110, duration: 0.35, ease: 'power2.out', paused: true });
        ScrollTrigger.create({
          start: 400,
          end: 'max',
          onUpdate: (self) => (self.direction === 1 ? hide.play() : hide.reverse()),
          onLeaveBack: () => hide.reverse(),
        });
      });

      // Highlight the link for the section in view
      LINKS.forEach(({ href }) => {
        const el = document.querySelector(href);
        if (!el) return;
        ScrollTrigger.create({
          trigger: el,
          start: 'top 50%',
          end: 'bottom 50%',
          onToggle: (self) => self.isActive && setActive(href),
        });
      });
    },
    { scope: ref }
  );

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('wya-theme', next);
      } catch {
        // Private mode: the choice just won't persist
      }
      flushSync(() => setMode(next));
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) {
      apply();
      return;
    }
    // Paint the new palette as a circle growing out of the button
    const x = e.clientX || window.innerWidth - 60;
    const y = e.clientY || 36;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  };

  return (
    <header className="nav" ref={ref}>
      <div className="wrap nav-inner">
        <a className="logo" href="#top" aria-label="wya home">
          wya<span>.</span>
        </a>
        <nav className="nav-links" aria-label="Sections">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={active === l.href ? 'is-active' : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={mode === 'dark' ? 'Switch to Soft pop (light) theme' : 'Switch to After dark (dark) theme'}
          >
            <svg className="i-sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
            </svg>
            <svg className="i-moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
            </svg>
          </button>
          <a className="btn btn-primary btn-sm magnetic" href="#get">
            Get the app
          </a>
        </div>
      </div>
    </header>
  );
}
