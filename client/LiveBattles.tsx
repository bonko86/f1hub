import type { LiveRace } from '../shared/types.js';
import { language, t } from './i18n.js';

export function LiveBattles({ data }: { data: LiveRace }) {
  const allowed = data.trackStatus === 'green' && data.sessionPhase === 'racing';
  const number = (value: number) => new Intl.NumberFormat(language.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return <section className="live-card live-battles" aria-labelledby="battles-title">
    <div className="card-heading"><span className="heading-meta">{t('live.battlesLabel')}</span><h2 id="battles-title">{t('live.battlesTitle')}</h2></div>
    <p className="live-table-hint">{t('live.battlesHint')}</p>
    {!allowed ? <p className="live-empty">{t('live.battlesPaused')}</p> : !data.battles?.length ? <p className="live-empty">{t('live.battlesEmpty')}</p> : <ul className="battle-list">{data.battles.map(battle => {
      const trend = battle.change == null ? 'pending' : battle.change <= -0.1 ? 'closing' : battle.change >= 0.1 ? 'opening' : 'stable';
      const labels = { pending: 'live.trendPending', closing: 'live.trendClosing', opening: 'live.trendOpening', stable: 'live.trendStable' } as const;
      return <li key={`${battle.ahead}:${battle.behind}`}><div className="battle-pair"><strong>{battle.behind} → {battle.ahead}</strong><span>{t('live.battlePosition', { position: battle.position })}</span></div><strong className="battle-gap">{number(battle.gap)} s</strong><div className={`battle-trend battle-${trend}`}><span>{t(labels[trend])}</span>{battle.change != null && battle.windowSeconds != null && <small>{t('live.trendChange', { change: `${battle.change > 0 ? '+' : ''}${number(battle.change)}`, seconds: battle.windowSeconds })}</small>}</div></li>;
    })}</ul>}
  </section>;
}
