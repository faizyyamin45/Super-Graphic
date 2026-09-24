import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useContent } from "../lib/ContentContext.jsx";
import { useLang } from "../lib/i18n.jsx";

/**
 * Per-page head tags: title, description, canonical, hreflang alternates and
 * Open Graph. Rendered once per page so social previews and search results
 * stop inheriting the generic index.html copy on every route.
 */
export default function Seo({ title, description, image, type = "website", noindex = false, children }) {
  const { company } = useContent();
  const { lang, dir } = useLang();
  const { pathname } = useLocation();

  const base = (company.siteUrl || "").replace(/\/$/, "");
  const url = `${base}${pathname}`;
  const ogImage = image || `${base}/super-graphic-logo.webp`;

  return (
    <Helmet>
      <html lang={lang} dir={dir} />
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <>
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href={url} />
          <link rel="alternate" hrefLang="en-ae" href={url} />
          
          <link rel="alternate" hrefLang="x-default" href={url} />
        </>
      )}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={lang === "ar" ? "ar_AE" : "en_AE"} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />
      {children}
    </Helmet>
  );
}

