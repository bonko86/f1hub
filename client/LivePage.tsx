import { lazy, Suspense, useState } from 'react';
import type { Dashboard } from '../shared/types.js';
import { LivePositions } from './LivePositions.js';
import { t } from './i18n.js';

const LocalReplay = import.meta.env.DEV ? lazy(() => import('./LocalReplay.js')) : null;
export function LivePage({ baseline }: { baseline: Dashboard | null }) {
  const [testing, setTesting] = useState(false);
  return <>
    {LocalReplay && <button className="replay-toggle" onClick={() => setTesting(value => !value)}>{testing ? t('replay.exit') : t('replay.open')}</button>}
    {testing && LocalReplay ? <Suspense fallback={<p role="status">{t('replay.loading')}</p>}><LocalReplay/></Suspense> : <div className="live-page"><LivePositions baseline={baseline}/></div>}
  </>;
}
