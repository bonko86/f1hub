export const stockholm = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('sv-SE', { ...options, timeZone: 'Europe/Stockholm' }).format(new Date(value));
export function countdown(start: string, now: number) {
  const minutes = Math.max(0, Math.ceil((Date.parse(start) - now) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  return [days > 0 ? `${days}d` : null, days > 0 || hours > 0 ? `${hours}h` : null, `${minutes % 60}min`].filter(Boolean).join(' ');
}
