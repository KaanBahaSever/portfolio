/**
 * Turns the shell's structured output into transcript entries (browser only). Text is set with
 * textContent and links are real <a> elements; nothing is parsed as HTML.
 */
import type { ConsoleMessages } from '../../i18n/console/messages.ts';
import { COMMANDS } from '../../lib/console/commands.ts';
import type { CommandName, Output } from '../../lib/console/commands.ts';
import type { ConsoleData } from '../../lib/console/data.ts';
import { blank, dim, heading, isSafeHref, pair, spanText, text } from '../../lib/console/rich.ts';
import type { Line, Span, Tone } from '../../lib/console/rich.ts';
import { describeError, describeNotice } from './describe.ts';

export interface RenderContext {
  m: ConsoleMessages;
  /** "(opens in a new tab)", appended visually hidden to external links. */
  newTab: string;
  docs: ConsoleData['docs'];
}

/** Widest term column for two-column lines; longer terms wrap inside it. */
const MAX_TERM_COLUMN = 24;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, content?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

const toneClass = (tone: Tone | undefined) =>
  tone === 'bright' ? 'console-bright' : tone === 'dim' ? 'console-dim' : undefined;

function renderSpan(span: Span, ctx: RenderContext): Node {
  if (typeof span === 'string') return document.createTextNode(span);

  if (span.href && isSafeHref(span.href)) {
    const anchor = element('a', toneClass(span.tone), span.text);
    anchor.href = span.href;
    if (/^https?:/i.test(span.href)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.append(element('span', 'sr-only', ` ${ctx.newTab}`));
    }
    return anchor;
  }

  if (span.run) {
    const button = element('button', 'console-run', span.text);
    button.type = 'button';
    button.dataset.run = span.run;
    return button;
  }

  return element('span', toneClass(span.tone), span.text);
}

function appendSpans(parent: HTMLElement, spans: readonly Span[], ctx: RenderContext): void {
  for (const span of spans) parent.append(renderSpan(span, ctx));
}

function renderLine(line: Line, ctx: RenderContext): HTMLElement {
  switch (line.type) {
    case 'text': {
      const node = element('div', 'console-line');
      if (line.indent) node.style.paddingInlineStart = `${line.indent}ch`;
      if (line.lang) node.lang = line.lang;
      appendSpans(node, line.spans, ctx);
      return node;
    }
    case 'pair': {
      const node = element('div', 'console-pair');
      const term = element('span', 'console-term');
      appendSpans(term, line.term, ctx);
      node.append(term);
      if (line.desc.length > 0) {
        const desc = element('span', 'console-desc');
        appendSpans(desc, line.desc, ctx);
        node.append(desc);
      }
      return node;
    }
    case 'art': {
      // role="img" with a label: a screen reader hears a description instead of punctuation.
      const node = element('div', 'console-art');
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', line.label);
      node.style.setProperty('--cols', String(Math.max(1, ...line.rows.map((row) => row.length))));
      const source = line.rows.join('\n');
      const mark = line.highlight;
      if (mark) {
        source.split(mark).forEach((part, index) => {
          if (index > 0) node.append(element('span', 'console-bright console-mark', mark));
          node.append(part);
        });
      } else {
        node.textContent = source;
      }
      return node;
    }
    case 'blank':
      // A space rather than an empty box: it takes a line only once the typewriter reaches it.
      return element('div', 'console-line', ' ');
  }
}

/** Renders lines into a block whose two-column lines share one term width. */
function renderBlock(lines: readonly Line[], ctx: RenderContext): HTMLElement {
  const block = element('div', 'console-block');
  const terms = lines.flatMap((line) => (line.type === 'pair' ? [line.term.map(spanText).join('').length] : []));
  if (terms.length > 0) {
    block.style.setProperty('--console-term', `${Math.min(Math.max(...terms), MAX_TERM_COLUMN)}ch`);
  }
  for (const line of lines) block.append(renderLine(line, ctx));
  return block;
}

function helpLines(commands: readonly CommandName[], m: ConsoleMessages): Line[] {
  const full = commands.length === COMMANDS.length;
  const lines: Line[] = full ? [heading(m.help.heading), blank()] : [];
  for (const command of commands) lines.push(pair(m.help.usage[command], m.help.describe[command]));
  if (full) lines.push(blank(), text(dim(m.help.keys)));
  return lines;
}

function renderListing(names: readonly { name: string; dir: boolean }[]): HTMLElement {
  const list = element('div', 'console-ls');
  for (const entry of names) {
    list.append(element('span', entry.dir ? 'console-bright' : undefined, entry.dir ? `${entry.name}/` : entry.name));
  }
  return list;
}

function renderOutput(output: Output, ctx: RenderContext): HTMLElement {
  switch (output.kind) {
    case 'help':
      return renderBlock(helpLines(output.commands, ctx.m), ctx);
    case 'doc':
      return renderBlock(ctx.docs[output.doc], ctx);
    case 'file':
      return renderBlock(output.lines, ctx);
    case 'listing':
      return renderListing(output.entries);
    case 'text':
      return element('div', 'console-line', output.text);
    case 'history': {
      if (output.entries.length === 0) return element('div', 'console-line', ctx.m.history.empty);
      const width = String(output.entries.length).length;
      return renderBlock(
        output.entries.map((entry, index) => text(dim(String(index + 1).padStart(width + 2)), '  ', entry)),
        ctx,
      );
    }
    case 'notice':
      return element('div', 'console-line', describeNotice(output, ctx.m));
    case 'error':
      return element('div', 'console-line', describeError(output.error, ctx.m));
  }
}

/** One transcript entry holding everything a command printed. */
export function renderOutputs(outputs: readonly Output[], ctx: RenderContext): HTMLElement {
  const entry = element('div', 'console-entry');
  for (const output of outputs) entry.append(renderOutput(output, ctx));
  return entry;
}

export function renderDocument(lines: readonly Line[], ctx: RenderContext): HTMLElement {
  const entry = element('div', 'console-entry');
  entry.append(renderBlock(lines, ctx));
  return entry;
}

/** Completion matches, listed like `ls` output. */
export function renderCandidates(candidates: readonly string[]): HTMLElement {
  const entry = element('div', 'console-entry');
  entry.append(
    renderListing(
      candidates.map((candidate) => ({ name: candidate.replace(/\/$/, ''), dir: candidate.endsWith('/') })),
    ),
  );
  return entry;
}

/**
 * The line the visitor typed, as it stays in the transcript. The prompt is hidden from screen
 * readers (they would spell out "guest at kbs-os tilde dollar" every time); a short label
 * stands in for it. An empty line is hidden entirely.
 */
export function renderEcho(prompt: string, command: string, ctx: RenderContext, suffix = ''): HTMLElement {
  const entry = element('div', 'console-entry console-echo');
  if (command.trim() === '' && suffix === '') entry.setAttribute('aria-hidden', 'true');
  const promptNode = element('span', 'console-prompt', prompt);
  promptNode.setAttribute('aria-hidden', 'true');
  entry.append(element('span', 'sr-only', `${ctx.m.a11y.commandEcho} `), promptNode, ` ${command}${suffix}`);
  return entry;
}
