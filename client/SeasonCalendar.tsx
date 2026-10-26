import type { Race } from '../shared/types.js';
import { formatDate, t, sessionLabel } from './i18n.js';

export function SeasonCalendar({ races, season, now, completedRounds }: { completedRounds: number[]; races: Race[]; season: number; now: number }) {
  return <section className="season-calendar schedule" aria-label={t('season.caption', { year: season })}>
    <div className="section-heading"><div className="card-heading"><span className="heading-meta">{t('season.count', { count: races.length })}</span><h2>{t('season.title', { year: season })}</h2></div></div>
    {!races.length && <p className="empty">{t('season.empty')}</p>}
    {races.map(race => <details className="season-race" key={`${race.season}-${race.round}`}>
      <summary><span className={completedRounds.includes(race.round) ? 'season-race-name completed-race' : 'season-race-name'}>{race.name}</span><span className="season-race-date">{formatDate(race.start || `${race.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="season-race-time">{race.start ? formatDate(race.start, { hour: '2-digit', minute: '2-digit' }) : t('schedule.notPublished')}</span><svg className="expand-icon" aria-hidden="true" viewBox="0 0 20 20" width="20" height="20"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></summary>
      <div className="season-sessions"><table><caption className="sr-only">{t('season.sessions', { race: race.name })}</caption><thead><tr><th>{t('schedule.session')}</th><th>{t('schedule.day')}</th><th>{t('schedule.time')}</th></tr></thead><tbody>{race.sessions.map(session => <tr key={sessionLabel(session)} className={session.start && Date.parse(session.start) <= now ? 'past-session' : ''}><th scope="row">{sessionLabel(session)}</th><td>{formatDate(session.start || `${session.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{session.start ? formatDate(session.start, { hour: '2-digit', minute: '2-digit' }) : t('schedule.notPublished')}</td></tr>)}</tbody></table></div>
    </details>)}
  </section>;
}
