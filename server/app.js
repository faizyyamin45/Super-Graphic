import express from "express";
import multer from "multer";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";
import { createMongoStore } from "./mongo-store.js";
import { createSqliteStore } from "./sqlite-store.js";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import path from "node:path";
import { MEDIA_SERVICES } from "../src/data/mediaServices.js";

export async function createApp({ mongo, dataDir, passwordHash, origin, production = false, trustProxy = false, distDir = path.resolve("dist"), seedDir }) {
  if ((!mongo?.uri && !dataDir) || !passwordHash || !origin) throw new Error("Set MongoDB or MEDIA_DATA_DIR, ADMIN_PASSWORD_HASH and SITE_ORIGIN before starting the server.");
  const [salt, digest] = passwordHash.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(digest || "")) throw new Error("Invalid ADMIN_PASSWORD_HASH. Use npm run admin:password.");
  const allowedOrigin = new URL(origin).origin;
  const store = mongo?.uri
    ? await createMongoStore({ ...mongo, seedDir })
    : createSqliteStore({ dataDir, seedDir });
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  const cookieName = production ? "__Host-supergraphic_media" : "supergraphic_media";
  const cookieOptions = { httpOnly: true, secure: production, sameSite: "strict", path: "/" };
  const hashToken = token => createHash("sha256").update(token).digest("hex");
  const credential = hashToken(passwordHash);
  const tokenFrom = req => (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
  const session = req => store.session(hashToken(tokenFrom(req)), credential);
  const requireAdmin = async (req, res, next) => await session(req) ? next() : res.status(401).json({ error: "Your session has expired. Please sign in again." });
  app.use((req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN", "Referrer-Policy": "strict-origin-when-cross-origin" });
    if (production) res.set("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin !== allowedOrigin) return res.status(403).json({ error: "Request origin not allowed." });
    next();
  }, express.json({ limit: "32kb" }));
  app.get("/api/media/session", async (req, res) => res.json({ authenticated: Boolean(await session(req)) }));
  app.post("/api/media/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many sign-in attempts. Try again in 15 minutes." } }), async (req, res) => {
    const password = req.body?.password;
    if (typeof password !== "string" || password.length > 256 || !timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, "hex"))) return res.status(401).json({ error: "Incorrect password." });
    await store.pruneSessions(credential);
    await store.deleteSession(hashToken(tokenFrom(req)));
    const token = randomBytes(32).toString("hex");
    await store.createSession(hashToken(token), Date.now() + 8 * 3600_000, credential);
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: 8 * 3600_000 }).json({ authenticated: true });
  });
  app.post("/api/media/logout", async (req, res) => {
    await store.deleteSession(hashToken(tokenFrom(req)));
    res.clearCookie(cookieName, cookieOptions).json({ authenticated: false });
  });
  const present = row => { const { filename, ...item } = row; return { ...item, url: `/media-files/${filename}` }; };
  app.get("/api/media", async (req, res) => res.json({ items: (await store.list()).map(present) }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 5, fieldSize: 8192, parts: 6 } });
  const metadata = body => {
    const result = {};
    for (const [key, max, required] of [["title", 160, true], ["description", 2000, true], ["titleAr", 160, false], ["descriptionAr", 2000, false], ["service", 80, true]]) {
      const value = body?.[key] ?? "";
      if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw Object.assign(new Error(`Please provide a valid ${key} (maximum ${max} characters).`), { status: 400 });
      result[key] = value.trim();
    }
    if (!MEDIA_SERVICES.some(s => s.slug === result.service)) throw Object.assign(new Error("Select a Super Graphic service."), { status: 400 });
    return result;
  };
  app.post("/api/media", requireAdmin, upload.single("image"), async (req, res) => {
    const fields = metadata(req.body);
    if (!req.file) return res.status(400).json({ error: "Choose an image to upload." });
    let output;
    try {
      const pipeline = sharp(req.file.buffer, { limitInputPixels: 40_000_000, animated: false });
      const info = await pipeline.metadata();
      if (!["jpeg", "png", "webp"].includes(info.format) || (info.pages || 1) > 1) throw new Error("Unsupported image");
      output = await pipeline.autoOrient().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    } catch { return res.status(400).json({ error: "Upload a valid JPG, PNG or WebP image, up to 12 MB and 40 megapixels." }); }
    const id = randomUUID();
    const filename = `${id}.webp`;
    await store.writeFile(filename, output.data);
    try {
      await store.insert({ id, ...fields, filename, width: output.info.width, height: output.info.height, createdAt: new Date().toISOString() });
    } catch (err) { await store.deleteFile(filename); throw err; }
    res.status(201).json({ item: present(await store.get(id)) });
  });
  app.patch("/api/media/:id", requireAdmin, async (req, res) => {
    const fields = metadata(req.body);
    const result = await store.update(req.params.id, fields);
    if (!result) return res.status(404).json({ error: "Image not found." });
    res.json({ item: present(await store.get(req.params.id)) });
  });
  app.delete("/api/media/:id", requireAdmin, async (req, res) => {
    const item = await store.get(req.params.id);
    if (!item) return res.status(404).json({ error: "Image not found." });
    await store.deleteFile(item.filename);
    await store.delete(item.id);
    res.json({ deleted: true });
  });
  app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found." }));
  if (mongo?.uri) app.get("/media-files/:filename", store.serveFile);
  else app.use("/media-files", store.serveFile);
  app.use("/media-files", (req, res) => res.sendStatus(404));
  app.use(express.static(distDir, { index: false }));
  app.get("/{*path}", (req, res) => { res.set("Cache-Control", "no-cache"); res.sendFile(path.join(distDir, "index.html")); });
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError) return res.status(400).json({ error: "Choose one image up to 12 MB and keep text within the field limits." });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error("Media request failed:", err.name, err.code || "");
    res.status(500).json({ error: "Unable to save changes. Please try again." });
  });
  return { app, close: () => store.close() };
}
