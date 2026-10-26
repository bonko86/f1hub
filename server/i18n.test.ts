import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, sessionKind, sessionLabel } from '../client/i18n.js';
import { countdown } from '../shared/time.js';

test('partial translations fall back to Swedish and preserve interpolation values', () => {
  const translate = createTranslator({ 'season.title': 'Season {year}' });
  assert.equal(translate('season.title', { year: 2026 }), 'Season 2026');
  assert.equal(translate('nav.season'), 'Säsong');
  assert.equal(translate('season.title'), 'Season {year}');
});

test('session identifiers and old cached names both resolve', () => {
  const session = { name: 'Träning 1', date: '2026-10-25', start: null };
  assert.equal(sessionKind(session), 'FirstPractice');
  assert.equal(sessionLabel({ ...session, name: 'Practice', kind: 'FirstPractice' }), 'Träning 1');
  assert.equal(sessionLabel({ ...session, name: 'Special session' }), 'Special session');
});

test('countdown localizes units without changing zero-unit rules', () => {
  const units = { day: 'days', hour: 'hr', minute: 'm', second: 'sec' };
  assert.equal(countdown('2026-10-25T00:00:00Z', Date.parse('2026-10-23T00:00:00Z'), units), '2days 0hr 0m');
  assert.equal(countdown('2026-10-25T00:00:00Z', Date.parse('2026-10-24T23:59:15Z'), units), '0m 45sec');
});
