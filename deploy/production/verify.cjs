const fs = require('node:fs');
const Database = require('better-sqlite3');
(async () => {
  if (process.getuid() !== 1000) throw new Error('Unexpected container UID');
  const health = await fetch('http://127.0.0.1:3000/api/health');
  if (!health.ok) throw new Error('Health endpoint failed');
  const internal = await fetch('http://f1-hubb:3000/api/health');
  if (!internal.ok) throw new Error('Internal Docker DNS/HTTP failed');
  const page = await fetch('http://127.0.0.1:3000/');
  const html = await page.text();
  if (!page.ok || !html.includes('id="root"')) throw new Error('Frontend failed');
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]);
  if (!assets.length) throw new Error('No built frontend assets');
  for (const path of [...assets, '/fonts/formula1-bold.ttf', '/teams/mercedes.webp', '/flags/gb.png', '/circuits/circuits.geojson']) {
    const response = await fetch('http://127.0.0.1:3000' + path);
    if (!response.ok || !(await response.arrayBuffer()).byteLength) throw new Error('Asset failed: ' + path);
  }
  const db = new Database(process.env.DATABASE_PATH, { fileMustExist: true });
  if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('SQLite integrity check failed');
  const token = process.env.F1_VERIFY_TOKEN;
  const previous = db.prepare('SELECT value FROM cache WHERE key=?').get('deployment:verification');
  if (previous && JSON.parse(previous.value).token !== token) throw new Error('Persistent database marker changed');
  if (process.env.F1_EXPECT_PERSISTENCE === 'yes' && !previous) throw new Error('Persistent database marker missing after update');
  db.prepare('INSERT INTO cache VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated').run('deployment:verification', JSON.stringify({ token }), new Date().toISOString());
  db.close();
  let dashboard;
  for (let attempt = 0; attempt < 90; attempt++) {
    const response = await fetch('http://127.0.0.1:3000/api/dashboard');
    if (!response.ok) throw new Error('Dashboard HTTP failed');
    dashboard = await response.json();
    if (!dashboard.loading) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (dashboard.loading || !dashboard.calendar?.length || !dashboard.drivers?.length || !dashboard.constructors?.length || dashboard.errors?.length) throw new Error('Calendar/standings initialisation incomplete or upstream error');
  console.log(JSON.stringify({ health: 'ok', internalDockerHTTP: 'ok', frontend: 'ok', sqlite: 'read/write ok', persistence: previous ? 'retained' : 'initial marker created', races: dashboard.calendar.length, drivers: dashboard.drivers.length, constructors: dashboard.constructors.length, cacheUpdated: dashboard.updated }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
