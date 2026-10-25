import type { Race } from '../shared/types.js';
import { stockholm } from '../shared/time.js';

export function SeasonCalendar({ races, season, now, completedRounds }: { completedRounds: number[]; races: Race[]; season: number; now: number }) {
  return <section className="season-calendar schedule" aria-label={`Tävlingskalender ${season}`}>
    <div className="section-heading"><h2>Säsong {season}</h2><span>{races.length} GRAND PRIX</span></div>
    {!races.length && <p className="empty">Ingen kalender tillgänglig.</p>}
    {races.map(race => <details className="season-race" key={`${race.season}-${race.round}`}>
      <summary><span className={completedRounds.includes(race.round) ? 'season-race-name completed-race' : 'season-race-name'}>{race.name}</span><span className="season-race-date">{stockholm(race.start || `${race.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="season-race-time">{race.start ? stockholm(race.start, { hour: '2-digit', minute: '2-digit' }) : 'Ej publicerad'}</span><svg className="expand-icon" aria-hidden="true" viewBox="0 0 20 20" width="20" height="20"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></summary>
      <div className="season-sessions"><table><caption className="sr-only">Sessioner för {race.name}, svensk tid</caption><thead><tr><th>Session</th><th>Dag</th><th>Tid</th></tr></thead><tbody>{race.sessions.map(session => <tr key={session.name} className={session.start && Date.parse(session.start) <= now ? 'past-session' : ''}><th scope="row">{session.name}</th><td>{stockholm(session.start || `${session.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{session.start ? stockholm(session.start, { hour: '2-digit', minute: '2-digit' }) : 'Ej publicerad'}</td></tr>)}</tbody></table></div>
    </details>)}
  </section>;
}
