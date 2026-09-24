import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as defaults from "../data/siteContent.js";
import { getContentOverrides } from "./store.js";
import { localize, useLang } from "./i18n.jsx";

const ContentContext = createContext(null);
/** Raw (un-localized, bilingual) content — the shape the admin panel edits. */
const RawContentContext = createContext(null);

/** Merge built-in defaults with admin overrides, still bilingual. */
function buildRaw() {
  const o = getContentOverrides();
  return {
    company: { ...defaults.COMPANY, ...(o.company || {}) },
    hero: { ...defaults.HERO, ...(o.hero || {}) },
    stats: o.stats?.length ? o.stats : defaults.STATS,
    services: (o.services?.length ? o.services : defaults.SERVICES).filter((service) => service.line === "signage"),
    testimonials: o.testimonials?.length ? o.testimonials : defaults.TESTIMONIALS,
    faqs: o.faqs?.length ? o.faqs : defaults.FAQS,
    copy: defaults.COPY,
    seo: defaults.SEO,
  };
}

export function ContentProvider({ children }) {
  const { lang } = useLang();
  const [raw, setRaw] = useState(buildRaw);

  useEffect(() => {
    const refresh = () => setRaw(buildRaw());
    window.addEventListener("supergraphic:store", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("supergraphic:store", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Resolve every { en, ar } leaf once per language change, not per component.
  const localized = useMemo(() => localize(raw, lang), [raw, lang]);

  return (
    <RawContentContext.Provider value={raw}>
      <ContentContext.Provider value={localized}>{children}</ContentContext.Provider>
    </RawContentContext.Provider>
  );
}

/** Content resolved to the active language — what pages and components render. */
export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContent must be used inside ContentProvider");
  return ctx;
}

/** Bilingual content as authored — used by the admin editor. */
export function useRawContent() {
  const ctx = useContext(RawContentContext);
  if (!ctx) throw new Error("useRawContent must be used inside ContentProvider");
  return ctx;
}
