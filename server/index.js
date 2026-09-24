import path from "node:path";
import { createApp } from "./app.js";

const production = process.env.NODE_ENV === "production";
if (production && (!process.env.MEDIA_DATA_DIR || !path.isAbsolute(process.env.MEDIA_DATA_DIR))) throw new Error("Production requires an absolute MEDIA_DATA_DIR outside the deployment folder.");
if (production) {
  const relative = path.relative(process.cwd(), process.env.MEDIA_DATA_DIR);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("MEDIA_DATA_DIR must be outside the deployment folder to survive rebuilds.");
  if (new URL(process.env.SITE_ORIGIN).protocol !== "https:") throw new Error("Production SITE_ORIGIN must use HTTPS.");
}
const { app } = createApp({
  dataDir: process.env.MEDIA_DATA_DIR || path.resolve(".media-data"),
  passwordHash: process.env.ADMIN_PASSWORD_HASH,
  origin: process.env.SITE_ORIGIN,
  production,
  trustProxy: process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : false,
  seedDir: path.resolve("server/seed-media"),
});
app.listen(Number(process.env.PORT || 3001), process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1"), () => console.log("Super Graphic website and media API ready."));
