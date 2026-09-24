import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, LogOut, Pencil, Trash2, ImagePlus } from "lucide-react";
import Seo from "../components/Seo.jsx";
import { MEDIA_SERVICES } from "../data/mediaServices.js";
import { mediaRequest, useMedia, mediaServerEnabled } from "../lib/media.js";
import { GalleryContent } from "../components/MediaGallery.jsx";

const EMPTY = { title: "", description: "", titleAr: "", descriptionAr: "", service: "" };

function Library({ onLogout }) {
  const services = MEDIA_SERVICES;
  const { items, loading, error, refresh } = useMedia();
  const [draft, setDraft] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [fileKey, setFileKey] = useState(0);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  const reset = () => { setDraft(EMPTY); setFile(null); setPreview(""); setEditing(null); setFileKey(v => v + 1); };
  const chooseFile = event => {
    const selected = event.target.files?.[0];
    setFailure("");
    setFile(null);
    setPreview("");
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 12 * 1024 * 1024) {
      setFailure("Choose a JPG, PNG or WebP file up to 12 MB.");
      event.target.value = "";
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setFailure(""); setMessage("");
    try {
      if (editing) await mediaRequest(`/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      else {
        if (!file) throw new Error("Choose an image first.");
        const body = new FormData();
        for (const [key, value] of Object.entries(draft)) body.set(key, value);
        body.set("image", file);
        await mediaRequest("", { method: "POST", body });
      }
      setMessage(editing ? "Image details updated for all visitors." : "Image published to Our work and the homepage.");
      reset(); refresh();
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  };
  const remove = async item => {
    if (!window.confirm(`Delete “${item.title}” from the gallery? This also removes its image file.`)) return;
    setBusy(true); setFailure(""); setMessage("");
    try { await mediaRequest(`/${item.id}`, { method: "DELETE" }); if (editing === item.id) reset(); refresh(); setMessage("Image deleted."); }
    catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  };
  const edit = item => {
    setDraft(Object.fromEntries(Object.keys(EMPTY).map(key => [key, item[key] || ""])));
    setEditing(item.id); setFile(null); setPreview(""); setMessage(""); setFailure("");
    document.getElementById("media-title")?.focus();
  };
  return <>
    <div className="flex flex-wrap justify-between items-end gap-5 mb-10"><div><h1 className="font-display font-bold text-3xl md:text-4xl">Our work · Image library</h1><p className="mt-3 text-ink/75">Upload your projects. Add a caption. Publish them straight to Our work.</p></div><div className="flex flex-wrap gap-3"><Link to="/media-gallery" className="btn-ghost">View gallery</Link><button type="button" className="btn-ink" onClick={onLogout} disabled={busy}><LogOut size={16} /> Sign out</button></div></div>
    {message && <p role="status" className="p-4 mb-6 bg-gulf-tint text-ink rounded-xl">{message}</p>}
    {failure && <p role="alert" className="p-4 mb-6 bg-weld-tint text-ink rounded-xl">{failure}</p>}
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-10 items-start">
      <form onSubmit={save} className="plate p-5 sm:p-7"><fieldset disabled={busy} className="space-y-5 min-w-0">
        <legend className="font-display text-xl font-bold mb-5">{editing ? "Edit image details" : "Upload a photo"}</legend>
        {!editing && <div><label htmlFor="media-image" className="block font-semibold text-sm mb-2">Image</label><input key={fileKey} id="media-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} required className="block w-full text-sm file:rounded-full file:border-0 file:bg-ink file:text-white file:px-4 file:py-3 file:me-3" /><p className="text-sm text-ink/70 mt-2">JPG, PNG or WebP · up to 12 MB. Images are optimized automatically.</p></div>}
        {preview && <img src={preview} alt="Selected image preview" className="w-full max-h-64 object-contain bg-ink/5 rounded-xl" />}
        <label className="block"><span className="block text-sm font-semibold mb-2">Super Graphic service</span><select className="field" required value={draft.service} onChange={e => setDraft({ ...draft, service: e.target.value })}><option value="">Choose a service</option>{services.map(service => <option key={service.slug} value={service.slug}>{service.title.en}</option>)}</select></label>
        <label className="block"><span className="block text-sm font-semibold mb-2">Title</span><input id="media-title" className="field" value={draft.title} required maxLength={160} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Illuminated shopfront lettering" /></label>
        <label className="block"><span className="block text-sm font-semibold mb-2">Description</span><textarea className="field" rows={4} value={draft.description} required maxLength={2000} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Describe what the image shows and the service provided." /></label>
        <p className="text-sm text-ink/70">The three newest photos appear on the homepage. Every photo appears in Our work.</p>
        <div className="flex flex-wrap gap-3"><button className="btn-weld" disabled={busy}><Upload size={17} />{busy ? "Saving…" : editing ? "Save changes" : "Publish photo"}</button>{editing && <button type="button" className="btn-ghost" onClick={reset}>Cancel</button>}</div>
      </fieldset></form>
      <section aria-labelledby="published-heading"><h2 id="published-heading" className="font-display text-xl font-bold mb-5">Published photos ({items.length})</h2>
        {loading && <p role="status">Loading your library…</p>}
        {error && <div role="alert"><p>{error}</p><button type="button" onClick={refresh} className="btn-ghost mt-4">Try again</button></div>}
        {!loading && !error && !items.length && <div className="border-y border-ink/15 py-12"><ImagePlus size={32} aria-hidden="true" /><h3 className="font-semibold text-lg mt-4">Your first photo starts here.</h3><p className="mt-2 text-ink/75">Upload a service photo and add a title and description. It will be visible to all visitors.</p></div>}
        <div className="divide-y divide-ink/10">{items.map(item => <article key={item.id} className="py-5 flex gap-4"><img src={item.url} alt="" width={96} height={96} className="w-20 h-24 sm:w-24 object-cover rounded-lg shrink-0" /><div className="min-w-0 flex-1"><h3 className="font-semibold break-words">{item.title}</h3><p className="text-sm text-ink/70 mt-1 line-clamp-2 break-words">{item.description}</p><div className="flex flex-wrap gap-2 mt-2"><button className="inline-flex items-center gap-2 p-2 text-sm underline" disabled={busy} type="button" onClick={() => edit(item)}><Pencil size={14} />Edit</button><button className="inline-flex items-center gap-2 p-2 text-sm underline" disabled={busy} type="button" onClick={() => remove(item)}><Trash2 size={14} />Delete</button></div></div></article>)}</div>
      </section>
    </div>
  </>;
}

export default function MediaAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (mediaServerEnabled) mediaRequest("/session").then(data => setAuthed(data.authenticated)).catch(err => setError(err.message)).finally(() => setChecking(false)); }, []);
  const signIn = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try { await mediaRequest("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); setAuthed(true); setPassword(""); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const signOut = async () => { try { await mediaRequest("/logout", { method: "POST" }); setAuthed(false); } catch (err) { setError(err.message); } };
  if (!mediaServerEnabled) return <div className="pt-12 pb-24 min-h-screen container-x"><Seo title="Image library — Super Graphic" noindex />
    <div className="flex flex-wrap justify-between gap-5 items-end mb-8"><h1 className="font-display font-bold text-3xl">Media library</h1><Link to="/media-gallery" className="btn-ghost">View public gallery</Link></div>
    <div className="plate p-6 mb-10"><h2 className="font-display font-bold text-xl">Your photos are published. Uploads are not enabled yet.</h2><p className="mt-3 text-ink/75 max-w-2xl">Browse your published photos below. Uploading new photos and editing or deleting them requires the secure media service to be connected.</p></div>
    <GalleryContent />
  </div>;
  return <div className="pt-12 pb-24 min-h-screen container-x"><Seo title="Media Admin — Super Graphic" noindex />
    {checking ? <p role="status">Checking your session…</p> : authed ? <>{error && <p role="alert">{error}</p>}<Library onLogout={signOut} /></> : <form onSubmit={signIn} className="admin-login plate max-w-md mx-auto my-10 p-7 sm:p-10"><h1 className="font-display font-bold text-3xl">Manage your gallery</h1><p className="mt-4 text-ink/75">Sign in to publish and manage Super Graphic photos.</p><label className="block mt-6"><span className="block text-sm font-semibold mb-2">Admin password</span><input className="field" type="password" required maxLength={256} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p role="alert" className="mt-4 text-ink">{error}</p>}<button disabled={busy} className="btn-ink w-full mt-5">{busy ? "Signing in…" : "Sign in"}</button><Link to="/media-gallery" className="block mt-5 text-sm underline text-center">Back to gallery</Link></form>}
  </div>;
}
