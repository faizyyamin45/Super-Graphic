import express from "express";
import multer from "multer";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { MEDIA_SERVICES } from "../src/data/mediaServices.js";

export function createApp({ dataDir, passwordHash, origin, production = false, trustProxy = false, distDir = path.resolve("dist"), seedDir }) {
  if (!dataDir || !passwordHash || !origin) throw new Error("Set MEDIA_DATA_DIR, ADMIN_PASSWORD_HASH and SITE_ORIGIN before starting the server.");
  const [salt, digest] = passwordHash.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(digest || "")) throw new Error("Invalid ADMIN_PASSWORD_HASH. Use npm run admin:password.");
  const allowedOrigin = new URL(origin).origin;
  const uploadDir = path.join(dataDir, "uploads");
  mkdirSync(uploadDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "gallery.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      titleAr TEXT NOT NULL DEFAULT '', descriptionAr TEXT NOT NULL DEFAULT '', service TEXT NOT NULL,
      filename TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, credential TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  if (seedDir && !db.prepare("SELECT value FROM app_meta WHERE key='initial-gallery-v1'").get()) {
    const seeds = JSON.parse(readFileSync(path.join(seedDir, "manifest.json"), "utf8"));
    db.exec("BEGIN IMMEDIATE");
    try {
      const insertedAt = Date.now();
      for (const item of seeds) {
        copyFileSync(path.join(seedDir, item.filename), path.join(uploadDir, item.filename));
        db.prepare("INSERT OR IGNORE INTO media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(item.id, item.title, item.description, item.titleAr, item.descriptionAr, item.service, item.filename, item.width, item.height, new Date(insertedAt - item.order * 1000).toISOString());
      }
      db.prepare("INSERT INTO app_meta VALUES ('initial-gallery-v1', 'complete')").run();
      db.exec("COMMIT");
    } catch (err) { db.exec("ROLLBACK"); db.close(); throw err; }
  }
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  const cookieName = production ? "__Host-supergraphic_media" : "supergraphic_media";
  const cookieOptions = { httpOnly: true, secure: production, sameSite: "strict", path: "/" };
  const hashToken = token => createHash("sha256").update(token).digest("hex");
  const credential = hashToken(passwordHash);
  const tokenFrom = req => (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
  const session = req => db.prepare("SELECT token FROM sessions WHERE token=? AND expires>? AND credential=?").get(hashToken(tokenFrom(req)), Date.now(), credential);
  const requireAdmin = (req, res, next) => session(req) ? next() : res.status(401).json({ error: "Your session has expired. Please sign in again." });
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
  app.get("/api/media/session", (req, res) => res.json({ authenticated: Boolean(session(req)) }));
  app.post("/api/media/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many sign-in attempts. Try again in 15 minutes." } }), (req, res) => {
    const password = req.body?.password;
    if (typeof password !== "string" || password.length > 256 || !timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, "hex"))) return res.status(401).json({ error: "Incorrect password." });
    db.prepare("DELETE FROM sessions WHERE expires<? OR credential<>?").run(Date.now(), credential);
    db.prepare("DELETE FROM sessions WHERE token=?").run(hashToken(tokenFrom(req)));
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(hashToken(token), Date.now() + 8 * 3600_000, credential);
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: 8 * 3600_000 }).json({ authenticated: true });
  });
  app.post("/api/media/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(hashToken(tokenFrom(req)));
    res.clearCookie(cookieName, cookieOptions).json({ authenticated: false });
  });
  const present = row => { const { filename, ...item } = row; return { ...item, url: `/media-files/${filename}` }; };
  app.get("/api/media", (req, res) => res.json({ items: db.prepare("SELECT * FROM media ORDER BY createdAt DESC, id DESC").all().map(present) }));
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
    const filePath = path.join(uploadDir, filename);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, output.data, { flag: "wx" });
    try {
      db.prepare("INSERT INTO media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, fields.title, fields.description, fields.titleAr, fields.descriptionAr, fields.service, filename, output.info.width, output.info.height, new Date().toISOString());
    } catch (err) { await unlink(filePath); throw err; }
    res.status(201).json({ item: present(db.prepare("SELECT * FROM media WHERE id=?").get(id)) });
  });
  app.patch("/api/media/:id", requireAdmin, (req, res) => {
    const fields = metadata(req.body);
    const result = db.prepare("UPDATE media SET title=?, description=?, titleAr=?, descriptionAr=?, service=? WHERE id=?").run(fields.title, fields.description, fields.titleAr, fields.descriptionAr, fields.service, req.params.id);
    if (!result.changes) return res.status(404).json({ error: "Image not found." });
    res.json({ item: present(db.prepare("SELECT * FROM media WHERE id=?").get(req.params.id)) });
  });
  app.delete("/api/media/:id", requireAdmin, async (req, res) => {
    const item = db.prepare("SELECT * FROM media WHERE id=?").get(req.params.id);
    if (!item) return res.status(404).json({ error: "Image not found." });
    await unlink(path.join(uploadDir, item.filename)).catch(err => { if (err.code !== "ENOENT") throw err; });
    db.prepare("DELETE FROM media WHERE id=?").run(item.id);
    res.json({ deleted: true });
  });
  app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found." }));
  app.use("/media-files", express.static(uploadDir, { immutable: true, maxAge: "1y", index: false, dotfiles: "deny" }), (req, res) => res.sendStatus(404));
  app.use(express.static(distDir, { index: false }));
  app.get("/{*path}", (req, res) => { res.set("Cache-Control", "no-cache"); res.sendFile(path.join(distDir, "index.html")); });
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError) return res.status(400).json({ error: "Choose one image up to 12 MB and keep text within the field limits." });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error("Media request failed:", err.message);
    res.status(500).json({ error: "Unable to save changes. Please try again." });
  });
  return { app, close: () => db.close() };
}
