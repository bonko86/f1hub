import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Dashboard } from '../shared/types.js';
import { countdown, formatDate, formatRaceStart, t, language, sessionKind, sessionLabel } from './i18n.js';
import './style.css';
import { LivePositions } from './LivePositions.js';
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
  const date = (value: string) => formatDate(value, { day: 'numeric', month: 'long' });
  return <><header><a className="brand" href="/" aria-label={t('app.home')}><span>F1</span>F1 Hub</a><nav className="main-nav" aria-label={t('nav.label')}><button aria-current={page === 'overview' ? 'page' : undefined} onClick={() => { setPage('overview'); window.scrollTo(0, 0); }}>{t('nav.overview')}</button><button aria-current={page === 'statistics' ? 'page' : undefined} onClick={() => { setPage('statistics'); window.scrollTo(0, 0); }}>{t('nav.statistics')}</button><button aria-current={page === 'season' ? 'page' : undefined} onClick={() => { setPage('season'); window.scrollTo(0, 0); }}>{t('nav.season')}</button></nav></header><main>
    <div className="intro"><span className="eyebrow">{page === 'statistics' ? t('page.statistics') : page === 'season' ? t('page.season') : t('page.overview')}</span></div>
    {(error || !!data?.errors.length) && <p className="notice" role="status">{error ? t('errors.backend') : t('errors.updateFailed')}</p>}
    {!data || data.loading ? <section className="empty" role="status">{error ? t('errors.unavailable') : t('loading.weekend')}</section> : <div className="layout page-layout"><div hidden={page !== 'overview'}>
      <div className="grand-prix-layout"><div className="race-column"><section className="race-card">
      
        {race ? <><p className="race-subheader">{race.start ? formatRaceStart(race.start) : t('race.timeMissing')}</p><h1>{race.name}</h1></> : <><h1>{data.status === 'season-ended' ? t('race.seasonEnded') : t('race.calendarPending')}</h1><p>{t('race.nextWhenAvailable')}</p></>}
      <section className="countdown" aria-label={t('race.countdown')}><div><span className="eyebrow countdown-heading">{data.status === 'awaiting-results' ? t('race.awaitingResults') : t('race.startsIn')}</span><p>{data.status === 'awaiting-results' ? t('race.ongoing') : race?.start ? countdown(race.start, now) : t('race.timeMissing')}</p></div></section>
      </section>
      {race && <section className="round-card" aria-label={t('race.roundLabel')}><span className="eyebrow">{t('race.season', { year: race.season })}</span><h2>{t('race.round')}</h2><p><strong>{race.round}</strong><span>{t('race.of', { count: data.seasonRaceCount || '–' })}</span></p></section>}
      {page === 'overview' && <LivePositions/>}
      </div>
      {race && <CircuitMap race={race}/>}</div>
      

      {race && <section className="schedule"><div className="section-heading"><div><h2>{t('schedule.title')}</h2><p className="weekend-dates">{date((race.sessions[0]?.start || `${race.sessions[0]?.date || race.date}T12:00:00Z`))} – {date(race.start || `${race.date}T12:00:00Z`)}</p></div>{race.sessions.some(s => sessionKind(s) === 'Sprint') && <span>{t('schedule.sprint')}</span>}</div><table><caption className="sr-only">{t('schedule.caption')}</caption><thead><tr><th>{t('schedule.session')}</th><th>{t('schedule.day')}</th><th>{t('schedule.time')}</th></tr></thead><tbody>{race.sessions.map(s => <tr key={sessionLabel(s)} className={sessionKind(s) === 'Race' && data.status === 'awaiting-results' ? 'ongoing-session' : s.start && Date.parse(s.start) <= now ? 'past-session' : s === next ? 'next-session' : ''}><th scope="row">{sessionLabel(s)}{sessionKind(s) === 'Race' && data.status === 'awaiting-results' && <span className="status-pill status-ongoing" title={t('schedule.ongoingHint')}>{t('schedule.ongoing')}</span>}{s === next && <span className="next-label status-pill">{t('schedule.next')}</span>}</th><td>{s.start ? formatDate(s.start, { weekday: 'short', day: 'numeric', month: 'short' }) : date(`${s.date}T12:00:00Z`)}</td><td>{s.start ? formatDate(s.start, { hour: '2-digit', minute: '2-digit' }) : t('schedule.notPublished')}</td></tr>)}</tbody></table></section>}

    </div><aside className="championship" hidden={page !== 'statistics'}><div className="section-heading"><div><span className="eyebrow">{t('standings.season', { year: data.season })}</span><h2>{t('standings.title')}</h2></div><span className="season-mark">{String(data.season).slice(2)}</span></div><div className="tabs" role="tablist" aria-label={t('standings.title')}><button id="drivers-tab" role="tab" aria-selected={tab === 'drivers'} aria-controls="standings" onClick={() => setTab('drivers')}>{t('standings.drivers')}</button><button id="constructors-tab" role="tab" aria-selected={tab === 'constructors'} aria-controls="standings" onClick={() => setTab('constructors')}>{t('standings.constructors')}</button></div><div id="standings" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {data[tab].length ? <table className="standings"><caption className="sr-only">{tab === 'drivers' ? t('standings.driverChampionship') : t('standings.constructorChampionship')}</caption><thead><tr><th>{t('table.position')}</th><th>{tab === 'drivers' ? t('table.driver') : t('table.team')}</th>{tab === 'drivers' && <th className="team-column">{t('table.team')}</th>}<th>{t('table.points')}</th></tr></thead><tbody>{data[tab].map(row => <tr key={row.position}><td className="position">{String(row.position).padStart(2, '0')}</td><th scope="row">{tab === 'drivers' ? <DriverIdentity driver={row}/> : <span className="constructor-identity"><DriverTeam driver={row}/>{row.name}</span>}</th>{tab === 'drivers' && <td className="team-column"><DriverTeam driver={row}/></td>}<td className="points">{row.points}</td></tr>)}</tbody></table> : <p className="empty">{t('standings.empty')}</p>}
      </div></aside><div hidden={page !== 'season'}><SeasonCalendar completedRounds={data.completedRounds || []} races={data.calendar || []} season={data.calendarSeason ?? data.season} now={now}/></div></div>}
    <footer className="metadata-footer">
      <p>{t('app.api')}: <a href="https://api.jolpi.ca/docs/" target="_blank" rel="noreferrer">Jolpica F1</a></p>
      <p>{t('app.unofficial')}</p>
    </footer>
  </main></>;
}
document.documentElement.lang = language.locale;
document.title = t('app.title');
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
