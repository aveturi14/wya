'use client';

import { useRef, useState } from 'react';
import { confettiFrom, THEME_ORDER, themeVars, toast, vars, type EventThemeName } from '@/lib/fx';
import { gsap, MOTION_OK, SplitText, useGSAP } from '@/lib/gsap';
import WaitlistButton from './WaitlistButton';

const STICKERS = [
  { cls: 'fs1', label: "I'm in!", bg: 'var(--highlight)', fg: 'var(--on-highlight)', rot: -10, depth: 40 },
  { cls: 'fs2', label: 'No flakes', bg: 'var(--secondary)', fg: 'var(--on-secondary)', rot: 8, depth: 70 },
  { cls: 'fs3', label: '+3 going', bg: 'var(--success)', fg: 'var(--on-status)', rot: 6, depth: 55 },
  { cls: 'fs4', label: '$0 if you show', bg: 'var(--primary)', fg: 'var(--on-primary)', rot: -6, depth: 30 },
];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [inState, setInState] = useState(false);
  const [coverTheme, setCoverTheme] = useState<EventThemeName>('violet');

  useGSAP(
    () => {
      const root = ref.current!;
      const q = gsap.utils.selector(root);
      const stickers = q<HTMLElement>('.float-sticker');
      stickers.forEach((s, i) => gsap.set(s, { rotation: STICKERS[i].rot }));

      // The cover art cycles through the event themes, like a host trying them on
      const cycle = window.setInterval(() => {
        setCoverTheme((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]);
      }, 3200);

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const title = q('.hero-title')[0];
        const split = SplitText.create(title, { type: 'chars', charsClass: 'char' });
        const path = q<SVGPathElement>('.scribble path')[0];
        const len = path.getTotalLength();

        // Un-hide before building tweens: autoAlpha reads `visibility: hidden` as 0.
        // The from() tweens below render their hidden start state in the same frame.
        gsap.set(q('[data-intro]'), { visibility: 'visible' });
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });
        tl.from(q('.blob'), { scale: 0, duration: 2, stagger: 0.15, ease: 'power3.out' }, 0)
          .from(q('.hero-kicker'), { y: 30, scale: 0.6, rotate: -20, autoAlpha: 0, duration: 0.9, ease: 'back.out(2.5)' }, 0.1)
          .from(
            split.chars,
            {
              yPercent: 120,
              rotate: () => gsap.utils.random(-25, 25),
              scale: 0.6,
              autoAlpha: 0,
              duration: 1.1,
              ease: 'back.out(1.8)',
              stagger: { each: 0.028, from: 'start' },
            },
            0.2
          )
          .fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0.95)
          .from(q('.hero-sub, .hero-ctas > *, .hero-note'), { y: 30, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.7)
          .from(
            q('.phone'),
            { y: 220, rotationX: 40, rotationZ: -14, scale: 0.8, autoAlpha: 0, duration: 1.5, ease: 'expo.out' },
            0.35
          )
          .from(
            stickers,
            { scale: 0, rotation: () => gsap.utils.random(-60, 60), autoAlpha: 0, duration: 1, ease: 'elastic.out(1, 0.45)', stagger: 0.12 },
            1.0
          );

        // Background blobs drift slowly so the color never sits still
        q<HTMLElement>('.blob').forEach((b, i) => {
          gsap.to(b, {
            x: () => gsap.utils.random(-8, 8) + 'vw',
            y: () => gsap.utils.random(-6, 6) + 'vh',
            scale: () => gsap.utils.random(0.85, 1.2),
            duration: gsap.utils.random(9, 14),
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            repeatRefresh: true,
            delay: 2.2 + i * 0.6, // after the intro has scaled them in
          });
        });

        // Stickers bob gently after landing
        stickers.forEach((s, i) => {
          gsap.to(s, {
            y: i % 2 ? 14 : -14,
            duration: gsap.utils.random(2.2, 3.2),
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            delay: 2 + i * 0.2,
          });
        });

        // Phone tilts toward the pointer; stickers drift at different depths
        const phone = q('.phone')[0];
        const rx = gsap.quickTo(phone, 'rotationX', { duration: 0.8, ease: 'power3.out' });
        const ry = gsap.quickTo(phone, 'rotationY', { duration: 0.8, ease: 'power3.out' });
        const sx = stickers.map((s) => gsap.quickTo(s, 'x', { duration: 1, ease: 'power3.out' }));
        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          ry(nx * 22);
          rx(-ny * 16);
          sx.forEach((fn, i) => fn(nx * STICKERS[i].depth));
        };
        root.addEventListener('pointermove', onMove);

        // Scrolling away: the phone floats up and turns, the copy drifts
        // On a wrapper, so it never fights the intro or the pointer tilt for the same transform
        gsap.to(q('.phone-float'), {
          yPercent: -18,
          rotationZ: 6,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
        });
        gsap.to(q('.hero-copy'), {
          yPercent: 12,
          opacity: 0.2,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
        });
        gsap.to(q('.b1'), { yPercent: 40, xPercent: -20, ease: 'none', scrollTrigger: { trigger: root, scrub: true, start: 'top top', end: 'bottom top' } });
        gsap.to(q('.b2'), { yPercent: -30, xPercent: 30, ease: 'none', scrollTrigger: { trigger: root, scrub: true, start: 'top top', end: 'bottom top' } });

        return () => {
          root.removeEventListener('pointermove', onMove);
          split.revert();
        };
      });

      return () => window.clearInterval(cycle);
    },
    { scope: ref }
  );

  const { contextSafe } = useGSAP({ scope: ref });

  const onImIn = contextSafe((e: React.MouseEvent<HTMLButtonElement>) => {
    const next = !inState;
    setInState(next);
    const root = ref.current!;
    const count = root.querySelector('[data-going]');
    gsap.fromTo(count, { scale: 1.8, color: 'var(--success)' }, { scale: 1, color: 'var(--text)', duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    if (next) {
      confettiFrom(e.currentTarget, 120);
      gsap.fromTo(root.querySelector('.phone'), { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
      toast("You're in. Now imagine every guest meaning it.");
    }
  });

  return (
    <section className="hero" id="top" ref={ref}>
      <div className="hero-bg" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
        <span className="blob b4" />
      </div>

      <div className="wrap hero-inner">
        <div className="hero-copy" data-intro>
          <span className="sticker hero-kicker">RSVPs with skin in the game</span>
          <h1 className="hero-title">
            <span className="line">Plans that</span>
            <span className="line">
              <span className="scribble">
                actually
                <svg viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M4 22 C 60 6, 120 28, 180 14 S 270 8, 296 18" />
                </svg>
              </span>
            </span>
            <span className="line">happen.</span>
          </h1>
          <p className="hero-sub">
            wya is the RSVP app where “I&apos;m in” means something. Guests put down a small deposit when they say yes.{' '}
            <strong>Show up and you pay nothing.</strong>
          </p>
          <div className="hero-ctas">
            <WaitlistButton />
            <a className="btn btn-outline btn-lg magnetic" href="#how">
              See how it works
            </a>
          </div>
          <p className="hero-note">
            <span className="pulse-dot" />
            In private testing. Get early access when we open the doors.
          </p>
        </div>

        <div className="hero-stage" data-intro>
          <div className="phone-float">
            <div className="phone">
              <div className="phone-notch" />
              <div className="phone-screen">
                <div className="ev-cover" style={themeVars(coverTheme)}>
                  <span className="ev-shape s1" />
                  <span className="ev-shape s2" />
                  <span className="ev-initial">R</span>
                  <span className="sticker ev-date">SAT · 8 PM</span>
                </div>
                <div className="ev-body">
                  <p className="label">Hannah is hosting</p>
                  <p className="ev-title" role="heading" aria-level={2}>
                    Rooftop Night
                  </p>
                  <p className="ev-meta">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
                      <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                    Hannah&apos;s place
                  </p>
                  <div className="ev-going">
                    <div className="avatars" aria-hidden="true">
                      {inState && <span style={vars({ '--c': 'var(--ev-lime)' })}>Y</span>}
                      <span style={vars({ '--c': 'var(--ev-violet)' })}>G</span>
                      <span style={vars({ '--c': 'var(--ev-tangerine)' })}>J</span>
                      <span style={vars({ '--c': 'var(--ev-ocean)' })}>R</span>
                      <span style={vars({ '--c': 'var(--ev-bubblegum)' })}>S</span>
                    </div>
                    <span className="ev-count">
                      <b data-going>{inState ? 12 : 11}</b> going
                    </span>
                  </div>
                  <div className="ev-deposit">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="11" rx="3" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                    <div>
                      <b>$10 deposit</b>
                      <small>Only charged if you flake</small>
                    </div>
                  </div>
                  <p className="ev-q">{inState ? 'See you there!' : 'Are you coming?'}</p>
                  <div className="ev-rsvp">
                    <button className={`rsvp rsvp-yes${inState ? ' is-in' : ''}`} type="button" onClick={onImIn} aria-pressed={inState}>
                      {inState ? "You're in" : "I'm in"}
                    </button>
                    <span className="rsvp" aria-hidden="true">
                      Maybe
                    </span>
                    <span className="rsvp" aria-hidden="true">
                      Can&apos;t go
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {STICKERS.map((s) => (
            <span key={s.cls} className={`float-sticker sticker ${s.cls}`} style={vars({ '--bg-s': s.bg, '--fg-s': s.fg })} aria-hidden="true">
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <a className="scroll-cue" href="#problem" aria-label="Scroll to learn more">
        <span />
      </a>
    </section>
  );
}
