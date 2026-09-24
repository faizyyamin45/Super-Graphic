import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import sharp from 'sharp';
import { MongoClient } from 'mongodb';

if (!process.env.TEST_MONGODB_URI || !process.env.PHP_BINARY) throw new Error('Set TEST_MONGODB_URI and PHP_BINARY to run the PHP integration checks.');
const root = path.resolve(os.tmpdir(), `sg-php-${randomUUID()}`);
const database = `sgt_${randomUUID().replaceAll('-', '')}`;
const php = process.env.PHP_BINARY;
const password = 'Temporary-test-password-only';
const phpHash = spawnSync(php, ['-r', 'echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'], { input: password, encoding: 'utf8' });
assert.equal(phpHash.status, 0, 'PHP password hashing failed');
const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const config = { mongodb_uri: process.env.TEST_MONGODB_URI, mongodb_username: process.env.TEST_MONGODB_USERNAME || '', mongodb_password: process.env.TEST_MONGODB_PASSWORD || '', mongodb_database: database, site_origin: base, production: false, admin_password_hash: phpHash.stdout };
const client = new MongoClient(config.mongodb_uri, { ...(config.mongodb_username ? { auth: { username: config.mongodb_username, password: config.mongodb_password } } : {}) });
let server, logs = '';
const start = async () => {
  server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public_html'), path.resolve('hostinger/test-router.php')], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  server.stderr.on('data', data => { logs += data; });
  server.stdout.on('data', data => { logs += data; });
  for (let n = 0; n < 100; n++) {
    try { const response = await fetch(base); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('PHP server did not start');
};
const stop = async () => { if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; } };
const cleanupFiles = async () => {
  if (!root.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(root).startsWith('sg-php-')) throw new Error('Unexpected test cleanup path');
  await rm(root, { recursive: true, force: true });
};
const json = (body, cookie, method = 'POST') => ({ method, headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
try {
  await mkdir(root);
  await cp('hostinger-build', root, { recursive: true });
  await writeFile(path.join(root, 'supergraphic-private/config.php'), `<?php return json_decode(base64_decode('${Buffer.from(JSON.stringify(config)).toString('base64')}'), true);`);
  await client.connect();
  await start();
  assert.equal((await fetch(`${base}/api/media`, { method: 'POST', headers: { Origin: base } })).status, 401);
  const initial = await fetch(`${base}/api/media`);
  assert.equal(initial.status, 200, 'Initial gallery/database connection');
  const seeds = (await initial.json()).items;
  assert.equal(seeds.length, 23);
  assert.equal((await fetch(`${base}${seeds[0].url}`)).status, 200);
  assert.equal((await fetch(`${base}/api/media/login`, { ...json({ password }), headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await fetch(`${base}/api/media/login`, json({ password: 'wrong' }))).status, 401);
  const login = await fetch(`${base}/api/media/login`, json({ password }));
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const fields = { title: 'PHP upload test', description: 'Temporary integration test photo.', service: '3d-signage', titleAr: '', descriptionAr: '' };
  const photo = await sharp({ create: { width: 120, height: 180, channels: 3, background: 'orange' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const upload = (bytes, changes = {}) => {
    const form = new FormData(); for (const [key, value] of Object.entries({ ...fields, ...changes })) form.set(key, value);
    form.set('image', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
    return fetch(`${base}/api/media`, { method: 'POST', headers: { Origin: base, Cookie: cookie }, body: form });
  };
  assert.equal((await upload(Buffer.from('bad image'))).status, 400);
  assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).status, 400);
  assert.equal((await upload(photo, { service: 'invalid' })).status, 400);
  assert.equal((await upload(photo, { title: ' ' })).status, 400);
  assert.equal((await upload(Buffer.alloc(12 * 1024 * 1024 + 1))).status, 400);
  const uploaded = await upload(photo);
  assert.equal(uploaded.status, 201, 'Image upload');
  const item = (await uploaded.json()).item;
  assert.equal(item.width, 180, 'EXIF orientation applied'); assert.equal(item.height, 120);
  const image = await fetch(`${base}${item.url}`);
  assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /image\/webp/);
  assert.equal((await fetch(`${base}${item.url}`, { method: 'HEAD' })).status, 200);
  assert.equal((await client.db(database).collection('php_images').countDocuments({})), 1);
  assert.equal((await fetch(`${base}/api/media/${item.id}`, { method: 'DELETE', headers: { Origin: base } })).status, 401);
  assert.equal((await fetch(`${base}/api/media/${item.id}`, json({ ...fields, title: 'Updated caption' }, cookie, 'PATCH'))).status, 200);
  assert.equal((await fetch(`${base}/api/media/${seeds[0].id}`, { method: 'DELETE', headers: { Origin: base, Cookie: cookie } })).status, 200);
  await stop(); await start();
  const after = (await (await fetch(`${base}/api/media`)).json()).items;
  assert.equal(after.length, 23); // 22 original + the new upload
  assert.equal(after.find(row => row.id === item.id).title, 'Updated caption');
  assert.equal((await fetch(`${base}${item.url}`)).status, 200, 'Image survives process restart');
  assert.equal((await fetch(`${base}${seeds[0].url}`)).status, 404, 'Deleted seed stays deleted');
  assert.equal((await fetch(`${base}/api/media/${item.id}`, { method: 'DELETE', headers: { Origin: base, Cookie: cookie } })).status, 200);
  assert.equal((await client.db(database).collection('php_images').countDocuments({})), 0);
  assert.equal((await fetch(`${base}${item.url}`)).status, 404);
  assert.equal((await fetch(`${base}/api/media/logout`, json({}, cookie))).status, 200);
  assert.equal((await (await fetch(`${base}/api/media/session`, { headers: { Cookie: cookie } })).json()).authenticated, false);
  for (let n = 0; n < 8; n++) assert.equal((await fetch(`${base}/api/media/login`, json({ password: 'wrong' }))).status, 401);
  assert.equal((await fetch(`${base}/api/media/login`, json({ password: 'wrong' }))).status, 429);
  console.log('PASS: PHP/Atlas auth, CSRF, image validation/orientation, upload/download, edit, restart persistence, seed deletion, logout, rate limiting.');
} catch (error) {
  console.error('PHP integration checks failed:', error.name, error.actual ?? '', error.expected ?? '');
  const sanitized = logs.split('\n').filter(line => line.includes('Super Graphic API failure:'));
  for (const line of sanitized) console.error(line);
  process.exitCode = 1;
} finally {
  await stop();
  try { await client.db(database).dropDatabase(); } finally { await client.close(); }
  await cleanupFiles();
}
