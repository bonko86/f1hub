import test from 'node:test';
import assert from 'node:assert/strict';
import { liveSnapshot, mergeLive } from './live.js';

test('livepositioner kräver rätt race, pågående session och färsk heartbeat', () => {
  const now = Date.parse('2026-10-25T20:10:00Z');
  const state = { Heartbeat: { Utc: new Date(now).toISOString() }, SessionInfo: { Name: 'Race', Meeting: { Name: 'United States Grand Prix' }, SessionStatus: 'Started' }, DriverList: { '1': { Tla: 'VER', TeamName: 'Red Bull Racing' } }, TimingData: { Lines: { '1': { Position: '1' } } } };
  const result = liveSnapshot(state, true, 'United States Grand Prix', now);
  assert.equal(result.status, 'live'); assert.deepEqual(result.rows, [{ position: 1, code: 'VER', team: 'Red Bull Racing' }]);
  assert.equal(liveSnapshot(state, false, 'United States Grand Prix', now).rows.length, 0);
  assert.equal(liveSnapshot(state, true, 'Mexican Grand Prix', now).rows.length, 0);
  assert.equal(liveSnapshot(state, true, 'United States Grand Prix', now + 60000).status, 'stale');
  assert.equal(liveSnapshot({ ...state, SessionData: { StatusSeries: [{ SessionStatus: 'Started' }, { SessionStatus: 'Finished' }] } }, true, 'United States Grand Prix', now).status, 'waiting');
});
test('deltauppdatering bevarar föraruppgifter och ändrar position', () => {
  const state = { TimingData: { Lines: { '1': { Position: '2', Retired: false } } } };
  mergeLive(state, { TimingData: { Lines: { '1': { Position: '1' } } } });
  assert.deepEqual(state.TimingData.Lines['1'], { Position: '1', Retired: false });
});
