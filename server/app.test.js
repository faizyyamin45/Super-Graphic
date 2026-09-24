import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scryptSync, randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import sharp from "sharp";
import { createApp } from "./app.js";

async function mongoFixture(t) {
  const database = `sgt_${randomUUID().replaceAll('-', '')}`;
  const mongo = { uri: process.env.TEST_MONGODB_URI, username: process.env.TEST_MONGODB_USERNAME, password: process.env.TEST_MONGODB_PASSWORD, database };
  t.after(async () => {
    const client = new MongoClient(mongo.uri, { ...(mongo.username && mongo.password ? { auth: { username: mongo.username, password: mongo.password } } : {}) });
    try { await client.connect(); await client.db(database).dropDatabase(); } finally { await client.close(); }
  });
  return mongo;
}

for (const backend of ['sqlite', 'mongo']) test(`${backend}: media authentication, validation, publishing, persistence, editing and deletion`, { skip: backend === 'mongo' && !process.env.TEST_MONGODB_URI }, async t => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "supergraphic-media-test-"));
  const password = "test-only-gallery-password";
  const salt = "0123456789abcdef0123456789abcdef";
  const options = { dataDir, passwordHash: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`, origin: "http://localhost:5173" };
  if (backend === 'mongo') options.mongo = await mongoFixture(t);
  let runtime = await createApp(options);
  let server;
  const start = async () => { server = runtime.app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve)); return `http://127.0.0.1:${server.address().port}`; };
  let base = await start();
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await runtime.close(); await rm(dataDir, { recursive: true, force: true }); });
  const json = (body, cookie) => ({ method: "POST", headers: { Origin: options.origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/api/media`, { method: "POST", headers: { Origin: options.origin } })).status, 401);
  assert.equal((await fetch(`${base}/api/media/login`, { ...json({ password }), headers: { Origin: "https://evil.example", "Content-Type": "application/json" } })).status, 403);
  assert.equal((await fetch(`${base}/api/media/login`, json({ password: "wrong" }))).status, 401);
  const login = await fetch(`${base}/api/media/login`, json({ password }));
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const fields = { title: "Shopfront letters", description: "Illuminated acrylic lettering.", titleAr: "", descriptionAr: "", service: "3d-signage" };
  const image = await sharp({ create: { width: 120, height: 180, channels: 3, background: "orange" } }).jpeg().toBuffer();
  const upload = async (bytes, patch = {}) => {
    const body = new FormData();
    for (const [key, value] of Object.entries({ ...fields, ...patch })) body.set(key, value);
    body.set("image", new Blob([bytes], { type: "image/jpeg" }), "photo.jpg");
    return fetch(`${base}/api/media`, { method: "POST", headers: { Origin: options.origin, Cookie: cookie }, body });
  };
  assert.equal((await upload(Buffer.from("not an image"))).status, 400);
  assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'))).status, 400);
  assert.equal((await upload(image, { service: "invalid" })).status, 400);
  assert.equal((await upload(image, { title: " " })).status, 400);
  assert.equal((await upload(Buffer.alloc(12 * 1024 * 1024 + 1))).status, 400);
  const published = await upload(image);
  assert.equal(published.status, 201);
  const { item } = await published.json();
  assert.equal(item.width, 120);
  assert.equal(item.height, 180);
  const publicImage = await fetch(`${base}${item.url}`);
  assert.equal(publicImage.status, 200);
  assert.match(publicImage.headers.get("content-type"), /image\/webp/);
  assert.equal((await (await fetch(`${base}/api/media`)).json()).items.length, 1);
  assert.equal((await fetch(`${base}/api/media/${item.id}`, { method: "DELETE", headers: { Origin: options.origin } })).status, 401);
  await new Promise(resolve => server.close(resolve)); await runtime.close();
  runtime = await createApp(options); base = await start();
  assert.equal((await (await fetch(`${base}/api/media`)).json()).items[0].title, fields.title);
  assert.equal((await fetch(`${base}${item.url}`)).status, 200);
  const updated = await fetch(`${base}/api/media/${item.id}`, { ...json({ ...fields, title: "Updated title" }, cookie), method: "PATCH" });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).item.title, "Updated title");
  assert.equal((await fetch(`${base}/api/media/${item.id}`, { method: "DELETE", headers: { Origin: options.origin, Cookie: cookie } })).status, 200);
  assert.equal((await fetch(`${base}${item.url}`)).status, 404);
  assert.equal((await (await fetch(`${base}/api/media`)).json()).items.length, 0);
  assert.equal((await fetch(`${base}/api/media/logout`, json({}, cookie))).status, 200);
  assert.equal((await (await fetch(`${base}/api/media/session`, { headers: { Cookie: cookie } })).json()).authenticated, false);
});

test('mongo: original gallery imports once, serves photos, and respects edits and deletions after restart', { skip: !process.env.TEST_MONGODB_URI }, async t => {
  const mongo = await mongoFixture(t);
  const salt = '0123456789abcdef0123456789abcdef';
  const options = { mongo, passwordHash: `${salt}:${scryptSync('seed-test-password', salt, 64).toString('hex')}`, origin: 'http://localhost:5173', seedDir: path.resolve('server/seed-media') };
  let runtime = await createApp(options);
  let server = runtime.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const items = (await (await fetch(`${base}/api/media`)).json()).items;
    assert.equal(items.length, 23);
    assert.equal((await fetch(`${base}${items[0].url}`)).status, 200);
    const { createMongoStore } = await import('./mongo-store.js');
    const store = await createMongoStore(mongo);
    try {
      await store.deleteFile(items[0].url.split('/').at(-1));
      await store.delete(items[0].id);
      await store.update(items[1].id, { title: 'Owner edited caption' });
    } finally { await store.close(); }
    assert.equal((await fetch(`${base}${items[0].url}`)).status, 404);
    await new Promise(resolve => server.close(resolve)); await runtime.close();
    runtime = await createApp(options);
    const after = await createMongoStore(mongo);
    try { assert.equal((await after.list()).length, 22); assert.equal((await after.get(items[1].id)).title, 'Owner edited caption'); }
    finally { await after.close(); }
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await runtime.close();
  }
});

test("the supplied gallery imports once and respects later edits and deletions", async t => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "supergraphic-seed-test-"));
  const salt = "0123456789abcdef0123456789abcdef";
  const options = { dataDir, passwordHash: `${salt}:${scryptSync("seed-test-password", salt, 64).toString("hex")}`, origin: "http://localhost:5173", seedDir: path.resolve("server/seed-media") };
  const first = await createApp(options); await first.close();
  const { DatabaseSync } = await import("node:sqlite");
  let db = new DatabaseSync(path.join(dataDir, "gallery.sqlite"));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM media").get().count, 23);
  const rows = db.prepare("SELECT * FROM media ORDER BY createdAt DESC").all();
  assert.equal(rows[0].title, "Danube building signage");
  db.prepare("DELETE FROM media WHERE id=?").run(rows[0].id);
  db.prepare("UPDATE media SET title='Owner edited caption' WHERE id=?").run(rows[1].id);
  db.close();
  const second = await createApp(options); await second.close();
  db = new DatabaseSync(path.join(dataDir, "gallery.sqlite"));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM media").get().count, 22);
  assert.equal(db.prepare("SELECT title FROM media WHERE id=?").get(rows[1].id).title, "Owner edited caption");
  db.close();
  t.after(() => rm(dataDir, { recursive: true, force: true }));
});

