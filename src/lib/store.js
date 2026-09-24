// ============================================================
// SUPER GRAPHIC local data layer — no external database.
// Content overrides + leads are persisted in localStorage.
//
// NOTE ON LEADS: localStorage is per-browser. A lead submitted by
// a visitor is stored in THAT visitor's browser; it reaches Super Graphic
// through the WhatsApp message the form hands off to. The /admin
// Leads tab therefore shows what was captured on the device it is
// opened on, plus anything merged in via JSON import.
// ============================================================

const KEYS = {
  content: "supergraphic_content_signage_v2",
  leads: "supergraphic_leads_v1",
  auth: "supergraphic_admin_session",
  pass: "supergraphic_admin_pass_v2", // v2 = salted hash, not plaintext
  legacyPass: "supergraphic_admin_pass",
  attempts: "supergraphic_admin_attempts",
};

export const DEFAULT_PASSWORD = "supergraphic2026"; // change it from Admin → Settings

function read(key, fallback, storage = localStorage) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("supergraphic:store"));
    return true;
  } catch {
    // Quota exceeded or storage blocked (private mode, cookie-blocking).
    return false;
  }
}

// ---------- content overrides ----------
export function getContentOverrides() {
  return read(KEYS.content, {});
}
export function setContentOverrides(overrides) {
  return write(KEYS.content, overrides);
}
export function resetContentOverrides() {
  try { localStorage.removeItem(KEYS.content); } catch { /* nothing stored to clear */ }
  window.dispatchEvent(new Event("supergraphic:store"));
}

// ---------- leads ----------
export function getLeads() {
  const list = read(KEYS.leads, []);
  return Array.isArray(list) ? list : [];
}

export function saveLead(lead) {
  const leads = getLeads();
  const entry = {
    // Date.now() alone collides when two forms submit in the same millisecond.
    id: `L-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "new",
    ...lead,
  };
  leads.unshift(entry);
  write(KEYS.leads, leads);
  return entry;
}

export function updateLead(id, patch) {
  return write(KEYS.leads, getLeads().map((l) => (l.id === id ? { ...l, ...patch } : l)));
}

export function deleteLead(id) {
  return write(KEYS.leads, getLeads().filter((l) => l.id !== id));
}

/** Merge an exported JSON list, skipping ids already present. Returns the count added. */
export function importLeads(list) {
  if (!Array.isArray(list)) return false;
  const existing = getLeads();
  const ids = new Set(existing.map((l) => l.id));
  const incoming = list.filter((l) => l && typeof l === "object" && l.id && !ids.has(l.id));
  const merged = [...incoming, ...existing];
  merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return write(KEYS.leads, merged) ? incoming.length : false;
}

export function leadsToCSV(leads) {
  const cols = ["id", "createdAt", "status", "name", "phone", "phoneE164", "email", "service", "message", "lang", "source", "consent"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [cols.join(","), ...leads.map((l) => cols.map((c) => esc(l[c])).join(","))].join("\r\n");
  // Excel needs the byte-order mark to read Arabic message text as UTF-8.
  return "﻿" + rows;
}

// ---------- admin auth (client-side gate only) ----------
// This gate keeps casual visitors out of /admin. It is NOT server-side
// security: anything in this bundle is readable by anyone who looks.
// Storing a salted hash simply avoids leaving the password itself sitting
// in localStorage in clear text on a shared machine.

const enc = new TextEncoder();

async function hash(password, salt) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function setAdminPassword(password) {
  const salt = randomSalt();
  const digest = await hash(password, salt);
  try { localStorage.removeItem(KEYS.legacyPass); } catch { /* no legacy value */ }
  return write(KEYS.pass, { salt, digest, isDefault: password === DEFAULT_PASSWORD });
}

/** True while the gate is still on the shipped default password. */
export function isDefaultPassword() {
  const stored = read(KEYS.pass, null);
  if (!stored) {
    const legacy = read(KEYS.legacyPass, null);
    return legacy === null || legacy === DEFAULT_PASSWORD;
  }
  return stored.isDefault === true;
}

/** Seed the hash on first use, migrating any plaintext value left by v1. */
async function ensureSeeded() {
  if (read(KEYS.pass, null)) return;
  const legacy = read(KEYS.legacyPass, null);
  const seed = typeof legacy === "string" ? legacy : DEFAULT_PASSWORD;
  const salt = randomSalt();
  write(KEYS.pass, { salt, digest: await hash(seed, salt), isDefault: seed === DEFAULT_PASSWORD });
  try { localStorage.removeItem(KEYS.legacyPass); } catch { /* no legacy value */ }
}

const LOCK_AFTER = 5;
const LOCK_MS = 60_000;

/** Remaining lockout in ms, or 0 when a login attempt is allowed. */
export function loginLockRemaining() {
  const a = read(KEYS.attempts, null, sessionStorage);
  if (!a || a.count < LOCK_AFTER) return 0;
  return Math.max(0, a.until - Date.now());
}

function noteAttempt(ok) {
  try {
    if (ok) { sessionStorage.removeItem(KEYS.attempts); return; }
    const a = read(KEYS.attempts, { count: 0, until: 0 }, sessionStorage);
    a.count += 1;
    if (a.count >= LOCK_AFTER) a.until = Date.now() + LOCK_MS;
    sessionStorage.setItem(KEYS.attempts, JSON.stringify(a));
  } catch { /* sessionStorage blocked — throttling is best-effort */ }
}

export async function loginAdmin(password) {
  if (loginLockRemaining() > 0) return false;
  await ensureSeeded();
  const stored = read(KEYS.pass, null);
  if (!stored) return false;
  const ok = (await hash(password, stored.salt)) === stored.digest;
  noteAttempt(ok);
  if (ok) {
    try { sessionStorage.setItem(KEYS.auth, "1"); } catch { /* gate degrades to this render only */ }
  }
  return ok;
}

export function isAdminLoggedIn() {
  try { return sessionStorage.getItem(KEYS.auth) === "1"; } catch { return false; }
}

export function logoutAdmin() {
  try { sessionStorage.removeItem(KEYS.auth); } catch { /* already gone */ }
}

// ---------- helpers ----------
export function downloadFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileToDataUrl(file, maxSize = 1400) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Not an image file."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
