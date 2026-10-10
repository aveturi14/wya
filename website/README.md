# wya website

The marketing site for wya. It explains the idea (RSVPs backed by a small deposit), walks through how it works, and collects sign-ups for the waitlist.

It is **completely separate from the app**: its own `package.json`, no imports from the app, no Supabase client, no keys. It only borrows the app's look: the Soft pop / After dark palettes, Bricolage Grotesque + DM Sans, and the event themes. Those are copied into `src/app/globals.css` and `src/lib/fx.ts`. If the app's `constants/theme.ts` or `constants/eventThemes.ts` change, update them here too.

## Stack

- **Next.js 16** (App Router, TypeScript), built as a **static export** (`output: 'export'`). The build is plain HTML/CSS/JS in `out/`: no server, no API routes, nothing secret to leak.
- **GSAP 3** (ScrollTrigger, SplitText) via `@gsap/react`, plus **Lenis** for smooth scrolling.
- Fonts are self-hosted from `@fontsource-variable/*` through `next/font/local`, so visitors never request anything from Google.
- Every animation sits behind `prefers-reduced-motion: no-preference`. With reduced motion on, each section renders in its final state.

## Commands

```bash
cd website
npm install
npm run dev        # http://localhost:3100
npm run build      # static site in out/
npm run start      # serve out/ locally
npm run typecheck
```

## Waitlist

wya is still in private testing, so every call to action (nav, hero, closing section, footer) opens the waitlist Google Form in a new tab. The link lives in one place: `waitlistUrl` in `src/lib/site.ts`, used through `src/components/WaitlistButton.tsx`. When the app launches, swap those buttons for store links (with Apple's and Google's official badge artwork).

Set `NEXT_PUBLIC_SITE_URL` at build time to the site's real domain so link previews resolve `og.png` correctly.

## Visitor analytics (Vercel)

`src/app/layout.tsx` renders `<Analytics />` from `@vercel/analytics`, which counts visitors and page views without cookies. It only reports from a Vercel deployment; local dev and other hosts send nothing.

To see the numbers:

1. In Vercel, import this repo as a project and set **Root Directory** to `website` (the app lives at the repo root, so this matters). Vercel detects Next.js and the static export on its own.
2. Open the project → **Analytics** tab → **Enable**.
3. Deploy. Visitors show up in the Analytics tab within a few minutes of the first visit.

## Hosting

`out/` can go on any static host (EAS Hosting, Vercel, Netlify, Cloudflare Pages, GitHub Pages). Recommended response headers to set on the host, since a static export can't set them itself:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

(`'unsafe-inline'` for scripts covers the small theme script in `layout.tsx` and Next's inline bootstrap.)

## Code map

```
src/app/layout.tsx       fonts, metadata, pre-paint theme script
src/app/page.tsx         section order
src/app/globals.css      design tokens (light + dark) and all styles
src/components/
  Nav.tsx                sticky nav, active section, theme toggle (circular view transition)
  Hero.tsx               split-text intro, 3D-tilt phone mockup, "I'm in" + confetti
  Marquee.tsx            crossing ticker bands, speed follows scroll velocity
  Problem.tsx            pinned scroll story: invited 30, cooked for 30, 10 came
  HowItWorks.tsx         four steps, sideways scroll on wide screens
  DepositSim.tsx         "I showed up / I flaked" toggle, the $10 coin follows the money
  Features.tsx           bento grid with live mini-demos
  ThemeFan.tsx           event-theme cards fan out on scroll
  Faq.tsx                accessible accordion
  Cta.tsx                closing question and the waitlist button
  WaitlistButton.tsx     the shared "Join the waitlist" link
  Chrome.tsx             smooth scroll, progress bar, cursor ring, magnetic buttons,
                         heading reveals, confetti canvas, toasts
src/lib/                 gsap setup, site config, effect helpers
```
