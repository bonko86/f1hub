import { useEffect, useState } from 'react';
import type { Race } from '../shared/types.js';

interface CircuitFeature { properties: { Name: string }; geometry: { type: string; coordinates: number[][] } }
export function CircuitMap({ race }: { race: Race }) {
  const [circuits, setCircuits] = useState<CircuitFeature[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/circuits/circuits.geojson', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Bankarta saknas');
      setCircuits((await response.json()).features);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  const latitude = race.latitude; const longitude = race.longitude;
  const feature = latitude != null && longitude != null ? circuits.find(c => c.geometry.type === 'LineString' && c.geometry.coordinates.some(([lon, lat]) => Math.abs(lon - longitude) < 0.04 && Math.abs(lat - latitude) < 0.04)) : undefined;
  let path = '';
  if (feature) {
    const factor = Math.cos(latitude! * Math.PI / 180);
    const points = feature.geometry.coordinates.map(([lon, lat]) => [lon * factor, -lat]);
    const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
    const minX = Math.min(...xs); const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX; const height = Math.max(...ys) - minY;
    const scale = Math.min(440 / width, 280 / height);
    path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${((x - minX) * scale + (500 - width * scale) / 2).toFixed(2)},${((y - minY) * scale + (340 - height * scale) / 2).toFixed(2)}`).join(' ');
  }
  return <section className="circuit-card" aria-label="Bankarta">
    <span className="eyebrow">BANAN</span><h2>{race.circuit}</h2>
    {path ? <svg className="circuit-map" viewBox="0 0 500 340" role="img" aria-label={`Bansträckning för ${race.circuit}`}><path d={path} fill="none" stroke="#e9ece9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg> : <p className="empty">{!circuits.length && !failed ? 'Hämtar bankarta…' : 'Bankarta saknas för den här banan.'}</p>}
    <p className="circuit-credit">Schematisk bansträckning · <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">Bandata: Tomislav Bacinger</a></p>
  </section>;
}
