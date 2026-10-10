'use client';

import Lenis from 'lenis';
import { useEffect, useRef, useState } from 'react';
import { gsap, MOTION_OK, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap';

/**
 * Page-wide effects that don't belong to one section: smooth scrolling, the
 * scroll progress bar, the cursor ring, magnetic buttons, heading reveals,
 * confetti and toasts.
 */
export default function Chrome() {
  const progressRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);

  // Smooth scroll, kept in sync with ScrollTrigger. Skipped for reduced motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: false, lerp: 0.11, anchors: { offset: -72 } });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  useGSAP(() => {
    // Progress bar
    gsap.to(progressRef.current, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
    });

    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      // Section headings: lines rise out of a mask, word by word
      document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
        SplitText.create(el, {
          type: 'lines,words',
          mask: 'lines',
          linesClass: 'split-line',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.words, {
              yPercent: 110,
              rotate: 6,
              duration: 0.9,
              ease: 'expo.out',
              stagger: 0.05,
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            }),
        });
      });

      // Generic reveal: fade and lift, staggered within each group
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%',
        once: true,
        onEnter: (els) =>
          gsap.from(els, { y: 50, autoAlpha: 0, rotate: 1.5, duration: 0.9, ease: 'expo.out', stagger: 0.08 }),
      });

      // Magnetic buttons
      const cleanups: (() => void)[] = [];
      document.querySelectorAll<HTMLElement>('.magnetic').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
        const move = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.3);
          yTo((e.clientY - r.top - r.height / 2) * 0.4);
        };
        const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        cleanups.push(() => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerleave', leave);
        });
      });

      // Cursor ring that trails the pointer and swells over anything clickable
      const cursor = cursorRef.current;
      const ring = cursor?.querySelector<HTMLElement>('.cursor-ring');
      if (cursor && ring && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
        const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
        const move = (e: PointerEvent) => {
          cursor.classList.add('is-ready');
          rx(e.clientX);
          ry(e.clientY);
        };
        const over = (e: Event) => {
          const t = e.target as Element | null;
          cursor.classList.toggle('is-hover', !!t?.closest('a, button, [data-cursor]'));
        };
        const out = () => cursor.classList.remove('is-ready');
        window.addEventListener('pointermove', move);
        document.addEventListener('pointerover', over);
        document.documentElement.addEventListener('pointerleave', out);
        cleanups.push(() => {
          window.removeEventListener('pointermove', move);
          document.removeEventListener('pointerover', over);
          document.documentElement.removeEventListener('pointerleave', out);
        });
      }

      return () => cleanups.forEach((c) => c());
    });

    // Fonts change line breaks and heights; re-measure once they're in
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  });

  // Toasts
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      setToastMsg((e as CustomEvent<string>).detail);
      setToastOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setToastOn(false), 3200);
    };
    window.addEventListener('wya:toast', onToast);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('wya:toast', onToast);
    };
  }, []);

  // Confetti: a small canvas particle system in the theme's colors
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; round: boolean; life: number };
    let parts: P[] = [];
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts = parts.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        p.life -= 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Flip the height to fake a tumbling ribbon
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2));
        }
        ctx.restore();
      }
      frame = parts.length ? requestAnimationFrame(tick) : 0;
    };

    const onBurst = (e: Event) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const { x, y, amount } = (e as CustomEvent<{ x: number; y: number; amount: number }>).detail;
      const css = getComputedStyle(document.documentElement);
      const colors = ['--primary', '--secondary', '--highlight', '--success', '--ev-ocean', '--ev-bubblegum'].map((v) =>
        css.getPropertyValue(v).trim()
      );
      for (let i = 0; i < amount; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
        const speed = 7 + Math.random() * 11;
        parts.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          w: 7 + Math.random() * 7,
          h: 10 + Math.random() * 8,
          c: colors[i % colors.length],
          round: Math.random() < 0.3,
          life: 110 + Math.random() * 60,
        });
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener('wya:confetti', onBurst);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('wya:confetti', onBurst);
    };
  }, []);

  return (
    <>
      <div className="progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>
      <div className="cursor" ref={cursorRef} aria-hidden="true">
        <span className="cursor-ring" />
      </div>
      <canvas className="confetti" ref={canvasRef} aria-hidden="true" />
      <div className={`toast${toastOn ? ' is-on' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );
}
