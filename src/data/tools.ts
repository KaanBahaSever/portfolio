export type ToolStatus = 'ready' | 'planned';

export interface ToolInfo {
  slug: string;
  title: string;
  description: string;
  /** 'ready' tools are linked from /tools/; 'planned' ones show a muted "Coming soon" card. */
  status: ToolStatus;
  href: string;
}

export const TOOLS: ToolInfo[] = [
  {
    slug: 'images-to-pdf',
    title: 'Images to PDF',
    description:
      'Combine photos, scans and screenshots into one PDF. Reorder pages, pick a page size and margins, then download.',
    status: 'ready',
    href: '/tools/images-to-pdf/',
  },
  {
    slug: 'notepad',
    title: 'Notepad',
    description:
      'A plain-text editor with find & replace (regex, match case, whole word), live character, word, sentence and byte counts, and Save As with any extension.',
    status: 'ready',
    href: '/tools/notepad/',
  },
  {
    slug: 'password-generator',
    title: 'Password generator',
    description:
      'Cryptographically secure random passwords with length and character-set options and a strength estimate.',
    status: 'ready',
    href: '/tools/password-generator/',
  },
  {
    slug: 'pdf-split',
    title: 'Split PDF',
    description:
      'Extract pages, or split a PDF into page ranges or every N pages. Several output files download as one ZIP.',
    status: 'ready',
    href: '/tools/pdf-split/',
  },
  {
    slug: 'pdf-compress',
    title: 'Compress PDF',
    description: 'Shrink a PDF by re-compressing its images and cleaning out unused objects.',
    status: 'ready',
    href: '/tools/pdf-compress/',
  },
  {
    slug: 'rich-text-editor',
    title: 'Rich text editor',
    description: 'Write formatted text with bold, italic, alignment and more.',
    status: 'planned',
    href: '/tools/rich-text-editor/',
  },
];
