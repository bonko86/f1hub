import type { LiveRace } from '../shared/types.js';

// Only explicit second values qualify; never parse '+1 LAP' as one second.
function seconds(value: string | null): number | null {
  if (!value || !/^\+?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
type Sample = { time: number; gap: number };
export class BattleTracker {
  private race: string | null = null;
  private lastTime = 0;
  private history = new Map<string, Sample[]>();
  update(data: LiveRace, now = Date.now()): NonNullable<LiveRace['battles']> {
    const time = Date.parse(data.updatedAt || '');
    const allowed = data.status === 'live' && data.trackStatus === 'green' && data.sessionPhase === 'racing' && !!data.raceName && Number.isFinite(time) && now - time < 45000 && now - time >= -10000;
    if (!allowed) { this.history.clear(); this.lastTime = 0; this.race = null; return []; }
    if (this.race !== data.raceName || time < this.lastTime || time - this.lastTime >= 45000) this.history.clear();
    this.race = data.raceName;
    const rows = [...data.rows].sort((a, b) => a.position - b.position);
    const active = new Set<string>();
    const battles: NonNullable<LiveRace['battles']> = [];
    for (let index = 1; index < rows.length; index++) {
      const ahead = rows[index - 1], behind = rows[index];
      if (behind.position !== ahead.position + 1 || ahead.driverStatus !== 'running' || behind.driverStatus !== 'running' || /lap/i.test(ahead.gapToLeader || '') || /lap/i.test(behind.gapToLeader || '')) continue;
      const gap = seconds(behind.interval);
      if (gap == null) continue;
      const key = `${ahead.code}:${behind.code}`;
      active.add(key);
      const samples = (this.history.get(key) || []).filter(sample => time - sample.time <= 30000);
      if (!samples.length || time > samples[samples.length - 1].time) samples.push({ time, gap });
      this.history.set(key, samples);
      const reference = samples[0];
      const elapsed = (time - reference.time) / 1000;
      if (gap < 2) battles.push({ ahead: ahead.code, behind: behind.code, position: behind.position, gap, change: elapsed >= 10 ? gap - reference.gap : null, windowSeconds: elapsed >= 10 ? Math.round(elapsed) : null });
    }
    for (const key of this.history.keys()) if (!active.has(key)) this.history.delete(key);
    this.lastTime = time;
    return battles.sort((a, b) => a.gap - b.gap);
  }
}
