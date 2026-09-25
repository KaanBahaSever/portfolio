import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  codeHostName,
  displayHost,
  liveLink,
  localizeProseLinks,
} from '../src/components/projects/links.ts';
import { projectsMessages } from '../src/i18n/messages/projects.ts';

test('displayHost', () => {
  assert.equal(displayHost('https://asion.app'), 'asion.app');
  assert.equal(displayHost('https://www.acik-matematik.com/x/'), 'acik-matematik.com');
  assert.equal(displayHost('not a url'), 'not a url');
  assert.equal(codeHostName('https://github.com/KaanBahaSever/karecik'), 'GitHub');
  assert.equal(codeHostName('https://git.example.org/a'), 'git.example.org');
});

test('liveLink', () => {
  assert.deepEqual(liveLink('/tools/pdf-split/', 'tr'), { href: '/tr/tools/pdf-split/', external: false, host: '' });
  assert.deepEqual(liveLink('/tools/pdf-split/', 'en'), { href: '/tools/pdf-split/', external: false, host: '' });
  assert.deepEqual(liveLink('https://asion.app', 'tr'), { href: 'https://asion.app', external: true, host: 'asion.app' });
  assert.equal(liveLink(undefined, 'tr'), undefined);
});

test('localizeProseLinks', () => {
  const html =
    '<p><a href="/about/#journey">About</a> <a href="/cv/kaan-cv.pdf">CV</a> <a href="https://x.com/a/">x</a> <a href="//cdn/a/">c</a> <a href="#top">t</a> <a class="x" href="/">home</a> <a href="/tr/blog/">b</a> <a href="/projects/karecik/?q=1">k</a> <img src="/a/"></p>';
  assert.equal(localizeProseLinks(html, 'en'), html);
  assert.equal(
    localizeProseLinks(html, 'tr'),
    '<p><a href="/tr/about/#journey">About</a> <a href="/cv/kaan-cv.pdf">CV</a> <a href="https://x.com/a/">x</a> <a href="//cdn/a/">c</a> <a href="#top">t</a> <a class="x" href="/tr/">home</a> <a href="/tr/blog/">b</a> <a href="/tr/projects/karecik/?q=1">k</a> <img src="/a/"></p>',
  );
});

test('messages', () => {
  assert.equal(projectsMessages.en.index.summary(6, 4), '6 projects · 4 open source');
  assert.equal(projectsMessages.en.index.summary(1, 1), '1 project · 1 open source');
  assert.equal(projectsMessages.tr.index.summary(6, 4), '6 proje · 4 açık kaynak');
  assert.deepEqual(Object.keys(projectsMessages.tr.figures), Object.keys(projectsMessages.en.figures));
  assert.ok(projectsMessages.en.card.liveName('Asion').startsWith(projectsMessages.en.card.live));
  assert.ok(projectsMessages.tr.card.liveName('Asion').startsWith(projectsMessages.tr.card.live));
  assert.ok(projectsMessages.tr.detail.visitName('asion.app').startsWith(projectsMessages.tr.detail.visit('asion.app')));
});
