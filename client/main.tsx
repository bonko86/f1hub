import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Dashboard } from '../shared/types.js';
import { countdown, stockholm, formatRaceStart } from '../shared/time.js';
import './style.css';
import { SeasonCalendar } from './SeasonCalendar.js';
import { CircuitMap } from './CircuitMap.js';
import { DriverIdentity, DriverTeam } from './DriverIdentity.js';
function App() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState<'overview' | 'statistics' | 'season'>('overview');
  const [tab, setTab] = useState<'drivers' | 'constructors'>('drivers');
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => { try { const response = await fetch('/api/dashboard', { signal: controller.signal }); if (!response.ok) throw new Error(); setData(await response.json()); setError(false); } catch { if (!controller.signal.aborted) setError(true); } };
    void load(); const poll = setInterval(() => void load(), 60000); const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { controller.abort(); clearInterval(poll); clearInterval(clock); };
  }, []);
  const race = data?.race;
  const next = race?.sessions.find(s => s.start && Date.parse(s.start) > now);
  const date = (value: string) => stockholm(value, { day: 'numeric', month: 'long' });
  return <><header><a className="brand" href="/" aria-label="F1 startsida"><span>F1</span>F1 Hub</a><nav className="main-nav" aria-label="Huvudmeny"><button aria-current={page === 'overview' ? 'page' : undefined} onClick={() => { setPage('overview'); window.scrollTo(0, 0); }}>Översikt</button><button aria-current={page === 'statistics' ? 'page' : undefined} onClick={() => { setPage('statistics'); window.scrollTo(0, 0); }}>Statistik</button><button aria-current={page === 'season' ? 'page' : undefined} onClick={() => { setPage('season'); window.scrollTo(0, 0); }}>Säsong</button></nav></header><main>
    <div className="intro"><span className="eyebrow">{page === 'statistics' ? 'POÄNGSTÄLLNING' : page === 'season' ? 'SÄSONG' : 'NÄSTA RACE'}</span></div>
    {(error || !!data?.errors.length) && <p className="notice" role="status">{error ? 'Kan inte nå backend. Senast hämtad information behålls. Försöker igen automatiskt.' : data?.errors[0]}</p>}
    {!data || data.loading ? <section className="empty" role="status">{error ? 'Informationen är inte tillgänglig just nu.' : 'Hämtar och verifierar tävlingshelgen. Första starten kan ta någon minut…'}</section> : <div className="layout page-layout"><div hidden={page !== 'overview'}>
      <div className="grand-prix-layout"><div className="race-column"><section className="race-card">
      
        {race ? <><p className="race-subheader">{race.start ? formatRaceStart(race.start) : 'Starttid ej publicerad'}</p><h1>{race.name}</h1></> : <><h1>{data.status === 'season-ended' ? 'Säsongen är avslutad' : 'Kalender inväntas'}</h1><p>Nästa Grand Prix visas när kalendern är tillgänglig.</p></>}
      <section className="countdown" aria-label="Nedräkning till racestart"><div><span className="eyebrow countdown-heading">{data.status === 'awaiting-results' ? 'Resultat inväntas' : 'Startar om'}</span><p>{data.status === 'awaiting-results' ? 'Racet pågår' : race?.start ? countdown(race.start, now) : 'Starttid ej publicerad'}</p></div></section>
      </section>
      {race && <section className="round-card" aria-label="Deltävling i världsmästerskapet"><span className="eyebrow">F1 {race.season}</span><h2>Omgång</h2><p><strong>{race.round}</strong><span>av {data.seasonRaceCount || '–'}</span></p></section>}
      </div>
      {race && <CircuitMap race={race}/>}</div>
      

      {race && <section className="schedule"><div className="section-heading"><div><h2>Tävlingshelgen</h2><p className="weekend-dates">{date((race.sessions[0]?.start || `${race.sessions[0]?.date || race.date}T12:00:00Z`))} – {date(race.start || `${race.date}T12:00:00Z`)}</p></div>{race.sessions.some(s => s.name === 'Sprint') && <span>SPRINTHELG</span>}</div><table><caption className="sr-only">Sessionsschema i svensk tid</caption><thead><tr><th>Session</th><th>Dag</th><th>Tid</th></tr></thead><tbody>{race.sessions.map(s => <tr key={s.name} className={s.name === 'Race' && data.status === 'awaiting-results' ? 'ongoing-session' : s.start && Date.parse(s.start) <= now ? 'past-session' : s === next ? 'next-session' : ''}><th scope="row">{s.name}{s.name === 'Race' && data.status === 'awaiting-results' && <span className="status-pill status-ongoing" title="Planerad starttid har passerat. Slutresultat inväntas; live-status saknas.">Pågår</span>}{s === next && <span className="next-label status-pill">Nästa</span>}</th><td>{s.start ? stockholm(s.start, { weekday: 'short', day: 'numeric', month: 'short' }) : date(`${s.date}T12:00:00Z`)}</td><td>{s.start ? stockholm(s.start, { hour: '2-digit', minute: '2-digit' }) : 'Ej publicerad'}</td></tr>)}</tbody></table></section>}

    </div><aside className="championship" hidden={page !== 'statistics'}><div className="section-heading"><div><span className="eyebrow">SÄSONG {data.season}</span><h2>Mästerskapet</h2></div><span className="season-mark">{String(data.season).slice(2)}</span></div><div className="tabs" role="tablist" aria-label="Mästerskap"><button id="drivers-tab" role="tab" aria-selected={tab === 'drivers'} aria-controls="standings" onClick={() => setTab('drivers')}>Förare</button><button id="constructors-tab" role="tab" aria-selected={tab === 'constructors'} aria-controls="standings" onClick={() => setTab('constructors')}>Konstruktörer</button></div><div id="standings" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {data[tab].length ? <table className="standings"><caption className="sr-only">{tab === 'drivers' ? 'Förarmästerskapet' : 'Konstruktörsmästerskapet'}</caption><thead><tr><th>Pl.</th><th>{tab === 'drivers' ? 'Förare' : 'Stall'}</th>{tab === 'drivers' && <th className="team-column">Stall</th>}<th>Poäng</th></tr></thead><tbody>{data[tab].map(row => <tr key={row.position}><td className="position">{String(row.position).padStart(2, '0')}</td><th scope="row">{tab === 'drivers' ? <DriverIdentity driver={row}/> : <span className="constructor-identity"><DriverTeam driver={row}/>{row.name}</span>}</th>{tab === 'drivers' && <td className="team-column"><DriverTeam driver={row}/></td>}<td className="points">{row.points}</td></tr>)}</tbody></table> : <p className="empty">Inga mästerskapsuppgifter tillgängliga.</p>}
      </div></aside><div hidden={page !== 'season'}><SeasonCalendar completedRounds={data.completedRounds || []} races={data.calendar || []} season={data.calendarSeason ?? data.season} now={now}/></div></div>}
    <footer className="metadata-footer">
      <p>API: <a href="https://api.jolpi.ca/docs/" target="_blank" rel="noreferrer">Jolpica F1</a></p>
      <p>Fristående, inofficiell applikation</p>
    </footer>
  </main></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
