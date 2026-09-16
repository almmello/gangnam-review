"use client";
import { useEffect, useState } from "react";
import type { Report } from "@/lib/analysis/contracts";
import { PROVIDERS } from "@/lib/analysis/providers";
import { inconclusiveItems, processedCount, reportState } from "@/lib/analysis/presentation";
import { scenarios } from "@/lib/product";

export function AnalysisProgress({ report, onCancel, onResume, disabled }: { report: Report; onCancel: () => void; onResume: () => void; disabled: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const running = report.status === "running";
  useEffect(() => { if (!running) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [running]);
  const elapsed = Math.max(0, Math.floor(((report.finishedAt ? Date.parse(report.finishedAt) : now) - Date.parse(report.startedAt)) / 1000));
  const identity = report.lens === "clinic-identity";
  const linked = identity ? report.results.filter((result) => result.method === "published_link").length : 0;
  const processed = processedCount(report);
  const completed = processed - linked;
  const total = report.selected - linked;
  const percent = total ? Math.floor(completed / total * 100) : 0;
  return <section className={`analysis-progress-panel ${running ? "is-running" : report.status}`} aria-label="Analysis progress">
    <div className="progress-heading"><div><span className="eyebrow">{scenarios.find((s) => s.id === report.lens)!.title} · {PROVIDERS[report.provider].label}</span><p role="status" aria-live="polite">{running && <span className="activity-dot" aria-hidden="true" />}{reportState(report)}</p></div>{running ? <button className="button button-secondary" onClick={onCancel}>Cancel analysis</button> : report.status === "partial" && <button className="button button-secondary" disabled={disabled} onClick={onResume}>Resume interrupted analysis</button>}</div>
    {identity && <div className="identity-progress-context"><p><strong>{linked} name occurrences</strong> linked from published clinic-profile URLs, without AI.</p><p>This lens reuses the collected pages, not another lens&apos;s conclusions. AI reviews the remaining names independently.</p></div>}
    <div className="progress-numbers"><strong>{identity ? `${completed} / ${total} remaining names processed with AI` : `${completed} / ${total} ${report.lens === "review-similarity" ? "comparison checks processed" : "review records processed"}`}</strong><span>{total ? `${percent}%` : identity && report.selected ? "No AI review needed" : "Not applicable"}</span></div>
    {total > 0 && <progress aria-label={identity ? "AI name review completion" : "Analysis completion"} value={completed} max={total} />}
    {identity && <p className="field-hint">Overall coverage: {processed} / {report.selected} name occurrences processed, including published links and AI checks.</p>}
    {report.lens === "review-similarity" && <p className="field-hint">One semantic pass per batch. Progress updates after the response and source quotations are validated.</p>}
    {inconclusiveItems(report).length > 0 && <p className="field-hint">{inconclusiveItems(report).length} individual records need review. Processing progress includes checks with inconclusive outcomes, not just validated findings.</p>}
    <p className="field-hint">{Math.floor(elapsed / 60)}m {elapsed % 60}s since first analysis start{running ? " · Waiting for the current provider response; progress updates after validation." : report.status === "partial" ? " · Incomplete. Validated results are preserved." : " · Selected coverage only; not a clinic quality rating."}</p>
    {report.error && <p className="progress-error" role="alert">{report.error}</p>}
  </section>;
}
