'use client';

import { useRef } from 'react';
import { confettiFrom, toast } from '@/lib/fx';
import { gsap, MOTION_OK, useGSAP } from '@/lib/gsap';
import { site } from '@/lib/site';

const STORES = [
  {
    key: 'ios',
    url: site.appStoreUrl,
    small: 'Coming soon to the',
    big: 'App Store',
    icon: (
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8C6.9 7.4 5.4 8.3 4.6 9.8c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 2.9 2.4s1.6-.8 3-.8 1.8.8 3 .7c1.3 0 2.1-1.2 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.4-.9-2.4-4.1ZM14.1 5.8c.6-.8 1.1-1.8.9-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2.1-.5 2.8-1.3Z" />
    ),
  },
  {
    key: 'android',
    url: site.playStoreUrl,
    small: 'Coming soon on',
    big: 'Google Play',
    icon: <path d="M4 3.5v17c0 .4.4.6.7.4L19 12.4c.3-.2.3-.6 0-.8L4.7 3.1c-.3-.2-.7 0-.7.4Z" />,
  },
];

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
        gsap.from(q('.cta-sub, .store, .web-link'), {
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

  const onStore = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (url) return; // Real link: let it navigate
    e.preventDefault();
    confettiFrom(e.currentTarget, 60);
    toast('Almost there. wya is landing in the stores soon.');
  };

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
        <p className="cta-sub">wya is landing on iPhone and Android soon. Be first in line when it does.</p>
        <div className="stores">
          {STORES.map((s) => (
            <a
              key={s.key}
              className="store magnetic"
              href={s.url || '#get'}
              onClick={(e) => onStore(e, s.url)}
              {...(s.url ? { target: '_blank', rel: 'noopener noreferrer' } : { 'aria-disabled': true })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <g className="fill">{s.icon}</g>
              </svg>
              <span>
                <small>{s.url ? (s.key === 'ios' ? 'Download on the' : 'Get it on') : s.small}</small>
                {s.big}
              </span>
            </a>
          ))}
        </div>
        <a className="web-link" href={site.webAppUrl} target="_blank" rel="noopener noreferrer">
          Or try wya on the web
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14m0 0-6-6m6 6-6 6" />
          </svg>
        </a>
      </div>
    </section>
  );
}
