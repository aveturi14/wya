'use client';

import { useRef } from 'react';
import { gsap, MOTION_OK, useGSAP } from '@/lib/gsap';
import WaitlistButton from './WaitlistButton';

export default function Cta() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref.current);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // The question assembles itself as you scroll in
        gsap.from(q('.cta-word'), {
          yPercent: 110,
          rotate: (i) => [-14, 10, -8][i],
          scale: 0.7,
          autoAlpha: 0,
          ease: 'back.out(1.6)',
          stagger: 0.12,
          scrollTrigger: { trigger: ref.current, start: 'top 75%', end: 'top 25%', scrub: 0.8 },
        });
        gsap.from(q('.cta-sub, .cta-btn, .cta-note'), {
          y: 40,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.1,
          scrollTrigger: { trigger: q('.cta-sub')[0], start: 'top 90%', once: true },
        });
        // Rings breathe like a ripple
        gsap.fromTo(q('.ring'), { scale: 0.6, opacity: 0.35 }, { scale: 1.3, opacity: 0, duration: 4, ease: 'sine.out', repeat: -1, stagger: 1.3 });
        // The accent word wiggles once in a while
        gsap
          .timeline({ repeat: -1, repeatDelay: 3.5, delay: 2 })
          .to(q('.cta-word.accent'), { skewX: -8, duration: 0.1, yoyo: true, repeat: 5, ease: 'sine.inOut' });
      });
    },
    { scope: ref }
  );

  return (
    <section className="cta" id="get" ref={ref}>
      <div className="cta-bg" aria-hidden="true">
        <span className="ring r1" />
        <span className="ring r2" />
        <span className="ring r3" />
      </div>
      <div className="wrap cta-inner">
        <h2 className="cta-title" aria-label="Are you coming?">
          <span className="cta-word" aria-hidden="true">Are</span>
          <span className="cta-word" aria-hidden="true">you</span>
          <span className="cta-word accent" aria-hidden="true">coming?</span>
        </h2>
        <p className="cta-sub">
          We&apos;re testing wya with a small group and ironing out the details. Join the waitlist and you&apos;ll be first in when we open
          the doors.
        </p>
        <WaitlistButton className="cta-btn" />
        <p className="cta-note">Opens a short Google Form.</p>
      </div>
    </section>
  );
}
