import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Images, SlidersHorizontal, Settings, LogOut, Lock,
  Trash2, Download, Upload, CheckCircle2, RotateCcw, AlertTriangle,
} from "lucide-react";
import { useContent, useRawContent } from "../lib/ContentContext.jsx";
import {
  getLeads, updateLead, deleteLead, importLeads, leadsToCSV,
  getContentOverrides, setContentOverrides, resetContentOverrides,
  loginAdmin, isAdminLoggedIn, logoutAdmin, isDefaultPassword, setAdminPassword,
  loginLockRemaining, downloadFile, DEFAULT_PASSWORD,
} from "../lib/store.js";

const STATUS = ["new", "contacted", "quoted", "won", "lost"];
const STATUS_COLOR = {
  new: "bg-weld-tint text-accent-ink",
  contacted: "bg-sodium-tint text-[#8a6a10]",
  quoted: "bg-gulf-tint text-gulf",
  won: "bg-gulf text-white",
  lost: "bg-ink/10 text-ink/50",
};

/* ============================================================
   Shared bits — declared at module scope.
   These used to live inside the component that rendered them,
   which made React treat each render as a NEW component type and
   remount the inputs, so every keystroke lost focus.
   ============================================================ */

function Field({ label, value, onChange, area = false, dir, ...rest }) {
  return (
    <div>
      <label className="label">{label}</label>
      {area ? (
        <textarea rows={3} className="field resize-y" value={value ?? ""} onChange={onChange} dir={dir} {...rest} />
      ) : (
        <input className="field" value={value ?? ""} onChange={onChange} dir={dir} {...rest} />
      )}
    </div>
  );
}

/** One bilingual value: English on top, Arabic below with RTL input. */
function BilingualField({ label, value, onChange, area = false }) { return <Field label={label} value={typeof value === "object" ? value.en : value} onChange={e => onChange(e.target.value)} area={area} dir="ltr" />; }

function Toast({ tone = "ok", children }) {
  if (!children) return null;
  const cls = tone === "error" ? "bg-red-50 text-red-700" : "bg-gulf-tint text-gulf";
  return (
    <p role="status" aria-live="polite" className={`rounded-xl px-4 py-2.5 text-[13.5px] ${cls}`}>
      {children}
    </p>
  );
}

/* ---------------- login gate ---------------- */
function Login({ onOk }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const locked = loginLockRemaining();
    if (locked > 0) {
      setErr(`Too many attempts. Try again in ${Math.ceil(locked / 1000)}s.`);
      setBusy(false);
      return;
    }
    const ok = await loginAdmin(pass);
    setBusy(false);
    if (ok) onOk();
    else setErr(loginLockRemaining() > 0 ? "Too many attempts — locked for 60 seconds." : "Wrong password.");
  };

  return (
    <div className="min-h-[70vh] grid place-items-center pt-[var(--header-h)] px-5">
      <form onSubmit={submit} className="plate p-8 w-full max-w-sm text-center">
        <span className="mx-auto grid place-items-center w-12 h-12 rounded-xl bg-ink text-sodium"><Lock size={20} aria-hidden="true" /></span>
        <h1 className="font-display font-bold text-2xl mt-4">Super Graphic Admin</h1>
        <p className="text-[13.5px] text-ink/55 mt-1.5">Enter the admin password to manage leads and content.</p>
        <input
          type="password"
          value={pass}
          onChange={(e) => { setPass(e.target.value); setErr(""); }}
          className="field mt-5"
          placeholder="Password"
          autoComplete="current-password"
          aria-label="Admin password"
          autoFocus
        />
        {err && <p className="text-[13px] text-red-700 mt-2" role="alert">{err}</p>}
        <button className="btn-ink w-full mt-4" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
        <Link to="/admin/media" className="block mt-5 underline text-sm">Open media admin</Link>
        {isDefaultPassword() && (
          <p className="text-[11.5px] text-ink/40 mt-4">
            Default password: <span className="font-mono">{DEFAULT_PASSWORD}</span> — change it in Settings after first login.
          </p>
        )}
      </form>
    </div>
  );
}

/* ---------------- leads tab ---------------- */
function LeadsTab() {
  const [leads, setLeads] = useState(getLeads);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState(null);
  const refresh = () => setLeads(getLeads());
  const shown = filter === "all" ? leads : leads.filter((l) => l.status === filter);
  const stamp = () => new Date().toISOString().slice(0, 10);

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const added = importLeads(JSON.parse(await file.text()));
      refresh();
      setMsg({ tone: "ok", text: added === 0 ? "No new leads — everything in that file was already here." : `Merged ${added} new lead${added === 1 ? "" : "s"}.` });
    } catch {
      setMsg({ tone: "error", text: "Could not read that file — expected a leads JSON export." });
    }
    e.target.value = "";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {["all", ...STATUS].map((s) => (
            <button
              key={s} type="button" onClick={() => setFilter(s)} aria-pressed={filter === s}
              className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${filter === s ? "bg-ink text-plaster border-ink" : "border-ink/20 text-ink/60 hover:border-ink"}`}
            >
              {s} {s !== "all" && `(${leads.filter((l) => l.status === s).length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ms-auto">
          <button type="button" className="btn-ghost !px-4 !py-2 text-[13px]" onClick={() => downloadFile(`supergraphic-leads-${stamp()}.csv`, leadsToCSV(leads), "text/csv")}>
            <Download size={15} aria-hidden="true" /> CSV
          </button>
          <button type="button" className="btn-ghost !px-4 !py-2 text-[13px]" onClick={() => downloadFile(`supergraphic-leads-${stamp()}.json`, JSON.stringify(leads, null, 2))}>
            <Download size={15} aria-hidden="true" /> JSON
          </button>
          <label className="btn-ghost !px-4 !py-2 text-[13px] cursor-pointer">
            <Upload size={15} aria-hidden="true" /> Import
            <input type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
          </label>
        </div>
      </div>

      {msg && <div className="mb-4"><Toast tone={msg.tone}>{msg.text}</Toast></div>}

      {shown.length === 0 ? (
        <div className="plate p-10 text-center text-ink/50">
          <Inbox size={32} className="mx-auto mb-3 text-ink/30" aria-hidden="true" />
          No leads here yet. Leads land in this inbox whenever someone submits the Quote or Contact form <em>in this browser</em>. Real enquiries arrive on WhatsApp — use Import to merge JSON exports from other devices.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((l) => (
            <div key={l.id} className="plate p-5">
              <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                <div className="min-w-[180px]">
                  <p className="font-display font-bold">{l.name}</p>
                  <p className="font-mono text-[11px] text-ink/45 mt-0.5">{l.id} · {new Date(l.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-[14px] text-ink/70 min-w-[160px]">
                  <p><a className="hover:text-accent-ink" href={`tel:${l.phoneE164 ? `+${l.phoneE164}` : l.phone}`} dir="ltr">{l.phone}</a></p>
                  {l.email && <p><a className="hover:text-accent-ink break-all" href={`mailto:${l.email}`} dir="ltr">{l.email}</a></p>}
                </div>
                <div className="flex-1 min-w-[200px] text-[14px]">
                  <p className="font-semibold">
                    {l.service}
                    <span className="font-mono text-[10.5px] uppercase text-ink/40 ms-2">via {l.source}{l.lang ? ` · ${l.lang}` : ""}</span>
                  </p>
                  {l.message && <p className="text-ink/60 mt-1">{l.message}</p>}
                </div>
                <div className="flex items-center gap-2 ms-auto">
                  <label className="sr-only" htmlFor={`status-${l.id}`}>Status for {l.name}</label>
                  <select
                    id={`status-${l.id}`} value={l.status}
                    onChange={(e) => { updateLead(l.id, { status: e.target.value }); refresh(); }}
                    className={`font-mono text-[11px] uppercase tracking-wider rounded-full px-3 py-1.5 border-0 cursor-pointer ${STATUS_COLOR[l.status] || ""}`}
                  >
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    type="button" aria-label={`Delete lead from ${l.name}`} className="p-2 text-ink/35 hover:text-accent-ink"
                    onClick={() => { if (window.confirm(`Delete the lead from ${l.name}? This cannot be undone.`)) { deleteLead(l.id); refresh(); } }}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- content tab ---------------- */
function ContentTab() {
  const raw = useRawContent();
  const [c, setC] = useState(raw.company);
  const [h, setH] = useState(raw.hero);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setContentOverrides({ ...getContentOverrides(), company: c, hero: h });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="plate p-6 space-y-4">
        <h3 className="font-display font-bold text-lg">Company &amp; contact</h3>
        <Field label="Phone (display)" value={c.phone} dir="ltr" onChange={(e) => setC({ ...c, phone: e.target.value })} />
        <Field label="WhatsApp number (digits only)" value={c.whatsapp} dir="ltr" inputMode="numeric"
          onChange={(e) => setC({ ...c, whatsapp: e.target.value.replace(/\D/g, "") })} />
        <Field label="Email" value={c.email} dir="ltr" onChange={(e) => setC({ ...c, email: e.target.value })} />
        <Field label="Google Maps URL" value={c.mapUrl} dir="ltr" onChange={(e) => setC({ ...c, mapUrl: e.target.value })} />
        <Field label="Trade licence no." value={c.tradeLicence} dir="ltr" onChange={(e) => setC({ ...c, tradeLicence: e.target.value })} />
        <Field label="VAT TRN" value={c.trn} dir="ltr" onChange={(e) => setC({ ...c, trn: e.target.value })} />
        <BilingualField label="Address" value={c.address} onChange={(v) => setC({ ...c, address: v })} />
        <BilingualField label="Working hours" value={c.hours} onChange={(v) => setC({ ...c, hours: v })} />
      </div>

      <div className="plate p-6 space-y-4">
        <h3 className="font-display font-bold text-lg">Homepage hero</h3>
        <BilingualField label="Kicker line" value={h.kicker} onChange={(v) => setH({ ...h, kicker: v })} />
        <BilingualField label="Headline line 1" value={h.titleA} onChange={(v) => setH({ ...h, titleA: v })} />
        <BilingualField label="Headline accent" value={h.titleB} onChange={(v) => setH({ ...h, titleB: v })} />
        <BilingualField label="Headline line 3" value={h.titleC} onChange={v => setH({ ...h, titleC: v })} />
        <Field label="Hero image URL" value={h.image} dir="ltr" onChange={(e) => setH({ ...h, image: e.target.value })} />
        <BilingualField label="Sub-headline" value={h.sub} area onChange={(v) => setH({ ...h, sub: v })} />
      </div>

      <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-weld" onClick={save}>
          <CheckCircle2 size={17} aria-hidden="true" /> {saved ? "Saved!" : "Save changes"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => downloadFile("supergraphic-content-overrides.json", JSON.stringify(getContentOverrides(), null, 2))}>
          <Download size={16} aria-hidden="true" /> Export content JSON
        </button>
        <button type="button" className="btn-ghost hover:!bg-weld hover:!border-weld hover:!text-ink"
          onClick={() => { if (window.confirm("Reset ALL content overrides back to the built-in defaults?")) resetContentOverrides(); }}>
          <RotateCcw size={16} aria-hidden="true" /> Reset to defaults
        </button>
        <p className="w-full text-[12.5px] text-ink/45">
          Overrides live in this browser only. To make them permanent for all visitors, export the JSON and merge it into <span className="font-mono">src/data/siteContent.js</span>, then redeploy.
        </p>
      </div>
    </div>
  );
}

/* ---------------- settings tab ---------------- */
function SettingsTab({ onLogout }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState(null);

  const change = async () => {
    if (p1.length < 8) return setMsg({ tone: "error", text: "Use at least 8 characters." });
    if (p1 !== p2) return setMsg({ tone: "error", text: "Passwords don't match." });
    if (p1 === DEFAULT_PASSWORD) return setMsg({ tone: "error", text: "Pick something other than the shipped default." });
    await setAdminPassword(p1);
    setMsg({ tone: "ok", text: "Password updated for this browser." });
    setP1(""); setP2("");
  };

  return (
    <div className="max-w-md space-y-6">
      {isDefaultPassword() && (
        <div className="plate p-5 flex items-start gap-3 border-weld/30">
          <AlertTriangle size={20} className="text-accent-ink shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13.5px] text-ink/70">
            This panel is still on the shipped default password. Change it before the site goes live.
          </p>
        </div>
      )}

      <div className="plate p-6 space-y-4">
        <h3 className="font-display font-bold text-lg">Change admin password</h3>
        <input type="password" className="field" placeholder="New password (min 8 characters)" autoComplete="new-password"
          aria-label="New password" value={p1} onChange={(e) => setP1(e.target.value)} />
        <input type="password" className="field" placeholder="Repeat new password" autoComplete="new-password"
          aria-label="Repeat new password" value={p2} onChange={(e) => setP2(e.target.value)} />
        {msg && <Toast tone={msg.tone}>{msg.text}</Toast>}
        <button type="button" className="btn-ink" onClick={change}>Update password</button>
        <p className="text-[12px] text-ink/45">
          The password is stored as a salted SHA-256 hash in this browser, and repeated failures lock the form for a minute.
          This is still only a front-end gate — it deters casual visitors, it is not server-side security. A hardened login needs a backend.
        </p>
      </div>

      <button type="button" className="btn-ghost" onClick={onLogout}>
        <LogOut size={16} aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}

/* ---------------- overview tab ---------------- */
function OverviewTab({ goTo }) {
  // Built once in a lazy initialiser: reading the clock on every render would
  // make the "last 7 days" figure shift unpredictably mid-session.
  const [cards] = useState(() => {
    const leads = getLeads();
    const now = Date.now();
    return [
      ["Total leads (this browser)", leads.length],
      ["New / uncontacted", leads.filter((l) => l.status === "new").length],
      ["Last 7 days", leads.filter((l) => now - new Date(l.createdAt) < 7 * 864e5).length],
      ["Won", leads.filter((l) => l.status === "won").length],
    ];
  });

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map(([t, v]) => (
          <div key={t} className="plate p-6">
            <p className="font-display font-extrabold text-4xl text-accent-ink">{v}</p>
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink/50 mt-2">{t}</p>
          </div>
        ))}
      </div>

      <div className="plate p-6 mt-6">
        <h3 className="font-display font-bold text-lg mb-2">How this panel works (no database)</h3>
        <ul className="text-[14px] text-ink/65 space-y-2 list-disc ps-5">
          <li>Submitting the form opens <strong>WhatsApp with the enquiry pre-filled</strong>. That WhatsApp message is the real lead delivery — a submission that is never sent in WhatsApp never reaches you.</li>
          <li>A copy is also saved in <strong>the visitor's own browser</strong>, so this inbox shows submissions made on <strong>this device</strong> (your own tests, or walk-ins you type in). Merge exports from other devices via Leads → Import.</li>
          <li>Project images and site text edited here update instantly in this browser; use <strong>Content → Export</strong> to make changes permanent in the code for all visitors.</li>
        </ul>
        <button type="button" className="btn-ink mt-5 !px-5 !py-2.5 text-[14px]" onClick={() => goTo("leads")}>Open leads inbox</button>
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, el: OverviewTab },
  { id: "leads", label: "Leads", icon: Inbox, el: LeadsTab },
  { id: "content", label: "Content", icon: SlidersHorizontal, el: ContentTab },
  { id: "settings", label: "Settings", icon: Settings, el: SettingsTab },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(isAdminLoggedIn);
  const [tab, setTab] = useState("overview");
  const [, force] = useState(0);
  const { company } = useContent();

  useEffect(() => {
    const r = () => force((x) => x + 1);
    window.addEventListener("supergraphic:store", r);
    return () => window.removeEventListener("supergraphic:store", r);
  }, []);

  const onLogout = useCallback(() => { logoutAdmin(); setAuthed(false); }, []);

  const head = (
    <Helmet>
      <title>Admin — Super Graphic</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );

  if (!authed) return (<>{head}<Login onOk={() => setAuthed(true)} /></>);

  const Active = TABS.find((t) => t.id === tab)?.el ?? OverviewTab;

  return (
    <div className="pt-[calc(var(--header-h)+32px)] pb-24 min-h-screen bg-plaster-deep/40">
      {head}
      <div className="container-x">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="eyebrow text-accent-ink">Backend panel</p>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl mt-1">Super Graphic Control</h1>
          </div>
          <p className="font-mono text-[11px] text-ink/40" dir="ltr">{company.phone}</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 -mx-1 px-1">
          <Link to="/admin/media" className="btn-ink whitespace-nowrap !py-2.5 !px-4 text-sm"><Images size={15} /> Media Gallery</Link>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap font-mono text-[12px] uppercase tracking-wider px-4 py-2.5 rounded-full border transition ${tab === id ? "bg-ink text-plaster border-ink" : "border-ink/15 text-ink/60 hover:border-ink bg-white"}`}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <Active goTo={setTab} onLogout={onLogout} />
      </div>
    </div>
  );
}

