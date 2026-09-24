import { cpSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { MEDIA_SERVICES } from '../src/data/mediaServices.js';

const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this with npm run build:hostinger.');
const build = spawnSync(process.execPath, [npm, 'run', 'build'], { stdio: 'inherit', env: { ...process.env, VITE_MEDIA_BACKEND: 'server' } });
if (build.status !== 0) process.exit(build.status || 1);
const root = 'hostinger-build';
mkdirSync(`${root}/public_html/api`, { recursive: true });
mkdirSync(`${root}/supergraphic-private`, { recursive: true });
cpSync('dist', `${root}/public_html`, { recursive: true });
copyFileSync('hostinger/.htaccess', `${root}/public_html/.htaccess`);
copyFileSync('hostinger/public-api.php', `${root}/public_html/api/index.php`);
for (const file of ['app.php', 'database.php', 'config.example.php']) copyFileSync(`hostinger/${file}`, `${root}/supergraphic-private/${file}`);
cpSync('server/seed-media', `${root}/supergraphic-private/seed-media`, { recursive: true });
writeFileSync(`${root}/supergraphic-private/services.json`, JSON.stringify(MEDIA_SERVICES.map(s => s.slug)));
writeFileSync(`${root}/supergraphic-private/.htaccess`, 'Require all denied\n');
console.log('Hostinger bundle built: public_html + supergraphic-private. Add private config.php before publishing.');
