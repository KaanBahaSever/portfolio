/**
 * Weight-loss calculator: DOM wiring (browser only). Everything is computed on the device and
 * nothing is sent anywhere; the form's values are kept in this browser's localStorage (saved.ts)
 * so they are still there on the next visit, and Reset forgets them.
 *
 * Validation follows "reward early, punish late", as in the distance calculator: a field's error
 * appears when you leave the field or press Enter, and disappears as soon as the value is valid.
 * While a value is half-typed the last plan stays on screen, greyed, until the form is valid.
 *
 * Unless the visitor types their own, the intake follows maintenance minus 500 kcal, so changing
 * weight or activity keeps the suggestion sensible.
 */
import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { weightLossMessages } from '../../../i18n/tools/weight-loss.ts';
import { saveBlob } from '../../../lib/download.ts';
import {
  ACTIVITY_FACTORS,
  DEFAULTS,
  bmrAt,
  bmrLine,
  buildPlan,
  defaultIntake,
  isActivityLevel,
  isBmrFormula,
  isGranularity,
  localIsoDate,
  tableDays,
  validateInput,
  type FieldError,
  type FieldName,
  type Granularity,
  type Plan,
  type RawInput,
} from '../../../lib/health/weight-plan.ts';
import { localStore } from '../../../lib/storage.ts';
import { createChartView } from './chart-view.ts';
import { planCsv, presenter, type Card } from './present.ts';
import { STORAGE_KEY, parseSavedForm, serializeForm } from './saved.ts';

const FIELD_NAMES: readonly FieldName[] = ['age', 'height', 'weight', 'target', 'bodyFat', 'intake', 'deficit', 'start'];
/** Results are read out once typing pauses, not on every keystroke. */
const ANNOUNCE_DELAY_MS = 900;
const SAVE_DELAY_MS = 400;

interface Field {
  name: FieldName;
  input: HTMLInputElement;
  error: HTMLElement;
  /** Set when the value is committed (leaving the field, Enter); cleared once it is valid. */
  showError: boolean;
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Weight loss: missing element ${selector}`);
  return element;
}

const CELL = 'px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums first:text-left first:font-sans';
const ROW = 'border-t border-zinc-100 first:border-t-0 dark:border-zinc-800/70';
const TARGET_ROW = 'bg-accent-50 font-semibold text-zinc-900 dark:bg-accent-500/10 dark:text-zinc-50';

export function initWeightLoss(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = weightLossMessages[locale];
  const f = formatters(locale);
  const present = presenter(locale);

  const fields = Object.fromEntries(
    FIELD_NAMES.map((name) => [
      name,
      {
        name,
        input: query<HTMLInputElement>(root, `[data-field="${name}"]`),
        error: query<HTMLElement>(root, `[data-error-for="${name}"]`),
        showError: false,
      } satisfies Field,
    ]),
  ) as Record<FieldName, Field>;

  const el = {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    form: query<HTMLFormElement>(root, '[data-form]'),
    reset: query<HTMLButtonElement>(root, '[data-reset]'),
    sex: Array.from(root.querySelectorAll<HTMLInputElement>('[data-sex]')),
    mode: Array.from(root.querySelectorAll<HTMLInputElement>('[data-mode]')),
    modeFields: Array.from(root.querySelectorAll<HTMLElement>('[data-mode-field]')),
    activity: query<HTMLSelectElement>(root, '[data-activity]'),
    activityDetail: query<HTMLElement>(root, '[data-activity-detail]'),
    formula: query<HTMLSelectElement>(root, '[data-formula]'),
    formulaDetail: query<HTMLElement>(root, '[data-formula-detail]'),
    intakeHint: query<HTMLElement>(root, '[data-intake-hint]'),
    intakeAuto: query<HTMLElement>(root, '[data-intake-auto]'),
    deficitHint: query<HTMLElement>(root, '[data-deficit-hint]'),
    result: query<HTMLElement>(root, '[data-result]'),
    status: query<HTMLElement>(root, '[data-status]'),
    headline: query<HTMLElement>(root, '[data-headline]'),
    date: query<HTMLElement>(root, '[data-date]'),
    duration: query<HTMLElement>(root, '[data-duration]'),
    message: query<HTMLElement>(root, '[data-message]'),
    cards: query<HTMLElement>(root, '[data-cards]'),
    warningsBox: query<HTMLElement>(root, '[data-warnings-box]'),
    warnings: query<HTMLElement>(root, '[data-warnings]'),
    figure: query<HTMLElement>(root, '[data-chart]'),
    chartSvg: query<SVGSVGElement>(root, '[data-chart-svg]'),
    legendLinear: query<HTMLElement>(root, '[data-legend="linear"]'),
    legendLevel: query<HTMLElement>(root, '[data-legend="level"]'),
    granularity: Array.from(root.querySelectorAll<HTMLInputElement>('[data-granularity]')),
    tableScroll: query<HTMLElement>(root, '[data-table-scroll]'),
    tableBody: query<HTMLElement>(root, '[data-table-body]'),
    caption: query<HTMLElement>(root, '[data-caption]'),
    download: query<HTMLButtonElement>(root, '[data-download]'),
  };
  const katchOption = query<HTMLOptionElement>(el.formula, 'option[value="katch"]');
  const chart = createChartView(
    query<HTMLElement>(root, '[data-chart-host]'),
    el.chartSvg,
    query<HTMLElement>(root, '[data-readout]'),
    present,
    locale,
    m.chart.readoutIdle,
  );

  let intakeEdited = false;
  let plan: Plan | null = null;
  let announceTimer = 0;
  let pendingTimer = 0;
  let saveTimer = 0;
  /** What the live region last said about the plan, so an unchanged plan is not repeated. */
  let lastAnnouncement = '';

  // ---------------------------------------------------------------- form state

  const checked = (inputs: HTMLInputElement[]) => inputs.find((input) => input.checked)?.value ?? '';
  const check = (inputs: HTMLInputElement[], value: string) => {
    for (const input of inputs) input.checked = input.value === value;
  };

  function granularity(): Granularity {
    const value = checked(el.granularity);
    return isGranularity(value) ? value : 'weekly';
  }

  function readRaw(): RawInput {
    return {
      sex: checked(el.sex),
      age: fields.age.input.value,
      height: fields.height.input.value,
      weight: fields.weight.input.value,
      target: fields.target.input.value,
      bodyFat: fields.bodyFat.input.value,
      activity: el.activity.value,
      formula: el.formula.value,
      mode: checked(el.mode),
      intake: fields.intake.input.value,
      deficit: fields.deficit.input.value,
      start: fields.start.input.value,
    };
  }

  function writeRaw(raw: RawInput): void {
    check(el.sex, raw.sex);
    check(el.mode, raw.mode);
    for (const name of FIELD_NAMES) fields[name].input.value = raw[name];
    if (isActivityLevel(raw.activity)) el.activity.value = raw.activity;
    if (isBmrFormula(raw.formula)) el.formula.value = raw.formula;
  }

  function defaultRaw(): RawInput {
    const number = (value: number) => f.number(value, { maximumFractionDigits: 1, useGrouping: false });
    return {
      sex: DEFAULTS.sex,
      age: number(DEFAULTS.age),
      height: number(DEFAULTS.heightCm),
      weight: number(DEFAULTS.weightKg),
      target: number(DEFAULTS.targetKg),
      bodyFat: '',
      activity: DEFAULTS.activity,
      formula: DEFAULTS.formula,
      mode: DEFAULTS.mode,
      intake: '',
      deficit: String(DEFAULTS.deficitKcal),
      start: localIsoDate(new Date()),
    };
  }

  function save(): void {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      localStore.set(STORAGE_KEY, serializeForm({ raw: readRaw(), intakeEdited, granularity: granularity() }));
    }, SAVE_DELAY_MS);
  }

  /** Katch–McArdle needs the body fat: its option is available only when the field has a value. */
  function syncFormula(): void {
    const hasBodyFat = fields.bodyFat.input.value.trim() !== '';
    katchOption.disabled = !hasBodyFat;
    const label = m.form.formulas.katch.label;
    katchOption.textContent = hasBodyFat ? label : `${label} (${m.form.needsBodyFat})`;
    if (!hasBodyFat && el.formula.value === 'katch') el.formula.value = DEFAULTS.formula;
    const formula = isBmrFormula(el.formula.value) ? el.formula.value : DEFAULTS.formula;
    el.formulaDetail.textContent = m.form.formulas[formula].detail;
    const activity = isActivityLevel(el.activity.value) ? el.activity.value : DEFAULTS.activity;
    el.activityDetail.textContent = m.form.activities[activity].detail;
  }

  function syncMode(mode: string): void {
    for (const block of el.modeFields) block.hidden = block.dataset.modeField !== mode;
    el.intakeAuto.hidden = intakeEdited;
  }

  /** Until the visitor types an intake, it is maintenance − 500 kcal for the current details. */
  function suggestIntake(raw: RawInput): void {
    if (intakeEdited || raw.mode !== 'intake') return;
    // Any valid intake will do: only the person's details matter here.
    const probe = validateInput({ ...raw, intake: '2000' });
    if (!probe.ok) return;
    const { input } = probe;
    const maintenance = bmrAt(bmrLine(input.formula, input), input.weightKg) * ACTIVITY_FACTORS[input.activity];
    const value = String(defaultIntake(maintenance));
    fields.intake.input.value = value;
    raw.intake = value;
  }

  // ---------------------------------------------------------------- rendering

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function errorMessage(name: FieldName, code: FieldError): string {
    const messages: Partial<Record<FieldError, string>> = m.errors.fields[name];
    return messages[code] ?? m.errors.number;
  }

  /** Shows or clears each field's error. Returns whether any error is on show. */
  function renderErrors(errors: Partial<Record<FieldName, FieldError>>): boolean {
    let shown = false;
    for (const field of Object.values(fields)) {
      const code = errors[field.name];
      if (!code) field.showError = false;
      const message = code && field.showError ? errorMessage(field.name, code) : '';
      field.error.textContent = message;
      field.error.hidden = message === '';
      if (message) {
        field.input.setAttribute('aria-invalid', 'true');
        shown = true;
      } else field.input.removeAttribute('aria-invalid');
    }
    return shown;
  }

  function cardNode(card: Card): HTMLElement {
    const box = document.createElement('div');
    box.className = 'min-w-0';
    const term = document.createElement('dt');
    term.className = 'label-mono text-zinc-600 dark:text-zinc-400';
    term.textContent = card.label;
    const detail = document.createElement('dd');
    detail.className = 'mt-1';
    const value = document.createElement('span');
    value.className =
      'block font-mono text-base text-zinc-900 tabular-nums transition-colors duration-200 group-data-[state=stale]/result:text-zinc-500 dark:text-zinc-100 dark:group-data-[state=stale]/result:text-zinc-400';
    value.textContent = card.value;
    const note = document.createElement('span');
    note.className = 'block text-sm text-zinc-600 dark:text-zinc-400';
    note.textContent = card.note;
    detail.append(value, note);
    box.append(term, detail);
    return box;
  }

  function renderSummary(current: Plan): string {
    const view = present.summary(current);
    el.result.dataset.state = 'ready';
    el.status.hidden = true;
    // "Target date" above the date; when the target is not reached, what happens instead, large.
    el.headline.textContent = view.headline;
    el.headline.hidden = view.date === '';
    el.date.textContent = view.date || view.headline;
    el.duration.textContent = view.duration;
    el.duration.hidden = view.duration === '';
    el.message.textContent = view.message;
    el.message.hidden = view.message === '';
    el.cards.replaceChildren(...view.cards.map(cardNode));
    el.warnings.replaceChildren(
      ...view.warnings.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }),
    );
    el.warningsBox.hidden = view.warnings.length === 0;
    return view.announcement;
  }

  function renderHints(current: Plan): void {
    const first = current.days[0]!;
    el.intakeHint.textContent =
      first.deficit > 0
        ? m.form.intakeHint(present.kcal(first.maintenance), present.kcal(first.deficit))
        : m.form.intakeAtMaintenance(present.kcal(first.maintenance));
    el.deficitHint.textContent = m.form.deficitHint(present.kcal(first.intake));
  }

  function renderTable(): void {
    if (!plan) return;
    const current = plan;
    const days = current.outcome === 'noDeficit' ? [] : tableDays(current, granularity());
    const last = current.days[current.days.length - 1]!;
    const fragment = document.createDocumentFragment();
    for (const day of days) {
      const row = document.createElement('tr');
      const isTarget = current.outcome === 'reached' && day === last;
      row.className = isTarget ? `${ROW} ${TARGET_ROW}` : ROW;
      present.row(current, day).forEach((text, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) cell.setAttribute('scope', 'row');
        cell.className = index === 0 ? `${CELL} font-normal` : CELL;
        cell.textContent = text;
        if (index === 0 && isTarget) {
          const note = document.createElement('span');
          note.className = 'sr-only';
          note.textContent = ` (${m.table.targetRow})`;
          cell.append(note);
        }
        row.append(cell);
      });
      fragment.append(row);
    }
    el.tableBody.replaceChildren(fragment);
    el.caption.textContent = m.table.caption(f.number(days.length));
    el.download.disabled = current.outcome === 'noDeficit';
  }

  function renderChart(current: Plan): void {
    const empty = current.outcome === 'noDeficit';
    el.figure.hidden = empty;
    if (empty) return;
    el.chartSvg.setAttribute('aria-label', present.chartLabel(current));
    el.legendLinear.hidden = current.linearDays === null || current.input.mode !== 'intake';
    el.legendLevel.hidden = current.outcome !== 'equilibrium';
    chart.show(current);
    delete el.figure.dataset.stale;
  }

  function renderStale(errorShown: boolean): void {
    el.result.dataset.state = 'stale';
    el.status.textContent = m.result.invalid;
    el.status.hidden = !errorShown;
    el.figure.dataset.stale = '';
    el.tableScroll.dataset.stale = '';
    el.download.disabled = true;
  }

  // ---------------------------------------------------------------- update

  type Announce = 'none' | 'later' | 'now';

  function update(options: { announce: Announce; lead?: string }): void {
    syncFormula();
    const raw = readRaw();
    syncMode(raw.mode);
    suggestIntake(raw);

    const result = validateInput(raw);
    const errorShown = renderErrors(result.ok ? {} : result.errors);
    save();
    window.clearTimeout(pendingTimer);
    if (!result.ok) {
      renderStale(errorShown);
      lastAnnouncement = '';
      if (options.lead) announce(options.lead);
      return;
    }

    plan = buildPlan(result.input);
    const announcement = renderSummary(plan);
    renderHints(plan);
    renderChart(plan);
    renderTable();
    delete el.tableScroll.dataset.stale;

    const lead = options.lead ?? '';
    const say = () => {
      if (!lead && announcement === lastAnnouncement) return;
      lastAnnouncement = announcement;
      announce(lead ? `${lead} ${announcement}` : announcement);
    };
    if (options.announce === 'now') say();
    else if (options.announce === 'later') pendingTimer = window.setTimeout(say, ANNOUNCE_DELAY_MS);
    else lastAnnouncement = announcement;
  }

  function commit(field: Field): void {
    field.showError = true;
    const before = field.error.textContent ?? '';
    update({ announce: 'later' });
    // A newly shown error is also said, since focus may already be elsewhere.
    const after = field.error.textContent ?? '';
    if (after && after !== before) announce(after);
  }

  // ---------------------------------------------------------------- events

  for (const field of Object.values(fields)) {
    field.input.addEventListener('input', () => {
      if (field.name === 'intake') intakeEdited = true;
      update({ announce: 'later' });
    });
    field.input.addEventListener('change', () => commit(field));
    field.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        commit(field);
      }
    });
  }

  for (const input of [...el.sex, ...el.mode]) input.addEventListener('change', () => update({ announce: 'now' }));
  el.activity.addEventListener('change', () => update({ announce: 'now' }));
  el.formula.addEventListener('change', () => update({ announce: 'now' }));
  for (const input of el.granularity) {
    input.addEventListener('change', () => {
      renderTable();
      save();
    });
  }

  el.reset.addEventListener('click', () => {
    intakeEdited = false;
    writeRaw(defaultRaw());
    check(el.granularity, 'weekly');
    for (const field of Object.values(fields)) field.showError = false;
    update({ announce: 'now', lead: m.announce.reset });
    // Forget the saved values (after update(), which schedules a save of the defaults).
    window.clearTimeout(saveTimer);
    localStore.remove(STORAGE_KEY);
  });

  el.download.addEventListener('click', () => {
    if (!plan || plan.outcome === 'noDeficit') return;
    const blob = new Blob([planCsv(plan, locale)], { type: 'text/csv;charset=utf-8' });
    saveBlob(blob, m.table.fileName);
  });

  el.form.addEventListener('submit', (event) => event.preventDefault());

  // Browsers may restore field values on a history navigation after this script has run, or
  // when a page returns from the back/forward cache: recompute once the page is shown.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    window.setTimeout(() => update({ announce: 'none' }), 0);
  });

  // ---------------------------------------------------------------- start

  const saved = parseSavedForm(localStore.get(STORAGE_KEY));
  const start = saved ? { ...saved.raw } : defaultRaw();
  if (!start.start) start.start = localIsoDate(new Date());
  intakeEdited = saved?.intakeEdited ?? false;
  writeRaw(start);
  check(el.granularity, saved?.granularity ?? 'weekly');
  update({ announce: 'none' });
}
