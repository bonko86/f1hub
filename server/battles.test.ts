import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleTracker } from './battles.js';
import type { LiveRace } from '../shared/types.js';

const start = Date.parse('2026-10-25T20:00:00Z');
function snapshot(second: number, interval = '+1.5'): LiveRace {
  return { status: 'live', updatedAt: new Date(start + second * 1000).toISOString(), raceName: 'Test GP', trackStatus: 'green', sessionPhase: 'racing', rows: [
    { position: 1, code: 'VER', team: 'Red Bull', driverStatus: 'running', gapToLeader: null, interval: null, lastLap: null },
    { position: 2, code: 'NOR', team: 'McLaren', driverStatus: 'running', gapToLeader: interval, interval, lastLap: null }
  ] };
}
const update = (tracker: BattleTracker, second: number, interval?: string) => tracker.update(snapshot(second, interval), start + second * 1000);

test('battles require numeric gaps strictly below two seconds and sufficient unique history', () => {
  const tracker = new BattleTracker();
  assert.equal(update(tracker, 0)[0].change, null);
  assert.equal(update(tracker, 0)[0].change, null);
  assert.equal(update(tracker, 5, '+1.4')[0].change, null);
  const closing = update(tracker, 10, '+1.1')[0];
  assert.ok(Math.abs(closing.change! + 0.4) < 0.0001); assert.equal(closing.windowSeconds, 10);
  assert.deepEqual(update(tracker, 15, '+2.000'), []);
  assert.deepEqual(update(tracker, 20, '+1 LAP'), []);
  assert.equal(update(tracker, 25, '+1.2')[0].change, null);
  for (const value of ['', 'NaN', '-1', '0', '1.2 seconds', '+2 LAPS']) assert.deepEqual(update(tracker, 30, value), []);
});

test('neutralisation, old data, changed opponent and race reset battle history', () => {
  for (const trackStatus of ['yellow', 'safety-car', 'vsc', 'vsc-ending', 'red', 'unknown'] as const) {
    const tracker = new BattleTracker(); update(tracker, 0);
    assert.deepEqual(tracker.update({ ...snapshot(5), trackStatus }, start + 5000), []);
    assert.equal(update(tracker, 10)[0].change, null);
  }
  const tracker = new BattleTracker(); update(tracker, 0);
  assert.deepEqual(tracker.update(snapshot(0), start + 45000), []);
  assert.equal(update(tracker, 50)[0].change, null);
  const changed = snapshot(60); changed.rows[0].code = 'LEC';
  assert.equal(tracker.update(changed, start + 60000)[0].change, null);
  assert.equal(tracker.update({ ...snapshot(70), raceName: 'Other GP' }, start + 70000)[0].change, null);
  assert.deepEqual(tracker.update({ ...snapshot(75), sessionPhase: 'suspended' }, start + 75000), []);
});

test('lapped cars, pits, retired and missing adjacent positions are excluded', () => {
  for (const index of [0, 1]) {
    for (const driverStatus of ['pit', 'pit-out', 'retired', 'stopped'] as const) {
      const data = snapshot(0); data.rows[index].driverStatus = driverStatus;
      assert.deepEqual(new BattleTracker().update(data, start), []);
    }
    const lapped = snapshot(0); lapped.rows[index].gapToLeader = '+1 LAP';
    assert.deepEqual(new BattleTracker().update(lapped, start), []);
  }
  const gap = snapshot(0); gap.rows[1].position = 3;
  assert.deepEqual(new BattleTracker().update(gap, start), []);
});

test('history remains limited to thirty seconds', () => {
  const tracker = new BattleTracker();
  for (let second = 0; second <= 60; second += 5) update(tracker, second, `+${1.9 - second / 100}`);
  const result = update(tracker, 60, '+1.3')[0];
  assert.equal(result.windowSeconds, 30); assert.ok(Math.abs(result.change! + 0.3) < 0.0001);
});
