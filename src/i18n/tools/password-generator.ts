/**
 * Password Generator text: the page, the component and the browser controller all read it,
 * so text rendered on the server and text written later by the script cannot drift apart.
 * The controller picks its locale with getPageLocale(); both locales ship to the browser.
 *
 * The library (src/lib/password/generate.ts) returns codes (character set names, strength
 * levels); this catalogue turns them into words.
 */
import type { Localized } from '../config.ts';
import { formatters } from '../format.ts';
import type { CharsetName, StrengthLevel } from '../../lib/password/generate.ts';

const enNumber = (value: number) => formatters('en').number(value);
const trNumber = (value: number) => formatters('tr').number(value);

const enTypes = {
  uppercase: 'Uppercase',
  lowercase: 'Lowercase',
  numbers: 'Numbers',
  symbols: 'Symbols',
} satisfies Record<CharsetName, string>;

const enStrength = {
  'very-weak': 'Very weak',
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  'very-strong': 'Very strong',
} satisfies Record<StrengthLevel, string>;

const en = {
  // ------------------------------------------------------------ page
  title: 'Password generator',
  description:
    'Generate strong, random passwords right in your browser with the Web Crypto API. Choose the length and character types; nothing is sent or stored.',
  lead: 'Strong, random passwords generated on your device with the Web Crypto API. They are never sent anywhere or stored.',
  tipsTitle: 'Tips',

  // ------------------------------------------------------------ component
  regionLabel: 'Password generator',
  noscript: 'This tool needs JavaScript. Passwords are generated in your browser; nothing is sent anywhere.',
  outputHeading: 'Generated password',
  optionsHeading: 'Options',
  /** Visible label before the strength rating ("Strength: Very strong"). */
  strengthLabel: 'Strength:',
  /** Read by screen readers in place of the "≈" before the bit count. */
  about: 'about',
  copy: 'Copy',
  copied: 'Copied',
  generate: 'Generate new',
  length: 'Length',
  typesLegend: 'Character types',
  typesHint: 'At least one type must stay selected.',
  advancedLegend: 'Advanced',
  lookAlikes: {
    label: 'Avoid look-alike characters',
    detail: 'Leaves out I, l, 1, |, O, o and 0, which are easy to mix up.',
  },
  eachType: {
    label: 'Include every selected type',
    detail: 'At least one character from each type you selected.',
  },
  types: enTypes,
  strength: enStrength,

  // ------------------------------------------------------------ controller
  bits: (bits: number) => `${enNumber(bits)} bits`,
  /** aria-valuetext of the length slider. */
  characters: (count: number) => `${enNumber(count)} ${count === 1 ? 'character' : 'characters'}`,
  strengthAnnouncement: (level: StrengthLevel, bits: number) =>
    `Strength: ${enStrength[level]}, about ${enNumber(bits)} bits`,
  /** Said when unchecking a type leaves `name` as the only one, which then locks on. */
  lockNotice: (name: CharsetName) => `${enTypes[name]} stays on: at least one type must stay selected.`,
  generated: 'New password generated',
  copiedAnnouncement: 'Copied to clipboard',
  copyFailed: 'Couldn’t copy automatically. The password is selected: copy it with your device’s Copy command.',
};

export type PasswordMessages = typeof en;

const trTypes = {
  uppercase: 'Büyük harfler',
  lowercase: 'Küçük harfler',
  numbers: 'Rakamlar',
  symbols: 'Semboller',
} satisfies Record<CharsetName, string>;

const trStrength = {
  'very-weak': 'Çok zayıf',
  weak: 'Zayıf',
  fair: 'Orta',
  strong: 'Güçlü',
  'very-strong': 'Çok güçlü',
} satisfies Record<StrengthLevel, string>;

const tr: PasswordMessages = {
  title: 'Parola üretici',
  description:
    'Web Crypto API ile doğrudan tarayıcınızda güçlü, rastgele parolalar üretin. Uzunluğu ve karakter türlerini seçin; hiçbir şey gönderilmez ya da saklanmaz.',
  lead: 'Web Crypto API ile cihazınızda üretilen güçlü, rastgele parolalar. Hiçbir yere gönderilmez ve hiçbir yerde saklanmaz.',
  tipsTitle: 'İpuçları',

  regionLabel: 'Parola üretici',
  noscript: 'Bu araç JavaScript gerektirir. Parolalar tarayıcınızda üretilir; hiçbir yere gönderilmez.',
  outputHeading: 'Üretilen parola',
  optionsHeading: 'Seçenekler',
  strengthLabel: 'Güç:',
  about: 'yaklaşık',
  copy: 'Kopyala',
  copied: 'Kopyalandı',
  generate: 'Yenisini üret',
  length: 'Uzunluk',
  typesLegend: 'Karakter türleri',
  typesHint: 'En az bir tür seçili kalmalıdır.',
  advancedLegend: 'Gelişmiş',
  lookAlikes: {
    label: 'Birbirine benzeyen karakterlerden kaçın',
    detail: 'Kolayca karıştırılan I, l, 1, |, O, o ve 0 karakterlerini dışarıda bırakır.',
  },
  eachType: {
    label: 'Seçilen her türü dahil et',
    detail: 'Parolada seçtiğiniz her türden en az bir karakter bulunur.',
  },
  types: trTypes,
  strength: trStrength,

  // Turkish nouns stay singular after a number: "20 karakter", "131 bit".
  bits: (bits) => `${trNumber(bits)} bit`,
  characters: (count) => `${trNumber(count)} karakter`,
  strengthAnnouncement: (level, bits) => `Güç: ${trStrength[level]}, yaklaşık ${trNumber(bits)} bit`,
  // Quoted, so no case suffix has to agree with the type name.
  lockNotice: (name) => `“${trTypes[name]}” seçili kalıyor: en az bir tür seçili olmalı.`,
  generated: 'Yeni parola üretildi',
  copiedAnnouncement: 'Panoya kopyalandı',
  copyFailed: 'Otomatik olarak kopyalanamadı. Parola seçili durumda; cihazınızın Kopyala komutuyla kopyalayın.',
};

export const passwordMessages = { en, tr } as const satisfies Localized<PasswordMessages>;
