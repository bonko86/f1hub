function interval(key: string, fallback: number) { const n = Number(process.env[key] ?? fallback); if (!Number.isFinite(n) || n < 1) throw new Error(`Ogiltigt intervall: ${key}`); return n * 60000; }
export const config = {
  port: Number(process.env.PORT || 3000), database: process.env.DATABASE_PATH || './data/f1.sqlite',
  baseUrl: process.env.JOLPICA_BASE_URL || 'https://api.jolpi.ca/ergast/f1/',
  calendar: interval('CALENDAR_INTERVAL_MINUTES', 720), standings: interval('STANDINGS_INTERVAL_MINUTES', 360),
  weekend: interval('WEEKEND_INTERVAL_MINUTES', 30), results: interval('RESULTS_INTERVAL_MINUTES', 5)
};
