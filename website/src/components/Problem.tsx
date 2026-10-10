'use client';

import { useRef } from 'react';
import { vars } from '@/lib/fx';
import { gsap, MOTION_OK, useGSAP } from '@/lib/gsap';

const COLORS = ['--ev-violet', '--ev-tangerine', '--ev-ocean', '--ev-bubblegum', '--ev-lime', '--ev-sunset'];
const INITIALS = 'GJRSHAMKTLPNOBDECVWZFIQUYXGJRS';
// The 10 guests who actually came (fixed, so the picture is the same every time)
const STAYED = new Set([1, 4, 8, 11, 14, 17, 21, 24, 26, 29]);
const PLATES = Array.from({ length: 30 }, (_, i) => ({
  i,
  color: `var(${COLORS[(i * 7) % COLORS.length]})`,
  initial: INITIALS[i],
  stays: STAYED.has(i),
}));

export default function Problem() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(ref.current);
        const counter = q('[data-counter]')[0];
        const num = { v: 30 };
        const flakes = gsap.utils.shuffle(q('.plate[data-flake] .plate-guest'));

        gsap.set(q('.pl2, .pl3'), { autoAlpha: 0, yPercent: 60 });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          scrollTrigger: {
            trigger: q('.problem-pin')[0],
            start: 'top top',
            end: '+=170%',
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
          },
        });

        tl.from(q('.plate'), { scale: 0, rotate: -90, duration: 0.6, stagger: { each: 0.015, from: 'random' }, ease: 'back.out(2)' })
          .from(q('.counter-card'), { y: 40, autoAlpha: 0, duration: 0.4 }, 0)
          // "You cooked for 30."
          .to(q('.pl1'), { autoAlpha: 0, yPercent: -60, duration: 0.4 }, 0.9)
          .to(q('.pl2'), { autoAlpha: 1, yPercent: 0, duration: 0.4 }, 0.95)
          // "10 showed up." Guests peel away one by one
          .to(q('.pl2'), { autoAlpha: 0, yPercent: -60, duration: 0.4 }, 1.7)
          .to(q('.pl3'), { autoAlpha: 1, yPercent: 0, duration: 0.4 }, 1.75)
          .to(
            flakes,
            {
              y: () => gsap.utils.random(-140, -60),
              x: () => gsap.utils.random(-60, 60),
              rotate: () => gsap.utils.random(-180, 180),
              scale: 0.2,
              autoAlpha: 0,
              duration: 0.5,
              stagger: 0.05,
              ease: 'power2.in',
            },
            1.7
          )
          .to(num, { v: 10, duration: 1.45, ease: 'none', onUpdate: () => (counter.textContent = String(Math.round(num.v))) }, 1.7)
          .to(q('.counter-bar span'), { scaleX: 1 / 3, duration: 1.45, ease: 'none' }, 1.7)
          .to(q('.problem-sub'), { color: 'var(--text)', duration: 0.4 }, 3.0);
      });
      // Reduced motion: skip the story and show where it ends
      mm.add('(prefers-reduced-motion: reduce)', () => {
        const q = gsap.utils.selector(ref.current);
        gsap.set(q('.plate[data-flake] .plate-guest'), { autoAlpha: 0 });
        gsap.set(q('.counter-bar span'), { scaleX: 1 / 3 });
        q('[data-counter]')[0].textContent = '10';
      });
    },
    { scope: ref }
  );

  return (
    <section className="problem" id="problem" ref={ref}>
      <div className="problem-pin">
        <div className="wrap problem-inner">
          <div className="problem-copy">
            <p className="label">The problem</p>
            <div className="problem-lines">
              <h2 className="pl pl1">
                You invited <em>30.</em>
              </h2>
              <p className="pl pl2">
                You cooked for <em>30.</em>
              </p>
              <p className="pl pl3">
                <em>10</em> showed up.
              </p>
            </div>
            <p className="problem-sub">
              A free RSVP is easy to give and easier to ignore. Hosts over-prepare, guests flake at the last minute, and the night feels emptier
              than it should.
            </p>
          </div>
          <div className="problem-viz" aria-hidden="true">
            <div className="counter-card card">
              <span className="counter-label">Guests who came</span>
              <span className="counter" data-counter>
                30
              </span>
              <span className="counter-bar">
                <span />
              </span>
            </div>
            <div className="plates">
              {PLATES.map((p) => (
                <span key={p.i} className="plate" data-flake={p.stays ? undefined : ''}>
                  <span className="plate-guest" style={vars({ '--c': p.color })}>
                    {p.initial}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
