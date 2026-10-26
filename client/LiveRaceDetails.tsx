import type { LiveRace } from '../shared/types.js';
import { formatDate, t } from './i18n.js';

export function LiveRaceDetails({ data }: { data: LiveRace }) {
  const compounds = { SOFT: 'live.tyre.soft', MEDIUM: 'live.tyre.medium', HARD: 'live.tyre.hard', INTERMEDIATE: 'live.tyre.intermediate', WET: 'live.tyre.wet', UNKNOWN: 'live.tyre.unknown' } as const;
  return <div className="live-details-grid">
    <section className="live-card live-control" aria-labelledby="race-control-title">
      <div className="card-heading"><span className="heading-meta">{t('live.events')}</span><h2 id="race-control-title">{t('live.control')}</h2></div>
      <p className="live-table-hint">{t('live.controlHint')}</p>
      {data.messages?.length ? <ol className="race-messages" tabIndex={0} aria-label={t('live.control')}>{data.messages.map(message => <li key={message.id}>
        <div className="race-message-meta">{message.lap != null && <span>{t('live.lap')} {message.lap}</span>}{message.time && <time dateTime={message.time}>{formatDate(message.time, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>}</div>
        <p>{message.text}</p>
      </li>)}</ol> : <p className="live-empty">{t('live.noMessages')}</p>}
    </section>
    <section className="live-card live-tyres" aria-labelledby="tyres-title">
      <div className="card-heading"><span className="heading-meta">{t('live.strategy')}</span><h2 id="tyres-title">{t('live.tyres')}</h2></div>
      <p className="live-table-hint">{t('live.tyresHint')}</p>
      {data.tyres?.some(driver => driver.stints.length) ? <ul className="tyre-drivers">{data.tyres.map(driver => {
        const current = driver.stints.at(-1);
        return <li key={driver.code}><div className="tyre-driver-heading"><strong>{driver.position}. {driver.code}</strong>{current && <span className="tyre-current">{t('live.currentTyre')} <span className={`tyre-chip tyre-${current.compound.toLowerCase()}`}>{t(compounds[current.compound])}</span><span>{t('live.tyreAge', { count: current.laps ?? '\u2013' })}</span></span>}</div>
          {driver.stints.length ? <details className="tyre-history"><summary>{t('live.stintCount', { count: driver.stints.length })}</summary><ol>{driver.stints.map(stint => <li key={stint.number}><span>{t('live.stint', { number: stint.number })}</span><span className={`tyre-chip tyre-${stint.compound.toLowerCase()}`}>{t(compounds[stint.compound])}</span><span>{t('live.tyreAge', { count: stint.laps ?? '\u2013' })}</span><span>{stint.newTyres == null ? '\u2013' : stint.newTyres ? t('live.tyreNew') : t('live.tyreUsed')}</span></li>)}</ol></details> : <p className="live-empty">{t('live.noTyres')}</p>}
        </li>;
      })}</ul> : <p className="live-empty">{t('live.noTyres')}</p>}
    </section>
  </div>;
}
