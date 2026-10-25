import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Dashboard } from '../shared/types.js';
import { countdown, stockholm } from '../shared/time.js';
import './style.css';
import { DriverIdentity, DriverTeam } from './DriverIdentity.js';
function App() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState<'overview' | 'statistics'>('overview');
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
  return <><header><a className="brand" href="/" aria-label="F1 startsida"><span>F1</span> GRAND PRIX</a><nav className="main-nav" aria-label="Huvudmeny"><button aria-current={page === 'overview' ? 'page' : undefined} onClick={() => { setPage('overview'); window.scrollTo(0, 0); }}>Översikt</button><button aria-current={page === 'statistics' ? 'page' : undefined} onClick={() => { setPage('statistics'); window.scrollTo(0, 0); }}>Statistik</button></nav></header><main>
    <div className="intro"><span className="eyebrow">FORMULA 1</span><span>Svensk tid · Europe/Stockholm</span></div>
    {(error || !!data?.errors.length) && <p className="notice" role="status">{error ? 'Kan inte nå backend. Senast hämtad information behålls. Försöker igen automatiskt.' : data?.errors[0]}</p>}
    {!data || data.loading ? <section className="empty" role="status">{error ? 'Informationen är inte tillgänglig just nu.' : 'Hämtar och verifierar tävlingshelgen. Första starten kan ta någon minut…'}</section> : <div className="layout page-layout"><div hidden={page !== 'overview'}>
      <section className="race-card"><div className="race-meta"><span className="eyebrow">NÄSTA GRAND PRIX</span>{race && <span>{race.season} / OMGÅNG {String(race.round).padStart(2, '0')}</span>}</div>
        {race ? <><h1>{race.name}</h1><p className="location">{race.circuit}<br/><span>{race.locality}, {race.country}</span></p><div className="race-date"><span>{date((race.sessions[0]?.start || `${race.sessions[0]?.date || race.date}T12:00:00Z`))} – {date(race.start || `${race.date}T12:00:00Z`)}</span><strong>Race {race.start ? stockholm(race.start, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : '· tid ej publicerad'}</strong></div></> : <><h1>{data.status === 'season-ended' ? 'Säsongen är avslutad' : 'Kalender inväntas'}</h1><p>Nästa Grand Prix visas när kalendern är tillgänglig.</p></>}
      </section>
      <section className="countdown" aria-label="Nästa session"><span className="indicator"/><div><span className="eyebrow">{data.status === 'awaiting-results' ? 'RESULTAT INVÄNTAS' : next ? `NÄSTA · ${next.name.toUpperCase()}` : 'NÄSTA SESSION'}</span><p>{next?.start ? countdown(next.start, now) : data.status === 'awaiting-results' ? 'Helgen behålls tills loppresultat publicerats.' : 'Ingen kommande session publicerad.'}</p></div></section>
      {race && <section className="schedule"><div className="section-heading"><h2>Tävlingshelgen</h2><span>{race.sessions.some(s => s.name === 'Sprint') ? 'SPRINTHELG' : 'GRAND PRIX'}</span></div><table><caption className="sr-only">Sessionsschema i svensk tid</caption><thead><tr><th>Session</th><th>Dag</th><th>Tid</th></tr></thead><tbody>{race.sessions.map(s => <tr key={s.name} className={s === next ? 'next-session' : ''}><th scope="row">{s.name}{s === next && <span className="next-label"> NÄSTA</span>}</th><td>{s.start ? stockholm(s.start, { weekday: 'short', day: 'numeric', month: 'short' }) : date(`${s.date}T12:00:00Z`)}</td><td>{s.start ? stockholm(s.start, { hour: '2-digit', minute: '2-digit' }) : 'Ej publicerad'}</td></tr>)}</tbody></table></section>}
      {data.updated.calendar && <p className="updated">Kalender uppdaterad {stockholm(data.updated.calendar, { dateStyle: 'short', timeStyle: 'short' })}{data.updated.results && <> · Resultat kontrollerade {stockholm(data.updated.results, { timeStyle: 'short' })}</>}</p>}
    </div><aside className="championship" hidden={page !== 'statistics'}><div className="section-heading"><div><span className="eyebrow">SÄSONG {data.season}</span><h2>Mästerskapet</h2></div><span className="season-mark">{String(data.season).slice(2)}</span></div><div className="tabs" role="tablist" aria-label="Mästerskap"><button id="drivers-tab" role="tab" aria-selected={tab === 'drivers'} aria-controls="standings" onClick={() => setTab('drivers')}>Förare</button><button id="constructors-tab" role="tab" aria-selected={tab === 'constructors'} aria-controls="standings" onClick={() => setTab('constructors')}>Konstruktörer</button></div><div id="standings" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {data[tab].length ? <table className="standings"><caption className="sr-only">{tab === 'drivers' ? 'Förarmästerskapet' : 'Konstruktörsmästerskapet'}</caption><thead><tr><th>Pl.</th><th>{tab === 'drivers' ? 'Förare' : 'Stall'}</th>{tab === 'drivers' && <th className="team-column">Stall</th>}<th>Poäng</th></tr></thead><tbody>{data[tab].map(row => <tr key={row.position}><td className="position">{String(row.position).padStart(2, '0')}</td><th scope="row">{tab === 'drivers' ? <DriverIdentity driver={row}/> : <span className="constructor-identity"><DriverTeam driver={row}/>{row.name}</span>}</th>{tab === 'drivers' && <td className="team-column"><DriverTeam driver={row}/></td>}<td className="points">{row.points}</td></tr>)}</tbody></table> : <p className="empty">Inga mästerskapsuppgifter tillgängliga.</p>}
      {data.updated[tab] && <p className="updated">Efter omgång {data.standingsRound[tab] ?? '–'}<br/>Uppdaterad {stockholm(data.updated[tab], { dateStyle: 'short', timeStyle: 'short' })}</p>}</div></aside></div>}
    <footer><span>F1 · GRAND PRIX</span><span>Data från <a href="https://api.jolpi.ca/docs/" target="_blank" rel="noreferrer">Jolpica F1</a> · Fristående, inofficiell applikation</span></footer>
  </main></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
