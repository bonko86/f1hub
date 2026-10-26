import type { LiveRace, LiveRow, TyreStint } from '../shared/types.js';
import { BattleTracker } from './battles.js';

type State = Record<string, any>;
const topics = ['Heartbeat', 'DriverList', 'TimingData', 'SessionInfo', 'SessionData', 'LapCount', 'TrackStatus', 'RaceControlMessages', 'TimingAppData'];
function collection(value: unknown): [string, State][] {
  return value && typeof value === 'object' ? Object.entries(value).filter((entry): entry is [string, State] => /^\d+$/.test(entry[0]) && !!entry[1] && typeof entry[1] === 'object') : [];
}
function stints(value: unknown): TyreStint[] {
  return collection(value).sort(([a], [b]) => Number(a) - Number(b)).map(([key, stint]) => ({
    number: Number(key) + 1,
    compound: ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].includes(stint.Compound) ? stint.Compound : 'UNKNOWN',
    laps: stint.TotalLaps != null && stint.TotalLaps !== '' && Number.isInteger(Number(stint.TotalLaps)) && Number(stint.TotalLaps) >= 0 ? Number(stint.TotalLaps) : null,
    newTyres: stint.New == null ? null : ['true', '1', true, 1].includes(stint.New) ? true : ['false', '0', false, 0].includes(stint.New) ? false : null
  }));
}
const positiveInteger = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const timingText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= 32 ? text : null;
};
const flag = (value: unknown) => value === true || value === 'true' || value === 1 || value === '1';
export function mergeLive(target: State, patch: State) {
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      mergeLive(target[key], value);
    } else target[key] = value;
  }
}
export function liveSnapshot(state: State, connected: boolean, expectedRace: string | undefined, now = Date.now()): LiveRace {
  const session = state.SessionInfo;
  const statuses = Object.values(state.SessionData?.StatusSeries || {}) as State[];
  const status = statuses.filter(s => s.SessionStatus).at(-1)?.SessionStatus || session?.SessionStatus;
  const heartbeat = Date.parse(state.Heartbeat?.Utc || '');
  const fresh = Number.isFinite(heartbeat) && now - heartbeat < 45000 && now - heartbeat >= -10000;
  const sameRace = !!expectedRace && session?.Meeting?.Name === expectedRace && session?.Name === 'Race';
  const rows = Object.entries(state.TimingData?.Lines || {}).flatMap(([number, value]) => {
    const line = value as State; const driver = state.DriverList?.[number];
    const position = Number(line.Position);
    const driverStatus: LiveRow['driverStatus'] = flag(line.Retired) ? 'retired' : flag(line.InPit) ? 'pit' : flag(line.PitOut) ? 'pit-out' : flag(line.Stopped) ? 'stopped' : 'running';
    return driver?.Tla && driver?.TeamName && Number.isInteger(position) && position > 0 ? [{
      position, code: String(driver.Tla), team: String(driver.TeamName), driverStatus,
      gapToLeader: timingText(line.GapToLeader), interval: timingText(line.IntervalToPositionAhead?.Value),
      lastLap: timingText(line.LastLapTime?.Value)
    }] : [];
  }).sort((a, b) => a.position - b.position);
  const active = ['Started', 'Aborted', 'Suspended'].includes(status);
  const live = connected && fresh && sameRace && active && rows.length > 0;
  const trackCodes: Record<string, NonNullable<LiveRace['trackStatus']>> = { '1': 'green', '2': 'yellow', '4': 'safety-car', '5': 'red', '6': 'vsc', '7': 'vsc-ending' };
  const messages = live ? collection(state.RaceControlMessages?.Messages).flatMap(([id, message]) => {
    if (typeof message.Message !== 'string' || !message.Message.trim()) return [];
    // The feed's UTC timestamps may omit the timezone suffix.
    const rawTime = typeof message.Utc === 'string' ? message.Utc : '';
    const time = Date.parse(rawTime && !/(Z|[+-]\d\d:\d\d)$/i.test(rawTime) ? `${rawTime}Z` : rawTime);
    return [{ id, time: Number.isFinite(time) ? new Date(time).toISOString() : null, lap: positiveInteger(message.Lap), text: message.Message.trim().slice(0, 2000) }];
  }).sort((a, b) => (Date.parse(b.time || '') || 0) - (Date.parse(a.time || '') || 0) || Number(b.id) - Number(a.id)).slice(0, 50) : [];
  const tyres = live ? Object.entries(state.TimingAppData?.Lines || {}).flatMap(([number, line]) => {
    const code = state.DriverList?.[number]?.Tla;
    const row = rows.find(row => row.code === code);
    return row ? [{ code: row.code, position: row.position, stints: stints((line as State)?.Stints) }] : [];
  }).sort((a, b) => a.position - b.position) : [];
  return {
    status: live ? 'live' : !connected ? 'offline' : sameRace && active && !fresh ? 'stale' : 'waiting',
    updatedAt: Number.isFinite(heartbeat) ? new Date(heartbeat).toISOString() : null,
    raceName: live ? session.Meeting.Name : null, rows: live ? rows : [],
    currentLap: live ? positiveInteger(state.LapCount?.CurrentLap) : null,
    totalLaps: live ? positiveInteger(state.LapCount?.TotalLaps) : null,
    sessionPhase: live ? status === 'Started' ? 'racing' : 'suspended' : null,
    trackStatus: live ? trackCodes[String(state.TrackStatus?.Status)] || 'unknown' : 'unknown',
    messages, tyres
  };
}

export class LiveTiming {
  private battles = new BattleTracker();
  private state: State = {};
  private connected = false;
  private stopped = false;
  private controller: AbortController | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  snapshot(expectedRace?: string) {
    const data = liveSnapshot(this.state, this.connected, expectedRace);
    return { ...data, battles: this.battles.update(data) };
  }
  start() { void this.connect(); }
  stop() { this.stopped = true; this.controller?.abort(); clearTimeout(this.retry); }
  private async connect() {
    if (this.stopped) return;
    const controller = this.controller = new AbortController();
    let watchdog = setTimeout(() => controller.abort(), 30000);
    const resetTimeout = () => { clearTimeout(watchdog); watchdog = setTimeout(() => controller.abort(), 30000); };
    const base = 'https://livetiming.formula1.com/signalrcore';
    try {
      const negotiation = await fetch(`${base}/negotiate?negotiateVersion=1`, { method: 'POST', signal: controller.signal });
      if (!negotiation.ok) throw new Error(`Förhandling HTTP ${negotiation.status}`);
      const data = await negotiation.json() as State;
      if (!data.connectionToken || !data.availableTransports?.some((t: State) => t.transport === 'ServerSentEvents')) throw new Error('SSE saknas');
      const url = `${base}?id=${encodeURIComponent(data.connectionToken)}`;
      const cookie = negotiation.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
      const headers: Record<string, string> = cookie ? { Cookie: cookie } : {};
      const stream = await fetch(url, { headers: { ...headers, Accept: 'text/event-stream' }, signal: controller.signal });
      if (!stream.ok || !stream.body) throw new Error(`Ström HTTP ${stream.status}`);
      for (const body of ['{"protocol":"json","version":1}\x1e', JSON.stringify({ type: 1, invocationId: '0', target: 'Subscribe', arguments: [topics] }) + '\x1e']) {
        const response = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body, signal: controller.signal });
        if (!response.ok) throw new Error(`Prenumeration HTTP ${response.status}`);
      }
      this.state = {}; this.connected = false;
      const decoder = new TextDecoder(); let buffer = '';
      const reader = stream.body.getReader();
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        resetTimeout(); buffer += decoder.decode(chunk, { stream: true });
        if (buffer.length > 4000000) throw new Error('För stor meddelanderad');
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
          if (!line.startsWith('data:')) continue;
          for (const segment of line.slice(5).trim().split('\x1e')) {
            if (!segment) continue;
            const frame = JSON.parse(segment) as State;
            if (frame.error) throw new Error('Livekällan avvisade prenumerationen');
            if (frame.type === 7) throw new Error('Livekällan stängde anslutningen');
            if (frame.type === 3 && frame.invocationId === '0' && frame.result) { mergeLive(this.state, frame.result); this.connected = true; }
            if (frame.type === 1 && frame.target === 'feed' && Array.isArray(frame.arguments)) {
              const [channel, payload] = frame.arguments;
              if (topics.includes(channel) && payload && typeof payload === 'object') { this.state[channel] ??= {}; mergeLive(this.state[channel], payload); }
            }
          }
        }
      }
    } catch { if (!this.stopped) console.error('[live] Anslutningen avbröts. Försöker igen om 30 sekunder.'); }
    finally {
      clearTimeout(watchdog); controller.abort(); this.connected = false;
      if (!this.stopped) this.retry = setTimeout(() => void this.connect(), 30000);
    }
  }
}
