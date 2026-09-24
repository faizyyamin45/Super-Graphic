import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
export function createSqliteStore({dataDir, seedDir}) {
  const uploadDir = path.join(dataDir, "uploads");
  mkdirSync(uploadDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "gallery.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      titleAr TEXT NOT NULL DEFAULT '', descriptionAr TEXT NOT NULL DEFAULT '', service TEXT NOT NULL,
      filename TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, credential TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  if (seedDir && !db.prepare("SELECT value FROM app_meta WHERE key='initial-gallery-v1'").get()) {
    const seeds = JSON.parse(readFileSync(path.join(seedDir, "manifest.json"), "utf8"));
    db.exec("BEGIN IMMEDIATE");
    try {
      const insertedAt = Date.now();
      for (const item of seeds) {
        copyFileSync(path.join(seedDir, item.filename), path.join(uploadDir, item.filename));
        db.prepare("INSERT OR IGNORE INTO media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(item.id, item.title, item.description, item.titleAr, item.descriptionAr, item.service, item.filename, item.width, item.height, new Date(insertedAt - item.order * 1000).toISOString());
      }
      db.prepare("INSERT INTO app_meta VALUES ('initial-gallery-v1', 'complete')").run();
      db.exec("COMMIT");
    } catch (err) { db.exec("ROLLBACK"); db.close(); throw err; }
  }

return {
 list: () => db.prepare('SELECT * FROM media ORDER BY createdAt DESC, id DESC').all(),
 get: id => db.prepare('SELECT * FROM media WHERE id=?').get(id),
 insert: item => db.prepare('INSERT INTO media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(item.id, item.title, item.description, item.titleAr, item.descriptionAr, item.service, item.filename, item.width, item.height, item.createdAt),
 update: (id, f) => Boolean(db.prepare('UPDATE media SET title=?, description=?, titleAr=?, descriptionAr=?, service=? WHERE id=?').run(f.title, f.description, f.titleAr, f.descriptionAr, f.service, id).changes),
 delete: id => db.prepare('DELETE FROM media WHERE id=?').run(id),
 session: (token, credential) => Boolean(db.prepare('SELECT token FROM sessions WHERE token=? AND expires>? AND credential=?').get(token, Date.now(), credential)),
 createSession: (token, expires, credential) => db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(token, expires, credential),
 deleteSession: token => db.prepare('DELETE FROM sessions WHERE token=?').run(token),
 pruneSessions: credential => db.prepare('DELETE FROM sessions WHERE expires<? OR credential<>?').run(Date.now(), credential),
 writeFile: (filename, bytes) => writeFile(path.join(uploadDir, filename), bytes, {flag:'wx'}),
 deleteFile: filename => unlink(path.join(uploadDir, filename)).catch(error => { if (error.code !== 'ENOENT') throw error; }),
 serveFile: (req, res, next) => express.static(uploadDir, {immutable:true, maxAge:'1y', index:false, dotfiles:'deny'})(req, res, next),
 close: () => db.close(),
};
}
