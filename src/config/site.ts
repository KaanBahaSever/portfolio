/**
 * Site-wide settings. Everything marked TODO is a placeholder to replace
 * with your own details before deploying.
 */
export const SITE = {
  // TODO: replace with your real name.
  name: 'Your Name',
  // TODO: replace with your role / headline.
  role: 'Software Developer',
  // TODO: replace with a one-sentence description of you and this site.
  description:
    'Portfolio, blog and a small set of privacy-friendly tools that run entirely in your browser.',
  // TODO: replace with your production URL (also set `site` in astro.config.mjs).
  url: 'https://example.com',
  // TODO: replace with your contact email.
  email: 'you@example.com',
  // TODO: replace with your city / country or "Remote".
  location: 'City, Country',
  // Served from public/cv/kaan-cv.pdf — replace that file to update the CV.
  cvPath: '/cv/kaan-cv.pdf',
  socials: [
    // TODO: replace with your GitHub profile.
    { label: 'GitHub', href: 'https://github.com/your-username' },
    // TODO: replace with your LinkedIn profile.
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/your-username/' },
  ],
  nav: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Projects', href: '/projects/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Tools', href: '/tools/' },
    { label: 'Console', href: '/console/' },
  ],
} as const;
