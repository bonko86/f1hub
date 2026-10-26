import type { LiveRace } from '../shared/types.js';

type State = Record<string, any>;
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
    return driver?.Tla && driver?.TeamName && Number.isInteger(position) && position > 0 ? [{ position, code: String(driver.Tla), team: String(driver.TeamName) }] : [];
  }).sort((a, b) => a.position - b.position);
  const live = connected && fresh && sameRace && status === 'Started' && rows.length > 0;
  return { status: live ? 'live' : !connected ? 'offline' : sameRace && status === 'Started' && !fresh ? 'stale' : 'waiting', updatedAt: Number.isFinite(heartbeat) ? new Date(heartbeat).toISOString() : null, raceName: session?.Meeting?.Name || null, rows: live ? rows : [] };
}

export class LiveTiming {
  private state: State = {};
  private connected = false;
  private stopped = false;
  private controller: AbortController | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  snapshot(expectedRace?: string) { return liveSnapshot(this.state, this.connected, expectedRace); }
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
      for (const body of ['{"protocol":"json","version":1}\x1e', JSON.stringify({ type: 1, invocationId: '0', target: 'Subscribe', arguments: [['Heartbeat', 'DriverList', 'TimingData', 'SessionInfo', 'SessionData']] }) + '\x1e']) {
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
              if (['Heartbeat', 'DriverList', 'TimingData', 'SessionInfo', 'SessionData'].includes(channel) && payload && typeof payload === 'object') { this.state[channel] ??= {}; mergeLive(this.state[channel], payload); }
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
