/**
 * Presentation details for the tool cards on /tools/, keyed by ToolInfo.slug (src/data/tools.ts).
 * `formats` names what a tool reads or relies on, in the notation developers use in both
 * languages, so it needs no translation. A tool missing here simply shows no formats line.
 */
export const TOOL_FORMATS: Readonly<Record<string, readonly string[]>> = {
  notepad: ['TXT'],
  'pdf-split': ['PDF', 'ZIP'],
  'image-compressor': ['JPEG', 'PNG', 'WebP'],
  'pdf-compress': ['PDF'],
  'password-generator': ['Web Crypto'],
};
