import { useEffect, useState } from 'react';
import type { Dashboard, LiveRace } from '../shared/types.js';
import { formatDate, t } from './i18n.js';
import { LiveRaceDetails } from './LiveRaceDetails.js';
import { LiveBattles } from './LiveBattles.js';
import { LiveChampionship } from './LiveChampionship.js';

export function LivePositions({ baseline, replay }: { baseline: Dashboard | null; replay?: LiveRace }) {
  const [fetched, setData] = useState<LiveRace | null>(null);
  const data = replay ?? fetched;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    if (replay) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const response = await fetch('/api/live', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }); if (!response.ok) throw new Error(); setData(await response.json()); }
      catch { if (!controller.signal.aborted) setData({ status: 'offline', rows: [], updatedAt: null, raceName: null }); }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 5000); }
    }
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [!!replay]);
  const age = data?.updatedAt ? now - Date.parse(data.updatedAt) : Infinity;
  const isLive = data?.status === 'live' && Number.isFinite(age) && age < 45000 && age >= -10000;
  const missing = '\u2013';
  const track = data?.trackStatus || 'unknown';
  const trackLabels = { green: 'live.track.green', yellow: 'live.track.yellow', 'safety-car': 'live.track.sc', red: 'live.track.red', vsc: 'live.track.vsc', 'vsc-ending': 'live.track.vscEnding', unknown: 'live.track.unknown' } as const;
  const statusLabels = { running: 'live.driver.running', pit: 'live.driver.pit', 'pit-out': 'live.driver.pitOut', retired: 'live.driver.retired', stopped: 'live.driver.stopped' } as const;
  return <>
    <section className="live-dashboard" aria-labelledby="live-race-title">
      <div className="card-heading"><span className="heading-meta">{t('live.raceStatus')}</span><h1 id="live-race-title">{isLive ? data.raceName : t('page.live')}</h1></div>
      {isLive ? <><div className="live-race-summary"><p className="live-lap">{t('live.lap')} <strong>{data.currentLap ?? missing}</strong><span> / {data.totalLaps ?? missing}</span></p><span className={`track-status track-${track}`}>{t(trackLabels[track])}</span>{data.sessionPhase === 'suspended' && <span className="track-status track-red">{t('live.suspended')}</span>}</div><p className="live-updated">{t('live.updated', { time: data.updatedAt ? formatDate(data.updatedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : missing })}</p></> : <p className="live-empty" role="status">{!data ? t('live.connecting') : data.status === 'offline' ? t('live.offline') : data.status === 'stale' || data.status === 'live' ? t('live.stale') : t('live.noRace')}</p>}
    </section>
    <section className="live-card"><div className="live-heading card-heading"><span className={isLive ? 'live-status active' : 'live-status'}>{isLive ? t('live.active') : t('live.waiting')}</span><h2>{t('live.title')}</h2></div>
      {isLive ? <><p className="live-table-hint">{t('live.tableHint')}</p><div className="live-table-scroll" tabIndex={0} aria-label={t('live.scroll')}><table className="live-table live-timing-table"><caption className="sr-only">{t('live.caption', { race: data.raceName || '' })}</caption><thead><tr><th>{t('table.position')}</th><th>{t('table.driver')}</th><th>{t('table.team')}</th><th>{t('live.gap')}</th><th>{t('live.interval')}</th><th>{t('live.lastLap')}</th><th>{t('live.driverStatus')}</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.code}><td>{row.position}</td><th scope="row">{row.code}</th><td>{row.team}</td><td>{row.position === 1 ? t('live.leader') : row.gapToLeader || missing}</td><td>{row.position === 1 ? missing : row.interval || missing}</td><td>{row.lastLap || missing}</td><td><span className={`driver-state driver-state-${row.driverStatus || 'running'}`}>{t(statusLabels[row.driverStatus || 'running'])}</span></td></tr>)}</tbody></table></div></> : <p className="live-empty">{t('live.positionsPending')}</p>}
    </section>
    {isLive && <><LiveBattles data={data}/><LiveRaceDetails data={data}/><LiveChampionship baseline={baseline} live={data}/></>}
  </>;
}
