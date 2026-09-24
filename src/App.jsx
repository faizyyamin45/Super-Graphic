import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider, useLang } from "./lib/i18n.jsx";
import { ContentProvider } from "./lib/ContentContext.jsx";
import { Header, Footer, WhatsAppFloat, ScrollToTop } from "./components/shared.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import { ScrollProgress } from "./components/motion.jsx";
import HomePage from "./pages/HomePage.jsx";
import {
  ServicesPage, ServiceDetailPage,
  AboutPage, ContactPage, QuotePage, NotFoundPage,
} from "./pages/OtherPages.jsx";

// The admin panel and the legal pages are never on the visitor's critical path,
// so they are split out of the main bundle instead of being downloaded by
// everyone who lands on the homepage.

const MediaGalleryPage = lazy(() => import("./pages/MediaGalleryPage.jsx"));
const MediaAdminPage = lazy(() => import("./pages/MediaAdminPage.jsx"));
const PrivacyPage = lazy(() => import("./pages/LegalPages.jsx").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("./pages/LegalPages.jsx").then((m) => ({ default: m.TermsPage })));

const RouteFallback = () => {
  const { t } = useLang();
  return (
    <div className="pt-[calc(var(--header-h)+80px)] pb-28 text-center container-x text-ink/50">
      {t("loading")}
    </div>
  );
};

const Shell = () => {
  const { pathname } = useLocation();
  const { t } = useLang();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      <a href="#main" className="skip-link">{t("nav.skipToContent")}</a>
      <ScrollProgress />
      <Header />
      <main id="main">
        <ErrorBoundary title={t("error.title")} body={t("error.body")} reload={t("error.reload")}>
          <Suspense fallback={<RouteFallback />}>
            <React.Fragment key={pathname}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/:slug" element={<ServiceDetailPage />} />
              <Route path="/portfolio" element={<Navigate to="/media-gallery" replace />} />
              <Route path="/media-gallery" element={<MediaGalleryPage />} />
              <Route path="/admin/media" element={<MediaAdminPage />} />
              {/* legacy path — redirects to the shared gallery */}
              <Route path="/projects" element={<Navigate to="/media-gallery" replace />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/quote" element={<QuotePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/admin" element={<Navigate to="/admin/media" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </React.Fragment>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <WhatsAppFloat />}
      
    </>
  );
};

export default function App() {
  return (
    <HelmetProvider>
      <LanguageProvider>
        <ContentProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Shell />
          </BrowserRouter>
        </ContentProvider>
      </LanguageProvider>
    </HelmetProvider>
  );
}

