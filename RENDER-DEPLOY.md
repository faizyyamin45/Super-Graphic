# Deploy Super Graphic from GitHub to Render

The Node web service serves the website, admin and API on one domain. MongoDB Atlas stores gallery records, sessions and new image uploads (GridFS). The original 23 project photos stay in the repository and their editable records seed once. No persistent Render disk is needed with MongoDB enabled.

## Deploy

### Standard web service (no Blueprint needed)

Choose **New > Web Service**, select `faizyyamin45/Super-Graphic`, and use branch `main`. Leave Root Directory empty. Set Build Command to `npm ci --include=dev && npm run build` and Start Command to `npm start`. Select the **Free ($0/month)** compute plan explicitly; the form may initially select a paid plan. Use **Add from .env > Choose a file** to import the separately supplied private `Super-Graphic-Render.env`, then click **Add variables**. Set the health-check path to `/api/media` under Advanced, then deploy. The database access and verification steps below also apply.

### Blueprint alternative

Blueprint creation can ask for card verification even when the YAML selects a free service. The standard Web Service flow above offers the same application setup without relying on Blueprint creation.

1. Sign in to https://dashboard.render.com with GitHub.
2. Choose **New > Blueprint** and connect `faizyyamin45/Super-Graphic`, branch `main`. Give Render access to this private repository when prompted.
3. Render reads `render.yaml`. It selects Node 24, builds with `npm ci --include=dev && npm run build`, then starts `npm start`.
4. Enter the four private settings prompted by the Blueprint: `MONGODB_URI`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`, and `ADMIN_PASSWORD_HASH`. The Atlas values come from your credentials file. Generate the admin hash with `npm run admin:password`, or use the separately prepared private deployment settings. Never commit these values.
5. Create the service. Under the service's **Connect > Outbound**, copy its outbound IP ranges. In MongoDB Atlas, add those ranges to **Security > Network Access** for the cluster's project. Save and redeploy if the initial database connection failed. Your database user needs read/write access to `supergraphic`.
6. The site automatically uses Render's assigned HTTPS address. Open that address and `/admin`, then sign in with the password matching your hash.
7. Upload a test project, check it in Our Work, manually redeploy, and confirm it remains. Delete the test project afterward.

The Blueprint starts on Render's free plan. Free web services sleep after inactivity and can be slow to wake. Choose an always-on paid plan before a business launch if uninterrupted responses are required; review Render's current pricing before changing the plan.

## Custom domain

Test the Render URL before changing the current live site. Back up the existing website and preserve mail DNS records. Add `supergraphic.ae` under the Render service's **Settings > Custom Domains**, then follow Render's exact DNS instructions. After HTTPS works, add `SITE_ORIGIN=https://supergraphic.ae` in Render's environment settings and redeploy. Use this canonical address for admin login; configure www to redirect to it.

## Environment

`render.yaml` supplies non-secret build and runtime values. Render supplies its own `PORT` and `RENDER_EXTERNAL_URL`; no hardcoded service URL is needed. `SITE_ORIGIN`, when provided, overrides the Render URL. `TRUST_PROXY_HOPS=1` assumes direct public traffic through Render's proxy; revisit it if adding another proxy.

`VITE_MEDIA_BACKEND=server` must be present during the build. MongoDB variables must never use the `VITE_` prefix. `MONGODB_DATABASE` defaults to `supergraphic`. With MongoDB enabled, `MEDIA_DATA_DIR` is unused. Without MongoDB, the local development server still supports SQLite and filesystem storage.

## Updates and backups

Push code to GitHub's `main` branch to trigger the connected service's deployment. Project uploads go directly to Atlas, not GitHub. Keep database backups that include `media`, `app_meta`, and both `gallery_images.files` and `gallery_images.chunks`. Sessions may be discarded to sign everyone out. Existing local SQLite uploads are not automatically migrated; transfer any local-only uploads before switching storage.

## Checks

`npm test` runs local SQLite tests and skips Atlas tests by default. To exercise Atlas, supply `TEST_MONGODB_URI` and optional `TEST_MONGODB_USERNAME` / `TEST_MONGODB_PASSWORD`, then run `npm test`. The tests create uniquely named `sgt_...` databases and drop only those test databases afterward; they never target the live `supergraphic` database. The test account therefore needs permission to create/drop those temporary databases.

Documentation:
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/outbound-ip-addresses
- https://render.com/docs/free
- https://render.com/docs/custom-domains
