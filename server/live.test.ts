import test from 'node:test';
import assert from 'node:assert/strict';
import { liveSnapshot, mergeLive } from './live.js';

test('livepositioner kräver rätt race, pågående session och färsk heartbeat', () => {
  const now = Date.parse('2026-10-25T20:10:00Z');
  const state = { Heartbeat: { Utc: new Date(now).toISOString() }, SessionInfo: { Name: 'Race', Meeting: { Name: 'United States Grand Prix' }, SessionStatus: 'Started' }, DriverList: { '1': { Tla: 'VER', TeamName: 'Red Bull Racing' } }, TimingData: { Lines: { '1': { Position: '1' } } } };
  const result = liveSnapshot(state, true, 'United States Grand Prix', now);
  assert.equal(result.status, 'live'); assert.deepEqual(result.rows, [{ position: 1, code: 'VER', team: 'Red Bull Racing', gapToLeader: null, interval: null, lastLap: null, driverStatus: 'running' }]);
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

test('timing values, flag status and lap count are normalized without inventing missing data', () => {
  const now = Date.parse('2026-10-25T20:10:00Z');
  const state = {
    Heartbeat: { Utc: new Date(now).toISOString() },
    SessionInfo: { Name: 'Race', Meeting: { Name: 'Test GP' }, SessionStatus: 'Started' },
    DriverList: { '1': { Tla: 'VER', TeamName: 'Red Bull Racing' } },
    LapCount: { CurrentLap: '24', TotalLaps: 56 }, TrackStatus: { Status: '4' },
    TimingData: { Lines: { '1': { Position: '2', GapToLeader: '+12.5', IntervalToPositionAhead: { Value: '+1 LAP' }, LastLapTime: { Value: '1:40.123' }, InPit: 'true', Retired: 'false' } } }
  };
  const result = liveSnapshot(state, true, 'Test GP', now);
  assert.equal(result.currentLap, 24); assert.equal(result.totalLaps, 56);
  assert.equal(result.trackStatus, 'safety-car'); assert.equal(result.sessionPhase, 'racing');
  assert.deepEqual(result.rows[0], { position: 2, code: 'VER', team: 'Red Bull Racing', gapToLeader: '+12.5', interval: '+1 LAP', lastLap: '1:40.123', driverStatus: 'pit' });
  mergeLive(state, { TimingData: { Lines: { '1': { Retired: true } } }, TrackStatus: { Status: '99' }, LapCount: { CurrentLap: '' } });
  const changed = liveSnapshot(state, true, 'Test GP', now);
  assert.equal(changed.rows[0].driverStatus, 'retired'); assert.equal(changed.trackStatus, 'unknown'); assert.equal(changed.currentLap, null);
  for (const status of ['Finished', 'Finalised', 'Ends']) {
    const ended = liveSnapshot({ ...state, SessionInfo: { ...state.SessionInfo, SessionStatus: status } }, true, 'Test GP', now);
    assert.equal(ended.status, 'waiting'); assert.equal(ended.currentLap, null); assert.equal(ended.raceName, null); assert.deepEqual(ended.rows, []);
  }
  const stale = liveSnapshot(state, true, 'Test GP', now + 45000);
  assert.equal(stale.status, 'stale'); assert.equal(stale.currentLap, null); assert.equal(stale.trackStatus, 'unknown');
  const paused = liveSnapshot({ ...state, SessionInfo: { ...state.SessionInfo, SessionStatus: 'Aborted' }, TrackStatus: { Status: '5' } }, true, 'Test GP', now);
  assert.equal(paused.status, 'live'); assert.equal(paused.sessionPhase, 'suspended'); assert.equal(paused.trackStatus, 'red');
});

test('race control and tyre stints support array snapshots and keyed deltas, and disappear when stale', () => {
  const now = Date.parse('2026-10-25T20:10:00Z');
  const state = {
    Heartbeat: { Utc: new Date(now).toISOString() },
    SessionInfo: { Name: 'Race', Meeting: { Name: 'Test GP' }, SessionStatus: 'Started' },
    DriverList: { '1': { Tla: 'VER', TeamName: 'Red Bull' } },
    TimingData: { Lines: { '1': { Position: '1' } } },
    RaceControlMessages: { Messages: [{ Utc: '2026-10-25T20:08:00', Lap: 20, Message: 'YELLOW FLAG' }] },
    TimingAppData: { Lines: { '1': { Stints: [{ Compound: 'MEDIUM', TotalLaps: 16, New: 'true' }] } } }
  };
  mergeLive(state, {
    RaceControlMessages: { Messages: { '1': { Utc: '2026-10-25T20:09:00Z', Lap: '21', Message: 'GREEN FLAG' }, '2': { Message: '' } } },
    TimingAppData: { Lines: { '1': { Stints: { '1': { Compound: 'HARD', TotalLaps: 0, New: 'false' } } }, '99': { Stints: [{ Compound: 'SOFT' }] } } }
  });
  const result = liveSnapshot(state, true, 'Test GP', now);
  assert.deepEqual(result.messages?.map(message => [message.text, message.time, message.lap]), [
    ['GREEN FLAG', '2026-10-25T20:09:00.000Z', 21], ['YELLOW FLAG', '2026-10-25T20:08:00.000Z', 20]
  ]);
  assert.deepEqual(result.tyres, [{ code: 'VER', position: 1, stints: [
    { number: 1, compound: 'MEDIUM', laps: 16, newTyres: true }, { number: 2, compound: 'HARD', laps: 0, newTyres: false }
  ] }]);
  for (const snapshot of [liveSnapshot(state, true, 'Test GP', now + 60000), liveSnapshot(state, true, 'Other GP', now), liveSnapshot(state, false, 'Test GP', now), liveSnapshot({ ...state, SessionInfo: { ...state.SessionInfo, SessionStatus: 'Finalised' } }, true, 'Test GP', now)]) {
    assert.deepEqual(snapshot.messages, []); assert.deepEqual(snapshot.tyres, []);
  }
});

test('optional live details handle missing, invalid and bounded data', () => {
  const now = Date.now();
  const state = {
    Heartbeat: { Utc: new Date(now).toISOString() }, SessionInfo: { Name: 'Race', Meeting: { Name: 'Test GP' }, SessionStatus: 'Started' },
    DriverList: { '1': { Tla: 'VER', TeamName: 'Red Bull' } }, TimingData: { Lines: { '1': { Position: '1' } } },
    TimingAppData: { Lines: { '1': { Stints: { '0': { Compound: 'UNRECOGNISED', TotalLaps: -2, New: 'unknown' }, _kf: true } } } },
    RaceControlMessages: { Messages: Array.from({ length: 60 }, (_, index) => ({ Message: `Message ${index}`, Utc: 'invalid' })) }
  };
  const result = liveSnapshot(state, true, 'Test GP', now);
  assert.equal(result.messages?.length, 50); assert.equal(result.messages[0].text, 'Message 59'); assert.equal(result.messages[0].time, null);
  assert.deepEqual(result.tyres?.[0].stints, [{ number: 1, compound: 'UNKNOWN', laps: null, newTyres: null }]);
  const missing = liveSnapshot({ ...state, TimingAppData: undefined, RaceControlMessages: undefined }, true, 'Test GP', now);
  assert.deepEqual(missing.tyres, []); assert.deepEqual(missing.messages, []);
});
