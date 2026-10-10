'use client';

import { useEffect, useRef, useState } from 'react';
import { vars } from '@/lib/fx';
import { gsap, MOTION_OK, useGSAP } from '@/lib/gsap';

// A decorative QR-ish grid: three finder squares plus a fixed pseudo-random fill
const QR_SIZE = 13;
const QR_CELLS = Array.from({ length: QR_SIZE * QR_SIZE }, (_, idx) => {
  const x = idx % QR_SIZE;
  const y = Math.floor(idx / QR_SIZE);
  // 5×5 finder: outer ring plus a center dot
  const finder = (fx: number, fy: number) => {
    const dx = x - fx;
    const dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 4 || dy > 4) return null;
    return dx === 0 || dy === 0 || dx === 4 || dy === 4 || (dx === 2 && dy === 2);
  };
  const f = finder(0, 0) ?? finder(QR_SIZE - 5, 0) ?? finder(0, QR_SIZE - 5);
  if (f !== null) return f;
  return ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
});

const DEPOSITS = ['$5', '$10', '$20', 'Custom'];

export default function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const [chip, setChip] = useState(1);

  // The host "tries" different deposit amounts
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setChip((c) => (c + 1) % 3), 1600);
    return () => window.clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref.current);
      const mm = gsap.matchMedia();

      // Wide screens: the steps scroll sideways while the section is pinned
      mm.add(`${MOTION_OK} and (min-width: 768px)`, () => {
        const track = q('.how-track')[0] as HTMLElement;
        const distance = () => track.scrollWidth - window.innerWidth;

        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: q('.how-pin')[0],
            start: 'center center',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        q('.step').forEach((step) => {
          const sq = gsap.utils.selector(step);
          const tl = gsap
            .timeline({
              scrollTrigger: { trigger: step, containerAnimation: slide, start: 'left 85%', toggleActions: 'play none none reverse' },
            })
            .from(step, { rotate: 4, y: 40, duration: 0.8, ease: 'expo.out' })
            .from(sq('.step-num'), { scale: 0, rotate: -180, duration: 0.8, ease: 'back.out(2)' }, 0.05)
            .from(sq('.step-mock > *'), { y: 60, scale: 0.85, autoAlpha: 0, duration: 0.9, ease: 'expo.out' }, 0.15);
          const pops = sq('.saved-pill, .checked-pill, .outcome');
          if (pops.length) tl.from(pops, { scale: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)', stagger: 0.12 }, 0.5);
        });
      });

      // Phones: a vertical stack where each step pops in
      mm.add(`${MOTION_OK} and (max-width: 767px)`, () => {
        q('.step').forEach((step) => {
          gsap.from(step, {
            y: 80,
            rotate: 3,
            autoAlpha: 0,
            duration: 0.9,
            ease: 'expo.out',
            scrollTrigger: { trigger: step, start: 'top 88%', once: true },
          });
        });
      });
    },
    { scope: ref }
  );

  return (
    <section className="how" id="how" ref={ref}>
      <div className="how-head wrap">
        <p className="label">How it works</p>
        <h2 className="section-title" data-split>
          Put a little skin in the game.
        </h2>
      </div>
      <div className="how-pin">
        <ol className="how-track" style={{ listStyle: 'none', margin: 0 }}>
          <li className="step card" style={vars({ '--accent': 'var(--primary)', '--on-accent': 'var(--on-primary)' })}>
            <div className="step-copy">
              <span className="step-num" aria-hidden="true">01</span>
              <h3>Host sets the stakes</h3>
              <p>Pick a small deposit and a cancellation cutoff. No payment setup needed to create a paid event.</p>
            </div>
            <div className="step-mock" aria-hidden="true">
              <div className="mock-panel">
                <p className="label">Deposit</p>
                <div className="chips">
                  {DEPOSITS.map((d, i) => (
                    <span key={d} className={`chip${chip === i ? ' is-on' : ''}`}>
                      {d}
                    </span>
                  ))}
                </div>
                <p className="label">Cancel for free until</p>
                <div className="mock-field">
                  <svg viewBox="0 0 24 24">
                    <rect x="3.5" y="5" width="17" height="15" rx="3" />
                    <path d="M3.5 10h17M8 3v4M16 3v4" />
                  </svg>
                  Fri, 6:00 PM
                </div>
                <span className="mock-btn">Create event</span>
              </div>
            </div>
          </li>

          <li className="step card" style={vars({ '--accent': 'var(--secondary)', '--on-accent': 'var(--on-secondary)' })}>
            <div className="step-copy">
              <span className="step-num" aria-hidden="true">02</span>
              <h3>Guests say “I&apos;m in”</h3>
              <p>Saying yes saves a card. Nothing is charged. Maybes don&apos;t put anything down at all.</p>
            </div>
            <div className="step-mock" aria-hidden="true">
              <div className="mock-card-stack">
                <div className="pay-card">
                  <span className="pay-chip" />
                  <span className="pay-num">•••• 4242</span>
                  <span className="pay-name">Gary</span>
                </div>
                <div className="saved-pill">
                  <svg viewBox="0 0 24 24">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                  Card saved. Not charged.
                </div>
              </div>
            </div>
          </li>

          <li className="step card" style={vars({ '--accent': 'var(--highlight)', '--on-accent': 'var(--on-highlight)' })}>
            <div className="step-copy">
              <span className="step-num" aria-hidden="true">03</span>
              <h3>Check in at the door</h3>
              <p>Scan in when you arrive and your host confirms. Checked in means you&apos;re never charged.</p>
            </div>
            <div className="step-mock" aria-hidden="true">
              <div className="qr-wrap">
                <div className="qr">
                  {QR_CELLS.map((on, i) => (
                    <i key={i} className={on ? undefined : 'off'} />
                  ))}
                </div>
                <span className="qr-scan" />
                <div className="checked-pill">
                  <svg viewBox="0 0 24 24">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                  Hannah checked you in
                </div>
              </div>
            </div>
          </li>

          <li className="step card" style={vars({ '--accent': 'var(--success)', '--on-accent': 'var(--on-status)' })}>
            <div className="step-copy">
              <span className="step-num" aria-hidden="true">04</span>
              <h3>Show up, pay nothing</h3>
              <p>After the event, only no-shows without an accepted excuse are charged. That deposit goes to the host.</p>
            </div>
            <div className="step-mock" aria-hidden="true">
              <div className="outcomes">
                <div className="outcome good">
                  <span>Showed up</span>
                  <b>$0</b>
                </div>
                <div className="outcome bad">
                  <span>Flaked</span>
                  <b>
                    $10 <small>to host</small>
                  </b>
                </div>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
