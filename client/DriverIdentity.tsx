import type { Standing } from '../shared/types.js';
import { t } from './i18n.js';

const icons = new Set(['mercedes', 'ferrari', 'mclaren', 'red_bull', 'rb', 'alpine', 'haas', 'audi', 'williams', 'aston_martin', 'cadillac']);
const countries: Record<string, { code: string; name: string }> = {
  Italian: { code: 'it', name: t('country.it') }, British: { code: 'gb', name: t('country.gb') },
  Dutch: { code: 'nl', name: t('country.nl') }, Monegasque: { code: 'mc', name: t('country.mc') },
  Australian: { code: 'au', name: t('country.au') }, French: { code: 'fr', name: t('country.fr') },
  'New Zealander': { code: 'nz', name: t('country.nz') }, Argentine: { code: 'ar', name: t('country.ar') },
  German: { code: 'de', name: t('country.de') }, Brazilian: { code: 'br', name: t('country.br') },
  Spanish: { code: 'es', name: t('country.es') }, Thai: { code: 'th', name: t('country.th') },
  Japanese: { code: 'jp', name: t('country.jp') }, Canadian: { code: 'ca', name: t('country.ca') },
  Finnish: { code: 'fi', name: t('country.fi') }, Mexican: { code: 'mx', name: t('country.mx') }
};

export function DriverIdentity({ driver }: { driver: Standing }) {
  const country = driver.nationality ? countries[driver.nationality] : undefined;
  return <span className="driver-identity">
    {country && <img className="driver-flag" src={`/flags/${country.code}.png`} alt={country.name} title={country.name} width="24" height="16"/>}
    <strong className="driver-name">{driver.name}</strong>
  </span>;
}

export function DriverTeam({ driver }: { driver: Standing }) {
  return <span className="team-icons" role="img" aria-label={driver.team}>{(driver.teamIds?.length === 1 ? driver.teamIds : []).filter(id => icons.has(id)).map(id => id === 'aston_martin'
      ? <svg key={id} className="aston-martin-icon" viewBox="394 516 809 202" width="26" height="26"><image href="/teams/aston-martin-source.png" width="1600" height="1200"/></svg>
      : <img key={id} src={`/teams/${id}.webp`} alt="" width="26" height="26"/>)}</span>;
}
