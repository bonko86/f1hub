import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export class Cache {
  db: Database.Database;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated TEXT NOT NULL)');
  }
  get<T>(key: string): { value: T; updated: string } | null {
    const row = this.db.prepare('SELECT value, updated FROM cache WHERE key = ?').get(key) as { value: string; updated: string } | undefined;
    return row ? { value: JSON.parse(row.value) as T, updated: row.updated } : null;
  }
  set(key: string, value: unknown) { this.db.prepare('INSERT INTO cache VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated').run(key, JSON.stringify(value), new Date().toISOString()); }
}
