import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import localFont from 'next/font/local';
import { site } from '@/lib/site';
import './globals.css';

// The app's fonts, self-hosted from npm (@fontsource-variable, OFL) and served
// from this site: no request to Google, at build time or in the browser.
const bricolage = localFont({
  src: '../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-bricolage',
  display: 'swap',
});
const dmSans = localFont({
  src: '../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
  weight: '100 1000',
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: 'wya. Plans that actually happen.',
  description:
    "wya is the RSVP app where “I'm in” means something. Guests put down a small deposit when they say yes. Show up and you pay nothing.",
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    title: 'wya. Plans that actually happen.',
    description: "The RSVP app where “I'm in” means something.",
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF6EC' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0F' },
  ],
};

// Runs before first paint so the page never flashes the wrong palette.
// A fixed string we wrote; no user input goes into it.
const themeScript = `(function(){try{var s=localStorage.getItem('wya-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}document.documentElement.classList.add('js');})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        {/* Vercel Web Analytics: cookieless page-view counts, visible in the Vercel project.
            Only reports from Vercel deployments; does nothing locally or in dev. */}
        <Analytics />
      </body>
    </html>
  );
}
