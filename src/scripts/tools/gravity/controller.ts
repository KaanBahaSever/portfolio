/**
 * Gravity simulator: DOM wiring (browser only). The physics is src/lib/physics/gravity.ts; the
 * picture is scene-view.ts (three.js). Nothing is stored or sent anywhere.
 *
 * One requestAnimationFrame loop advances the simulation by (real time × time scale), lets the
 * view draw, recomputes the predicted path while a body is being thrown, and refreshes the text
 * (measurements, the selected body and the table of bodies) four times a second. The table is
 * the accessible equivalent of the picture; the live region only announces events (a body added,
 * removed or merged, a scene loaded), never the changing numbers.
 *
 * Throwing a body: in "Adds a body" mode a press on the plane fixes the position, and the drag
 * from there sets the velocity, relative to the body that pulls hardest at that point (so a moon
 * thrown around a moving planet moves with it). The scale from drag length to speed is set at
 * the press: a drag of a quarter of the view's height gives about the circular-orbit speed at
 * half the view's height from that attractor, so useful speeds are short drags at any zoom.
 *
 * With prefers-reduced-motion the simulation starts paused and the camera does not glide.
 */
import { getPageLocale } from '../../../i18n/client.ts';
import { gravityMessages } from '../../../i18n/tools/gravity.ts';
import {
  BODY_TYPES,
  CUSTOM_DENSITY,
  EARTH_MASS,
  G,
  MAX_BODIES,
  MAX_MASS,
  MIN_MASS,
  PRESETS,
  TIME_SCALES,
  addBody,
  advance,
  bodyRadius,
  circularOrbitState,
  clearestAngle,
  createSimulation,
  invalidate,
  isBodyKind,
  isMassUnit,
  isPresetId,
  loadPreset,
  nearestTimeScaleIndex,
  orbitAround,
  parseAmount,
  physicalRadius,
  predictPath,
  removeBody,
  strongestAttractor,
  strongestAttractorAt,
  totalEnergy,
  type Body,
  type BodyInit,
  type BodyKind,
  type MassUnit,
  type Merge,
  type PresetId,
  type Simulation,
} from '../../../lib/physics/gravity.ts';
import { presenter } from './present.ts';
import { bodyColor, createSceneView, type DragMode, type SceneView } from './scene-view.ts';

const STATS_INTERVAL_MS = 250;
/** While a body is being thrown and the simulation runs, the prediction is redone this often. */
const PREDICT_INTERVAL_MS = 120;
/** A press that moves less than this is a click, not a drag (CSS px). */
const CLICK_SLOP = 6;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Gravity: missing element ${selector}`);
  return element;
}

/** The unit a body type's mass reads best in. */
function unitFor(kind: BodyKind, mass: number): MassUnit {
  if (kind === 'moon') return 'moon';
  if (kind === 'asteroid' || kind === 'satellite') return 'kg';
  if (kind === 'custom') return mass < 1e20 ? 'kg' : mass < 1e23 ? 'moon' : 'earth';
  return 'earth';
}

const ROW = 'border-t border-zinc-100 first:border-t-0 dark:border-zinc-800/70';
const CELL = 'px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums';
const NAME_BUTTON =
  'inline-flex min-h-9 items-center gap-2 rounded-md px-1 text-left font-sans font-medium text-zinc-900 hover:text-accent-700 aria-[current=true]:text-accent-700 dark:text-zinc-100 dark:hover:text-accent-400 dark:aria-[current=true]:text-accent-400';

interface Placing {
  pointerId: number;
  x: number;
  y: number;
  tipX: number;
  tipY: number;
  startClientX: number;
  startClientY: number;
  /** Velocity of the attractor, added to the thrown velocity. */
  baseVx: number;
  baseVy: number;
  attractor: Body | null;
  /** m/s of speed per metre of drag. */
  perMetre: number;
  path: Float64Array | null;
  merged: boolean;
  /** When the prediction was last computed (performance.now()). */
  predictedAt: number;
  pending: boolean;
}

export function initGravity(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = gravityMessages[locale];
  const present = presenter(locale);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    stage: query<HTMLElement>(root, '[data-stage]'),
    canvas: query<HTMLCanvasElement>(root, '[data-canvas]'),
    labels: query<HTMLElement>(root, '[data-labels]'),
    readout: query<HTMLElement>(root, '[data-readout]'),
    elapsedOverlay: query<HTMLElement>(root, '[data-elapsed-overlay]'),
    hint: query<HTMLElement>(root, '[data-hint]'),
    noWebgl: query<HTMLElement>(root, '[data-no-webgl]'),
    play: query<HTMLButtonElement>(root, '[data-play]'),
    playLabel: query<HTMLElement>(root, '[data-play-label]'),
    iconPlay: query<HTMLElement>(root, '[data-icon-play]'),
    iconPause: query<SVGElement>(root, '[data-icon-pause]'),
    step: query<HTMLButtonElement>(root, '[data-step]'),
    stepHint: query<HTMLElement>(root, '[data-step-hint]'),
    speed: query<HTMLInputElement>(root, '[data-speed]'),
    speedValue: query<HTMLOutputElement>(root, '[data-speed-value]'),
    limited: query<HTMLElement>(root, '[data-limited]'),
    modes: Array.from(root.querySelectorAll<HTMLInputElement>('[data-mode]')),
    trails: query<HTMLInputElement>(root, '[data-trails]'),
    labelsToggle: query<HTMLInputElement>(root, '[data-labels-toggle]'),
    follow: query<HTMLInputElement>(root, '[data-follow]'),
    fit: query<HTMLButtonElement>(root, '[data-fit]'),
    preset: query<HTMLSelectElement>(root, '[data-preset]'),
    presetDetail: query<HTMLElement>(root, '[data-preset-detail]'),
    reset: query<HTMLButtonElement>(root, '[data-reset]'),
    clear: query<HTMLButtonElement>(root, '[data-clear]'),
    kind: query<HTMLSelectElement>(root, '[data-kind]'),
    mass: query<HTMLInputElement>(root, '[data-mass]'),
    massUnit: query<HTMLSelectElement>(root, '[data-mass-unit]'),
    massSlider: query<HTMLInputElement>(root, '[data-mass-slider]'),
    massEquals: query<HTMLElement>(root, '[data-mass-equals]'),
    massError: query<HTMLElement>(root, '[data-mass-error]'),
    full: query<HTMLElement>(root, '[data-full]'),
    orbitForm: query<HTMLFormElement>(root, '[data-orbit-form]'),
    orbitAround: query<HTMLSelectElement>(root, '[data-orbit-around]'),
    orbitDistance: query<HTMLInputElement>(root, '[data-orbit-distance]'),
    orbitError: query<HTMLElement>(root, '[data-orbit-error]'),
    orbitSubmit: query<HTMLButtonElement>(root, '[data-orbit-submit]'),
    numbersForm: query<HTMLFormElement>(root, '[data-numbers-form]'),
    numbers: {
      x: query<HTMLInputElement>(root, '[data-num="x"]'),
      y: query<HTMLInputElement>(root, '[data-num="y"]'),
      vx: query<HTMLInputElement>(root, '[data-num="vx"]'),
      vy: query<HTMLInputElement>(root, '[data-num="vy"]'),
    },
    numbersError: query<HTMLElement>(root, '[data-numbers-error]'),
    selectedNone: query<HTMLElement>(root, '[data-selected-none]'),
    selectedForm: query<HTMLFormElement>(root, '[data-selected-form]'),
    selName: query<HTMLInputElement>(root, '[data-sel-name]'),
    selMass: query<HTMLInputElement>(root, '[data-sel-mass]'),
    selUnit: query<HTMLSelectElement>(root, '[data-sel-unit]'),
    selEquals: query<HTMLElement>(root, '[data-sel-equals]'),
    selError: query<HTMLElement>(root, '[data-sel-error]'),
    selRemove: query<HTMLButtonElement>(root, '[data-sel-remove]'),
    selAttractor: query<HTMLElement>(root, '[data-sel-attractor]'),
    selDistance: query<HTMLElement>(root, '[data-sel-distance]'),
    selSpeed: query<HTMLElement>(root, '[data-sel-speed]'),
    selPeriod: query<HTMLElement>(root, '[data-sel-period]'),
    selEccentricity: query<HTMLElement>(root, '[data-sel-eccentricity]'),
    statElapsed: query<HTMLElement>(root, '[data-stat-elapsed]'),
    statCount: query<HTMLElement>(root, '[data-stat-count]'),
    statEnergy: query<HTMLElement>(root, '[data-stat-energy]'),
    statDrift: query<HTMLElement>(root, '[data-stat-drift]'),
    listBody: query<HTMLElement>(root, '[data-list-body]'),
    listEmpty: query<HTMLElement>(root, '[data-list-empty]'),
    listScroll: query<HTMLElement>(root, '[data-list-scroll]'),
  };

  const view: SceneView | null = createSceneView(el.canvas, el.labels, { reducedMotion });
  if (!view) {
    el.noWebgl.hidden = false;
    el.canvas.hidden = true;
    el.hint.parentElement!.hidden = true;
    el.fit.disabled = true;
  }

  // ---------------------------------------------------------------- state

  let presetId: PresetId = isPresetId(el.preset.value) ? el.preset.value : 'earth-moon';
  let sim: Simulation = loadPreset(presetId, m.bodies);
  /** Total energy when the bodies last changed; the drift is measured from it. */
  let baseline = totalEnergy(sim);
  let running = !reducedMotion;
  let scaleIndex = nearestTimeScaleIndex(PRESETS[presetId].timeScale);
  let mode: DragMode = 'add';
  let selectedId: number | null = null;
  let following = false;
  /** Mass of the next body to add, kg, or null while the field is invalid. */
  let addMass: number | null = BODY_TYPES.moon.mass;
  let placing: Placing | null = null;
  let press: { id: number; x: number; y: number } | null = null;
  const pointers = new Set<number>();
  /** Names by id, so a merge can still name the body that is gone. */
  const names = new Map<number, string>();
  /** The ids in the table, joined, to know when to rebuild its rows. */
  let listKey = '';
  let lastLimited = -Infinity;

  // ---------------------------------------------------------------- helpers

  let announceTimer = 0;
  function announce(text: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = text;
    }, 60);
  }

  const bodyById = (id: number | null) => (id === null ? undefined : sim.bodies.find((body) => body.id === id));

  function uniqueName(base: string): string {
    const taken = new Set(sim.bodies.map((body) => body.name));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }

  function nextCustomName(): string {
    const taken = new Set(sim.bodies.map((body) => body.name));
    for (let n = 1; ; n++) if (!taken.has(m.add.customName(n))) return m.add.customName(n);
  }

  function setError(element: HTMLElement, text: string, inputs: HTMLElement[] = []): void {
    element.textContent = text;
    element.hidden = text === '';
    for (const input of inputs) {
      if (text) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  /** Reads a mass field in its unit: kg, or the error message. */
  function readMass(input: HTMLInputElement, unitSelect: HTMLSelectElement): number | string {
    const value = parseAmount(input.value);
    if (value === null) return m.errors.mass.empty;
    if (Number.isNaN(value)) return m.errors.mass.number;
    const unit: MassUnit = isMassUnit(unitSelect.value) ? unitSelect.value : 'kg';
    const kg = value * (unit === 'kg' ? 1 : unit === 'earth' ? EARTH_MASS : BODY_TYPES.moon.mass);
    if (!(kg >= MIN_MASS && kg <= MAX_MASS)) return m.errors.mass.range;
    return kg;
  }

  const unitOf = (select: HTMLSelectElement): MassUnit => (isMassUnit(select.value) ? select.value : 'kg');

  // ---------------------------------------------------------------- bodies changed

  /** After bodies were added, removed, merged or edited: new energy baseline, new lists. */
  function bodiesChanged(): void {
    baseline = totalEnergy(sim);
    names.clear();
    for (const body of sim.bodies) names.set(body.id, body.name);
    if (selectedId !== null && !bodyById(selectedId)) select(null, false);
    view?.sync(sim.bodies, false);
    view?.setNames(sim.bodies);
    refreshOrbitOptions();
    el.full.hidden = sim.bodies.length < MAX_BODIES;
    updateText();
  }

  function refreshOrbitOptions(): void {
    const current = Number(el.orbitAround.value);
    el.orbitAround.replaceChildren(
      ...sim.bodies.map((body) => {
        const option = document.createElement('option');
        option.value = String(body.id);
        option.textContent = body.name;
        return option;
      }),
    );
    const heaviest = sim.bodies.reduce<Body | null>((best, body) => (!best || body.mass > best.mass ? body : best), null);
    const preferred = bodyById(selectedId) ?? bodyById(current) ?? heaviest;
    if (preferred) el.orbitAround.value = String(preferred.id);
    el.orbitAround.disabled = sim.bodies.length === 0;
    el.orbitSubmit.disabled = sim.bodies.length === 0;
  }

  function addNewBody(init: Omit<BodyInit, 'name' | 'kind' | 'mass' | 'density'>): Body | null {
    if (addMass === null) {
      setError(el.massError, readMassError(), [el.mass]);
      el.mass.focus();
      return null;
    }
    if (sim.bodies.length >= MAX_BODIES) {
      el.full.hidden = false;
      announce(m.add.full);
      return null;
    }
    const kind = isBodyKind(el.kind.value) ? el.kind.value : 'custom';
    const name = kind === 'custom' ? nextCustomName() : uniqueName(m.add.kinds[kind]);
    const body = addBody(sim, { ...init, name, kind, mass: addMass });
    if (!body) return null;
    bodiesChanged();
    select(body.id, false);
    announce(m.announce.added(body.name));
    return body;
  }

  function readMassError(): string {
    const result = readMass(el.mass, el.massUnit);
    return typeof result === 'string' ? result : '';
  }

  function handleMerges(merges: Merge[]): void {
    const messages: string[] = [];
    for (const merge of merges) {
      messages.push(m.announce.merged(names.get(merge.survivor) ?? '', names.get(merge.absorbed) ?? ''));
      if (selectedId === merge.absorbed) selectedId = merge.survivor;
    }
    bodiesChanged();
    select(selectedId, false);
    announce(messages.join(' '));
  }

  // ---------------------------------------------------------------- selection

  function select(id: number | null, speak = true): void {
    const body = bodyById(id);
    selectedId = body ? body.id : null;
    view?.setSelected(selectedId);
    el.selectedNone.hidden = selectedId !== null;
    el.selectedForm.hidden = selectedId === null;
    el.follow.disabled = selectedId === null;
    if (selectedId === null) {
      following = false;
      el.follow.checked = false;
      view?.setFollow(null);
    } else if (following) view?.setFollow(selectedId);
    if (body) {
      el.selName.value = body.name;
      const unit = unitFor(body.kind, body.mass);
      el.selUnit.value = unit;
      el.selMass.value = present.massField(body.mass, unit);
      el.selEquals.textContent = `${m.add.equals}: ${present.equivalents(body.mass, unit).join(' · ')}`;
      setError(el.selError, '', [el.selName, el.selMass]);
      if (speak) announce(m.announce.selected(body.name));
    }
    updateText();
  }

  // ---------------------------------------------------------------- text

  function updateText(): void {
    const elapsed = present.duration(sim.time);
    el.elapsedOverlay.textContent = elapsed;
    el.statElapsed.textContent = elapsed;
    el.statCount.textContent = String(sim.bodies.length);
    if (sim.bodies.length > 1) {
      const energy = totalEnergy(sim);
      el.statEnergy.textContent = present.energy(energy);
      el.statDrift.textContent = present.drift(baseline === 0 ? 0 : (energy - baseline) / Math.abs(baseline));
    } else {
      el.statEnergy.textContent = sim.bodies.length === 1 ? present.energy(totalEnergy(sim)) : '–';
      el.statDrift.textContent = '0';
    }

    const body = bodyById(selectedId);
    if (body) {
      const primary = strongestAttractor(sim, body);
      if (primary) {
        const orbit = orbitAround(body, primary);
        el.selAttractor.textContent = primary.name;
        el.selDistance.textContent = present.distance(orbit.distance);
        el.selSpeed.textContent = present.speed(orbit.speed);
        el.selPeriod.textContent = orbit.bound ? present.duration(orbit.period) : m.selected.unbound;
        el.selEccentricity.textContent = present.eccentricity(orbit.eccentricity);
      } else {
        el.selAttractor.textContent = m.selected.alone;
        for (const dd of [el.selDistance, el.selSpeed, el.selPeriod, el.selEccentricity]) dd.textContent = '–';
      }
    }
    updateList();
  }

  function updateList(): void {
    el.listEmpty.hidden = sim.bodies.length > 0;
    el.listScroll.hidden = sim.bodies.length === 0;
    const key = sim.bodies.map((body) => `${body.id}:${body.name}`).join(',');
    if (key !== listKey) {
      listKey = key;
      el.listBody.replaceChildren(
        ...sim.bodies.map((body) => {
          const row = document.createElement('tr');
          row.className = ROW;
          row.dataset.id = String(body.id);
          const head = document.createElement('th');
          head.scope = 'row';
          head.className = 'px-2 py-0.5 text-left font-normal whitespace-nowrap';
          const button = document.createElement('button');
          button.type = 'button';
          button.className = NAME_BUTTON;
          button.dataset.selectId = String(body.id);
          button.setAttribute('aria-label', m.list.select(body.name));
          const swatch = document.createElement('span');
          swatch.className = 'size-2.5 shrink-0 rounded-full';
          swatch.style.backgroundColor = bodyColor(body);
          swatch.setAttribute('aria-hidden', 'true');
          button.append(swatch, document.createTextNode(body.name));
          head.append(button);
          row.append(head);
          for (let i = 0; i < 4; i++) {
            const cell = document.createElement('td');
            cell.className = CELL;
            row.append(cell);
          }
          return row;
        }),
      );
    }
    for (const row of el.listBody.querySelectorAll<HTMLTableRowElement>('tr')) {
      const body = bodyById(Number(row.dataset.id));
      if (!body) continue;
      const button = row.querySelector('button')!;
      button.setAttribute('aria-current', String(body.id === selectedId));
      const primary = strongestAttractor(sim, body);
      const orbit = primary ? orbitAround(body, primary) : null;
      const cells = row.querySelectorAll('td');
      cells[0]!.textContent = present.mass(body.mass);
      cells[1]!.textContent = primary ? primary.name : '–';
      cells[2]!.textContent = orbit ? present.distance(orbit.distance) : '–';
      cells[3]!.textContent = orbit ? present.speed(orbit.speed) : present.speed(Math.hypot(body.vx, body.vy));
    }
  }

  function updateTransport(): void {
    el.playLabel.textContent = running ? m.transport.pause : m.transport.play;
    el.iconPlay.hidden = running;
    el.iconPause.toggleAttribute('hidden', !running);
    const scale = TIME_SCALES[scaleIndex]!;
    el.speed.value = String(scaleIndex);
    const text = present.timeScale(scale);
    el.speedValue.textContent = text;
    el.speed.setAttribute('aria-valuetext', text);
    el.stepHint.textContent = m.transport.stepHint(present.duration(scale / 10));
  }

  // ---------------------------------------------------------------- scenes

  function loadScene(id: PresetId): void {
    cancelPlacing();
    presetId = id;
    sim = loadPreset(id, m.bodies);
    scaleIndex = nearestTimeScaleIndex(PRESETS[id].timeScale);
    view?.reset();
    selectedId = null;
    following = false;
    el.follow.checked = false;
    listKey = '';
    el.preset.value = id;
    el.presetDetail.textContent = m.presets.items[id].detail;
    bodiesChanged();
    select(null, false);
    view?.fit(sim.bodies);
    updateTransport();
  }

  el.preset.addEventListener('change', () => {
    if (!isPresetId(el.preset.value)) return;
    loadScene(el.preset.value);
    announce(m.announce.preset(m.presets.items[presetId].label));
  });
  el.reset.addEventListener('click', () => {
    loadScene(presetId);
    announce(m.announce.preset(m.presets.items[presetId].label));
  });
  el.clear.addEventListener('click', () => {
    cancelPlacing();
    sim = createSimulation();
    view?.reset();
    listKey = '';
    bodiesChanged();
    select(null, false);
    announce(m.announce.cleared);
  });

  // ---------------------------------------------------------------- transport

  el.play.addEventListener('click', () => {
    running = !running;
    updateTransport();
    announce(running ? m.announce.playing : m.announce.paused);
  });
  el.step.addEventListener('click', () => {
    if (running) {
      running = false;
      updateTransport();
    }
    stepBy(TIME_SCALES[scaleIndex]! / 10);
  });
  el.speed.addEventListener('input', () => {
    scaleIndex = Math.min(TIME_SCALES.length - 1, Math.max(0, Number(el.speed.value) || 0));
    updateTransport();
  });

  function stepBy(duration: number): void {
    if (sim.bodies.length === 0) return;
    const result = advance(sim, duration);
    if (result.merges.length) handleMerges(result.merges);
    view?.sync(sim.bodies, true);
    updateText();
  }

  // ---------------------------------------------------------------- view options

  function setMode(next: DragMode): void {
    mode = next;
    view?.setMode(mode);
    el.hint.textContent = m.view.hint[mode];
    el.canvas.style.cursor = mode === 'add' ? 'crosshair' : 'grab';
    if (mode === 'camera') cancelPlacing();
  }
  for (const radio of el.modes) {
    radio.addEventListener('change', () => {
      if (radio.checked) setMode(radio.value === 'camera' ? 'camera' : 'add');
    });
  }
  el.trails.addEventListener('change', () => view?.setTrails(el.trails.checked));
  el.labelsToggle.addEventListener('change', () => view?.setLabels(el.labelsToggle.checked));
  el.follow.addEventListener('change', () => {
    following = el.follow.checked && selectedId !== null;
    view?.setFollow(following ? selectedId : null);
  });
  el.fit.addEventListener('click', () => view?.fit(sim.bodies));

  // ---------------------------------------------------------------- the mass of a new body

  function showAddMass(source: 'kind' | 'field' | 'slider' | 'unit'): void {
    if (addMass !== null) {
      const unit = unitOf(el.massUnit);
      if (source !== 'field') el.mass.value = present.massField(addMass, unit);
      if (source !== 'slider') el.massSlider.value = String(Math.log10(addMass));
      el.massSlider.setAttribute('aria-valuetext', present.mass(addMass));
      el.massEquals.textContent = `${m.add.equals}: ${present.equivalents(addMass, unit).join(' · ')}`;
      setError(el.massError, '', [el.mass]);
    }
  }

  el.kind.addEventListener('change', () => {
    const kind = el.kind.value;
    if (isBodyKind(kind)) {
      addMass = BODY_TYPES[kind].mass;
      el.massUnit.value = unitFor(kind, addMass);
    } else {
      addMass ??= BODY_TYPES.moon.mass;
    }
    showAddMass('kind');
  });
  /** The field was typed in: take its value, and call the body custom unless it is the type's mass. */
  function readMassField(): void {
    const result = readMass(el.mass, el.massUnit);
    if (typeof result === 'string') {
      addMass = null;
      return;
    }
    addMass = result;
    const kind = el.kind.value;
    if (isBodyKind(kind) && Math.abs(BODY_TYPES[kind].mass - result) > BODY_TYPES[kind].mass * 1e-3) el.kind.value = 'custom';
    showAddMass('field');
  }
  el.mass.addEventListener('input', readMassField);
  el.mass.addEventListener('change', () => setError(el.massError, readMassError(), [el.mass]));
  // A valid mass is shown in the new unit; a value still being typed is read in it instead.
  el.massUnit.addEventListener('change', () => (addMass !== null ? showAddMass('unit') : readMassField()));
  el.massSlider.addEventListener('input', () => {
    // Round to three significant digits, so the field shows a readable number.
    addMass = Number((10 ** Number(el.massSlider.value)).toPrecision(3));
    el.kind.value = 'custom';
    showAddMass('slider');
  });

  // ---------------------------------------------------------------- add by form

  el.orbitForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const primary = bodyById(Number(el.orbitAround.value));
    if (!primary) {
      setError(el.orbitError, m.add.orbit.none, []);
      return;
    }
    const km = parseAmount(el.orbitDistance.value);
    if (km === null || Number.isNaN(km)) {
      setError(el.orbitError, km === null ? m.errors.empty : m.errors.number, [el.orbitDistance]);
      return;
    }
    if (addMass === null) {
      setError(el.massError, readMassError(), [el.mass]);
      return;
    }
    const distance = km * 1000;
    const kind = isBodyKind(el.kind.value) ? el.kind.value : 'custom';
    const density = kind === 'custom' ? CUSTOM_DENSITY : BODY_TYPES[kind].density;
    if (!(distance > bodyRadius(primary) + physicalRadius(addMass, density))) {
      setError(el.orbitError, m.errors.distance, [el.orbitDistance]);
      return;
    }
    setError(el.orbitError, '', [el.orbitDistance]);
    const state = circularOrbitState(primary, addMass, distance, clearestAngle(sim, primary, distance));
    addNewBody(state);
  });

  el.numbersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const inputs = [el.numbers.x, el.numbers.y, el.numbers.vx, el.numbers.vy];
    const values = inputs.map((input) => parseAmount(input.value));
    const invalid = inputs.filter((_, i) => values[i] === null || Number.isNaN(values[i]));
    if (invalid.length) {
      const empty = values.some((value) => value === null);
      setError(el.numbersError, empty ? m.errors.empty : m.errors.number, inputs);
      for (const input of inputs) if (!invalid.includes(input)) input.removeAttribute('aria-invalid');
      return;
    }
    // km → m and km/s → m/s.
    const [x, y, vx, vy] = (values as number[]).map((value) => value * 1000);
    if (addMass === null) {
      setError(el.massError, readMassError(), [el.mass]);
      return;
    }
    const inside = sim.bodies.some((body) => Math.hypot(body.x - x!, body.y - y!) < bodyRadius(body));
    if (inside) {
      setError(el.numbersError, m.errors.overlap, [el.numbers.x, el.numbers.y]);
      return;
    }
    setError(el.numbersError, '', inputs);
    addNewBody({ x: x!, y: y!, vx: vx!, vy: vy! });
  });

  // ---------------------------------------------------------------- selected body

  el.selectedForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const body = bodyById(selectedId);
    if (!body) return;
    const name = el.selName.value.trim();
    if (!name) {
      setError(el.selError, m.errors.name, [el.selName]);
      return;
    }
    const mass = readMass(el.selMass, el.selUnit);
    if (typeof mass === 'string') {
      setError(el.selError, mass, [el.selMass]);
      return;
    }
    setError(el.selError, '', [el.selName, el.selMass]);
    body.name = name;
    if (mass !== body.mass) {
      body.mass = mass;
      invalidate(sim);
    }
    bodiesChanged();
    select(body.id, false);
  });
  el.selUnit.addEventListener('change', () => {
    const body = bodyById(selectedId);
    const unit = unitOf(el.selUnit);
    // Changing the unit shows the body's mass in it; it does not change the mass.
    if (body) {
      el.selMass.value = present.massField(body.mass, unit);
      el.selEquals.textContent = `${m.add.equals}: ${present.equivalents(body.mass, unit).join(' · ')}`;
    }
  });
  el.selMass.addEventListener('input', () => {
    const mass = readMass(el.selMass, el.selUnit);
    if (typeof mass !== 'string') {
      el.selEquals.textContent = `${m.add.equals}: ${present.equivalents(mass, unitOf(el.selUnit)).join(' · ')}`;
    }
  });
  el.selRemove.addEventListener('click', () => {
    const body = bodyById(selectedId);
    if (!body) return;
    removeBody(sim, body.id);
    select(null, false);
    bodiesChanged();
    announce(m.announce.removed(body.name));
  });

  el.listBody.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-select-id]');
    if (button) select(Number(button.dataset.selectId));
  });

  // ---------------------------------------------------------------- pointer: throwing and picking

  function cancelPlacing(): void {
    if (!placing) return;
    placing = null;
    view?.setDrag(null);
    el.readout.hidden = true;
  }

  function placingVelocity(p: Placing): { vx: number; vy: number; speed: number } {
    const dx = (p.tipX - p.x) * p.perMetre;
    const dy = (p.tipY - p.y) * p.perMetre;
    return { vx: p.baseVx + dx, vy: p.baseVy + dy, speed: Math.hypot(dx, dy) };
  }

  function candidate(p: Placing): BodyInit {
    const kind = isBodyKind(el.kind.value) ? el.kind.value : 'custom';
    const { vx, vy } = placingVelocity(p);
    return { name: '', kind, mass: addMass ?? BODY_TYPES.moon.mass, x: p.x, y: p.y, vx, vy };
  }

  function predict(p: Placing): void {
    const result = predictPath(sim, candidate(p));
    p.path = result.points;
    p.merged = result.merged;
    p.predictedAt = performance.now();
    p.pending = false;
    showDrag(p);
  }

  function showDrag(p: Placing): void {
    if (!view) return;
    const init = candidate(p);
    view.setDrag({
      x: p.x,
      y: p.y,
      tipX: p.tipX,
      tipY: p.tipY,
      mass: init.mass,
      color: bodyColor({ kind: init.kind, id: sim.nextId }),
      path: p.path,
    });
    // The readout, next to the pointer.
    const { speed } = placingVelocity(p);
    const speedText = present.speed(speed);
    let text = m.view.readout.still(speedText);
    if (p.merged) text = m.view.readout.collides(speedText);
    else if (p.attractor && speed > 0) {
      const ghost = { ...init, id: -1, density: 1, ax: 0, ay: 0 } satisfies Body;
      const orbit = orbitAround(ghost, p.attractor);
      text = orbit.bound ? m.view.readout.bound(speedText, present.duration(orbit.period)) : m.view.readout.escapes(speedText);
    }
    el.readout.textContent = text;
    el.readout.hidden = false;
    const tip = view.toClient(p.tipX, p.tipY);
    const stage = el.stage.getBoundingClientRect();
    if (tip) {
      const x = Math.min(stage.width - el.readout.offsetWidth - 8, Math.max(8, tip.x - stage.left + 14));
      const y = Math.min(stage.height - el.readout.offsetHeight - 8, Math.max(8, tip.y - stage.top - 30));
      el.readout.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  el.canvas.addEventListener('pointerdown', (event) => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) {
      // A second finger: the gesture is a pinch or a pan, not a throw.
      cancelPlacing();
      press = null;
      return;
    }
    if (event.button !== 0 || !view) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (mode !== 'add') return;
    const touch = event.pointerType !== 'mouse';
    const hit = view.pick(event.clientX, event.clientY, touch);
    if (hit !== null) {
      select(hit);
      press = null;
      return;
    }
    if (sim.bodies.length >= MAX_BODIES) {
      el.full.hidden = false;
      announce(m.add.full);
      return;
    }
    if (addMass === null) {
      setError(el.massError, readMassError(), [el.mass]);
      return;
    }
    const point = view.planePoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    const attractor = strongestAttractorAt(sim, point.x, point.y);
    const halfHeight = view.halfHeightAt(point.x, point.y);
    const referenceSpeed = Math.sqrt((G * (attractor?.mass ?? EARTH_MASS)) / halfHeight);
    placing = {
      pointerId: event.pointerId,
      x: point.x,
      y: point.y,
      tipX: point.x,
      tipY: point.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseVx: attractor?.vx ?? 0,
      baseVy: attractor?.vy ?? 0,
      attractor,
      perMetre: referenceSpeed / (0.5 * halfHeight),
      path: null,
      merged: false,
      predictedAt: 0,
      pending: true,
    };
    el.canvas.setPointerCapture(event.pointerId);
    showDrag(placing);
  });

  el.canvas.addEventListener('pointermove', (event) => {
    if (!placing || event.pointerId !== placing.pointerId || !view) return;
    const point = view.planePoint(event.clientX, event.clientY);
    if (!point) return;
    placing.tipX = point.x;
    placing.tipY = point.y;
    placing.pending = true;
    showDrag(placing);
  });

  function endPointer(event: PointerEvent, cancelled: boolean): void {
    pointers.delete(event.pointerId);
    if (placing && event.pointerId === placing.pointerId) {
      const p = placing;
      cancelPlacing();
      if (cancelled) return;
      const moved = Math.hypot(event.clientX - p.startClientX, event.clientY - p.startClientY);
      if (moved < CLICK_SLOP) {
        p.tipX = p.x;
        p.tipY = p.y;
      }
      const { vx, vy } = placingVelocity(p);
      addNewBody({ x: p.x, y: p.y, vx, vy });
      return;
    }
    if (press && event.pointerId === press.id && !cancelled && mode === 'camera' && view) {
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (moved < CLICK_SLOP) select(view.pick(event.clientX, event.clientY, event.pointerType !== 'mouse'));
    }
    press = null;
  }
  el.canvas.addEventListener('pointerup', (event) => endPointer(event, false));
  el.canvas.addEventListener('pointercancel', (event) => endPointer(event, true));
  el.canvas.addEventListener('lostpointercapture', (event) => pointers.delete(event.pointerId));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && placing) cancelPlacing();
  });
  // The context menu would interrupt a right-button pan.
  el.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // ---------------------------------------------------------------- the loop

  let onScreen = true;
  new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
  }).observe(el.stage);

  let last = performance.now();
  let lastText = 0;
  function tick(now: number): void {
    const real = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    let advanced = false;
    if (running && sim.bodies.length > 0 && real > 0) {
      const result = advance(sim, real * TIME_SCALES[scaleIndex]!);
      advanced = result.advanced > 0;
      if (result.limited) lastLimited = now;
      if (result.merges.length) handleMerges(result.merges);
    }
    el.limited.hidden = now - lastLimited > 1000;
    if (view) {
      if (advanced) view.sync(sim.bodies, true);
      if (placing && (placing.pending || (running && now - placing.predictedAt > PREDICT_INTERVAL_MS))) {
        predict(placing);
      }
      if (onScreen) view.frame();
    }
    if (now - lastText > STATS_INTERVAL_MS) {
      lastText = now;
      updateText();
    }
    window.requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- start

  setMode('add');
  bodiesChanged();
  select(null, false);
  view?.fit(sim.bodies);
  updateTransport();
  showAddMass('kind');
  window.requestAnimationFrame(tick);
}
