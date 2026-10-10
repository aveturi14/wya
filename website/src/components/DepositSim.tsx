'use client';

import { useRef, useState } from 'react';
import { confettiFrom, vars } from '@/lib/fx';
import { gsap, MOTION_OK, useGSAP } from '@/lib/gsap';

type Outcome = 'show' | 'flake';

const COPY: Record<Outcome, { result: string; guest: string; host: string }> = {
  show: { result: 'You checked in. Your card is never charged.', guest: '$10 kept', host: '$0 collected' },
  flake: { result: 'No-show, no excuse. Your $10 goes to Hannah for the food you didn’t eat.', guest: '$10 charged', host: '$10 collected' },
};

const RULES = [
  {
    title: 'Cancel before the cutoff',
    body: 'Plans change. Drop out before the host’s cutoff and it’s free.',
    bg: 'var(--primary)',
    fg: 'var(--on-primary)',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  {
    title: 'Maybe? No deposit.',
    body: 'Maybes decide by the cutoff. If you don’t, it becomes a no, and we’ll nudge you first.',
    bg: 'var(--warning)',
    fg: 'var(--on-status)',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2" />
      </>
    ),
  },
  {
    title: 'Life happens',
    body: 'Couldn’t make it? Send an excuse. Your host decides, and nothing is charged until they’ve had time to review.',
    bg: 'var(--secondary)',
    fg: 'var(--on-secondary)',
    icon: <path d="M5 5h14v10H9l-4 4V5Z" />,
  },
];

export default function DepositSim() {
  const ref = useRef<HTMLElement>(null);
  const [outcome, setOutcome] = useState<Outcome>('show');
  const outcomeRef = useRef<Outcome>('show');

  // Where the coin rests for each outcome: just above the avatar it belongs to
  const spot = (which: 'guest' | 'host') => {
    const stage = ref.current!.querySelector<HTMLElement>('.sim-stage')!;
    const av = ref.current!.querySelector<HTMLElement>(`.sim-node.${which} .sim-avatar`)!;
    const coin = ref.current!.querySelector<HTMLElement>('.coin')!;
    const s = stage.getBoundingClientRect();
    const a = av.getBoundingClientRect();
    // offsetWidth ignores the coin's own transforms (it may be mid-spin)
    const size = coin.offsetWidth;
    return { x: a.left - s.left + a.width / 2 - size / 2, y: a.top - s.top - size - 8 };
  };

  const { contextSafe } = useGSAP(
    () => {
      const coin = ref.current!.querySelector('.coin');
      const place = () => gsap.set(coin, spot(outcomeRef.current === 'show' ? 'guest' : 'host'));
      place();
      window.addEventListener('resize', place);

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // First time in view: the coin drops onto the guest with a bounce
        const g = spot('guest');
        gsap.from(coin, {
          y: g.y - 260,
          rotate: -200,
          duration: 1.3,
          ease: 'bounce.out',
          scrollTrigger: { trigger: '.sim', start: 'top 70%', once: true },
        });
        gsap.from('.rule', {
          y: 60,
          rotate: (i) => [-4, 2, 5][i],
          autoAlpha: 0,
          duration: 1,
          ease: 'expo.out',
          stagger: 0.12,
          scrollTrigger: { trigger: '.rules', start: 'top 85%', once: true },
        });
      });

      return () => window.removeEventListener('resize', place);
    },
    { scope: ref }
  );

  const choose = contextSafe((next: Outcome) => {
    if (next === outcomeRef.current) return;
    outcomeRef.current = next;
    setOutcome(next);

    const root = ref.current!;
    const coin = root.querySelector<HTMLElement>('.coin')!;
    const from = spot(next === 'flake' ? 'guest' : 'host');
    const to = spot(next === 'flake' ? 'host' : 'guest');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      gsap.set(coin, to);
      return;
    }

    // Fly the coin along a quadratic arc between the two avatars
    const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 160 };
    const p = { t: 0 };
    gsap.killTweensOf(p);
    gsap.to(p, {
      t: 1,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = p.t;
        const u = 1 - t;
        gsap.set(coin, {
          x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
          y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
          rotate: t * (next === 'flake' ? 720 : -720),
          scale: 1 + Math.sin(t * Math.PI) * 0.35,
        });
      },
      onComplete: () => {
        const target = root.querySelector(`.sim-node.${next === 'flake' ? 'host' : 'guest'} .sim-avatar`)!;
        gsap.fromTo(target, { scale: 1.25 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
        if (next === 'show') confettiFrom(target, 50);
      },
    });
    gsap.fromTo(root.querySelector('[data-sim-result]'), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out', delay: 0.15 });
  });

  const c = COPY[outcome];

  return (
    <section className="deal" id="deposits" ref={ref}>
      <div className="wrap">
        <div className="deal-head">
          <p className="label">Deposits</p>
          <h2 className="section-title" data-split>
            Your $10 only moves if you don&apos;t.
          </h2>
          <p className="section-sub" data-reveal>
            Try it. Pick what happens on the night and follow the money.
          </p>
        </div>

        <div className="sim card" data-outcome={outcome}>
          <div className="sim-toggle" role="radiogroup" aria-label="What happens on the night">
            {(['show', 'flake'] as const).map((o) => (
              <button key={o} type="button" role="radio" aria-checked={outcome === o} onClick={() => choose(o)}>
                {o === 'show' ? 'I showed up' : 'I flaked'}
              </button>
            ))}
            <span className="sim-thumb" aria-hidden="true" />
          </div>

          <div className="sim-stage">
            <div className="sim-node guest">
              <span className="sim-avatar" style={vars({ '--c': 'var(--ev-ocean)' })} aria-hidden="true">
                G
              </span>
              <b>Gary</b>
              <small>{c.guest}</small>
            </div>
            <svg className="sim-path" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
              <path d="M10 100 C 120 -20, 280 -20, 390 100" />
            </svg>
            <div className="sim-node host">
              <span className="sim-avatar" style={vars({ '--c': 'var(--ev-violet)' })} aria-hidden="true">
                H
              </span>
              <b>Hannah, host</b>
              <small>{c.host}</small>
            </div>
            <span className="coin" aria-hidden="true">
              $10
            </span>
          </div>

          <p className="sim-result" aria-live="polite" data-sim-result>
            {c.result}
          </p>
        </div>

        <div className="rules">
          {RULES.map((r) => (
            <article key={r.title} className="rule card">
              <span className="rule-icon" style={vars({ '--bg-i': r.bg, '--fg-i': r.fg })} aria-hidden="true">
                <svg viewBox="0 0 24 24">{r.icon}</svg>
              </span>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
