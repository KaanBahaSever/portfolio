/**
 * Class strings shared by the game components (settings, panels, stat tables), in the same spirit
 * as src/components/ui/styles.ts. Pure constants.
 */
export const gameUi = {
  /** Fieldset legend and small panel headings. */
  legend: 'label-mono text-zinc-600 dark:text-zinc-400',
  /** Container of a segmented control (radio buttons styled as a row of pills). */
  segmented:
    'mt-2 grid gap-1 rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900',
  /**
   * One segment: a label wrapping a visually hidden radio. The checked segment is ink on paper
   * (the accent stays reserved for the primary action and the board), and the focus ring moves to
   * the label because the input itself is hidden.
   */
  segment:
    'flex min-h-11 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm font-medium text-zinc-700 transition-colors select-none hover:bg-zinc-100 has-checked:bg-zinc-900 has-checked:text-zinc-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-700 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:has-checked:bg-zinc-100 dark:has-checked:text-zinc-900 dark:has-focus-visible:outline-accent-400',
  /** A card-like panel. */
  panel: 'rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900',
  /** Muted helper text under a control. */
  hint: 'mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400',
  /** A switch-style checkbox row. */
  toggle:
    '-mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60',
  checkbox: 'size-5 shrink-0 cursor-pointer accent-accent-700 dark:accent-accent-500',
} as const;
