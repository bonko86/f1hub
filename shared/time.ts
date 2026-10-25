export const stockholm = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('sv-SE', { ...options, timeZone: 'Europe/Stockholm' }).format(new Date(value));
export function formatRaceStart(value: string, locale = 'sv-SE', timeZone = 'Europe/Stockholm') {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const text = formatter.formatToParts(new Date(value)).map(part =>
    formatter.resolvedOptions().locale.startsWith('sv') && part.type === 'literal' ? part.value.replace(':', '.') : part.value
  ).join('');
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
export function countdown(start: string, now: number) {
  const remaining = Math.max(0, Date.parse(start) - now);
  if (remaining < 3600000) {
    const seconds = Math.floor(remaining / 1000);
    return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
  }
  const minutes = Math.ceil(remaining / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  return [days > 0 ? `${days}d` : null, days > 0 || hours > 0 ? `${hours}h` : null, `${minutes % 60}min`].filter(Boolean).join(' ');
}
