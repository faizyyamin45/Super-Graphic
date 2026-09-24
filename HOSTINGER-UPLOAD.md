# Super Graphic — upload through Hostinger File Manager

This is the selected production build: prebuilt React pages with a PHP admin API, all hosted on Hostinger. MongoDB Atlas stores project details and uploaded WebP images. No Node.js process, GitHub deployment, Render service, Composer command, or terminal command is needed on the hosting account.

## What was checked

The existing `supergraphic.ae` website is on Hostinger Cloud, with PHP 8.5.5, GD, Fileinfo, Mbstring and OpenSSL. The MongoDB PHP extension has been enabled and its version is 2.2.1. The PHP backend uses the native extension directly. Its login, origin checks, upload validation, EXIF orientation, image retrieval, edit/delete, restart persistence, one-time seed import and login rate limiting were tested against an isolated Atlas test database.

The existing live WordPress files and DNS have not been replaced. A connection from Hostinger to Atlas still needs to be verified after upload; the successful integration tests ran from the local test environment.

## Upload the prepared ZIP

1. Download a backup of the current WordPress files and database from Hostinger before replacing the live site.
2. Open **Websites > supergraphic.ae > Dashboard > File Manager**. Choose access to all hosting files if necessary so you can see the directory above `public_html`.
3. Go to `/home/u302374095/domains/supergraphic.ae/`.
4. Create a dated folder such as `previous-website-2026-09-24` at this level, outside `public_html`. Move the old contents of `public_html` into it, including the old `.htaccess` and `index.php`. Do this only when ready to switch the live website; there will be a brief interruption until the new files are extracted.
5. Upload **Super-Graphic-Hostinger.zip** to `/home/u302374095/domains/supergraphic.ae/` — **not inside public_html**. Extract it into that same directory without adding an extra enclosing folder.
6. Check the resulting structure:

```
/home/u302374095/domains/supergraphic.ae/
  public_html/
    index.html
    .htaccess
    assets/
    images/
    api/index.php
  supergraphic-private/
    config.php
    app.php
    database.php
    services.json
    seed-media/
```

7. `config.php` in the prepared private ZIP already contains your supplied MongoDB connection details and a generated PHP admin-password hash. Keep `supergraphic-private` outside `public_html`. The separate **HOSTINGER-ADMIN-ACCESS.txt** contains your login password; do not upload it.
8. Use permissions `600` for private `config.php` if Hostinger permits it; do not make any directory world-writable. Remove the uploaded ZIP from the hosting server after successful extraction and testing; keep your local copy private.
9. Confirm the domain has HTTPS enabled. Open `https://supergraphic.ae/`, then `https://supergraphic.ae/admin`.

## MongoDB network access

Atlas must allow outbound connections from your Hostinger server. If the gallery returns “temporarily unavailable,” obtain the correct outbound IP from Hostinger support and add that address in **Atlas > Security > Network Access**. Use the actual server egress address, which can differ from the website's DNS address. Keep the existing database credentials private. No Atlas allow-list settings were changed by this build.

The database name is `supergraphic`. The first request imports the 23 original gallery records once. Uploaded image bytes are stored in `php_images`; metadata is in `media`. Admin sessions and rate limits use `php_sessions` and `php_login_attempts`. Do not delete `app_meta`: it records the completed seed import.

## Verify after upload

- Home, Services, individual service pages, Our Work, About and Contact open directly and after refreshing.
- The gallery shows the original projects. Call and WhatsApp links work.
- `/admin` accepts the password from HOSTINGER-ADMIN-ACCESS.txt.
- A new JPG, PNG or WebP upload appears in Our Work, can be edited, and can be deleted. The limit is 12 MB and 40 megapixels.
- The upload remains after refreshing or uploading a new frontend build.
- `/supergraphic-private/config.php` is not accessible on the public site. Credentials are never inside JavaScript assets.

The package redirects `www.supergraphic.ae` to the canonical `https://supergraphic.ae` address. The `site_origin` value in the private config must match the exact HTTPS origin used for admin actions. Update it if testing on a different domain.

## Later updates and backups

For design changes, rebuild locally using `npm run build:hostinger`, then upload the new public files and any changed PHP application files. Preserve the live private `config.php`; do not overwrite it with a placeholder. Uploaded projects remain in Atlas and are not overwritten by website files. Back up Atlas's `media`, `php_images` and `app_meta` collections together, plus your private configuration and seed assets. Existing SQLite/Node-local uploads are not automatically migrated; only the original supplied gallery is seeded.

For a new unconfigured build, copy `config.example.php` to `config.php` in the private directory and fill in its values. The admin hash must be generated with PHP `password_hash`, not the previous Node salt:hash format.

## Developer checks

The source lives in `hostinger/`; `npm run build:hostinger` produces `hostinger-build/`. The build contains no Node source or node_modules. To run the PHP integration checks, set `PHP_BINARY`, `TEST_MONGODB_URI` and optional `TEST_MONGODB_USERNAME` / `TEST_MONGODB_PASSWORD`, then run `node hostinger/test-api.mjs`. Tests create and remove only uniquely named `sgt_...` databases. Never point a test cleanup at the live database.
