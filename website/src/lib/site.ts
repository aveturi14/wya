/**
 * Site settings. While wya is in private development, every call to action
 * points at the waitlist instead of the app.
 */
export const site = {
  // Where this marketing site lives; used for link-preview image URLs. Set at deploy.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3100',
  waitlistUrl: 'https://forms.gle/bUMfsBAf9rENZVwA8',
} as const;
