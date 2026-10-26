import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { liveSnapshot } from './live.js';
import { BattleTracker } from './battles.js';
import type { Dashboard, Standing } from '../shared/types.js';

let fixture: any;
const load = () => fixture ??= JSON.parse(readFileSync(resolve('server/fixtures/race-snapshot.json'), 'utf8'));
export const replayDuration = 180;
export function replaySnapshot(second: number, now = Date.now()) {
  second = Math.max(0, Math.min(replayDuration, Math.floor(second)));
  const recording = load();
  const original = recording.state;
  const raceName = original.SessionInfo.Meeting.Name;
  const phase = second < 20 ? 'racing' : second < 40 ? 'pit' : second < 60 ? 'positions' : second < 80 ? 'safety-car' : second < 100 ? 'red' : second < 120 ? 'restart' : second < 140 ? 'stale' : second < 160 ? 'offline' : 'finished';
  const drivers = Object.entries(original.TimingData.Lines).sort(([, a], [, b]) => Number((a as any).Position) - Number((b as any).Position)).map(([id]) => ({ id, ...original.DriverList[id] })).filter(driver => driver.Tla && driver.TeamName);
  function frame(at: number, time: number) {
    const state = structuredClone(original);
    state.Heartbeat = { Utc: new Date(time - (at >= 120 && at < 140 ? 60000 : 0)).toISOString() };
    state.SessionData = {};
    state.SessionInfo.SessionStatus = at >= 160 ? 'Finalised' : at >= 80 && at < 100 ? 'Aborted' : 'Started';
    state.TrackStatus = { Status: at >= 60 && at < 80 ? '4' : at >= 80 && at < 100 ? '5' : '1' };
    state.LapCount = { CurrentLap: 20 + Math.floor(at / 10), TotalLaps: 56 };
    state.TimingData = { Lines: {} }; state.TimingAppData = { Lines: {} };
    drivers.forEach((driver, index) => {
      const position = at >= 40 && index < 2 ? 2 - index : index + 1;
      state.TimingData.Lines[driver.id] = { Position: String(position), GapToLeader: index === drivers.length - 1 ? '+1 LAP' : position === 1 ? '' : `+${(position * 1.2).toFixed(3)}`, IntervalToPositionAhead: { Value: `+${index < 2 ? (1.8 - (at % 40) * .03).toFixed(3) : '2.500'}` }, LastLapTime: { Value: '1:40.123' }, Retired: false, Stopped: false, PitOut: false, InPit: at >= 20 && at < 30 && index === 1 };
      state.TimingAppData.Lines[driver.id] = { Stints: index === 1 && at >= 30 ? [{ Compound: 'MEDIUM', TotalLaps: 20, New: 'true' }, { Compound: 'HARD', TotalLaps: Math.floor((at - 30) / 10), New: 'true' }] : [{ Compound: 'MEDIUM', TotalLaps: 20 + Math.floor(at / 10), New: 'true' }] };
    });
    const events = [{ second: 0, text: 'TEST: GREEN FLAG' }, { second: 20, text: 'TEST: PIT STOP' }, { second: 40, text: 'TEST: POSITION CHANGE' }, { second: 60, text: 'TEST: SAFETY CAR DEPLOYED' }, { second: 80, text: 'TEST: RED FLAG' }, { second: 100, text: 'TEST: SESSION RESUMED' }];
    state.RaceControlMessages = { Messages: events.filter(event => event.second <= at).map(event => ({ Utc: new Date(time - (at - event.second) * 1000).toISOString(), Lap: 20 + Math.floor(event.second / 10), Message: event.text })) };
    return liveSnapshot(state, !(at >= 140 && at < 160), raceName, time);
  }
  const tracker = new BattleTracker();
  for (let at = Math.max(0, second - 30); at < second; at++) {
    const time = now - (second - at) * 1000;
    tracker.update(frame(at, time), time);
  }
  const live = frame(second, now); live.battles = tracker.update(live, now);
  const standings: Standing[] = drivers.map((driver, index) => ({ position: index + 1, code: driver.Tla, name: `${driver.FirstName || ''} ${driver.LastName || driver.Tla}`.trim(), team: driver.TeamName, teamIds: [driver.TeamName], points: String(200 - index * 5), wins: 0 }));
  const teams = [...new Set(standings.map(driver => driver.team))];
  const baseline: Dashboard = { loading: false, season: 2026, calendarSeason: 2026, calendar: [], completedRounds: [], race: { season: 2026, round: 2, name: raceName, circuit: original.SessionInfo.Meeting.Circuit.ShortName, country: '', locality: '', date: '2026-10-25', start: null, sessions: [] }, status: 'awaiting-results', drivers: standings, constructors: teams.map((team, index) => ({ position: index + 1, name: team, team, teamIds: [team], points: String(400 - index * 10), wins: 0 })), standingsRound: { drivers: 1, constructors: 1 }, updated: {}, errors: [] };
  return { live, baseline, phase, duration: replayDuration, recordedRace: raceName, recordedAt: recording.recordedAt };
}
