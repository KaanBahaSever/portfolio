/**
 * Site-wide settings: identity, contact links and navigation.
 * Résumé details (experience, education, skills…) live in src/data/resume.ts.
 */
export const SITE = {
  name: 'Kaan Baha Sever',
  role: 'Software Developer · Mathematics Student',
  description:
    'Portfolio of Kaan Baha Sever, a software developer and mathematics student in Istanbul: projects, writing and privacy-friendly browser tools.',
  // Keep in sync with `site` in astro.config.mjs.
  url: 'https://kaanbahasever.com',
  email: 'kaanbahasever@gmail.com',
  location: 'Istanbul, Turkey',
  // Served from public/cv/kaan-cv.pdf — replace that file to update the CV.
  cvPath: '/cv/kaan-cv.pdf',
  socials: [
    { label: 'GitHub', href: 'https://github.com/KaanBahaSever' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/kaan-baha-sever/' },
    { label: 'Medium', href: 'https://medium.com/@KaanBahaSever' },
  ],
  // /console/ is intentionally not listed: it is a hidden, noindex route.
  nav: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Projects', href: '/projects/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Tools', href: '/tools/' },
  ],
} as const;
