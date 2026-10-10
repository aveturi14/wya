'use client';

import { useRef, useState } from 'react';
import { EVENT_THEMES, THEME_ORDER, themeVars, toast, vars, type EventThemeName } from '@/lib/fx';
import { gsap, MOTION_OK, useGSAP } from '@/lib/gsap';

const GUESTS = [
  { name: 'Gary', initial: 'G', color: 'var(--ev-ocean)', status: 'Going' },
  { name: 'Jo', initial: 'J', color: 'var(--ev-tangerine)', status: 'Going' },
  { name: 'Riley', initial: 'R', color: 'var(--ev-sunset)', status: 'Maybe' },
  { name: 'Sam', initial: 'S', color: 'var(--ev-bubblegum)', status: 'Invited' },
];
const STATUS_CLASS: Record<string, string> = { Going: 's-yes', Maybe: 's-maybe', Invited: 's-wait' };

export default function Features() {
  const ref = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<EventThemeName>('violet');
  const [samStatus, setSamStatus] = useState('Invited');
  const [copied, setCopied] = useState(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref.current);
      const tiles = q<HTMLElement>('.tile');

      // Spotlight follows the pointer inside each tile
      const cleanups: (() => void)[] = [];
      tiles.forEach((tile) => {
        const move = (e: PointerEvent) => {
          const r = tile.getBoundingClientRect();
          tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
          tile.style.setProperty('--my', `${e.clientY - r.top}px`);
        };
        tile.addEventListener('pointermove', move);
        cleanups.push(() => tile.removeEventListener('pointermove', move));
      });

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Tiles deal in like cards
        gsap.from(tiles, {
          y: 90,
          rotate: () => gsap.utils.random(-6, 6),
          scale: 0.92,
          autoAlpha: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: { each: 0.08, from: 'start' },
          scrollTrigger: { trigger: q('.bento')[0], start: 'top 80%', once: true },
        });

        // Gentle 3D tilt on hover (mouse only)
        tiles.forEach((tile) => {
          const rx = gsap.quickTo(tile, 'rotationX', { duration: 0.6, ease: 'power3.out' });
          const ry = gsap.quickTo(tile, 'rotationY', { duration: 0.6, ease: 'power3.out' });
          gsap.set(tile, { transformPerspective: 900 });
          const move = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            const r = tile.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 8);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
          };
          const leave = () => {
            rx(0);
            ry(0);
          };
          tile.addEventListener('pointermove', move);
          tile.addEventListener('pointerleave', leave);
          cleanups.push(() => {
            tile.removeEventListener('pointermove', move);
            tile.removeEventListener('pointerleave', leave);
          });
        });

        // Guest list: rows slide in, then Sam finally says yes
        gsap
          .timeline({ scrollTrigger: { trigger: q('.t-guests')[0], start: 'top 70%', once: true } })
          .from(q('.guest-rows li'), { x: -40, autoAlpha: 0, duration: 0.7, ease: 'expo.out', stagger: 0.1 }, 0.3)
          .call(() => setSamStatus('Going'), [], 1.8)
          .fromTo(q('.guest-rows li:last-child .status'), { scale: 1.6 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' }, 1.8);

        // Chat: messages arrive on a loop
        gsap
          .timeline({ repeat: -1, repeatDelay: 1.5, scrollTrigger: { trigger: q('.t-chat')[0], start: 'top 85%', toggleActions: 'play pause resume pause' } })
          .from(q('.chat .bubble'), {
            y: 20,
            scale: 0.6,
            autoAlpha: 0,
            transformOrigin: (i: number) => (i === 1 ? '100% 100%' : '0% 100%'),
            duration: 0.5,
            ease: 'back.out(2)',
            stagger: 0.7,
          })
          .to(q('.chat .bubble'), { autoAlpha: 0, y: -10, duration: 0.4, stagger: 0.05 }, '+=2.2');

        // Activity: notifications drop in from the top
        gsap
          .timeline({ repeat: -1, repeatDelay: 1, scrollTrigger: { trigger: q('.t-activity')[0], start: 'top 85%', toggleActions: 'play pause resume pause' } })
          .from(q('.notif'), { y: -30, autoAlpha: 0, scale: 0.9, duration: 0.6, ease: 'back.out(1.8)', stagger: 0.8 })
          .to(q('.notif'), { autoAlpha: 0, x: 30, duration: 0.4, stagger: 0.06 }, '+=2.4');
      });

      return () => cleanups.forEach((c) => c());
    },
    { scope: ref }
  );

  const { contextSafe } = useGSAP({ scope: ref });

  const pickTheme = contextSafe((name: EventThemeName) => {
    setTheme(name);
    gsap.fromTo(
      ref.current!.querySelector('.mini-initial'),
      { scale: 0.4, rotate: -40 },
      { scale: 1, rotate: -8, duration: 0.9, ease: 'elastic.out(1, 0.4)' }
    );
  });

  const copyDemo = contextSafe(() => {
    // Demo only: nothing goes to the clipboard, because this link isn't real
    setCopied(true);
    toast('In the app, that’s your real invite link.');
    gsap.fromTo(ref.current!.querySelector('.link-pill b'), { scale: 1.3 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    window.setTimeout(() => setCopied(false), 2000);
  });

  const guests = GUESTS.map((g) => (g.name === 'Sam' ? { ...g, status: samStatus } : g));

  return (
    <section className="features" id="features" ref={ref}>
      <div className="wrap">
        <p className="label">Everything else</p>
        <h2 className="section-title" data-split>
          The one place for the event.
        </h2>

        <div className="bento">
          <article className="tile card t-guests">
            <h3>Guest list that&apos;s actually true</h3>
            <p>See who&apos;s going, who&apos;s a maybe and who still hasn&apos;t answered.</p>
            <ul className="guest-rows" aria-hidden="true">
              {guests.map((g) => (
                <li key={g.name}>
                  <span className="mini-av" style={vars({ '--c': g.color })}>
                    {g.initial}
                  </span>
                  {g.name}
                  <span className={`status ${STATUS_CLASS[g.status]}`}>{g.status}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="tile card t-chat">
            <h3>Group chat, built in</h3>
            <p>Only for people who are coming.</p>
            <div className="chat" aria-hidden="true">
              <div className="bubble them">who&apos;s bringing ice?</div>
              <div className="bubble me">on it</div>
              <div className="bubble them">legend</div>
              <div className="bubble typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </article>

          <article className="tile card t-themes">
            <h3>Make it yours</h3>
            <p>Six bold event themes color the cover, stickers and invite.</p>
            <div className="theme-demo">
              <div className="mini-cover" style={themeVars(theme)} aria-hidden="true">
                <span className="ev-shape s1" />
                <span className="ev-shape s2" />
                <span className="mini-initial">B</span>
              </div>
              <div className="swatches" role="radiogroup" aria-label="Event theme">
                {THEME_ORDER.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={theme === name}
                    aria-label={EVENT_THEMES[name].label}
                    style={vars({ '--c': EVENT_THEMES[name].base })}
                    onClick={() => pickTheme(name)}
                  />
                ))}
              </div>
            </div>
          </article>

          <article className="tile card t-invite">
            <h3>One link invites everyone</h3>
            <p>Share it anywhere. Friends open it on the web, no app needed to say yes.</p>
            <button className={`link-pill${copied ? ' is-copied' : ''}`} type="button" onClick={copyDemo}>
              <span>…/invite/rooftop-night</span>
              <b>{copied ? 'Copied' : 'Copy'}</b>
            </button>
          </article>

          <article className="tile card t-activity">
            <h3>Nudges that land</h3>
            <p>Reminders before the cutoff, so nobody forgets to decide.</p>
            <div className="notifs" aria-hidden="true">
              <div className="notif">
                <span className="dot" style={vars({ '--c': 'var(--primary)' })} />
                <span>
                  <b>Rooftop Night</b> cutoff is tomorrow. Still a maybe?
                </span>
              </div>
              <div className="notif">
                <span className="dot" style={vars({ '--c': 'var(--success)' })} />
                <span>
                  <b>Jo</b> is going to Rooftop Night
                </span>
              </div>
              <div className="notif">
                <span className="dot" style={vars({ '--c': 'var(--secondary)' })} />
                <span>
                  <b>Hannah</b> posted in the chat
                </span>
              </div>
            </div>
          </article>

          <article className="tile card t-dark">
            <h3>Soft pop by day. After dark by night.</h3>
            <p>Two looks, one app. Try the switch up top.</p>
            <div className="mode-chips" aria-hidden="true">
              <span className="mode light">Soft pop</span>
              <span className="mode dark">After dark</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
