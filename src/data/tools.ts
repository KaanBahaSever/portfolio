export type ToolStatus = 'ready' | 'planned';

export interface ToolInfo {
  slug: string;
  title: string;
  description: string;
  status: ToolStatus;
  href: string;
}

export const TOOLS: ToolInfo[] = [
  {
    slug: 'images-to-pdf',
    title: 'Images to PDF',
    description: 'Combine photos and images into a single PDF. Reorder pages, then download.',
    status: 'ready',
    href: '/tools/images-to-pdf/',
  },
  {
    slug: 'notepad',
    title: 'Notepad',
    description: 'A distraction-free scratch pad for quick notes and text clean-up.',
    status: 'planned',
    href: '/tools/notepad/',
  },
  {
    slug: 'password-generator',
    title: 'Password generator',
    description: 'Generate strong, random passwords and passphrases on your device.',
    status: 'planned',
    href: '/tools/password-generator/',
  },
  {
    slug: 'pdf-split',
    title: 'Split PDF',
    description: 'Extract pages or split a PDF into several smaller files.',
    status: 'planned',
    href: '/tools/pdf-split/',
  },
  {
    slug: 'pdf-compress',
    title: 'Compress PDF',
    description: 'Reduce the file size of a PDF without uploading it anywhere.',
    status: 'planned',
    href: '/tools/pdf-compress/',
  },
];
