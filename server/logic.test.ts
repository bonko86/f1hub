import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeRace, Jolpica } from './jolpica.js';
import { Cache } from './cache.js';
import { selectRace, Service } from './service.js';
import { countdown, stockholm } from '../shared/time.js';
test('förare med flera lag använder endast laget från senaste omgången', async () => {
  const api = new Jolpica('https://example.com/');
  const old = { constructorId: 'red_bull', name: 'Red Bull' };
  const current = { constructorId: 'rb', name: 'RB F1 Team' };
  api.request = async path => path.includes('driverstandings')
    ? { total: '1', StandingsTable: { StandingsLists: [{ round: '17', DriverStandings: [{ position: '9', points: '75', wins: '0', Driver: { driverId: 'lawson', givenName: 'Liam', familyName: 'Lawson', code: 'LAW', nationality: 'New Zealander' }, Constructors: [old, current] }] }] } }
    : { total: '2', RaceTable: { Races: [{ round: '17', Results: [{ Constructor: current }] }, { round: '1', Results: [{ Constructor: old }] }] } };
  const standings = await api.standings(2026, 'drivers');
  assert.deepEqual(standings.rows[0].teamIds, ['rb']);
  assert.equal(standings.rows[0].team, 'RB F1 Team');
});
const raw = (round = 1) => ({ season: '2026', round: String(round), raceName: 'Test GP', date: '2026-03-29', time: '13:00:00Z', Circuit: { circuitName: 'Test Circuit', Location: { country: 'Test', locality: 'Test' } }, FirstPractice: { date: '2026-03-27', time: '12:00:00Z' }, Qualifying: { date: '2026-03-28', time: '13:00:00Z' } });
test('normal helg och sprinthelg använder bara publicerade sessioner', () => {
  assert.deepEqual(normalizeRace(raw()).sessions.map(s => s.name), ['Träning 1', 'Kvalificering', 'Race']);
  const sprint = normalizeRace({ ...raw(), SprintQualifying: { date: '2026-03-27', time: '16:00:00Z' }, Sprint: { date: '2026-03-28', time: '09:00:00Z' } });
  assert.equal(sprint.sessions.length, 5); assert.equal(sprint.sessions[1].name, 'Sprintkval');
  assert.equal(normalizeRace({ ...raw(), time: undefined }).start, null);
});
test('starttid innebär inte avslut; publicerade resultat flyttar loppet', () => {
  const races = [normalizeRace(raw()), normalizeRace(raw(2))];
  assert.equal(selectRace(races, new Set())?.round, 1);
  assert.equal(selectRace(races, new Set([1]))?.round, 2);
  assert.equal(selectRace(races, new Set([1, 2])), null);
});
test('Stockholm hanterar både sommar- och vintertidsövergång', () => {
  const fmt = (s: string) => stockholm(s, { hour: '2-digit', minute: '2-digit' });
  assert.equal(fmt('2026-03-29T00:30:00Z'), '01:30'); assert.equal(fmt('2026-03-29T01:30:00Z'), '03:30');
  assert.equal(fmt('2026-10-25T00:30:00Z'), '02:30'); assert.equal(fmt('2026-10-25T01:30:00Z'), '02:30');
  assert.equal(countdown('2026-03-29T13:00:00Z', Date.parse('2026-03-28T08:28:00Z')), '1 d 4 h 32 min');
});
test('SQLite är persistent och backup är läsbar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'f1-test-')); const path = join(dir, 'test.sqlite');
  const c = new Cache(path); c.set('test', [1, 2]); await c.db.backup(join(dir, 'backup.sqlite')); c.db.close();
  const reopened = new Cache(path); assert.deepEqual(reopened.get('test')?.value, [1, 2]); reopened.db.close();
  const backup = new Cache(join(dir, 'backup.sqlite')); assert.deepEqual(backup.get('test')?.value, [1, 2]); backup.db.close(); rmSync(dir, { recursive: true });
});
test('API-fel bevarar cache, hindrar parallell uppdatering och besökare hämtar ingen extern data', async () => {
  const cache = new Cache(':memory:'); let calls = 0;
  const api = { calendar: async () => { calls++; throw new Error('Testfel'); }, standings: async () => { throw new Error('Testfel'); } } as unknown as Jolpica;
  cache.set('calendar:2026', [normalizeRace(raw())]);
  cache.db.prepare('UPDATE cache SET updated=?').run('2020-01-01T00:00:00Z');
  const service = new Service(cache, api);
  await Promise.all([service.tick(new Date('2026-01-01')), service.tick(new Date('2026-01-01'))]);
  const count = calls; const state = service.dashboard(new Date('2026-01-01')); service.dashboard();
  assert.equal(calls, count); assert.equal(calls, 3); assert.equal(state.race?.round, 1); assert.ok(state.errors.length); cache.db.close();
});
test('nyår behåller föregående lopp tills resultat finns; nästa kalender kan visas efter finalen', () => {
  const cache = new Cache(':memory:'); const race = normalizeRace({ ...raw(), season: '2025', date: '2025-12-31' });
  cache.set('calendar:2025', [race]); cache.set('calendar:2026', [normalizeRace(raw())]);
  const service = new Service(cache, {} as Jolpica);
  assert.equal(service.dashboard(new Date('2026-01-01')).race?.season, 2025);
  cache.set('result:2025:1', true);
  assert.equal(service.dashboard(new Date('2026-01-01')).race?.season, 2026);
  cache.set('result:2026:1', true); assert.equal(service.dashboard(new Date('2026-12-31')).status, 'season-ended'); cache.db.close();
});
test('uppdatering växlar först när resultat publiceras och cachar avslutade lopp', async () => {
  const cache = new Cache(':memory:'); let published = false; const checked: number[] = [];
  const api = {
    calendar: async (year: number) => year === 2026 ? [normalizeRace(raw()), normalizeRace(raw(2))] : [],
    standings: async () => ({ round: null, rows: [] }),
    result: async (_year: number, round: number) => { checked.push(round); return published && round === 1; }
  } as unknown as Jolpica;
  const now = new Date('2026-04-01');
  const service = new Service(cache, api); await service.tick(now);
  assert.equal(service.dashboard(now).status, 'awaiting-results'); assert.equal(service.dashboard(now).race?.round, 1);
  published = true; cache.db.prepare("UPDATE cache SET updated='2020-01-01T00:00:00Z' WHERE key LIKE 'result:%'").run();
  const restarted = new Service(cache, api); await restarted.tick(now);
  assert.equal(restarted.dashboard(now).race?.round, 2);
  const count = checked.filter(r => r === 1).length;
  await new Service(cache, api).tick(now);
  assert.equal(checked.filter(r => r === 1).length, count); cache.db.close();
});
test('felaktig kalender avvisas istället för att ersätta sparad data', () => {
  assert.throws(() => normalizeRace({ ...raw(), Circuit: null }));
  assert.throws(() => normalizeRace({ ...raw(), time: 'ogiltigt' }));
});
