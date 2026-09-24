import path from "node:path";
import { createApp } from "./app.js";

const production = process.env.NODE_ENV === "production";
const origin = process.env.SITE_ORIGIN || process.env.RENDER_EXTERNAL_URL;
const mongo = process.env.MONGODB_URI ? {
  uri: process.env.MONGODB_URI,
  username: process.env.MONGODB_USERNAME,
  password: process.env.MONGODB_PASSWORD,
  database: process.env.MONGODB_DATABASE || 'supergraphic',
} : undefined;
if (production && !mongo && (!process.env.MEDIA_DATA_DIR || !path.isAbsolute(process.env.MEDIA_DATA_DIR))) throw new Error("Production requires MongoDB or an absolute MEDIA_DATA_DIR outside the deployment folder.");
if (production && !mongo) {
  const relative = path.relative(process.cwd(), process.env.MEDIA_DATA_DIR);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("MEDIA_DATA_DIR must be outside the deployment folder to survive rebuilds.");
}
if (production && new URL(origin).protocol !== "https:") throw new Error("Production SITE_ORIGIN must use HTTPS.");
let runtime;
try { runtime = await createApp({
  mongo,
  dataDir: process.env.MEDIA_DATA_DIR || path.resolve(".media-data"),
  passwordHash: process.env.ADMIN_PASSWORD_HASH,
  origin,
  production,
  trustProxy: process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : false,
  seedDir: path.resolve("server/seed-media"),
}); } catch (error) {
  console.error('Backend startup failed. Check database access and environment settings.', error.name, error.code || '');
  process.exit(1);
}
const server = runtime.app.listen(Number(process.env.PORT || 3001), process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1"), () => console.log("Super Graphic website and media API ready."));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  server.close(async () => { await runtime.close(); process.exit(0); });
});
