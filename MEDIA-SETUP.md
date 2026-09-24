# Backend image administration

## Local
Run npm ci, npm run setup and npm run dev. The combined development command starts Vite on 127.0.0.1:5173 and the Express API on 127.0.0.1:3001.
Sign in at /admin using the generated password in .admin-access.txt, or the separately supplied ADMIN-ACCESS.txt for the prepared workspace.

Upload JPG, PNG or WebP files up to 12 MB and 40 megapixels. Choose a service, enter a title and description, then publish.
Images are decoded and converted to WebP automatically. Image files and metadata persist on the server.
The three newest uploads appear on the homepage. All images appear in Our work. Captions and categories can be edited. Deletion removes both the database record and file.

## Production
For the selected **Hostinger File Manager + PHP + MongoDB** setup, follow **HOSTINGER-UPLOAD.md**. The settings below describe the alternative Node.js/SQLite deployment. The Node backend also supports Atlas via MONGODB_URI, as described in RENDER-DEPLOY.md.

Use a Node.js 24+ host with persistent disk, an HTTPS reverse proxy, and these environment variables:

```
NODE_ENV=production
SITE_ORIGIN=https://supergraphic.ae
VITE_MEDIA_BACKEND=server
PORT=3001
HOST=0.0.0.0
ADMIN_PASSWORD_HASH=<generated salt:hash>
MEDIA_DATA_DIR=/absolute/persistent/directory/outside-the-deployment
TRUST_PROXY_HOPS=<actual reverse proxy hop count>
```

1. Install dependencies with npm ci.
2. Generate a fresh production credential with npm run admin:password and store its result in the server environment.
3. Set VITE_MEDIA_BACKEND=server while running npm run build.
4. Start with npm start. Express serves dist, /api and /media-files from one origin.
5. Route the public HTTPS hostname to the Node process. SITE_ORIGIN must match the exact public origin.
6. Keep MEDIA_DATA_DIR outside the source checkout and deployment folder. Back it up, including gallery.sqlite and uploads/. Stop the service or use SQLite-aware backup tooling for consistent database backups.

The initial 23 source-site project photos import only once. A database marker prevents deleted seed photos reappearing on restart.
Images are protected from unauthorized writes by server-side sessions, HttpOnly cookies, origin validation and rate-limited login.
Production cookies use Secure and SameSite=Strict. Do not publish .env or admin-access files.

## Password rotation
Run npm run admin:password, replace ADMIN_PASSWORD_HASH, then restart the service. Existing sessions are invalidated.

