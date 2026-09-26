/**
 * Great-circle distance calculator: DOM wiring (browser only).
 * Everything is computed on the device; nothing is stored or sent. Interface text comes from the
 * same catalogue and presenter the server-rendered component uses, in the page's language.
 *
 * Validation follows "reward early, punish late": a field's error appears when you leave the
 * field, press Enter or paste, and disappears as soon as the value is valid. While you type,
 * half-written values ("45.", "-") raise no error: the last result stays on screen, dimmed,
 * until all four values are valid again. Results update on every keystroke that makes them so.
 */
import { getPageLocale } from '../../../i18n/client.ts';
import { geoDistanceMessages } from '../../../i18n/tools/geo-distance.ts';
import { parseCoordinate, parsePair, type Axis, type ParseResult } from '../../../lib/geo/parse.ts';
import { CITIES, cityAt, isCityId } from '../../../lib/geo/presets.ts';
import { greatCircle, isDistanceUnit, type DistanceUnit, type LatLon } from '../../../lib/geo/sphere.ts';
import { vincentyInverse } from '../../../lib/geo/vincenty.ts';
import { createGlobeView } from './globe-view.ts';
import { presenter, type BearingView, type ResultView } from './present.ts';

type PointId = 'a' | 'b';
type FieldId = `${PointId}-${Axis}`;

const POINT_IDS: readonly PointId[] = ['a', 'b'];
const AXES: readonly Axis[] = ['lat', 'lon'];
/** Results are read out once typing pauses, not on every keystroke. */
const ANNOUNCE_DELAY_MS = 900;

interface Field {
  point: PointId;
  axis: Axis;
  input: HTMLInputElement;
  error: HTMLElement;
  /**
   * Whether the field's error is on show: set when the value is committed (leaving the field,
   * Enter, a paste), cleared as soon as the value is valid again.
   */
  showError: boolean;
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Geo distance: missing element ${selector}`);
  return element;
}

function fieldId(point: PointId, axis: Axis): FieldId {
  return `${point}-${axis}`;
}

export function initGeoDistance(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = geoDistanceMessages[locale];
  const present = presenter(locale);

  const fields = {} as Record<FieldId, Field>;
  for (const point of POINT_IDS) {
    for (const axis of AXES) {
      const id = fieldId(point, axis);
      fields[id] = {
        point,
        axis,
        input: query<HTMLInputElement>(root, `[data-field="${id}"]`),
        error: query<HTMLElement>(root, `[data-error-for="${id}"]`),
        showError: false,
      };
    }
  }
  const cities: Record<PointId, HTMLSelectElement> = {
    a: query<HTMLSelectElement>(root, '[data-city="a"]'),
    b: query<HTMLSelectElement>(root, '[data-city="b"]'),
  };

  const el = {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    form: query<HTMLFormElement>(root, '[data-points]'),
    swap: query<HTMLButtonElement>(root, '[data-swap]'),
    units: Array.from(root.querySelectorAll<HTMLInputElement>('[data-unit]')),
    result: query<HTMLElement>(root, '[data-result]'),
    status: query<HTMLElement>(root, '[data-result-status]'),
    distanceValue: query<HTMLElement>(root, '[data-distance-value]'),
    distanceUnit: query<HTMLElement>(root, '[data-distance-unit]'),
    others: query<HTMLElement>(root, '[data-distance-others]'),
    bearings: {
      initial: {
        degrees: query<HTMLElement>(root, '[data-initial-degrees]'),
        abbr: query<HTMLElement>(root, '[data-initial-abbr]'),
        name: query<HTMLElement>(root, '[data-initial-name]'),
      },
      final: {
        degrees: query<HTMLElement>(root, '[data-final-degrees]'),
        abbr: query<HTMLElement>(root, '[data-final-abbr]'),
        name: query<HTMLElement>(root, '[data-final-name]'),
      },
    },
    midpointDecimal: Array.from(root.querySelectorAll<HTMLElement>('[data-midpoint-decimal]')),
    midpointDms: Array.from(root.querySelectorAll<HTMLElement>('[data-midpoint-dms]')),
    angleDegrees: query<HTMLElement>(root, '[data-angle-degrees]'),
    angleRadians: query<HTMLElement>(root, '[data-angle-radians]'),
    ellipsoidDistance: query<HTMLElement>(root, '[data-ellipsoid-distance]'),
    ellipsoidComparison: query<HTMLElement>(root, '[data-ellipsoid-comparison]'),
    notes: query<HTMLElement>(root, '[data-notes]'),
    figure: query<HTMLElement>(root, '[data-globe]'),
    figureAngle: query<HTMLElement>(root, '[data-figure-angle]'),
    figureView: query<HTMLElement>(root, '[data-figure-view]'),
  };
  const globe = createGlobeView(query<SVGSVGElement>(root, '[data-globe-svg]'));

  /** The unit of the radio button that is checked (restored form state included). */
  function checkedUnit(): DistanceUnit {
    const value = el.units.find((input) => input.checked)?.value;
    return isDistanceUnit(value) ? value : 'km';
  }

  let unit = checkedUnit();
  let announceTimer = 0;
  let pendingTimer = 0;
  /** What the live region last said about the result, so an unchanged result is not repeated. */
  let lastResult = '';

  // ---------------------------------------------------------------- helpers

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function parse(field: Field): ParseResult<number> {
    return parseCoordinate(field.input.value, field.axis);
  }

  /** Shows or clears a field's error. Returns the message now shown ('' for none). */
  function renderFieldError(field: Field, result: ParseResult<number>): string {
    // A valid value clears the flag, so the next half-typed value raises nothing until committed.
    if (result.ok) field.showError = false;
    const message = !result.ok && field.showError ? present.fieldError(result.code, field.axis) : '';
    field.error.textContent = message;
    field.error.hidden = message === '';
    if (message) field.input.setAttribute('aria-invalid', 'true');
    else field.input.removeAttribute('aria-invalid');
    return message;
  }

  function pointOf(point: PointId, results: Record<FieldId, ParseResult<number>>): LatLon | null {
    const lat = results[fieldId(point, 'lat')];
    const lon = results[fieldId(point, 'lon')];
    return lat.ok && lon.ok ? { lat: lat.value, lon: lon.value } : null;
  }

  /** Each city menu shows the city whose coordinates are in its fields, or the prompt. */
  function syncCities(points: Record<PointId, LatLon | null>): void {
    for (const point of POINT_IDS) {
      const at = points[point];
      const city = at ? cityAt(at) : null;
      cities[point].value = city ?? '';
    }
  }

  // ---------------------------------------------------------------- rendering

  function renderBearing(target: (typeof el.bearings)['initial'], bearing: BearingView | null): void {
    target.degrees.textContent = bearing ? bearing.degrees : m.result.none;
    target.abbr.textContent = bearing ? bearing.abbr : '';
    target.name.textContent = present.spokenCompassName(bearing);
  }

  /** Mid-typing: the last result stays, dimmed (an empty result keeps its message). */
  function renderStale(): void {
    if (el.result.dataset.state === 'empty') return;
    el.result.dataset.state = 'stale';
    el.figure.dataset.stale = '';
  }

  function renderResult(view: ResultView): void {
    el.result.dataset.state = 'ready';
    el.status.hidden = true;
    el.status.textContent = '';
    el.distanceValue.textContent = view.distance.value;
    el.distanceUnit.textContent = view.distance.unit;
    el.others.textContent = view.others;
    renderBearing(el.bearings.initial, view.initialBearing);
    renderBearing(el.bearings.final, view.finalBearing);
    el.midpointDecimal.forEach((node, i) => {
      node.textContent = view.midpoint ? view.midpoint.decimal[i] ?? '' : i === 0 ? m.result.none : '';
    });
    el.midpointDms.forEach((node, i) => {
      node.textContent = view.midpoint ? view.midpoint.dms[i] ?? '' : '';
    });
    el.angleDegrees.textContent = view.angle.degrees;
    el.angleRadians.textContent = view.angle.radians;
    el.ellipsoidDistance.textContent = view.ellipsoid ? view.ellipsoid.distance : m.result.none;
    el.ellipsoidComparison.textContent = view.ellipsoid ? view.ellipsoid.comparison : '';
    el.notes.replaceChildren(
      ...view.notes.map((note) => {
        const item = document.createElement('li');
        item.textContent = note;
        return item;
      }),
    );
    el.figureAngle.textContent = `δ = ${view.angle.degrees}`;
    el.figureView.textContent = view.view;
    delete el.figure.dataset.stale;
  }

  function renderEmpty(message: string): void {
    el.result.dataset.state = 'empty';
    el.status.textContent = message;
    el.status.hidden = false;
    el.distanceValue.textContent = m.result.none;
    el.others.textContent = '';
    renderBearing(el.bearings.initial, null);
    renderBearing(el.bearings.final, null);
    el.midpointDecimal.forEach((node, i) => {
      node.textContent = i === 0 ? m.result.none : '';
    });
    el.midpointDms.forEach((node) => {
      node.textContent = '';
    });
    el.angleDegrees.textContent = m.result.none;
    el.angleRadians.textContent = '';
    el.ellipsoidDistance.textContent = m.result.none;
    el.ellipsoidComparison.textContent = '';
    el.notes.replaceChildren();
    el.figureAngle.textContent = '';
    // The globe keeps the last valid route, faded, until the input is valid again.
    el.figure.dataset.stale = '';
  }

  // ---------------------------------------------------------------- update

  type Announce = 'none' | 'later' | 'now';

  /**
   * Reads the four fields, updates their errors, the result and the figure. `lead` is said
   * before the result when announcing (e.g. "Points A and B swapped.").
   */
  function update(options: { animate: boolean; announce: Announce; lead?: string }): void {
    const results = {} as Record<FieldId, ParseResult<number>>;
    let errorShown = false;
    let empty = false;
    for (const [id, field] of Object.entries(fields) as Array<[FieldId, Field]>) {
      const result = parse(field);
      results[id] = result;
      if (renderFieldError(field, result)) errorShown = true;
      if (!result.ok && result.code === 'empty') empty = true;
    }
    const points = { a: pointOf('a', results), b: pointOf('b', results) };
    syncCities(points);

    window.clearTimeout(pendingTimer);
    const lead = options.lead ?? '';
    if (!points.a || !points.b) {
      lastResult = '';
      if (errorShown) renderEmpty(m.result.invalid);
      else if (empty) renderEmpty(m.result.incomplete);
      else renderStale();
      if (lead) announce(lead);
      return;
    }

    const summary = greatCircle(points.a, points.b);
    const view = present.result(summary, vincentyInverse(points.a, points.b), unit);
    renderResult(view);
    globe.show(points.a, points.b, { animate: options.animate });

    const say = () => {
      if (!lead && view.announcement === lastResult) return;
      lastResult = view.announcement;
      announce(lead ? `${lead} ${view.announcement}` : view.announcement);
    };
    if (options.announce === 'now') say();
    else if (options.announce === 'later') pendingTimer = window.setTimeout(say, ANNOUNCE_DELAY_MS);
    else lastResult = view.announcement;
  }

  /**
   * A whole "latitude, longitude" in one field (pasted, or typed and committed) is spread over
   * the point's two fields, keeping each value as written. A value that reads as a single
   * coordinate is left alone ("41 30" is 41°30′ in a latitude field, not a pair).
   */
  function splitPair(field: Field): boolean {
    if (parse(field).ok) return false;
    const pair = parsePair(field.input.value);
    if (!pair.ok) return false;
    const lat = fields[fieldId(field.point, 'lat')];
    const lon = fields[fieldId(field.point, 'lon')];
    lat.input.value = pair.value.latText;
    lon.input.value = pair.value.lonText;
    return true;
  }

  /** Leaving a field, pressing Enter or pasting: a pair is split, and an invalid value says why. */
  function commit(field: Field): void {
    const split = splitPair(field);
    field.showError = true;
    const before = field.error.textContent ?? '';
    update({ animate: true, announce: split ? 'now' : 'later', lead: split ? m.announce.split : undefined });
    // A newly shown error is also said, since focus may already be elsewhere.
    const after = field.error.textContent ?? '';
    if (after && after !== before) {
      const label = field.axis === 'lat' ? m.points.latitude : m.points.longitude;
      const legend = m.points.legend[field.point];
      announce(`${legend}, ${label}: ${after}`);
    }
  }

  // ---------------------------------------------------------------- events

  for (const field of Object.values(fields)) {
    field.input.addEventListener('input', (event) => {
      const type = event instanceof InputEvent ? event.inputType : '';
      // A pasted or dropped value is complete: treat it like a committed one.
      if (type === 'insertFromPaste' || type === 'insertFromDrop') commit(field);
      else update({ animate: true, announce: 'later' });
    });
    field.input.addEventListener('change', () => commit(field));
    field.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        commit(field);
      }
    });
  }

  for (const point of POINT_IDS) {
    cities[point].addEventListener('change', () => {
      const id = cities[point].value;
      if (!isCityId(id)) return;
      const city = CITIES[id];
      for (const axis of AXES) {
        const field = fields[fieldId(point, axis)];
        field.input.value = present.inputValue(city[axis]);
        field.showError = false;
      }
      update({ animate: true, announce: 'now' });
    });
  }

  el.swap.addEventListener('click', () => {
    for (const axis of AXES) {
      const a = fields[fieldId('a', axis)];
      const b = fields[fieldId('b', axis)];
      [a.input.value, b.input.value] = [b.input.value, a.input.value];
      [a.showError, b.showError] = [b.showError, a.showError];
    }
    update({ animate: true, announce: 'now', lead: m.announce.swapped });
  });

  for (const input of el.units) {
    input.addEventListener('change', () => {
      if (!input.checked || !isDistanceUnit(input.value)) return;
      unit = input.value;
      update({ animate: false, announce: 'now' });
    });
  }

  el.form.addEventListener('submit', (event) => event.preventDefault());

  // Browsers may restore field values on a history navigation after this script has run, or
  // when a page returns from the back/forward cache: recompute once the page is shown.
  window.addEventListener('pageshow', () => {
    window.setTimeout(() => {
      unit = checkedUnit();
      update({ animate: false, announce: 'none' });
    }, 0);
  });

  update({ animate: false, announce: 'none' });
}
