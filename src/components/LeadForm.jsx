import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, Phone } from "lucide-react";
import { useContent } from "../lib/ContentContext.jsx";
import { useLang } from "../lib/i18n.jsx";
import { saveLead } from "../lib/store.js";
import { isValidUAEPhone, normalizeUAEPhone } from "../lib/phone.js";

const EMPTY = { name: "", phone: "", email: "", service: "", message: "", consent: false };
const FIELD_ORDER = ["name", "phone", "email", "service", "consent"];

export default function LeadForm({ source = "contact", compact = false }) {
  const { company, services } = useContent();
  const { t, lang } = useLang();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [handoff, setHandoff] = useState(null);
  const honeypot = useRef(null);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t("form.err.name");
    if (!isValidUAEPhone(form.phone)) e.phone = t("form.err.phone");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = t("form.err.email");
    if (!form.service) e.service = t("form.err.service");
    if (!form.consent) e.consent = t("form.err.consent");
    setErrors(e);
    return e;
  };

  const buildWaUrl = (lead) => {
    const body = [
      `New ${source} enquiry — Super Graphic website`,
      "",
      `Ref: ${lead.id}`,
      `Name: ${lead.name}`,
      `Phone: +${lead.phoneE164}`,
      `Email: ${lead.email || "—"}`,
      `Service: ${lead.service}`,
      `Message: ${lead.message || "—"}`,
      `Language: ${lang.toUpperCase()}`,
    ].join("\n");
    return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(body)}`;
  };

  const submit = (e) => {
    e.preventDefault();
    // Bots fill every field they find; humans never see this one.
    if (honeypot.current?.value) return;

    const found = validate();
    const firstInvalid = FIELD_ORDER.find((k) => found[k]);
    if (firstInvalid) {
      // Move focus to the first bad field so screen-reader and keyboard users
      // land on the problem instead of being silently returned to the top.
      document.getElementById(`${source}-${firstInvalid}`)?.focus();
      return;
    }

    const lead = saveLead({
      ...form,
      phoneE164: normalizeUAEPhone(form.phone),
      lang,
      source,
    });
    const url = buildWaUrl(lead);

    // Opened synchronously inside the submit gesture so the browser treats it
    // as user-initiated and does not block it as a popup.
    window.open(url, "_blank", "noopener,noreferrer");
    setHandoff({ lead, url });
  };

  /* ---------------- handoff screen ---------------- */
  if (handoff) {
    return (
      <div className="plate p-8 text-center" role="status" aria-live="polite">
        <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[#25D366]/15 text-[#128C4A]">
          <MessageCircle size={28} aria-hidden="true" />
        </span>
        <h3 className="font-display font-bold text-2xl mt-4">{t("form.handoff.title")}</h3>
        <p className="mt-2.5 text-ink/65 text-[15px] max-w-md mx-auto leading-relaxed">
          {t("form.handoff.body")}
        </p>
        <p className="mt-3 text-[13px] text-ink/45">
          {t("form.handoff.reference")}: <span className="font-mono keep-latin text-accent-ink">{handoff.lead.id}</span>
        </p>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <a href={handoff.url} target="_blank" rel="noreferrer noopener" className="btn-weld">
            <MessageCircle size={18} aria-hidden="true" /> {t("form.handoff.retry")}
          </a>
          <a href={`tel:${company.phone.replace(/\s/g, "")}`} className="btn-ghost">
            <Phone size={17} aria-hidden="true" /> {t("form.handoff.callInstead")}
          </a>
        </div>

        <button
          type="button"
          className="mt-5 text-[13.5px] text-ink/50 underline underline-offset-4 hover:text-ink"
          onClick={() => { setHandoff(null); setForm(EMPTY); setErrors({}); }}
        >
          {t("form.handoff.newRequest")}
        </button>
      </div>
    );
  }

  /* ---------------- form ---------------- */
  const errId = (k) => `${source}-${k}-error`;
  const fieldProps = (k) => ({
    id: `${source}-${k}`,
    className: `field ${errors[k] ? "field-error" : ""}`,
    value: form[k],
    onChange: set(k),
    "aria-invalid": errors[k] ? "true" : undefined,
    "aria-describedby": errors[k] ? errId(k) : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className={compact ? "" : "plate p-6 sm:p-8"}>
      {/* honeypot — hidden from people, irresistible to bots */}
      <input
        ref={honeypot}
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute w-px h-px -m-px overflow-hidden opacity-0 pointer-events-none"
      />

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="label" htmlFor={`${source}-name`}>{t("form.name")} *</label>
          <input {...fieldProps("name")} placeholder={t("form.namePlaceholder")} autoComplete="name" />
          {errors.name && <p id={errId("name")} className="mt-1 text-[13px] text-red-700">{errors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor={`${source}-phone`}>{t("form.phone")} *</label>
          <input {...fieldProps("phone")} dir="ltr" placeholder={t("form.phonePlaceholder")} autoComplete="tel" inputMode="tel" />
          {errors.phone && <p id={errId("phone")} className="mt-1 text-[13px] text-red-700">{errors.phone}</p>}
        </div>

        <div>
          <label className="label" htmlFor={`${source}-email`}>
            {t("form.email")} <span className="normal-case tracking-normal text-ink/35">({t("form.optional")})</span>
          </label>
          <input {...fieldProps("email")} type="email" dir="ltr" placeholder={t("form.emailPlaceholder")} autoComplete="email" inputMode="email" />
          {errors.email && <p id={errId("email")} className="mt-1 text-[13px] text-red-700">{errors.email}</p>}
        </div>

        <div>
          <label className="label" htmlFor={`${source}-service`}>{t("form.service")} *</label>
          <select {...fieldProps("service")}>
            <option value="">{t("form.servicePlaceholder")}</option>
            {services.map((s) => (
              <option key={s.slug} value={s.title}>{s.sku} — {s.title}</option>
            ))}
            <option value={t("form.serviceOther")}>{t("form.serviceOther")}</option>
          </select>
          {errors.service && <p id={errId("service")} className="mt-1 text-[13px] text-red-700">{errors.service}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${source}-message`}>
            {t("form.message")} <span className="normal-case tracking-normal text-ink/35">({t("form.optional")})</span>
          </label>
          <textarea {...fieldProps("message")} rows={4} className={`field resize-y ${errors.message ? "field-error" : ""}`} placeholder={t("form.messagePlaceholder")} />
        </div>
      </div>

      {/* PDPL consent — collecting a name and phone needs a stated basis */}
      <div className="mt-6">
        <label className="flex items-start gap-3 text-[13.5px] leading-relaxed text-ink/70 cursor-pointer">
          <input
            type="checkbox"
            id={`${source}-consent`}
            checked={form.consent}
            onChange={set("consent")}
            aria-invalid={errors.consent ? "true" : undefined}
            aria-describedby={errors.consent ? errId("consent") : undefined}
            className="mt-0.5 w-4 h-4 shrink-0 rounded border-ink/30 text-accent-ink focus:ring-weld/30"
          />
          <span>
            {t("form.consent.pre")}{" "}
            <Link to="/privacy" className="text-accent-ink underline underline-offset-2">{t("legal.privacy")}</Link>.
          </span>
        </label>
        {errors.consent && <p id={errId("consent")} className="mt-1.5 text-[13px] text-red-700">{errors.consent}</p>}
      </div>

      <button type="submit" className="btn-weld w-full sm:w-auto mt-6">
        <Send size={17} aria-hidden="true" /> {t("form.submit")}
      </button>
      <p className="mt-3 text-[12.5px] text-ink/45">{t("form.footnote")}</p>
    </form>
  );
}
