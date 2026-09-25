/**
 * Shared Tailwind class strings, so pages and tools look alike without repeating long lists.
 * Import what you need: `import { ui } from '../components/ui/styles';` then `class={ui.buttonPrimary}`.
 *
 * Conventions (see also the tokens in src/styles/global.css):
 * - Touch targets are at least 44×44 px (min-h-11 / size-11); primary page actions use min-h-12.
 * - Accent text: text-accent-700 on light, dark:text-accent-400 on dark backgrounds.
 * - Headings: serif (font-serif, weight 500) for page and section titles; sans for UI.
 */
export const ui = {
  /** Underlined link inside running text. */
  inlineLink:
    'font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-accent-700 hover:decoration-accent-600 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:text-accent-400 dark:hover:decoration-accent-500',
  /** Accent-coloured text link ("All projects →"). */
  accentLink:
    '-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent-700 underline-offset-4 hover:text-accent-800 hover:underline dark:text-accent-400 dark:hover:text-accent-300',
  /** "← All posts" style navigation link. */
  backLink:
    '-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 transition-colors hover:text-accent-700 dark:text-zinc-400 dark:hover:text-accent-400',

  buttonPrimary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-500 dark:text-zinc-950 dark:hover:bg-accent-400',
  buttonSecondary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
  buttonGhost:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  /** Square icon-only button; always give it an aria-label or sr-only text. */
  iconButton:
    'inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',

  card: 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
  /** Card that is (or contains) a stretched link. */
  cardInteractive:
    'rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600',
  /** Text inputs, selects and textareas. 16px on touch screens so iOS does not zoom in. */
  field:
    'min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-500 sm:pointer-fine:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500',

  /** Small uppercase mono label above a title. */
  eyebrow: 'label-mono text-accent-700 dark:text-accent-400',
  /** Page title (h1). */
  pageTitle: 'font-serif text-4xl font-medium tracking-tight text-balance sm:text-5xl',
  /** Intro paragraph under a page title. */
  lead: 'text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400',
  /** Muted small text. */
  muted: 'text-sm text-zinc-600 dark:text-zinc-400',
  kbd: 'rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 font-mono text-xs whitespace-nowrap text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100',
  code: 'rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.8125rem] break-words text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
} as const;
