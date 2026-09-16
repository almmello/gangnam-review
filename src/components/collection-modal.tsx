"use client";
import { useEffect, useRef, useState } from "react";
import type { Collection } from "./use-live-sources";
import type { Discovery } from "@/lib/crawl/contracts";
import { collectionExport, downloadJson } from "@/lib/analysis/exports";
import { kindLabel } from "@/lib/analysis/presentation";

export function CollectionModal({ collection, discovery, onClose }: { collection: Collection; discovery: Discovery; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"reviews" | "clinics">("reviews");
  const [clinic, setClinic] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const reviews = collection.pages.flatMap((p) => p.reviews);
  const names = collection.pages.flatMap((p) => p.clinics);
  const choices = [...new Set(tab === "reviews" ? reviews.map((r) => r.clinicName ?? "Clinic not stated") : names.map((r) => r.name))].sort();
  const filteredReviews = reviews.filter((r) => (!clinic || (r.clinicName ?? "Clinic not stated") === clinic) && (!kind || r.contentKind === kind));
  const filteredNames = names.filter((r) => !clinic || r.name === clinic);
  const total = tab === "reviews" ? filteredReviews.length : filteredNames.length;
  const pages = Math.max(1, Math.ceil(total / 10));
  const current = Math.min(page, pages - 1);
  const failures = collection.pages.filter((p) => p.error);
  return <dialog ref={dialog} className="collection-dialog" aria-labelledby="collection-dialog-title" aria-describedby="collection-dialog-description" onCancel={onClose}>
    <header className="dialog-header"><div><span className="eyebrow">SOURCE REFERENCE</span><h2 id="collection-dialog-title">Collected source data</h2></div><button type="button" className="button button-secondary" onClick={onClose}>Close</button></header>
    <p id="collection-dialog-description">Published content collected for this run, not analysis findings. Counts include repeated appearances and summaries, not unique patients or clinics.</p>
    <p className="field-hint">{collection.complete ? "Complete collection" : collection.finishedAt ? "Partial collection" : "Collection in progress"} · Started {new Date(collection.startedAt).toLocaleString()} {collection.finishedAt && `· Ended ${new Date(collection.finishedAt).toLocaleString()}`} · {collection.pages.length} / {discovery.sources.length} pages attempted · {failures.length} page failures.</p>
    {(failures.length > 0 || collection.note) && <details><summary>Collection warnings</summary><p>{collection.note}</p><ul>{failures.map((p) => <li key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>: {p.error}</li>)}</ul></details>}
    <div className="modal-tabs" role="group" aria-label="Collected record category">{(["reviews", "clinics"] as const).map((value) => <button type="button" key={value} aria-pressed={tab === value} className="button button-secondary" onClick={() => { setTab(value); setPage(0); setClinic(""); setKind(""); }}>{value === "reviews" ? `Reviews (${reviews.length})` : `Clinic names (${names.length})`}</button>)}</div>
    <div className="result-filters"><label>Collected clinic<select value={clinic} onChange={(e) => { setClinic(e.target.value); setPage(0); }}><option value="">All clinics</option>{choices.map((c) => <option key={c}>{c}</option>)}</select></label>{tab === "reviews" && <label>Collected record type<select value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}><option value="">All types</option>{[...new Set(reviews.map((r) => r.contentKind))].map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>}</div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Collected data table"><table className="data-table"><caption>{total} matching {tab === "reviews" ? "review records" : "name occurrences"} · Page {current + 1} of {pages}</caption><thead><tr><th scope="col">Clinic</th><th scope="col">{tab === "reviews" ? "Type / published date" : "Published profile"}</th><th scope="col">Source / details</th></tr></thead><tbody>
      {tab === "reviews" ? filteredReviews.slice(current * 10, current * 10 + 10).map((r) => <tr key={r.id}><th scope="row">{r.clinicName ?? "Clinic not stated"}</th><td>{kindLabel(r.contentKind)}<small>{r.publishedAt ?? "Publication date not stated"}</small></td><td><a href={r.pageUrl} target="_blank" rel="noreferrer">Open source page ↗</a><details><summary>View collected text</summary><p className="source-text">{r.text}</p><p>Rating: {r.rating ?? "Not stated"} · Language: {r.language ?? "Not stated"} · Source label: {r.sourceLabel ?? "Not stated"}</p><p>Translation label: {r.translationLabel ?? "None observed"}</p>{r.originalReviewUrl ? <a href={r.originalReviewUrl} target="_blank" rel="noreferrer">Original review ↗</a> : <p>Original review link not available in extracted markup.</p>}<small>{r.locator} · Collected {new Date(r.collectedAt).toLocaleString()}{r.textTruncated ? " · Text truncated" : ""}</small></details></td></tr>) : filteredNames.slice(current * 10, current * 10 + 10).map((r, i) => <tr key={r.pageUrl + i}><th scope="row">{r.name}</th><td>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">Clinic profile ↗</a> : "No profile link published"}</td><td><a href={r.pageUrl} target="_blank" rel="noreferrer">Observed on source ↗</a></td></tr>)}
      {!total && <tr><td colSpan={3}>No records match these filters.</td></tr>}
    </tbody></table></div>
    <div className="pagination"><button className="button button-secondary" disabled={!current} onClick={() => setPage(current - 1)}>Previous page</button><span>Page {current + 1} / {pages}</span><button className="button button-secondary" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next page</button></div>
    <footer className="dialog-footer"><button className="button button-secondary" onClick={() => downloadJson(collectionExport(discovery, collection), `gangnam-collected-${discovery.id}.json`)}>Download collected data (JSON)</button><small>All collected records, regardless of filters. No AI results or API keys. May contain published personal information.</small></footer>
  </dialog>;
}
