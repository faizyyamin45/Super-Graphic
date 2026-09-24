import { MongoClient, GridFSBucket } from 'mongodb';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Credentials belong in the server environment, never in a VITE_ variable.
export async function createMongoStore({ uri, username, password, database = 'supergraphic', seedDir }) {
  const client = new MongoClient(uri, {
    ...(username && password ? { auth: { username, password } } : {}),
    serverSelectionTimeoutMS: 15000,
  });
  try {
    await client.connect();
    const db = client.db(database);
    const media = db.collection('media');
    const sessions = db.collection('sessions');
    const meta = db.collection('app_meta');
    const bucket = new GridFSBucket(db, { bucketName: 'gallery_images' });
    const seeds = seedDir ? JSON.parse(await readFile(path.join(seedDir, 'manifest.json'), 'utf8')) : [];
    const seedFiles = new Set(seeds.map(item => item.filename));
    await media.createIndex({ id: 1 }, { unique: true });
    await media.createIndex({ createdAt: -1, id: -1 });
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    const clean = row => { if (!row) return null; const { _id, ...item } = row; return item; };
    const store = {
      list: async () => (await media.find().sort({ createdAt: -1, id: -1 }).toArray()).map(clean),
      get: async id => clean(await media.findOne({ id })),
      insert: async item => { await media.insertOne({ ...item }); },
      update: async (id, fields) => (await media.updateOne({ id }, { $set: fields })).matchedCount > 0,
      delete: async id => { await media.deleteOne({ id }); },
      session: async (token, credential) => Boolean(await sessions.findOne({ _id: token, credential, expiresAt: { $gt: new Date() } })),
      createSession: async (token, expires, credential) => { await sessions.insertOne({ _id: token, expiresAt: new Date(expires), credential }); },
      deleteSession: async token => { await sessions.deleteOne({ _id: token }); },
      pruneSessions: async credential => { await sessions.deleteMany({ $or: [{ expiresAt: { $lt: new Date() } }, { credential: { $ne: credential } }] }); },
      writeFile: async (filename, data) => {
        const stream = bucket.openUploadStreamWithId(filename, filename, { metadata: { contentType: 'image/webp' } });
        try { await pipeline(Readable.from([data]), stream); }
        catch (error) { await stream.abort().catch(() => {}); throw error; }
      },
      deleteFile: async filename => { if (await db.collection('gallery_images.files').findOne({ _id: filename })) await bucket.delete(filename); },
      serveFile: async (req, res, next) => {
        try {
          const filename = req.params.filename;
          // Only published media can be downloaded, including during an interrupted upload.
          const item = await media.findOne({ filename });
          if (item && seedFiles.has(filename)) return res.sendFile(path.resolve(seedDir, filename), { immutable: true, maxAge: '1y' });
          const file = item && await db.collection('gallery_images.files').findOne({ _id: filename });
          if (!file) return res.sendStatus(404);
          res.set({ 'Content-Type': 'image/webp', 'Content-Length': String(file.length), 'Cache-Control': 'public, max-age=31536000, immutable' });
          if (req.method === 'HEAD') return res.end();
          await pipeline(bucket.openDownloadStream(filename), res);
        } catch (error) { next(error); }
      },
      close: () => client.close(),
    };
    // Single initial seed transaction keeps rolling deployments from duplicating
    // records and preserves owner edits/deletions after the initial import.
    if (seedDir && !await meta.findOne({ _id: 'initial-gallery-v1' })) {
      // Seed photos remain versioned application assets. User uploads use GridFS.
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          if (await meta.findOne({ _id: 'initial-gallery-v1' }, { session })) return;
          const now = Date.now();
          for (const { order, ...item } of seeds) {
            await media.updateOne({ id: item.id }, { $setOnInsert: { ...item, createdAt: new Date(now - order * 1000).toISOString() } }, { upsert: true, session });
          }
          await meta.insertOne({ _id: 'initial-gallery-v1', value: 'complete' }, { session });
        });
      } finally { await session.endSession(); }
    }
    return store;
  } catch (error) { await client.close(); throw error; }
}
