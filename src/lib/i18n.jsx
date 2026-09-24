import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UI } from "../data/uiStrings.js";

export const LANGS = {
  en: { code: "en", dir: "ltr", label: "English", short: "EN" },
  ar: { code: "ar", dir: "rtl", label: "العربية", short: "ع" },
};

const STORAGE_KEY = "supergraphic_lang";
const LangContext = createContext(null);

function detectInitialLang() { return "en"; }

/**
 * Resolve a possibly-bilingual value.
 * Strings pass through untouched; { en, ar } objects resolve for the active
 * language and fall back to English so a missing translation never blanks the UI.
 */
export function pick(value, lang) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("en" in value || "ar" in value) return value[lang] ?? value.en ?? "";
  }
  return value;
}

/** Deep-resolve every bilingual leaf inside an object/array tree. */
export function localize(node, lang) {
  if (Array.isArray(node)) return node.map((n) => localize(n, lang));
  if (node && typeof node === "object") {
    if ("en" in node || "ar" in node) return pick(node, lang);
    const out = {};
    for (const k of Object.keys(node)) out[k] = localize(node[k], lang);
    return out;
  }
  return node;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);
  const dir = LANGS[lang].dir;

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    root.classList.toggle("is-rtl", dir === "rtl");
  }, [lang, dir]);

  const setLang = useCallback((next) => {
    if (!LANGS[next]) return;
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked — language resets next visit */ }
  }, []);

  const t = useCallback(
    (key) => {
      const entry = UI[key];
      if (!entry) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing UI string: ${key}`);
        return key;
      }
      return entry[lang] ?? entry.en;
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, dir, isRTL: dir === "rtl", setLang, t, pick: (v) => pick(v, lang) }),
    [lang, dir, setLang, t]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}

