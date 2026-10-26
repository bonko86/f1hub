import type { Dashboard, LiveRace, Standing } from './types.js';

export interface ProjectedStanding { name: string; code?: string; base: number; gained: number; total: number; rank: number }
export type ProjectionReason = 'waiting' | 'baseline' | 'sprint' | 'classification' | 'teams';
export interface Projection { drivers: ProjectedStanding[]; constructors: ProjectedStanding[]; reason?: ProjectionReason; constructorReason?: ProjectionReason }
// Full GP points: https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-formula-1-weekend.5RFZzGXNhEi9AEuMXwo987
// Explicit full-distance forecast, not a calculation for an early race termination.
const points2026 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const numericPoints = (row: Standing) => /^\d+(?:\.\d+)?$/.test(row.points) && Number.isFinite(Number(row.points));
const normalise = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
function sameTeam(a: string, b: string) {
  const aliases: Record<string, string> = { redbullracing: 'redbull', haasf1team: 'haas', rbf1team: 'racingbulls', rb: 'racingbulls' };
  const canonical = (name: string) => aliases[normalise(name)] || normalise(name);
  return canonical(a) === canonical(b);
}
function rank(rows: ProjectedStanding[]) {
  rows.sort((a, b) => b.total - a.total);
  let position = 0;
  return rows.map((row, index) => { if (index === 0 || row.total !== rows[index - 1].total) position = index + 1; return { ...row, rank: position }; });
}
export function projectChampionship(base: Dashboard | null, live: LiveRace, now = Date.now()): Projection {
  const blocked = (reason: ProjectionReason): Projection => ({ drivers: [], constructors: [], reason });
  const race = base?.race;
  const age = now - Date.parse(live.updatedAt || '');
  if (!base || !race || live.status !== 'live' || live.sessionPhase !== 'racing' || !Number.isFinite(age) || age >= 45000 || age < -10000 || live.raceName !== race.name) return blocked('waiting');
  if (race.sessions.some(session => session.kind === 'Sprint' || session.name === 'Sprint')) return blocked('sprint');
  // This model is intentionally scoped to verified 2026 full-distance GP rules.
  if (base.loading || race.season !== 2026 || base.season !== race.season || base.standingsRound.drivers !== race.round - 1 || !base.drivers.length || base.drivers.some(row => !numericPoints(row))) return blocked('baseline');
  const scoring = [...live.rows].filter(row => row.position <= 10).sort((a, b) => a.position - b.position);
  if (scoring.length !== 10 || scoring.some((row, index) => row.position !== index + 1 || !['running', 'pit', 'pit-out'].includes(row.driverStatus)) || new Set(live.rows.map(row => row.code)).size !== live.rows.length) return blocked('classification');
  const codes = base.drivers.map(row => row.code).filter(Boolean);
  if (new Set(codes).size !== codes.length || scoring.some(row => !base.drivers.some(driver => driver.code === row.code))) return blocked('classification');
  const gains = new Map(scoring.map(row => [row.code, points2026[row.position - 1]]));
  const drivers = rank(base.drivers.map(row => ({ name: row.name, code: row.code, base: Number(row.points), gained: gains.get(row.code || '') || 0, total: Number(row.points) + (gains.get(row.code || '') || 0), rank: 0 })));
  if (base.standingsRound.constructors !== race.round - 1 || !base.constructors.length || base.constructors.some(row => !numericPoints(row) || row.teamIds?.length !== 1) || new Set(base.constructors.map(row => row.teamIds?.[0])).size !== base.constructors.length) return { drivers, constructors: [], constructorReason: 'baseline' };
  const teamGains = new Map<string, number>();
  for (const row of scoring) {
    const driver = base.drivers.find(driver => driver.code === row.code)!;
    const id = driver.teamIds?.length === 1 ? driver.teamIds[0] : undefined;
    if (!id || !sameTeam(driver.team, row.team) || !base.constructors.some(team => team.teamIds?.[0] === id)) return { drivers, constructors: [], constructorReason: 'teams' };
    teamGains.set(id, (teamGains.get(id) || 0) + points2026[row.position - 1]);
  }
  const constructors = rank(base.constructors.map(row => ({ name: row.name, base: Number(row.points), gained: teamGains.get(row.teamIds![0]) || 0, total: Number(row.points) + (teamGains.get(row.teamIds![0]) || 0), rank: 0 })));
  return { drivers, constructors };
}
