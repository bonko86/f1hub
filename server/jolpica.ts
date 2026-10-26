import type { Race, Standing } from '../shared/types.js';
type ObjectData = Record<string, any>;
const labels: Record<string, string> = { FirstPractice: 'Träning 1', SecondPractice: 'Träning 2', ThirdPractice: 'Träning 3', SprintQualifying: 'Sprintkval', SprintShootout: 'Sprintkval', Sprint: 'Sprint', Qualifying: 'Kvalificering' };
function start(date: string, time?: string): string | null { if (!time) return null; const value = `${date}T${time}`; if (!Number.isFinite(Date.parse(value))) throw new Error('Ogiltig sessionstid'); return value; }
export function normalizeRace(r: ObjectData): Race {
  if (!r.raceName || !r.Circuit?.Location || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number(r.round)) throw new Error('Ogiltigt kalenderformat');
  const sessions = Object.entries(labels).filter(([key]) => r[key]?.date).map(([key, name]) => ({ name, kind: key === 'SprintShootout' ? 'SprintQualifying' : key, date: r[key].date, start: start(r[key].date, r[key].time) }));
  const raceStart = start(r.date, r.time);
  sessions.push({ name: 'Race', kind: 'Race', date: r.date, start: raceStart });
  sessions.sort((a, b) => (a.start || a.date).localeCompare(b.start || b.date));
  return { season: Number(r.season), round: Number(r.round), name: r.raceName, circuit: r.Circuit.circuitName, latitude: Number(r.Circuit.Location.lat), longitude: Number(r.Circuit.Location.long), country: r.Circuit.Location.country, locality: r.Circuit.Location.locality, date: r.date, start: raceStart, sessions };
}
export class Jolpica {
  private lastRequest = 0;
  constructor(private base: string) {}
  async request(path: string): Promise<ObjectData> {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - this.lastRequest))));
    this.lastRequest = Date.now();
    const response = await fetch(new URL(path, this.base.endsWith('/') ? this.base : this.base + '/'), { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Jolpica HTTP ${response.status}`);
    const body = await response.json() as ObjectData;
    if (!body.MRData) throw new Error('Jolpica saknar MRData');
    return body.MRData;
  }
  async calendar(year: number) {
    const data = await this.request(`${year}.json?limit=100`);
    const races = data.RaceTable?.Races;
    if (!Array.isArray(races) || Number(data.total) !== races.length) throw new Error('Ofullständig kalender');
    return races.map(normalizeRace).sort((a, b) => a.round - b.round);
  }
  async standings(year: number, kind: 'drivers' | 'constructors'): Promise<{ round: number | null; rows: Standing[] }> {
    const driver = kind === 'drivers';
    const data = await this.request(`${year}/${driver ? 'driver' : 'constructor'}standings.json?limit=100`);
    const lists = data.StandingsTable?.StandingsLists;
    if (!Array.isArray(lists)) throw new Error('Ogiltigt tabellformat');
    if (!lists.length) return { round: null, rows: [] };
    const list = lists[0];
    const rows = list[driver ? 'DriverStandings' : 'ConstructorStandings'];
    if (!Array.isArray(rows) || Number(data.total) !== rows.length) throw new Error('Ofullständig mästerskapstabell');
    if (driver) for (const row of rows) {
      if (!Array.isArray(row.Constructors) || row.Constructors.length <= 1) continue;
      const results = await this.request(`${year}/drivers/${encodeURIComponent(row.Driver.driverId)}/results.json?limit=100`);
      const races = results.RaceTable?.Races;
      if (!Array.isArray(races) || Number(results.total) !== races.length) throw new Error('Ofullständiga förarresultat');
      const latest = [...races].sort((a, b) => Number(b.round) - Number(a.round))[0]?.Results?.[0]?.Constructor;
      if (!latest?.constructorId || !latest.name) throw new Error('Kan inte fastställa förarens senaste lag');
      row.Constructors = [latest];
    }
    return { round: Number(list.round), rows: rows.map((r: ObjectData) => {
      if (!Number(r.position) || r.points == null || r.wins == null || (driver ? !r.Driver?.familyName || !Array.isArray(r.Constructors) : !r.Constructor?.name)) throw new Error('Ogiltig tabellrad');
      return { position: Number(r.position), name: driver ? `${r.Driver.givenName} ${r.Driver.familyName}` : r.Constructor.name, ...(driver ? { code: r.Driver.code || undefined, nationality: r.Driver.nationality, teamIds: r.Constructors.map((c: ObjectData) => c.constructorId) } : { teamIds: [r.Constructor.constructorId] }), team: driver ? r.Constructors.map((c: ObjectData) => c.name).join(' / ') : r.Constructor.name, points: String(r.points), wins: Number(r.wins) };
    }).sort((a: Standing, b: Standing) => a.position - b.position) };
  }
  async result(year: number, round: number): Promise<boolean> {
    const data = await this.request(`${year}/${round}/results.json?limit=100`);
    const races = data.RaceTable?.Races;
    if (!Array.isArray(races)) throw new Error('Ogiltigt resultatformat');
    if (!races.length) return false;
    if (Number(races[0].round) !== round || !Array.isArray(races[0].Results)) throw new Error('Ogiltigt loppresultat');
    return races[0].Results.length > 0;
  }
}
