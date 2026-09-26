/**
 * Theme controller: keeps <html data-theme> right after the first paint and switches it.
 *
 * The inline script at the top of BaseLayout's <head> sets the theme before the first paint
 * (stored choice, else the operating system). From then on this module owns it:
 * - initTheme() (every page, from BaseLayout) follows the operating system live while no choice
 *   is stored, applies a choice made in another tab (storage event) and re-syncs a page restored
 *   from the back/forward cache;
 * - initThemeToggle() wires the header button: a toggle named "Dark theme" whose aria-pressed
 *   state is the active theme, with a tooltip saying what a press does.
 *
 * Every change updates data-theme, the root's color-scheme and the theme-color metas, then
 * dispatches THEME_CHANGE_EVENT on document for scripts that read colours at runtime.
 */
import { getPageLocale } from '../i18n/client.ts';
import { common } from '../i18n/messages/common.ts';
import { localStore } from '../lib/storage.ts';
import {
  SYSTEM_DARK_QUERY,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  oppositeTheme,
  parseTheme,
  resolveTheme,
  type Theme,
  type ThemeChangeDetail,
} from '../lib/theme.ts';

/** On <html> for the frame in which the colours change: global.css turns transitions off under it. */
const SWITCHING_CLASS = 'theme-switching';

const root = document.documentElement;
const systemDark = window.matchMedia(SYSTEM_DARK_QUERY);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * The explicit choice in force on this page. Starts from storage and is updated by the toggle,
 * so a choice still holds for this page when storage is blocked and could not keep it.
 */
let choice: Theme | null = readStoredTheme();

/**
 * The theme on screen, or on its way there while a cross-fade has not yet run its update. Set by
 * the pre-paint script; null only if that script failed.
 */
let shown: Theme | null = parseTheme(root.dataset.theme);

function readStoredTheme(): Theme | null {
  return parseTheme(localStore.get(THEME_STORAGE_KEY));
}

export function currentTheme(): Theme {
  return shown ?? resolveTheme(choice, systemDark.matches);
}

function commit(theme: Theme): void {
  // Without this every element with a colour transition (links, buttons, cards) would fade at
  // its own speed. The class stays for one rendered frame, then transitions work again.
  root.classList.add(SWITCHING_CLASS);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  // Both media-specific metas get the active colour, so whichever one the browser picks is right
  // (without JavaScript they keep their own colours and follow the operating system).
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][media]').forEach((meta) => {
    meta.content = THEME_COLORS[theme];
  });
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove(SWITCHING_CLASS)));
  document.dispatchEvent(new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, { detail: { theme } }));
}

/**
 * Shows `theme` if it is not already on screen. `animate`: cross-fade the whole page with the
 * View Transitions API where it exists and the visitor has not asked for reduced motion; changes
 * the visitor did not make on this page (the OS, another tab) switch instantly.
 */
function apply(theme: Theme, { animate = false } = {}): void {
  if (shown === theme) return;
  // Recorded now, not in commit(): a second press during the cross-fade toggles from here.
  shown = theme;
  if (animate && !reducedMotion.matches && typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => commit(theme));
  } else {
    commit(theme);
  }
}

/** Stores an explicit choice and shows it. */
export function setTheme(theme: Theme): void {
  choice = theme;
  // A failed write (storage blocked or full) still switches this page; `choice` keeps it here.
  localStore.set(THEME_STORAGE_KEY, theme);
  apply(theme, { animate: true });
}

let initialised = false;

/** Global listeners; call once per page (BaseLayout does). */
export function initTheme(): void {
  if (initialised) return;
  initialised = true;

  // The pre-paint script normally did this already; it is a no-op then.
  apply(resolveTheme(choice, systemDark.matches));

  // Follow the operating system while no choice is stored (e.g. an automatic dark mode at night).
  systemDark.addEventListener('change', () => {
    if (choice === null) apply(resolveTheme(null, systemDark.matches));
  });

  // A choice made (or storage cleared) in another tab of this site applies here too.
  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    choice = readStoredTheme();
    apply(resolveTheme(choice, systemDark.matches));
  });

  // A page restored from the back/forward cache missed changes made while it was hidden.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    choice = readStoredTheme();
    apply(resolveTheme(choice, systemDark.matches));
  });
}

/**
 * The header's theme button: a toggle button (aria-pressed = dark theme on) with a fixed
 * accessible name, as the ARIA pattern requires; the tooltip says what a press does.
 */
export function initThemeToggle(button: HTMLButtonElement): void {
  const m = common[getPageLocale()].theme;

  function render(theme: Theme): void {
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.title = theme === 'dark' ? m.toLight : m.toDark;
  }

  render(currentTheme());
  button.addEventListener('click', () => setTheme(oppositeTheme(currentTheme())));
  document.addEventListener(THEME_CHANGE_EVENT, (event) => {
    render((event as CustomEvent<ThemeChangeDetail>).detail.theme);
  });
}
