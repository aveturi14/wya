/**
 * Site settings. Fill in the store links once the app is live. While a link
 * is empty, its button shows a "coming soon" message instead of navigating.
 */
export const site = {
  // Where this marketing site lives; used for link-preview image URLs. Set at deploy.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3100',
  appStoreUrl: '',
  playStoreUrl: '',
  webAppUrl: 'https://wya.expo.app',
} as const;
