// Adds link-preview (Open Graph / Twitter) and theme tags to the exported web app.
// The `single` web build ignores app/+html.tsx, and previews in iMessage, WhatsApp
// or Slack are built from raw HTML without running JavaScript, so the tags have to
// be in dist/index.html itself. Runs after `expo export` in `npm run deploy:web`.
import { readFileSync, writeFileSync } from 'node:fs';

const SITE = process.env.EXPO_PUBLIC_WEB_URL || 'https://wya.expo.app';
const TITLE = "You're invited · wya";
const DESCRIPTION = "RSVP in seconds, see who's going, and join the chat. Plans that actually happen.";
const FILE = 'dist/index.html';

const tags = `
    <meta name="description" content="${DESCRIPTION}" />
    <meta name="theme-color" content="#FAFAFA" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0B0B0D" media="(prefers-color-scheme: dark)" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="wya" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <meta name="twitter:image" content="${SITE}/og.png" />
    <link rel="apple-touch-icon" href="${SITE}/apple-touch-icon.png" />
    <style>body{background-color:#FAFAFA}@media (prefers-color-scheme: dark){body{background-color:#0B0B0D}}</style>
`;

let html = readFileSync(FILE, 'utf8');
if (html.includes('og:title')) {
  console.log('inject-web-meta: tags already present');
} else {
  html = html
    .replace('<title>wya</title>', '<title>wya · plans that actually happen</title>')
    .replace('</head>', `${tags}  </head>`);
  writeFileSync(FILE, html);
  console.log('inject-web-meta: added preview tags to', FILE);
}
