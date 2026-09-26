/**
 * Class strings of the collision figures' controls, in the spirit of src/components/ui/styles.ts
 * (kept here so the figures do not depend on another feature's styles). Pure constants.
 */
export const demoUi = {
  /** Fieldset legend and small headings. */
  legend: 'label-mono text-zinc-600 dark:text-zinc-400',
  /** A row of radio buttons styled as pills. */
  segmented:
    'grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900',
  /**
   * One segment: a label around a visually hidden radio. The checked segment is ink on paper (the
   * accent stays with the figure), and the focus ring moves to the label.
   */
  segment:
    'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md px-2.5 text-center text-sm font-medium text-zinc-700 transition-colors select-none hover:bg-zinc-100 has-checked:bg-zinc-900 has-checked:text-zinc-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:has-checked:bg-zinc-100 dark:has-checked:text-zinc-900 dark:has-focus-visible:outline-accent-400',
  /** Square icon button with a hairline border. */
  iconButton:
    'inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:translate-y-px dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  /** Small secondary text button. */
  button:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 active:translate-y-px dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
  hint: 'text-sm leading-relaxed text-zinc-600 dark:text-zinc-400',
  kbd: 'rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 font-mono text-xs whitespace-nowrap text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100',
} as const;
