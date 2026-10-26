import { sv } from './locales/sv.js';
import { countdown as sharedCountdown, formatRaceStart as sharedRaceStart } from '../shared/time.js';
import type { Session } from '../shared/types.js';

export type MessageKey = keyof typeof sv.messages;
export type Messages = Record<MessageKey, string>;
export interface Language { locale: string; messages: Messages }
const languages: Record<string, Language> = { sv };
// Register a language above and change this key to select it. No automatic browser-language switching.
const selectedLanguage = 'sv';
export const language = languages[selectedLanguage] ?? sv;
export const timeZone = 'Europe/Stockholm';
export function createTranslator(messages: Partial<Messages>) {
  return (key: MessageKey, values: Record<string, string | number> = {}) =>
    (messages[key] ?? sv.messages[key]).replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}
export const t = createTranslator(language.messages);
export const formatDate = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language.locale, { ...options, timeZone }).format(new Date(value));
export const formatRaceStart = (value: string) => sharedRaceStart(value, language.locale, timeZone);
export const countdown = (start: string, now: number) => sharedCountdown(start, now, { day: t('countdown.day'), hour: t('countdown.hour'), minute: t('countdown.minute'), second: t('countdown.second') });
// Old persistent calendars contain Swedish session names. Recognise them without rewriting SQLite.
export function sessionKind(session: Session): string {
  if (session.kind) return session.kind;
  return Object.keys(sv.messages).find(key => key.startsWith('session.') && sv.messages[key as MessageKey] === session.name)?.slice(8) ?? '';
}
export function sessionLabel(session: Session): string {
  const key = `session.${sessionKind(session)}` as MessageKey;
  return key in sv.messages ? t(key) : session.name;
}
