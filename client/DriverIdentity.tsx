import type { Standing } from '../shared/types.js';

const icons = new Set(['mercedes', 'ferrari', 'mclaren', 'red_bull', 'rb', 'alpine', 'haas', 'audi', 'williams', 'aston_martin', 'cadillac']);
const countries: Record<string, { code: string; name: string }> = {
  Italian: { code: 'it', name: 'Italien' }, British: { code: 'gb', name: 'Storbritannien' },
  Dutch: { code: 'nl', name: 'Nederländerna' }, Monegasque: { code: 'mc', name: 'Monaco' },
  Australian: { code: 'au', name: 'Australien' }, French: { code: 'fr', name: 'Frankrike' },
  'New Zealander': { code: 'nz', name: 'Nya Zeeland' }, Argentine: { code: 'ar', name: 'Argentina' },
  German: { code: 'de', name: 'Tyskland' }, Brazilian: { code: 'br', name: 'Brasilien' },
  Spanish: { code: 'es', name: 'Spanien' }, Thai: { code: 'th', name: 'Thailand' },
  Japanese: { code: 'jp', name: 'Japan' }, Canadian: { code: 'ca', name: 'Kanada' },
  Finnish: { code: 'fi', name: 'Finland' }, Mexican: { code: 'mx', name: 'Mexiko' }
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
