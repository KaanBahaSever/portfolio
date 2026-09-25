/**
 * Interface text for the console (/console/): the toolbar, accessibility labels, `help`, errors
 * and notices. Used by the page (server) and by the browser controller, which picks the page's
 * language with getPageLocale(); both languages ship in the script on purpose (see
 * src/i18n/client.ts). Longer copy that only the build needs (about.txt, skills/…) lives in
 * ./content.ts and reaches the browser as data.
 *
 * Command names, paths and file names stay English in both languages, like a real shell.
 */
import type { Localized } from '../config.ts';
import type { CommandName } from '../../lib/console/commands.ts';

const en = {
  title: 'Console',
  description:
    'A distraction-free terminal for exploring this site: projects, skills and contact details, one command at a time.',
  toolbar: {
    label: 'Terminal settings',
    fontSize: 'Font size',
    smaller: 'Smaller text',
    larger: 'Larger text',
    fontSizeValue: (px: number) => `${px}px`,
    phosphor: 'Phosphor colour',
    green: 'Green',
    amber: 'Amber',
    exit: 'Exit',
  },
  a11y: {
    transcript: 'Terminal output',
    input: 'Command',
    /** Read before each echoed command in the transcript (the prompt itself is hidden from screen readers). */
    commandEcho: 'Command:',
    inputHint:
      'Type a command and press Enter; try help. Tab completes names; on an empty line Tab moves on to the next control. Up and down arrows recall earlier commands.',
  },
  noscript: 'The console needs JavaScript. Everything it shows is also on the rest of the site:',
  noscriptLink: 'go to the home page',
  help: {
    heading: 'Commands',
    usage: {
      help: 'help [command]',
      whoami: 'whoami',
      ls: 'ls [path]',
      cd: 'cd [dir]',
      pwd: 'pwd',
      cat: 'cat <file…>',
      projects: 'projects',
      open: 'open <project>',
      echo: 'echo <text>',
      history: 'history',
      clear: 'clear',
      exit: 'exit',
    } satisfies Record<CommandName, string>,
    describe: {
      help: 'list the commands, or explain one',
      whoami: 'a short introduction',
      ls: 'list a directory',
      cd: 'change directory (.., ~ and / work)',
      pwd: 'print the current directory',
      cat: 'print one or more files',
      projects: 'project summaries with links',
      open: 'go to a project’s page',
      echo: 'print the text back',
      history: 'list earlier commands',
      clear: 'clear the screen (also Ctrl+L)',
      exit: 'leave the console',
    } satisfies Record<CommandName, string>,
    keys: 'Tab completes · ↑ ↓ recall history · Ctrl+L clears · Ctrl+C cancels the line',
  },
  errors: {
    commandNotFound: (command: string) => `command not found: ${command} — type 'help'`,
    commandSuggestion: (command: string, suggestion: string) =>
      `command not found: ${command} — did you mean '${suggestion}'?`,
    noSuchPath: (command: string, path: string) => `${command}: ${path}: No such file or directory`,
    notADirectory: (command: string, path: string) => `${command}: ${path}: Not a directory`,
    isADirectory: (command: string, path: string) => `${command}: ${path}: Is a directory`,
    missingFile: 'cat: missing file name — try: cat about.txt',
    missingProject: "open: missing project name — type 'projects' to see them",
    tooManyArguments: (command: string) => `${command}: too many arguments`,
    unterminatedQuote: (quote: string) => `syntax error: unterminated quote ${quote}`,
    unknownProject: (name: string) => `open: no project called ${name} — type 'projects' to see them`,
    unknownHelpTopic: (topic: string) => `help: no such command: ${topic}`,
  },
  notices: {
    opening: (title: string) => `Opening ${title}…`,
    logout: 'logout',
  },
  history: {
    empty: 'No commands yet.',
  },
};

export type ConsoleMessages = typeof en;

const tr: ConsoleMessages = {
  title: 'Konsol',
  description:
    'Siteyi komutlarla keşfetmek için sade bir terminal: projeler, beceriler ve iletişim bilgileri, her seferinde tek komut.',
  toolbar: {
    label: 'Terminal ayarları',
    fontSize: 'Yazı boyutu',
    smaller: 'Yazıyı küçült',
    larger: 'Yazıyı büyüt',
    fontSizeValue: (px) => `${px} px`,
    phosphor: 'Ekran rengi',
    green: 'Yeşil',
    amber: 'Kehribar',
    exit: 'Çıkış',
  },
  a11y: {
    transcript: 'Terminal çıktısı',
    input: 'Komut',
    commandEcho: 'Komut:',
    inputHint:
      'Bir komut yazıp Enter tuşuna basın; help ile başlayabilirsiniz. Tab adları tamamlar; satır boşken Tab sonraki denetime geçer. Yukarı ve aşağı ok tuşları önceki komutları getirir.',
  },
  noscript: 'Konsol için JavaScript gerekiyor. Konsolda gösterilen her şey sitenin geri kalanında da var:',
  noscriptLink: 'ana sayfaya gidin',
  help: {
    heading: 'Komutlar',
    usage: {
      help: 'help [komut]',
      whoami: 'whoami',
      ls: 'ls [yol]',
      cd: 'cd [dizin]',
      pwd: 'pwd',
      cat: 'cat <dosya…>',
      projects: 'projects',
      open: 'open <proje>',
      echo: 'echo <metin>',
      history: 'history',
      clear: 'clear',
      exit: 'exit',
    },
    describe: {
      help: 'komutları listeler ya da birini açıklar',
      whoami: 'kısa bir tanıtım',
      ls: 'dizinin içeriğini listeler',
      cd: 'dizin değiştirir (.., ~ ve / kullanılabilir)',
      pwd: 'bulunduğunuz dizini yazar',
      cat: 'bir ya da daha fazla dosyayı gösterir',
      projects: 'bağlantılarıyla birlikte proje özetleri',
      open: 'projenin sayfasına gider',
      echo: 'yazdığınız metni geri yazar',
      history: 'önceki komutları listeler',
      clear: 'ekranı temizler (Ctrl+L de olur)',
      exit: 'konsoldan çıkar',
    },
    keys: 'Tab tamamlar · ↑ ↓ önceki komutlar · Ctrl+L temizler · Ctrl+C satırı iptal eder',
  },
  errors: {
    commandNotFound: (command) => `komut bulunamadı: ${command} — komutlar için 'help' yazın`,
    commandSuggestion: (command, suggestion) =>
      `komut bulunamadı: ${command} — bunu mu demek istediniz: ${suggestion}`,
    noSuchPath: (command, path) => `${command}: ${path}: Böyle bir dosya ya da dizin yok`,
    notADirectory: (command, path) => `${command}: ${path}: Bir dizin değil`,
    isADirectory: (command, path) => `${command}: ${path}: Bir dizin`,
    missingFile: 'cat: dosya adı eksik — örnek: cat about.txt',
    missingProject: "open: proje adı eksik — projeleri görmek için 'projects' yazın",
    tooManyArguments: (command) => `${command}: çok fazla argüman`,
    unterminatedQuote: (quote) => `sözdizimi hatası: kapatılmamış tırnak ${quote}`,
    unknownProject: (name) => `open: proje bulunamadı: ${name} — projeleri görmek için 'projects' yazın`,
    unknownHelpTopic: (topic) => `help: böyle bir komut yok: ${topic}`,
  },
  notices: {
    opening: (title) => `Açılıyor: ${title}…`,
    logout: 'oturum kapatıldı',
  },
  history: {
    empty: 'Henüz komut yok.',
  },
};

export const consoleMessages = { en, tr } as const satisfies Localized<ConsoleMessages>;
