import { useEffect, useState } from 'react';
import type { Dashboard, LiveRace } from '../shared/types.js';
import { LivePositions } from './LivePositions.js';
import { t } from './i18n.js';

interface Replay { live: LiveRace; baseline: Dashboard; phase: string; recordedRace: string }
const phases = ['racing', 'pit', 'positions', 'safety-car', 'red', 'restart', 'stale', 'offline', 'finished'] as const;
export default function LocalReplay() {
  const [second, setSecond] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [data, setData] = useState<Replay | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setSecond(value => Math.min(180, value + speed)), 1000);
    return () => clearInterval(timer);
  }, [playing, speed]);
  useEffect(() => { if (second === 180) setPlaying(false); }, [second]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/replay?second=${second}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!controller.signal.aborted) { setData(result); setError(false); }
      } catch { if (!controller.signal.aborted) { setError(true); setData(null); } }
    }
    void load(); const refresh = setInterval(() => void load(), 5000);
    return () => { controller.abort(); clearInterval(refresh); };
  }, [second]);
  return <div className="live-page">
    <div className="replay-indicator">{t('replay.testOnly')}</div>
    <section className="replay-controls" aria-label={t('replay.title')}>
      <div className="card-heading"><span className="heading-meta">{t('replay.testOnly')}</span><h2>{t('replay.title')}</h2></div>
      <p>{t('replay.explanation')}</p>
      {data && <p>{t('replay.recording', { race: data.recordedRace })}</p>}
      <div className="replay-buttons"><button onClick={() => { if (second === 180) setSecond(0); setPlaying(value => !value); }}>{playing ? t('replay.pause') : t('replay.play')}</button><button onClick={() => { setPlaying(false); setSecond(0); }}>{t('replay.reset')}</button><label>{t('replay.speed')} <select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={4}>4×</option><option value={10}>10×</option></select></label></div>
      <label className="replay-timeline">{t('replay.timeline', { second })}<input type="range" min="0" max="180" value={second} onChange={event => { setPlaying(false); setSecond(Number(event.target.value)); }}/></label>
      <div className="replay-scenarios">{phases.map((phase, index) => <button key={phase} aria-pressed={data?.phase === phase} onClick={() => { setPlaying(false); setSecond(index * 20); }}>{t(`replay.phase.${phase}`)}</button>)}</div>
      {error && <p role="alert">{t('replay.error')}</p>}
    </section>
    {data ? <LivePositions baseline={data.baseline} replay={data.live}/> : !error && <p role="status">{t('replay.loading')}</p>}
  </div>;
}
