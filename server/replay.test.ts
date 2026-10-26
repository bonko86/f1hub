import test from 'node:test';
import assert from 'node:assert/strict';
import { replaySnapshot } from './replay.js';
import { projectChampionship } from '../shared/championship.js';

test('local replay uses the live normalizer and exercises race scenarios', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const start = replaySnapshot(0, now);
  assert.equal(start.live.status, 'live'); assert.ok(start.live.rows.length >= 10);
  assert.equal(start.live.battles?.[0].change, null);
  const race = replaySnapshot(15, now);
  assert.ok(race.live.battles!.some(battle => battle.change! < 0));
  assert.ok(projectChampionship(race.baseline, race.live, now).drivers.length >= 10);
  const pit = replaySnapshot(20, now);
  assert.ok(pit.live.rows.some(row => row.driverStatus === 'pit'));
  const changedTyres = replaySnapshot(35, now);
  assert.ok(changedTyres.live.tyres?.some(driver => driver.stints.length === 2));
  assert.notEqual(replaySnapshot(40, now).live.rows[0].code, start.live.rows[0].code);
  assert.equal(replaySnapshot(60, now).live.trackStatus, 'safety-car');
  assert.deepEqual(replaySnapshot(60, now).live.battles, []);
  assert.equal(replaySnapshot(80, now).live.sessionPhase, 'suspended');
  assert.equal(replaySnapshot(100, now).live.trackStatus, 'green');
  assert.equal(replaySnapshot(120, now).live.status, 'stale');
  assert.equal(replaySnapshot(140, now).live.status, 'offline');
  assert.equal(replaySnapshot(160, now).live.status, 'waiting');
  assert.deepEqual(replaySnapshot(120, now).live.rows, []);
});

test('seeking is deterministic, does not mutate the recording or other playback sessions', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const original = replaySnapshot(15, now);
  replaySnapshot(90, now); replaySnapshot(165, now);
  assert.deepEqual(replaySnapshot(15, now), original);
  const another = replaySnapshot(15, now + 100000);
  assert.deepEqual(another.live.rows, original.live.rows);
  assert.deepEqual(another.live.battles, original.live.battles);
  assert.equal(another.live.status, 'live');
});
