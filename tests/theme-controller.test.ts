/**
 * The runtime theme controller (src/scripts/theme.ts), run against stubbed browser globals: it
 * follows the operating system only while no choice is stored, applies choices made (or storage
 * cleared) in other tabs, re-syncs pages restored from the back/forward cache, and the header
 * toggle stores a choice and toggles correctly even when pressed again during the cross-fade.
 *
 * The module keeps its state (the choice, the theme on screen) at module level, as one page does,
 * so every test loads a fresh copy of it: `?page=N` makes a new module instance per page.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { common } from '../src/i18n/messages/common.ts';
import {
  SYSTEM_DARK_QUERY,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  resolveTheme,
  type Theme,
  type ThemeChangeDetail,
} from '../src/lib/theme.ts';

type Controller = typeof import('../src/scripts/theme.ts');

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** A MediaQueryList whose `matches` the test flips, firing 'change' like the browser does. */
class FakeMediaQuery extends EventTarget {
  readonly media: string;
  matches: boolean;

  constructor(media: string, matches: boolean) {
    super();
    this.media = media;
    this.matches = matches;
  }

  set(matches: boolean): void {
    if (matches === this.matches) return;
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

function blockedError(): DOMException {
  return new DOMException('The operation is insecure.', 'SecurityError');
}

/**
 * The site's localStorage, shared by every page (tab) of a test. One object for the whole file:
 * src/lib/storage.ts looks the storage up once and keeps it, like a real page would.
 */
const storage = {
  items: new Map<string, string>(),
  /** Every access throws, as with blocked site data. */
  blocked: false,
  getItem(key: string): string | null {
    if (this.blocked) throw blockedError();
    return this.items.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    if (this.blocked) throw blockedError();
    this.items.set(key, value);
  },
  removeItem(key: string): void {
    if (this.blocked) throw blockedError();
    this.items.delete(key);
  },
};

/** The header button: just what initThemeToggle uses. */
class FakeButton extends EventTarget {
  title = '';
  readonly attributes = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  click(): void {
    this.dispatchEvent(new Event('click'));
  }
}

interface PageOptions {
  /** The theme key in storage when the page loads (null: no choice). */
  stored?: string | null;
  blocked?: boolean;
  systemDark?: boolean;
  reducedMotion?: boolean;
  /** document.startViewTransition exists. */
  viewTransitions?: boolean;
  /** The pre-paint script in BaseLayout ran (it sets data-theme first). */
  prePaint?: boolean;
  lang?: string;
}

let pages = 0;

/** Loads one page: stubs the globals the controller touches, then a fresh copy of the module. */
async function openPage({
  stored = null,
  blocked = false,
  systemDark = false,
  reducedMotion = false,
  viewTransitions = false,
  prePaint = true,
  lang = 'en',
}: PageOptions = {}) {
  storage.blocked = false;
  storage.items.clear();
  if (stored !== null) storage.items.set(THEME_STORAGE_KEY, stored);
  storage.blocked = blocked;

  const classes = new Set<string>();
  const root = {
    lang,
    dataset: {} as Record<string, string | undefined>,
    style: {} as Record<string, string>,
    classList: {
      add: (name: string) => void classes.add(name),
      remove: (name: string) => void classes.delete(name),
      contains: (name: string) => classes.has(name),
    },
  };
  const metas: Array<{ media: string; content: string }> = [
    { media: '(prefers-color-scheme: light)', content: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', content: THEME_COLORS.dark },
  ];
  if (prePaint) {
    const theme = resolveTheme(blocked ? null : stored, systemDark);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    for (const meta of metas) meta.content = THEME_COLORS[theme];
  }

  /** Update callbacks passed to startViewTransition, not run yet (the browser runs them later). */
  const pendingTransitions: Array<() => void> = [];
  const document = Object.assign(new EventTarget(), {
    documentElement: root,
    querySelectorAll(selector: string) {
      assert.equal(selector, 'meta[name="theme-color"][media]');
      return metas;
    },
    startViewTransition: viewTransitions
      ? (update: () => void) => {
          pendingTransitions.push(update);
          return {};
        }
      : undefined,
  });
  const events: Theme[] = [];
  document.addEventListener(THEME_CHANGE_EVENT, (event) => {
    events.push((event as CustomEvent<ThemeChangeDetail>).detail.theme);
  });

  const systemDarkQuery = new FakeMediaQuery(SYSTEM_DARK_QUERY, systemDark);
  const reducedMotionQuery = new FakeMediaQuery(REDUCED_MOTION_QUERY, reducedMotion);
  const window = Object.assign(new EventTarget(), {
    localStorage: storage,
    matchMedia(query: string) {
      if (query === SYSTEM_DARK_QUERY) return systemDarkQuery;
      if (query === REDUCED_MOTION_QUERY) return reducedMotionQuery;
      throw new Error(`unexpected media query ${query}`);
    },
  });

  let frames: Array<(time: number) => void> = [];
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = window;
  globals.document = document;
  globals.requestAnimationFrame = (callback: (time: number) => void) => frames.push(callback);

  const controller = (await import(`../src/scripts/theme.ts?page=${++pages}`)) as Controller;

  return {
    controller,
    events,
    /** Everything the visitor (and the browser chrome) can see of the theme. */
    state() {
      return {
        theme: root.dataset.theme,
        colorScheme: root.style.colorScheme,
        metas: metas.map((meta) => meta.content),
      };
    },
    stored: () => storage.items.get(THEME_STORAGE_KEY) ?? null,
    switching: () => classes.has('theme-switching'),
    os: (dark: boolean) => systemDarkQuery.set(dark),
    /** Another tab wrote `value` under `key` (null value: removed it; null key: cleared everything). */
    otherTab(key: string | null, value: string | null) {
      if (key === null) storage.items.clear();
      else if (value === null) storage.items.delete(key);
      else storage.items.set(key, value);
      window.dispatchEvent(Object.assign(new Event('storage'), { key, newValue: value }));
    },
    pageshow(persisted: boolean) {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
    },
    pendingTransitions,
    runTransitions() {
      for (const update of pendingTransitions.splice(0)) update();
    },
    /** Runs animation frames until none are requested. */
    runFrames() {
      while (frames.length) {
        const due = frames;
        frames = [];
        for (const callback of due) callback(0);
      }
    },
    button() {
      const button = new FakeButton();
      controller.initThemeToggle(button as unknown as HTMLButtonElement);
      return button;
    },
  };
}

const light = { theme: 'light', colorScheme: 'light', metas: [THEME_COLORS.light, THEME_COLORS.light] };
const dark = { theme: 'dark', colorScheme: 'dark', metas: [THEME_COLORS.dark, THEME_COLORS.dark] };

test('without a stored choice the page follows the operating system live', async () => {
  const page = await openPage({ systemDark: false });
  page.controller.initTheme();
  assert.deepEqual(page.state(), light);
  assert.deepEqual(page.events, [], 'the pre-paint script already showed the right theme');

  page.os(true);
  assert.deepEqual(page.state(), dark);
  page.os(false);
  assert.deepEqual(page.state(), light);
  assert.deepEqual(page.events, ['dark', 'light']);
  assert.equal(page.stored(), null, 'following the system stores nothing');
});

test('a stored choice is kept when the operating system changes', async () => {
  const page = await openPage({ stored: 'dark', systemDark: false });
  page.controller.initTheme();
  page.os(true);
  page.os(false);
  assert.deepEqual(page.state(), dark);
  assert.deepEqual(page.events, []);
});

test('the toggle switches, stores the choice and then stops following the operating system', async () => {
  const page = await openPage({ systemDark: false });
  page.controller.initTheme();
  const button = page.button();
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(button.title, common.en.theme.toDark);

  button.click();
  assert.deepEqual(page.state(), dark);
  assert.equal(page.stored(), 'dark');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.title, common.en.theme.toLight);

  page.os(true);
  page.os(false);
  assert.deepEqual(page.state(), dark, 'an explicit choice outranks the system');

  button.click();
  assert.deepEqual(page.state(), light);
  assert.equal(page.stored(), 'light');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(page.events, ['dark', 'light']);
});

test('the toggle speaks the page language', async () => {
  const page = await openPage({ systemDark: true, lang: 'tr' });
  page.controller.initTheme();
  const button = page.button();
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.title, common.tr.theme.toLight);
  button.click();
  assert.equal(button.title, common.tr.theme.toDark);
});

test('transitions are off for the frame in which the colours change', async () => {
  const page = await openPage();
  page.controller.initTheme();
  page.button().click();
  assert.equal(page.switching(), true);
  page.runFrames();
  assert.equal(page.switching(), false);
});

test('a choice made in another tab applies here, and clearing the storage returns to the system', async () => {
  const page = await openPage({ systemDark: false });
  page.controller.initTheme();

  page.otherTab(THEME_STORAGE_KEY, 'dark');
  assert.deepEqual(page.state(), dark);
  page.os(true);
  page.os(false);
  assert.deepEqual(page.state(), dark, 'the other tab stored a choice: the system no longer decides');

  page.otherTab('notepad:draft', 'text');
  assert.deepEqual(page.state(), dark, 'other keys are ignored');

  // localStorage.clear() in another tab: a storage event whose key is null.
  page.otherTab(null, null);
  assert.deepEqual(page.state(), light, 'back to the (light) system theme');
  page.os(true);
  assert.deepEqual(page.state(), dark, 'and following it live again');

  page.otherTab(THEME_STORAGE_KEY, 'light');
  page.otherTab(THEME_STORAGE_KEY, null);
  assert.deepEqual(page.state(), dark, 'removing the key returns to the (now dark) system');
  assert.deepEqual(page.events, ['dark', 'light', 'dark', 'light', 'dark']);
});

test('an invalid value written by another tab counts as no choice', async () => {
  const page = await openPage({ stored: 'dark', systemDark: false });
  page.controller.initTheme();
  page.otherTab(THEME_STORAGE_KEY, 'system');
  assert.deepEqual(page.state(), light);
});

test('a page restored from the back/forward cache catches up with changes made meanwhile', async () => {
  const page = await openPage({ systemDark: false });
  page.controller.initTheme();

  // Another page of the site stored a choice while this one sat in the cache (no storage event).
  storage.items.set(THEME_STORAGE_KEY, 'dark');
  page.pageshow(false);
  assert.deepEqual(page.state(), light, 'a normal load is left to the pre-paint script');
  page.pageshow(true);
  assert.deepEqual(page.state(), dark);

  page.os(true);
  page.os(false);
  assert.deepEqual(page.state(), dark, 'the choice read on restore holds');
});

test('a second press during the cross-fade toggles back', async () => {
  const page = await openPage({ systemDark: false, viewTransitions: true });
  page.controller.initTheme();
  const button = page.button();

  button.click();
  assert.equal(page.pendingTransitions.length, 1, 'the switch goes through a view transition');
  assert.equal(page.state().theme, 'light', 'the page changes when the browser runs the update');
  assert.equal(page.controller.currentTheme(), 'dark', 'but the next press already starts from dark');

  button.click();
  page.runTransitions();
  page.runFrames();
  assert.deepEqual(page.state(), light);
  assert.equal(page.stored(), 'light');
  assert.deepEqual(page.events, ['dark', 'light']);
  assert.equal(page.switching(), false);
});

test('reduced motion and changes from elsewhere switch without a cross-fade', async () => {
  const reduced = await openPage({ viewTransitions: true, reducedMotion: true });
  reduced.controller.initTheme();
  reduced.button().click();
  assert.equal(reduced.pendingTransitions.length, 0);
  assert.deepEqual(reduced.state(), dark);

  const page = await openPage({ viewTransitions: true });
  page.controller.initTheme();
  page.os(true);
  page.otherTab(THEME_STORAGE_KEY, 'light');
  assert.equal(page.pendingTransitions.length, 0);
  assert.deepEqual(page.events, ['dark', 'light']);
});

test('with storage blocked the toggle still switches, and the choice holds on this page', async () => {
  const page = await openPage({ blocked: true, systemDark: false });
  page.controller.initTheme();
  page.button().click();
  assert.deepEqual(page.state(), dark);
  page.os(true);
  page.os(false);
  assert.deepEqual(page.state(), dark);
});

test('if the pre-paint script did not run, initTheme sets the theme', async () => {
  const page = await openPage({ prePaint: false, stored: 'dark', systemDark: false });
  assert.equal(page.state().theme, undefined);
  page.controller.initTheme();
  assert.deepEqual(page.state(), dark);
});

test('initTheme listens once however often it is called', async () => {
  const page = await openPage();
  page.controller.initTheme();
  page.controller.initTheme();
  page.os(true);
  assert.deepEqual(page.events, ['dark']);
});
