import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, X } from "lucide-react";
import { useLang } from "../lib/i18n.jsx";
import { MEDIA_SERVICES } from "../data/mediaServices.js";
import { useMedia } from "../lib/media.js";

export function MediaGrid({ items, compact = false }) {
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
  const { lang } = useLang();
  const services = MEDIA_SERVICES.map(s => ({ ...s, title: s.title[lang] || s.title.en }));
  const title = item => lang === "ar" && item.titleAr ? item.titleAr : item.title;
  const description = item => lang === "ar" && item.descriptionAr ? item.descriptionAr : item.description;
  useEffect(() => {
    if (!selected) return;
    dialog.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [selected]);
  return <>
    <div className={compact ? "media-home-grid" : "media-masonry"}>
      {items.map(item => <figure className="media-tile" key={item.id}>
        <button type="button" className="media-image-button" onClick={() => setSelected(item)} aria-label={`${lang === "ar" ? "عرض" : "View"} ${title(item)}`}>
          <img src={item.url} alt={title(item)} width={item.width} height={item.height} loading="lazy" decoding="async" />
          <span className="media-expand" aria-hidden="true"><ArrowUpRight size={20} /></span>
        </button>
        <figcaption className="pt-4 pb-2">
          <p className="text-sm text-ink/70">{services.find(service => service.slug === item.service)?.title}</p>
          <h3 className="font-display font-bold text-xl mt-1 break-words">{title(item)}</h3>
          <p className={`text-sm leading-relaxed text-ink/75 mt-2 break-words whitespace-pre-line${compact ? " line-clamp-3" : ""}`}>{description(item)}</p>
        </figcaption>
      </figure>)}
    </div>
    {selected && <dialog ref={dialog} className="media-dialog" aria-labelledby="media-dialog-title" onClose={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) dialog.current.close(); }}>
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h2 id="media-dialog-title" className="font-display font-bold text-xl break-words">{title(selected)}</h2>
          <button type="button" className="p-3 rounded-full bg-ink/5" autoFocus onClick={() => dialog.current.close()} aria-label={lang === "ar" ? "إغلاق" : "Close image"}><X size={20} /></button>
        </div>
        <img src={selected.url} alt={title(selected)} className="w-full max-h-[65vh] object-contain" />
        <p className="mt-4 text-ink/75 whitespace-pre-line break-words">{description(selected)}</p>
      </div>
    </dialog>}
  </>;
}

export function GalleryContent({ preview = false }) {
  const { items, loading, error, refresh } = useMedia();
  const { lang } = useLang();
  const services = MEDIA_SERVICES.map(s => ({ ...s, title: s.title[lang] || s.title.en }));
  const [filter, setFilter] = useState("");
  const ar = lang === "ar";
  const shown = preview ? items.slice(0, 3) : items.filter(item => !filter || item.service === filter);
  return <>
    {!preview && <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
      <label className="flex flex-col gap-2 text-sm font-semibold">
        {ar ? "تصفية حسب الخدمة" : "Browse by service"}
        <select aria-label={ar ? "تصفية حسب الخدمة" : "Browse by service"} className="field max-w-full sm:w-96" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">{ar ? "جميع الخدمات" : "All services"}</option>
          {services.map(service => <option key={service.slug} value={service.slug}>{service.title}</option>)}
        </select>
      </label>
      <p className="text-sm text-ink/70" aria-live="polite">{shown.length} {ar ? "صورة" : "images"}</p>
    </div>}
    {loading ? <div className="grid grid-cols-2 md:grid-cols-3 gap-6" role="status" aria-label={ar ? "تحميل الصور" : "Loading images"}>{[0, 1, 2].map(i => <div key={i} className="h-72 rounded-xl bg-ink/5" />)}</div>
      : error ? <div className="py-12 text-center"><p>{ar ? "الصور غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى." : "Photos are temporarily unavailable. Please try again."}</p><button type="button" className="btn-ghost mt-4" onClick={refresh}>{ar ? "إعادة المحاولة" : "Try again"}</button></div>
      : shown.length ? <MediaGrid items={shown} compact={preview} />
      : <div className="py-12 border-y border-ink/10"><h3 className="font-display text-2xl font-bold">{ar ? "صور جديدة قريباً" : "A closer look, coming soon."}</h3><p className="mt-3 text-ink/75">{ar ? "سنشارك صوراً من أعمال اللافتات هنا." : "Photos from our signage, fabrication work will appear here."}</p></div>}
  </>;
}

export function HomeMediaGallery() {
  const { lang } = useLang();
  return <section className="py-20 md:py-28" aria-labelledby="home-media-title"><div className="container-x">
    <div className="flex flex-wrap justify-between items-end gap-6 mb-10">
      <div><h2 id="home-media-title" className="font-display font-extrabold text-3xl md:text-5xl">{lang === "ar" ? "معرض الصور" : "Media Gallery"}</h2><p className="mt-4 max-w-xl text-ink/75">{lang === "ar" ? "شاهد تفاصيل أعمالنا في اللافتات." : "See the details behind our signage work."}</p></div>
      <Link to="/media-gallery" className="btn-ghost">{lang === "ar" ? "عرض جميع الصور" : "View all media"}<ArrowUpRight size={18} aria-hidden="true" /></Link>
    </div><GalleryContent preview />
  </div></section>;
}

