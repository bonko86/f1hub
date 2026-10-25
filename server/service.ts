import type { Dashboard, Race, Standing } from '../shared/types.js';
import { Cache } from './cache.js';
import { Jolpica } from './jolpica.js';
import { config } from './config.js';
export function selectRace(races: Race[], completed: Set<number>) { return races.find(r => !completed.has(r.round)) ?? null; }
export class Service {
  private busy = false;
  private initialized = false;
  private errors = new Map<string, string>();
  private attempts = new Map<string, number>();
  constructor(private cache: Cache, private api: Jolpica) {}
  private async refresh<T>(key: string, interval: number, fetcher: () => Promise<T>) {
    const saved = this.cache.get<T>(key);
    const now = Date.now();
    const legacyDrivers = key.startsWith('drivers:') && (saved?.value as { rows?: Standing[] } | undefined)?.rows?.some(row => !row.teamIds || row.teamIds.length > 1 || row.nationality === undefined);
    const legacyConstructors = key.startsWith('constructors:') && (saved?.value as { rows?: Standing[] } | undefined)?.rows?.some(row => !row.teamIds);
    const legacyCalendar = key.startsWith('calendar:') && (saved?.value as Race[] | undefined)?.some(race => race.latitude == null || race.longitude == null);
    if (saved && !legacyDrivers && !legacyConstructors && !legacyCalendar && now - Date.parse(saved.updated) < interval) return;
    if (now - (this.attempts.get(key) ?? 0) < Math.min(interval, 300000)) return;
    this.attempts.set(key, now);
    try { this.cache.set(key, await fetcher()); this.errors.delete(key); }
    catch (error) { this.errors.set(key, 'Uppdateringen misslyckades. Sparad data visas om den finns.'); console.error(`[${key}]`, error instanceof Error ? error.message : 'Okänt fel'); }
  }
  async tick(now = new Date()) {
    if (this.busy) return;
    this.busy = true;
    try {
      const year = now.getUTCFullYear();
      // Last season must remain visible across New Year until its final results exist.
      for (const y of [year - 1, year, year + 1]) await this.refresh(`calendar:${y}`, config.calendar, () => this.api.calendar(y));
      for (const season of [year - 1, year]) for (const race of this.races(season)) {
        if (Date.parse(race.start || `${race.date}T23:59:59Z`) > now.getTime()) continue;
        const key = `result:${season}:${race.round}`;
        if (this.cache.get<boolean>(key)?.value) continue;
        await this.refresh(key, config.results, () => this.api.result(season, race.round));
      }
      const season = this.activeSeason(year);
      const races = this.races(season);
      const race = selectRace(races, this.completed(season));
      const first = race?.sessions[0];
      const weekend = race && first && now.getTime() >= Date.parse(first.start || `${first.date}T00:00:00Z`) && now.getTime() <= Date.parse(`${race.date}T23:59:59Z`) + 86400000;
      for (const kind of ['drivers', 'constructors'] as const) await this.refresh(`${kind}:${season}`, weekend ? config.weekend : config.standings, () => this.api.standings(season, kind));
    } finally { this.busy = false; this.initialized = true; }
  }
  private races(year: number) { return this.cache.get<Race[]>(`calendar:${year}`)?.value ?? []; }
  private completed(year: number) { return new Set(this.races(year).filter(r => this.cache.get<boolean>(`result:${year}:${r.round}`)?.value).map(r => r.round)); }
  private activeSeason(year: number) {
    const previous = this.races(year - 1);
    if (previous.length && selectRace(previous, this.completed(year - 1))) return year - 1;
    return year;
  }
  dashboard(now = new Date()): Dashboard {
    const season = this.activeSeason(now.getUTCFullYear());
    const races = this.races(season);
    let race = selectRace(races, this.completed(season));
    let status: Dashboard['status'] = !races.length ? 'unavailable' : race ? 'upcoming' : 'season-ended';
    if (!race && races.length) race = this.races(season + 1)[0] ?? null;
    if (race && Date.parse(race.start || `${race.date}T23:59:59Z`) <= now.getTime()) status = 'awaiting-results';
    else if (race) status = 'upcoming';
    const updated: Record<string, string> = {};
    const read = (kind: 'drivers' | 'constructors') => { const item = this.cache.get<{ round: number | null; rows: Standing[] }>(`${kind}:${season}`); if (item) updated[kind] = item.updated; return item?.value ?? { round: null, rows: [] }; };
    const drivers = read('drivers'); const constructors = read('constructors');
    const calendar = this.cache.get(`calendar:${race?.season ?? season}`);
    if (calendar) updated.calendar = calendar.updated;
    if (race) { const result = this.cache.get(`result:${race.season}:${race.round}`); if (result) updated.results = result.updated; }
    return { seasonRaceCount: this.races(race?.season ?? season).length, loading: !this.initialized, season, race, status, drivers: drivers.rows, constructors: constructors.rows, updated, errors: [...new Set(this.errors.values())], standingsRound: { drivers: drivers.round, constructors: constructors.round } };
  }
}
