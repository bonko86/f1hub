import test from 'node:test';
import assert from 'node:assert/strict';
import { projectChampionship } from '../shared/championship.js';
import type { Dashboard, LiveRace } from '../shared/types.js';

function fixture() {
  const now = Date.parse('2026-11-01T21:30:00Z');
  const drivers = Array.from({ length: 10 }, (_, i) => ({ position: i + 1, name: `Driver ${i}`, code: `D${i}`, points: '100', wins: 0, team: `Team ${Math.floor(i / 2)}`, teamIds: [`team${Math.floor(i / 2)}`] }));
  const constructors = Array.from({ length: 5 }, (_, i) => ({ position: i + 1, name: `Team ${i}`, team: `Team ${i}`, teamIds: [`team${i}`], points: '200', wins: 0 }));
  const base: Dashboard = { loading: false, season: 2026, race: { season: 2026, round: 19, name: 'Test GP', circuit: 'Test', country: 'Test', locality: 'Test', date: '2026-11-01', start: null, sessions: [] }, drivers, constructors, standingsRound: { drivers: 18, constructors: 18 }, calendar: [], calendarSeason: 2026, completedRounds: [], status: 'awaiting-results', updated: {}, errors: [] };
  const live: LiveRace = { status: 'live', raceName: 'Test GP', updatedAt: new Date(now).toISOString(), sessionPhase: 'racing', trackStatus: 'green', rows: drivers.map(row => ({ position: row.position, code: row.code!, team: row.team, driverStatus: 'running', interval: null, gapToLeader: null, lastLap: null })) };
  return { base, live, now };
}
test('projection applies full GP points once to drivers and the sum to each constructor', () => {
  const { base, live, now } = fixture();
  const result = projectChampionship(base, live, now);
  assert.equal(result.reason, undefined); assert.equal(result.constructorReason, undefined);
  assert.deepEqual(result.drivers.map(row => row.gained), [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
  assert.equal(result.drivers[0].total, 125); assert.equal(result.constructors[0].gained, 43);
  assert.equal(result.constructors[0].total, 243);
  assert.deepEqual(projectChampionship(base, live, now), result);
  assert.equal(base.drivers[0].points, '100');
});
test('projection refuses included race points, older baselines, sprint weekends and mismatched sessions', () => {
  for (const round of [17, 19, null]) {
    const { base, live, now } = fixture(); base.standingsRound.drivers = round;
    assert.equal(projectChampionship(base, live, now).reason, 'baseline');
  }
  const { base, live, now } = fixture();
  base.race!.sessions = [{ name: 'Sprint', kind: 'Sprint', date: '2026-10-31', start: null }];
  assert.equal(projectChampionship(base, live, now).reason, 'sprint');
  assert.equal(projectChampionship(base, { ...live, raceName: 'Other GP' }, now).reason, 'waiting');
  assert.equal(projectChampionship(base, live, now + 45000).reason, 'waiting');
  assert.equal(projectChampionship(base, { ...live, sessionPhase: 'suspended' }, now).reason, 'waiting');
});
test('incomplete or ambiguous scoring positions and unknown drivers do not produce totals', () => {
  for (const mutate of [(live: LiveRace) => { live.rows.pop(); }, (live: LiveRace) => { live.rows[0].driverStatus = 'retired'; }, (live: LiveRace) => { live.rows[0].code = 'NEW'; }, (live: LiveRace) => { live.rows[0].position = 2; }]) {
    const { base, live, now } = fixture(); mutate(live);
    assert.equal(projectChampionship(base, live, now).reason, 'classification');
  }
});
test('constructor matching can be withheld independently and ties share a provisional rank', () => {
  const { base, live, now } = fixture();
  live.rows[0].team = 'Other team';
  const result = projectChampionship(base, live, now);
  assert.equal(result.drivers.length, 10); assert.equal(result.constructorReason, 'teams'); assert.deepEqual(result.constructors, []);
  base.drivers[1].points = '107';
  const tied = projectChampionship(base, live, now);
  assert.equal(tied.drivers[0].total, tied.drivers[1].total); assert.equal(tied.drivers[0].rank, 1); assert.equal(tied.drivers[1].rank, 1); assert.equal(tied.drivers[2].rank, 3);
});
