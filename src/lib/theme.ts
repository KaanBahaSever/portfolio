/**
 * Light and dark themes: the rules shared by the pre-paint script in BaseLayout.astro, the
 * runtime controller (src/scripts/theme.ts) and the header's toggle.
 *
 * The active theme lives on the root element as <html data-theme="light|dark">. A visitor's
 * explicit choice is stored in localStorage; without one the site follows the operating system,
 * live. Without JavaScript the attribute is never set and the CSS falls back to
 * prefers-color-scheme (the `dark` variant in src/styles/global.css).
 *
 * Pure module: no DOM access, so `node --test` can load it.
 */

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** localStorage key holding the visitor's explicit choice ('light' or 'dark'); absent = follow the OS. */
export const THEME_STORAGE_KEY = 'theme';

/** Media query for the operating system's preference. */
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Event dispatched on `document` after the theme changed (detail: ThemeChangeDetail). Scripts
 * that read theme colours at runtime (canvas drawing, computed styles) re-read them on it.
 */
export const THEME_CHANGE_EVENT = 'themechange';

export interface ThemeChangeDetail {
  theme: Theme;
}

/**
 * Browser-chrome colour (<meta name="theme-color">) per theme: the page background, zinc-50 on
 * light and zinc-950 on dark (body in global.css).
 */
export const THEME_COLORS = { light: '#fafafa', dark: '#09090b' } as const satisfies Record<Theme, string>;

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

/** A stored value as a theme, or null when it is missing or not one we wrote. */
export function parseTheme(value: unknown): Theme | null {
  return isTheme(value) ? value : null;
}

/** The theme to show: the stored choice when there is a valid one, else the operating system's. */
export function resolveTheme(stored: unknown, systemPrefersDark: boolean): Theme {
  return parseTheme(stored) ?? (systemPrefersDark ? 'dark' : 'light');
}

/** What the header toggle switches to. */
export function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
