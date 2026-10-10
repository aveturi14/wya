'use client';

import { useRef } from 'react';
import { themeVars, type EventThemeName } from '@/lib/fx';
import { gsap, MOTION_OK, useGSAP } from '@/lib/gsap';

const CARDS: { theme: EventThemeName; initial: string; name: string }[] = [
  { theme: 'violet', initial: 'B', name: 'Birthday dinner' },
  { theme: 'lime', initial: 'G', name: 'Game night' },
  { theme: 'bubblegum', initial: 'K', name: 'Karaoke' },
  { theme: 'tangerine', initial: 'P', name: 'Picnic' },
  { theme: 'ocean', initial: 'B', name: 'Beach day' },
  { theme: 'sunset', initial: 'R', name: 'Rooftop night' },
];

/** Final fanned-out position of card i, scaled to the viewport. */
function fanPose(i: number) {
  const mid = (CARDS.length - 1) / 2;
  const off = i - mid;
  const card = document.querySelector<HTMLElement>('.fan-card')?.offsetWidth ?? 240;
  // Wide enough to fan out, narrow enough that the outer cards stay on screen
  const spread = Math.max(24, Math.min(window.innerWidth * 0.14, 250, (window.innerWidth * 0.82 - card) / (CARDS.length - 1)));
    // Tilted cards get wider, so phones get a gentler tilt
  const tilt = window.innerWidth < 768 ? 5 : 9;
  return { x: off * spread, y: Math.abs(off) ** 2 * spread * 0.07, rotate: off * tilt };
}

export default function ThemeFan() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>('.fan-card', ref.current);
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        // Stacked deck → fan, scrubbed with scroll
        gsap.fromTo(
          cards,
          { x: 0, y: 60, rotate: (i) => (i - 2.5) * 2, scale: 0.85 },
          {
            x: (i) => fanPose(i).x,
            y: (i) => fanPose(i).y,
            rotate: (i) => fanPose(i).rotate,
            scale: 1,
            ease: 'power2.out',
            stagger: 0.02,
            scrollTrigger: { trigger: ref.current, start: 'top 85%', end: 'center 55%', scrub: 0.8, invalidateOnRefresh: true },
          }
        );

        // Lift a card toward you on hover
        const cleanups: (() => void)[] = [];
        cards.forEach((card, i) => {
          const enter = () => gsap.to(card, { y: fanPose(i).y - 40, scale: 1.08, rotate: 0, zIndex: 10, duration: 0.5, ease: 'back.out(2)' });
          const leave = () => gsap.to(card, { y: fanPose(i).y, scale: 1, rotate: fanPose(i).rotate, zIndex: i, duration: 0.6, ease: 'power3.out' });
          card.addEventListener('pointerenter', enter);
          card.addEventListener('pointerleave', leave);
          cleanups.push(() => {
            card.removeEventListener('pointerenter', enter);
            card.removeEventListener('pointerleave', leave);
          });
        });
        return () => cleanups.forEach((c) => c());
      });

      // Reduced motion: just show the fan
      mm.add('(prefers-reduced-motion: reduce)', () => {
        cards.forEach((c, i) => gsap.set(c, fanPose(i)));
      });
    },
    { scope: ref }
  );

  return (
    <section className="fan-section" ref={ref} aria-label="Event themes">
      <div className="fan" aria-hidden="true">
        {CARDS.map((c, i) => (
          <div key={c.name} className="fan-card" style={{ ...themeVars(c.theme), zIndex: i }}>
            <span className="fan-initial">{c.initial}</span>
            <span className="fan-name">{c.name}</span>
          </div>
        ))}
      </div>
      <p className="fan-caption" data-split>
        Every plan gets a look worth showing up for.
      </p>
    </section>
  );
}
