'use client';

import { useRef } from 'react';
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from '@/lib/gsap';

const ROW_1 = ['RSVP means something', 'Show up, pay nothing', 'No more ghost guests', 'Cook for who’s coming'];
const ROW_2 = ['I’m in', 'wya?', 'Are you coming?', 'See you there'];

function Track({ words, mark }: { words: string[]; mark: string }) {
  // Two identical halves so a -50% shift loops seamlessly
  const items = [...words, ...words, ...words];
  return (
    <div className="marquee-track">
      {[0, 1].map((half) =>
        items.map((w, i) => (
          <span key={`${half}-${i}`} style={{ display: 'contents' }}>
            <span>{w}</span>
            <i>{mark}</i>
          </span>
        ))
      )}
    </div>
  );
}

export default function Marquee() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const [t1, t2] = gsap.utils.toArray<HTMLElement>('.marquee-track', ref.current);
        const loop1 = gsap.to(t1, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
        const loop2 = gsap.fromTo(t2, { xPercent: -50 }, { xPercent: 0, duration: 30, ease: 'none', repeat: -1 });

        // Scroll speed pushes the bands faster and flips their direction
        let dir = 1;
        ScrollTrigger.create({
          onUpdate: (self) => {
            if (self.direction !== dir) dir = self.direction;
            const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 250, 6);
            gsap.to([loop1, loop2], { timeScale: boost * dir, duration: 0.2, overwrite: true });
            gsap.to([loop1, loop2], { timeScale: dir, duration: 1.2, delay: 0.2, ease: 'power2.out' });
          },
        });

        // The bands swing slightly as they pass through the viewport
        gsap.fromTo(
          ref.current!.querySelector('.m1'),
          { rotate: -5 },
          { rotate: 1, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true } }
        );
        gsap.fromTo(
          ref.current!.querySelector('.m2'),
          { rotate: 5 },
          { rotate: -1, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true } }
        );
      });
    },
    { scope: ref }
  );

  return (
    <div className="marquees" ref={ref} aria-hidden="true">
      <div className="marquee m1">
        <Track words={ROW_1} mark="✱" />
      </div>
      <div className="marquee m2">
        <Track words={ROW_2} mark="●" />
      </div>
    </div>
  );
}
