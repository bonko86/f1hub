import { useEffect, useState } from 'react';
import type { LiveRace } from '../shared/types.js';
import { stockholm } from '../shared/time.js';

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
  return <section className="live-card"><div className="live-heading"><h2>Positioner</h2><span className={isLive ? 'live-status active' : 'live-status'}>{isLive ? 'Live' : 'Inväntar data'}</span></div>
    {isLive ? <><p className="live-updated">Uppdaterad {data.updatedAt ? stockholm(data.updatedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–'}</p><div className="live-table-scroll" tabIndex={0} aria-label="Rulla genom livepositioner"><table className="live-table"><caption className="sr-only">Livepositioner i {data.raceName}</caption><thead><tr><th>Pl.</th><th>Förare</th><th>Stall</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.code}><td>{row.position}</td><th scope="row">{row.code}</th><td>{row.team}</td></tr>)}</tbody></table></div></> : <p className="live-empty">{!data ? 'Ansluter till livepositioner…' : data.status === 'offline' ? 'Liveanslutningen är inte tillgänglig. Försöker igen automatiskt.' : data.status === 'stale' ? 'Liveuppgifterna är inaktuella. Inväntar nya data.' : 'Positioner visas när aktuellt race pågår och färska data finns.'}</p>}
  </section>;
}
