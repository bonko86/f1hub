import type { Dashboard, LiveRace } from '../shared/types.js';
import { projectChampionship, type ProjectedStanding } from '../shared/championship.js';
import { language, t } from './i18n.js';

export function LiveChampionship({ baseline, live }: { baseline: Dashboard | null; live: LiveRace }) {
  const projection = projectChampionship(baseline, live);
  const reasons = { waiting: 'live.vm.waiting', baseline: 'live.vm.baseline', sprint: 'live.vm.sprint', classification: 'live.vm.classification', teams: 'live.vm.teams' } as const;
  const number = (value: number) => new Intl.NumberFormat(language.locale).format(value);
  const table = (rows: ProjectedStanding[], label: string, nameLabel: string) => <div className="live-table-scroll" tabIndex={0} aria-label={label}><table className="live-table projected-table"><caption className="sr-only">{label}</caption><thead><tr><th>{t('table.position')}</th><th>{nameLabel}</th><th>{t('live.vm.gain')}</th><th>{t('live.vm.total')}</th></tr></thead><tbody>{rows.map(row => <tr key={row.code || row.name}><td>{row.rank}</td><th scope="row">{row.code || row.name}</th><td>+{number(row.gained)}</td><td>{number(row.total)}</td></tr>)}</tbody></table></div>;
  return <section className="live-card live-projection" aria-labelledby="live-vm-title">
    <div className="card-heading"><span className="heading-meta">{t('live.vm.label')}</span><h2 id="live-vm-title">{t('live.vm.title')}</h2></div>
    <p className="live-table-hint">{t('live.vm.assumptions')}</p>
    {projection.reason ? <p className="live-empty">{t(reasons[projection.reason])}</p> : <div className="projection-grid"><div><h3>{t('standings.drivers')}</h3>{table(projection.drivers, t('standings.driverChampionship'), t('table.driver'))}</div><div><h3>{t('standings.constructors')}</h3>{projection.constructorReason ? <p className="live-empty">{t(reasons[projection.constructorReason])}</p> : table(projection.constructors, t('standings.constructorChampionship'), t('table.team'))}</div></div>}
  </section>;
}
