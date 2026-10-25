import { resolve, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';
const destination = process.argv[2];
if (!destination) throw new Error('Ange målfil: npm run backup -- ./backups/f1.sqlite');
if (existsSync(destination) || resolve(destination) === resolve(config.database)) throw new Error('Målfilen får inte finnas sedan tidigare');
mkdirSync(dirname(resolve(destination)), { recursive: true });
const db = new Database(config.database, { readonly: true, fileMustExist: true });
try { await db.backup(resolve(destination)); console.log('Konsistent backup skapad.'); } finally { db.close(); }
