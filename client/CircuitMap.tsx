import { useEffect, useState } from 'react';
import type { Race } from '../shared/types.js';
import { t, language } from './i18n.js';

interface CircuitFeature { properties: { Name: string; length?: number; opened?: number; firstgp?: number; turns?: number; raceLaps?: number; lapRecord?: { time: string; driver: string; year: number } }; geometry: { type: string; coordinates: number[][] } }
export function CircuitMap({ race }: { race: Race }) {
  const [circuits, setCircuits] = useState<CircuitFeature[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/circuits/circuits.geojson', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(t('circuit.missing'));
      setCircuits((await response.json()).features);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  const latitude = race.latitude; const longitude = race.longitude;
  const feature = latitude != null && longitude != null ? circuits.find(c => c.geometry.type === 'LineString' && c.geometry.coordinates.some(([lon, lat]) => Math.abs(lon - longitude) < 0.04 && Math.abs(lat - latitude) < 0.04)) : undefined;
  let path = '';
  const facts = feature ? [
    { label: t('circuit.length'), value: feature.properties.length ? `${new Intl.NumberFormat(language.locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(feature.properties.length / 1000)} ${t('units.km')}` : null },
    { label: t('circuit.opened'), value: feature.properties.opened },
    { label: t('circuit.firstRace'), value: feature.properties.firstgp },
    { label: t('circuit.turns'), value: feature.properties.turns },
    { label: t('circuit.laps'), value: feature.properties.raceLaps }
  ].filter(fact => fact.value != null) : [];
  if (feature) {
    const factor = Math.cos(latitude! * Math.PI / 180);
    const points = feature.geometry.coordinates.map(([lon, lat]) => [lon * factor, -lat]);
    const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
    const minX = Math.min(...xs); const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX; const height = Math.max(...ys) - minY;
    const scale = Math.min(440 / width, 280 / height);
    path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${((x - minX) * scale + (500 - width * scale) / 2).toFixed(2)},${((y - minY) * scale + (340 - height * scale) / 2).toFixed(2)}`).join(' ');
  }
  return <section className="circuit-card" aria-label={t('circuit.label')}>
    <h2>{race.circuit}</h2>
    {path ? <svg className="circuit-map" viewBox="0 0 500 340" role="img" aria-label={t('circuit.outline', { circuit: race.circuit })}><path d={path} fill="none" stroke="#e9ece9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg> : <p className="empty">{!circuits.length && !failed ? t('circuit.loading') : t('circuit.missing')}</p>}
    {facts.length > 0 && <dl className="circuit-facts">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}{feature?.properties.lapRecord && <div><dt>{t('circuit.record')}</dt><dd>{feature.properties.lapRecord.time}<p className="record-holder">{feature.properties.lapRecord.driver} · {feature.properties.lapRecord.year}</p></dd></div>}</dl>}
  </section>;
}
