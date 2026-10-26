import { useState } from 'react';
import type { Race } from '../shared/types.js';
import { formatDate, t, sessionLabel } from './i18n.js';

export function SeasonCalendar({ races, season, now, completedRounds }: { completedRounds: number[]; races: Race[]; season: number; now: number }) {
  const [showCompleted, setShowCompleted] = useState(true);
  const completed = races.filter(race => completedRounds.includes(race.round));
  const remaining = races.filter(race => !completedRounds.includes(race.round));
  const startTime = (race: Race) => Date.parse(race.start || `${race.date}T23:59:59Z`);
  const nextRace = [...remaining].filter(race => startTime(race) > now).sort((a, b) => startTime(a) - startTime(b))[0];
  const renderRace = (race: Race) => {
    const done = completedRounds.includes(race.round);
    const isNext = race === nextRace;
    return <details className={`season-race ${done ? 'is-completed' : isNext ? 'is-next' : 'is-upcoming'}`} key={`${race.season}-${race.round}`}>
      <summary><span className="season-race-identity">{isNext && <span className="season-race-status">{t('race.next')}</span>}<span className={completedRounds.includes(race.round) ? 'season-race-name completed-race' : 'season-race-name'}>{race.name}</span></span><span className="season-race-date">{formatDate(race.start || `${race.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="season-race-time">{race.start ? formatDate(race.start, { hour: '2-digit', minute: '2-digit' }) : t('schedule.notPublished')}</span><svg className="expand-icon" aria-hidden="true" viewBox="0 0 20 20" width="20" height="20"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></summary>
      <div className="season-sessions"><table><caption className="sr-only">{t('season.sessions', { race: race.name })}</caption><thead><tr><th>{t('schedule.session')}</th><th>{t('schedule.day')}</th><th>{t('schedule.time')}</th></tr></thead><tbody>{race.sessions.map(session => <tr key={sessionLabel(session)} className={session.start && Date.parse(session.start) <= now ? 'past-session' : ''}><th scope="row">{sessionLabel(session)}</th><td>{formatDate(session.start || `${session.date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{session.start ? formatDate(session.start, { hour: '2-digit', minute: '2-digit' }) : t('schedule.notPublished')}</td></tr>)}</tbody></table></div>
    </details>;
  };
  return <section className="season-calendar schedule" aria-label={t('season.caption', { year: season })}>
    <div className="section-heading"><div className="card-heading"><span className="heading-meta">{t('season.count', { count: races.length })}</span><h2>{t('season.title', { year: season })}</h2></div></div>
    {!races.length && <p className="empty">{t('season.empty')}</p>}
    {completed.length > 0 && <button className="season-history-toggle" aria-expanded={showCompleted} aria-controls="completed-races" onClick={() => setShowCompleted(value => !value)}>{showCompleted ? t('season.hideCompleted') : t('season.showCompleted')}</button>}
    <div id="completed-races" className="season-completed-list" hidden={!showCompleted}>{completed.map(renderRace)}</div>
    <div className="season-remaining">{remaining.map(renderRace)}</div>
  </section>;
}
