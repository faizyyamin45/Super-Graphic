# Super Graphic website

A custom English-only redesign built on the supplied React 19 / Vite 8 / Tailwind / Express framework.

## Start
Requires Node.js 24 or newer.

```
npm ci
npm run setup
npm run dev
```

The website opens at http://127.0.0.1:5173/. Admin is at http://127.0.0.1:5173/admin.
Setup preserves an existing .env. On a fresh copy, it generates a strong admin password and saves it in .admin-access.txt.
The current prepared workspace is already configured; its credentials are supplied separately in ADMIN-ACCESS.txt.

## Included
- Distinct Super Graphic visual design, supplied logo, source-site colors and Manrope typography.
- Eight equally prominent services and individual service pages.
- Three original project-photo slides with different headlines and descriptions. Consistent dimensions: 720px desktop, 640px tablet and 590px phone height, with a 780px wide-desktop layout.
- Twenty-three original gallery project images. Filter by service and view full-size images.
- Authenticated image administration: upload, preview, categorize, caption, edit and delete.
- MongoDB Atlas stores gallery metadata and uploaded images in the Hostinger PHP build. The original Node backend remains available for local development. New uploads publish immediately to Our work; the three newest appear on the homepage.
- Call-first navigation, About, Contact, Quote, FAQs and mobile menu.

## Build and verify
```
npm run build
npm test
npm run lint
```

Build and backend tests pass. Lint has no errors; six inherited Fast Refresh code-organization warnings remain.

## Production hosting
The selected deployment is **Hostinger File Manager + PHP + MongoDB Atlas**. Run `npm run build:hostinger` to build the two-folder upload package. See **HOSTINGER-UPLOAD.md** for exact upload paths, private configuration and checks. No Render or Node.js server is needed for this build. The Node backend and RENDER-DEPLOY.md describe an optional alternative and are not part of the Hostinger upload ZIP.
The current local preview has not replaced supergraphic.ae.

## Content and editing
- src/data/siteContent.js — company, services, FAQs and metadata.
- src/pages/HomePage.jsx — slide photos/text and homepage composition.
- src/supergraphic.css — custom design and responsive layout.
- server/seed-media/manifest.json — original gallery captions and categories.
- public/images/ — optimized source-site images.

The original Pro Plus local admin source is retained for reference but is not routed. /admin opens the real backend image library.

## Enquiries
The form validates details and prepares a WhatsApp message; the visitor must press Send in WhatsApp. It does not email the team or store leads centrally. Browser-local enquiry history is separate from the backend image database.

## Brand and sources
Confirmed phone: +971 52 553 8190, Farman Khan.
Email: sales@supergraphic.ae.
Address: Ras Al Khor Industrial Area 2, Dubai.
Source details are documented in CONTENT-SOURCES.md.


