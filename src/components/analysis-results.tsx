"use client";
import { useState } from "react";
import { fieldNames, type Finding, type Report } from "@/lib/analysis/contracts";
import { scenarios } from "@/lib/product";
import { PROVIDERS } from "@/lib/analysis/providers";
import { clinicKey, clinicOptions, fieldLabels, findingLabels, inconclusiveItems, kindLabel, processedCount, similarityDescriptions, stateLabels } from "@/lib/analysis/presentation";
import { InconclusiveItems } from "./inconclusive-items";

export function AnalysisResults({ report: sourceReport }: { report: Report }) {
  const items = inconclusiveItems(sourceReport);
  const report = { ...sourceReport, results: sourceReport.results.filter((r) => r.status !== "inconclusive") };
  const [clinic, setClinic] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [field, setField] = useState("");
  const [shown, setShown] = useState(12);
  const clinics = clinicOptions([...report.results, ...items.map((item) => ({ records: [item.record] }))]);
  const statuses: Finding["status"][] = report.lens === "review-similarity" ? ["similar", "inconclusive"] : [...new Set([...report.results.map((r) => r.status), ...(items.length ? ["inconclusive" as const] : [])])].sort();
  const kinds = [...new Set([...report.results.flatMap((r) => r.records.map((row) => row.kind)), ...items.map((item) => item.record.kind)])].sort();
  const filtered = report.results.filter((r) => (!clinic || r.records.some((row) => clinicKey(row) === clinic)) && (!status || r.status === status) && (!kind || r.records.some((row) => row.kind === kind)) && (!field || r.fields.some((f) => f.name === field && f.state !== "stated")));
  const filteredItems = items.filter((item) => (!status || status === "inconclusive") && (!clinic || clinicKey(item.record) === clinic) && (!kind || item.record.kind === kind) && !field);
  const categories = report.lens === "clinic-identity" ? ["linked_identity", "candidate_match", "unresolved"] as const : ["similar", "inconclusive"] as const;
  return <section className="analysis-results" aria-labelledby="findings-title">
    <div className="panel-heading"><div><span className="eyebrow">ANALYSIS RESULTS</span><h3 id="findings-title">{scenarios.find((s) => s.id === report.lens)!.title}</h3><p>{processedCount(sourceReport)} / {report.selected} checks processed · {report.results.length} {report.lens === "review-similarity" ? "paired findings" : "validated findings"} · {report.eligible} eligible</p></div><span className="status-pill">{PROVIDERS[report.provider].label}</span></div>
    <p className="summary-scope">{report.status !== "complete" ? "Partial results — " : "Selected results — "}{report.lens === "review-similarity" ? `${report.results.length} paired findings before filters. Inconclusive outcomes appear separately as individual items.` : `summary covers only the ${report.results.length} processed records, before filters.`} Repeated appearances are not unique patients or clinics.{report.lens === "review-similarity" && " Pairs were selected for high word overlap: this is selected coverage, not a count of unique patients."}</p>
    {report.lens === "missing-information" ? <div className="result-summary" aria-label="Field coverage summary">{fieldNames.map((name) => <div className="summary-card" key={name}><h4>{fieldLabels[name]}</h4>{(["stated", "not_stated", "unclear"] as const).map((state) => <p key={state}><strong>{report.results.filter((r) => r.fields.some((f) => f.name === name && f.state === state)).length}</strong><span>{stateLabels[state]}</span></p>)}</div>)}</div> : <div className="result-summary" aria-label="Finding summary">{categories.map((value) => <div className="summary-card" key={value}><strong className="summary-number">{value === "inconclusive" ? items.length : report.results.filter((r) => r.status === value).length}</strong><h4>{findingLabels[value]}</h4>{report.lens === "review-similarity" && <><small>{value === "inconclusive" ? "individual records · no pair assigned" : "pairs"}</small><p className="category-explanation">{similarityDescriptions[value]}</p></>}</div>)}</div>}
    {report.lens === "review-similarity" && <p className="field-hint">Similar counts pairs; Inconclusive counts individual records, deduplicated by source-record ID. Do not add these counts as if they used the same unit.</p>}
    <p className="collection-disclaimer">{report.lens === "missing-information" ? "Missing from a published summary does not mean missing from the original review. These findings describe text, not medical quality." : report.lens === "review-similarity" ? `Only ${report.selected} of ${report.eligible} eligible pairs were selected. Unselected pairs have not been assessed. Similarity is not proof of duplication.` : "Names sharing a published profile link can be grouped. AI suggestions are not verified identities."} Interpretations need human review; checked quotations verify text provenance, not correctness.</p>
    <details className="run-warnings"><summary>Processing details & coverage</summary><p>{report.completedTasks} / {report.tasks} AI batches · Model: {report.model}</p><p>Collection: {new Date(report.collectionStartedAt).toLocaleString()} · Analysis started: {new Date(report.startedAt).toLocaleString()}{report.finishedAt && ` · Ended: ${new Date(report.finishedAt).toLocaleString()}`}</p><ul>{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul></details>
    {!report.eligible && !report.error && <p className="run-message">No eligible records for this lens in the collected dataset. No AI request was needed.</p>}
    <div className="result-filters"><label>Clinic<select value={clinic} onChange={(e) => { setClinic(e.target.value); setShown(12); }}><option value="">All clinics</option>{clinics.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}</select></label><label>Finding<select value={status} onChange={(e) => { setStatus(e.target.value); setShown(12); }}><option value="">All findings</option>{statuses.map((v) => <option key={v} value={v}>{findingLabels[v]}</option>)}</select></label><label>Record type<select value={kind} onChange={(e) => { setKind(e.target.value); setShown(12); }}><option value="">All types</option>{kinds.map((v) => <option key={v} value={v}>{kindLabel(v)}</option>)}</select></label>{report.lens === "missing-information" && <label>Missing or unclear field<select value={field} onChange={(e) => { setField(e.target.value); setShown(12); }}><option value="">Any field</option>{fieldNames.map((name) => <option key={name} value={name}>{fieldLabels[name]}</option>)}</select></label>}</div>
    <p className="field-hint">Showing {Math.min(shown, filtered.length)} of {filtered.length} matching findings · {filteredItems.length} matching inconclusive records. Grouping uses published profile links, never name similarity alone.</p>
    {!filtered.length && !filteredItems.length && (report.results.length > 0 || items.length > 0) && <p className="run-message">No findings match these filters.</p>}
    <div className="findings-list">{filtered.slice(0, shown).map((finding) => <article className="finding-card compact-finding" key={finding.unitId}>
      <div className="finding-top"><div><strong>{finding.records[0].clinic}</strong><small>{finding.records.map((r) => kindLabel(r.kind)).join(" / ")} · {finding.records.length > 1 ? "Comparison" : "Record"} {report.results.indexOf(finding) + 1}</small></div><span className="status-pill">{findingLabels[finding.status]}</span></div>
      <p className="finding-reason">{finding.reason}</p>
      {!!finding.fields.length && <div className="field-chips">{finding.fields.map((f) => <span key={f.name} className={`field-chip ${f.state}`}><strong>{fieldLabels[f.name]}</strong> {stateLabels[f.state]}</span>)}</div>}
      <details className="finding-details"><summary>View details</summary>
        <p className="field-hint">{finding.method === "published_link" ? "Resolved from a published link, not independently verified." : "AI interpretation. Supporting quotations match the collected text."}</p>
        {!!finding.fields.length && <dl className="finding-fields">{finding.fields.map((f) => <div key={f.name}><dt>{fieldLabels[f.name]} · {stateLabels[f.state]}</dt><dd>{f.quote ? <blockquote>{f.quote}</blockquote> : "No supporting detail stated in this collected text."}</dd></div>)}</dl>}
        <div className={finding.records.length === 2 ? "comparison-grid" : "supporting-records"}>{finding.records.map((record, i) => <section key={record.id} className="comparison-record" aria-label={`Supporting record ${i + 1}`}><h4>{finding.records.length === 2 ? `Record ${i === 0 ? "A" : "B"}` : "Supporting record"} · {kindLabel(record.kind)}</h4>{finding.quotes.filter((q) => q.recordId === record.id).map((q, j) => <blockquote key={j}>{q.text}</blockquote>)}<a href={record.pageUrl} target="_blank" rel="noreferrer">Open source page ↗</a><details><summary>Read supporting text</summary><p className="source-text">{record.text}</p><small>Reference: {record.id}</small></details></section>)}</div>
        {finding.candidateUrl && <a href={finding.candidateUrl} target="_blank" rel="noreferrer">{finding.method === "published_link" ? "Published clinic profile" : "Suggested candidate — verify manually"} ↗</a>}
      </details>
    </article>)}</div>
    {filtered.length > shown && <button className="button button-secondary show-more" onClick={() => setShown((n) => n + 12)}>Show 12 more findings</button>}
    <InconclusiveItems key={`${clinic}:${status}:${kind}:${field}`} items={filteredItems} />
  </section>;
}
