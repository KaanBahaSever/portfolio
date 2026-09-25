/**
 * Maps the shell's structured errors and notices to the page language. No DOM, so tests can
 * check that every code has a message in both languages.
 */
import type { ConsoleMessages } from '../../i18n/console/messages.ts';
import type { Output, ShellError } from '../../lib/console/commands.ts';

export function describeError(error: ShellError, m: ConsoleMessages): string {
  const e = m.errors;
  switch (error.code) {
    case 'command-not-found':
      return error.suggestion
        ? e.commandSuggestion(error.command, error.suggestion)
        : e.commandNotFound(error.command);
    case 'no-such-path':
      return e.noSuchPath(error.command, error.path);
    case 'not-a-directory':
      return e.notADirectory(error.command, error.path);
    case 'is-a-directory':
      return e.isADirectory(error.command, error.path);
    case 'missing-operand':
      return error.command === 'cat' ? e.missingFile : e.missingProject;
    case 'too-many-arguments':
      return e.tooManyArguments(error.command);
    case 'unterminated-quote':
      return e.unterminatedQuote(error.quote);
    case 'unknown-project':
      return e.unknownProject(error.name);
    case 'unknown-help-topic':
      return e.unknownHelpTopic(error.topic);
  }
}

export function describeNotice(output: Extract<Output, { kind: 'notice' }>, m: ConsoleMessages): string {
  return output.notice === 'opening' ? m.notices.opening(output.title) : m.notices.logout;
}
