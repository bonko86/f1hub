import { useEffect, useState } from 'react';
import type { LiveRace } from '../shared/types.js';
import { formatDate, t } from './i18n.js';

export function LivePositions() {
  const [data, setData] = useState<LiveRace | null>(null);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const response = await fetch('/api/live', { signal: controller.signal }); if (!response.ok) throw new Error(); setData(await response.json()); }
      catch { if (!controller.signal.aborted) setData({ status: 'offline', rows: [], updatedAt: null, raceName: null }); }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 5000); }
    }
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const isLive = data?.status === 'live';
  return <section className="live-card"><div className="live-heading"><h2>{t('live.title')}</h2><span className={isLive ? 'live-status active' : 'live-status'}>{isLive ? t('live.active') : t('live.waiting')}</span></div>
    {isLive ? <><p className="live-updated">{t('live.updated', { time: data.updatedAt ? formatDate(data.updatedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–' })}</p><div className="live-table-scroll" tabIndex={0} aria-label={t('live.scroll')}><table className="live-table"><caption className="sr-only">{t('live.caption', { race: data.raceName || '' })}</caption><thead><tr><th>{t('table.position')}</th><th>{t('table.driver')}</th><th>{t('table.team')}</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.code}><td>{row.position}</td><th scope="row">{row.code}</th><td>{row.team}</td></tr>)}</tbody></table></div></> : <p className="live-empty">{!data ? t('live.connecting') : data.status === 'offline' ? t('live.offline') : data.status === 'stale' ? t('live.stale') : t('live.noRace')}</p>}
  </section>;
}
