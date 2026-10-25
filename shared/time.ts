export const stockholm = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('sv-SE', { ...options, timeZone: 'Europe/Stockholm' }).format(new Date(value));
export function countdown(start: string, now: number) {
  const minutes = Math.max(0, Math.ceil((Date.parse(start) - now) / 60000));
  return `${Math.floor(minutes / 1440)} d ${Math.floor(minutes % 1440 / 60)} h ${minutes % 60} min`;
}
