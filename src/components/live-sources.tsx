"use client";
import { useState, type ReactNode } from "react";
import { ApiSetup } from "./api-setup";
import { analysisExport, downloadJson } from "@/lib/analysis/exports";
import { CollectionModal } from "./collection-modal";
import { AnalysisProgress } from "./analysis-progress";
import { PROVIDERS } from "@/lib/analysis/providers";
import { useAnalysis } from "./use-analysis";
import { AnalysisResults } from "./analysis-results";
import type { CollectedPage } from "@/lib/crawl/contracts";
import { scenarios, site, type ScenarioId } from "@/lib/product";
import { useLiveSources } from "./use-live-sources";
import { Icon } from "./icon";
const labels: Record<CollectedPage["status"], string> = {
  collected: "Collected", no_review_section: "No review section", empty_review_section: "Empty review section",
  extraction_failed: "Template not recognized", fetch_failed: "Fetch failed", robots_blocked: "Blocked by robots policy",
};
const stamp = (value: string) => new Date(value).toLocaleString();
export function LiveSources({ scenario, children }: { scenario: ScenarioId; children: ReactNode }) {
  const { discovery, collection, activity, error, scan, analyze, cancel } = useLiveSources();
  const ai = useAnalysis();
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reused, setReused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const busy = activity !== "idle" || ai.active !== null || starting;
  const report = ai.reports[scenario];
  const lensComplete = report?.status === "complete";
  const activeReport = ai.active ? ai.reports[ai.active] : report;
  const savedReports = Object.values(ai.allReports);
  const partialExport = savedReports.some((r) => r.status !== "complete");
  async function runAnalysis(restart = false) {
    if (busy || lensComplete) return;
    setStarting(true); setReused(!!collection?.finishedAt); setActionError(null);
    try { const dataset = await analyze(); if (dataset) await ai.run(dataset, scenario, restart); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Unable to prepare the analysis."); }
    finally { setStarting(false); }
  }
  async function exportAll() {
    if (!discovery || !collection || exporting) return;
    setExporting(true); setActionError(null);
    try { downloadJson(analysisExport(discovery, collection, ai.allReports, ai.provider, scenario), `gangnam-analysis-${discovery.id}.json`); }
    catch { setActionError("Download could not be created. Please try again."); }
    finally { setExporting(false); }
  }
  const lens = scenarios.find((item) => item.id === scenario)!;
  const pages = new Map(collection?.pages.map((page) => [page.url, page]));
  const failures = collection?.pages.filter((page) => page.error).length ?? 0;
  return <>
    <div className="section-step"><span className="step-index">1</span><div><p className="eyebrow">A SHARED STARTING POINT</p><h2>Select your source</h2><p>Discover the current pages once. Reuse their collected evidence across all three lenses.</p></div></div>
    <fieldset className="source-choice"><legend>Source website</legend><label><input type="radio" name="source" checked readOnly value={site.sourceHost} /><span><strong>Gangnam Beauty Guide</strong><small>English clinic profiles, directory and published reviews. The only source supported in this MVP.</small></span></label><a href={site.sourceUrl} target="_blank" rel="noreferrer">{site.sourceHost}<Icon name="external" size={13} /></a></fieldset>
    <section className="source-panel" aria-labelledby="sources-title">
      <div className="panel-heading"><div><h3 id="sources-title">Website sources</h3><p>{discovery ? `Scanned ${stamp(discovery.finishedAt)}` : "Your next scan will define the dataset."}</p></div><span className="status-pill">{activity === "scanning" ? "Scanning…" : discovery ? `${discovery.sources.length} URLs` : "Not scanned"}</span></div>
      {!discovery ? <div className="empty-sources"><div className="empty-illustration" aria-hidden="true"><span className="paper back" /><span className="paper front"><span /><span /><span /></span><span className="glass"><Icon name="search" size={24} /></span></div><h4>{activity === "scanning" ? "Discovering current sources" : "No sources discovered yet"}</h4><p>{activity === "scanning" ? "Checking robots.txt, the current sitemap and entry-point links." : "URLs will appear here after a live website scan. No saved lists. No preloaded reviews."}</p></div> : <>
        {!discovery.sources.length && <p className="run-message">No supported URLs were found. See scan warnings below.</p>}
        <div className="source-list" tabIndex={0} role="region" aria-label="Discovered website URLs">{discovery.sources.map((source) => {
          const page = pages.get(source.url);
          return <details className="source-row" key={source.url}><summary><span className="source-address"><small>{source.kind}</small><span>{new URL(source.url).pathname}</span></span><span className={"source-status " + (page?.error ? "has-error" : "")}>{page ? labels[page.status] : collection ? "Not collected" : "Discovered"}</span></summary><div className="source-detail"><a href={source.url} target="_blank" rel="noreferrer">{source.url} ↗</a><p>Discovered {stamp(source.discoveredAt)}</p><p>Found via: {source.discoveredFrom.join(", ")}</p>{page && <><p>{page.reviews.length} review occurrences · {page.clinics.length} clinic-name occurrences · Collected {stamp(page.collectedAt)}</p>{page.finalUrl && page.finalUrl !== page.url && <p>Redirected to: {page.finalUrl}</p>}{page.error && <p className="has-error">{page.error}</p>}{page.warnings.map((warning) => <p key={warning}>{warning}</p>)}</>}</div></details>;
        })}</div>
        {!!discovery.warnings.length && <details className="run-warnings"><summary>Scan coverage warnings ({discovery.warnings.length})</summary><ul>{discovery.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
      </>}
      <div className="action-bar"><button className="button button-primary" type="button" disabled={busy} onClick={() => { setReused(false); ai.reset(); void scan(); }} aria-describedby="scan-help"><Icon name="search" size={17} />{discovery ? "Refresh sources" : "Scan website"}</button>{activity === "scanning" && <button type="button" className="button button-secondary" onClick={cancel}>Cancel</button>}<span id="scan-help">{discovery ? "Refresh clears this dataset and its findings. Changing the lens does not." : "Discover URLs first; no AI request is made."}</span></div>
      <div className="run-status" role="status" aria-live="polite">{activity === "scanning" ? "Scan in progress. No AI requests are made." : activity === "collecting" ? `Collecting fresh pages: ${collection?.pages.length ?? 0} / ${discovery?.sources.length}. You can cancel safely.` : collection ? `${collection.complete ? "Collection finished" : "Partial collection"}: ${collection.pages.length} / ${discovery?.sources.length} pages attempted · ${failures} failures.` : discovery ? "Scan finished. Choose a lens, then run analysis." : "Ready for a live scan."}</div>
      {collection && <div className="collection-progress"><progress aria-label="Pages collected" value={collection.pages.length} max={discovery?.sources.length || 1} /><small>Collection started {stamp(collection.startedAt)}{collection.finishedAt ? ` · Collection ended ${stamp(collection.finishedAt)}` : ""}</small></div>}
      {error && <p className="run-message has-error" role="alert">{error}</p>}
      {collection?.note && <p className="run-message">{collection.note}</p>}
      {collection && <div className="source-data-action"><button type="button" className="quiet-button" onClick={() => setShowCollection(true)}>View collected data</button></div>}
    </section>
    {children}
    <section className="analysis-action-section" aria-labelledby="run-title">
      <div className="section-step"><span className="step-index">3</span><div><p className="eyebrow">APPLY YOUR CHOSEN LENS</p><h2 id="run-title">Run your analysis</h2><p>Selected lens: <strong>{lens.title}</strong></p></div></div>
      <p id="analysis-help" className="analysis-help">{collection?.finishedAt ? "This lens uses the existing collection. No new website scan or collection is needed." : "The first run collects current evidence, then analyzes your selected lens. Later lenses reuse the same collection."} Relevant text is sent to <strong>{PROVIDERS[ai.provider].label}</strong> ({PROVIDERS[ai.provider].model}). Obvious contacts are removed; this is not full anonymization. Each lens keeps its own report; changing the connection does not recollect the website.</p>
      <button className="button button-primary" type="button" disabled={busy || exporting || lensComplete || !discovery?.sources.length} onClick={() => void runAnalysis()} aria-describedby="analysis-help">{lensComplete ? "Analysis complete" : report?.status === "partial" ? "Resume analysis" : "Run analysis"}{!lensComplete && <Icon name="arrow" size={17} />}</button>
      {lensComplete && <p className="field-hint">This lens is complete. Select a lens not yet analyzed to continue; completed results remain available below.</p>}
      {scenario === "review-similarity" && !lensComplete && <p className="field-hint">One semantic analysis identifies related content.</p>}
      {scenario === "review-similarity" && report?.status === "partial" && <button className="quiet-button" disabled={busy || exporting} onClick={() => void runAnalysis(true)}>Restart this lens</button>}
      <button className="button button-secondary connection-toggle" type="button" disabled={busy} aria-expanded={showSetup} onClick={() => setShowSetup((value) => !value)}>{showSetup ? "Close connection settings" : "Change API connection"}</button>
      {showSetup && <div className="inline-setup"><p className="field-hint">Change your connection here without leaving or clearing this dataset.</p><ApiSetup disabled={busy} /></div>}
      {activity === "collecting" && <p className="dataset-reuse">Collecting shared evidence: {collection?.pages.length ?? 0} / {discovery?.sources.length} pages. <span>This first collection will be available to every lens. No AI result exists yet.</span><button className="button button-secondary" onClick={cancel}>Cancel collection</button></p>}
      {collection?.finishedAt && <p className="dataset-reuse" aria-live="polite">{reused ? "Reusing the collected dataset — no new scan or collection was made." : "Dataset ready to reuse with another lens."} <span>{collection.complete ? "Collection finished" : "Partial collection"} at {stamp(collection.finishedAt)}.</span>{!collection.complete && <span>Refresh sources to start a new collection attempt.</span>}</p>}
    </section>
    {activeReport && <AnalysisProgress report={activeReport} onCancel={ai.cancel} onResume={() => { if (collection) void (async () => { setStarting(true); setActionError(null); try { await ai.run(collection, activeReport.lens); } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to resume."); } finally { setStarting(false); } })(); }} disabled={busy || exporting} />}
    {report && <AnalysisResults key={ai.provider + scenario + report.collectionStartedAt} report={report} />}
    {discovery && collection && savedReports.length > 0 && !busy && <footer className="report-export" aria-label="Analysis report download">
      <div><span className="eyebrow">KEEP YOUR RESULTS</span><h3>Download all lens results</h3><p>One JSON includes every completed or partial lens report from this collection, not just the lens currently open. Lenses not run are marked as such. Includes supporting quotations and source references, never API keys. Full collected texts are available separately in “View collected data”.</p></div>
      <ul>{(["deepseek"] as const).map((provider) => <li key={provider}><strong>{PROVIDERS[provider].label}</strong>: {scenarios.map((lens) => `${lens.title}: ${ai.allReports[`${provider}:${lens.id}`]?.status ?? "not run"}`).join(" · ")}</li>)}</ul>
      <button type="button" className="button button-primary" disabled={exporting} onClick={() => void exportAll()}>{exporting ? "Preparing download…" : "Download all analyses (JSON)"}</button>
      <small>All findings are included regardless of filters. Reloading or leaving the workbench clears this session. {partialExport && "This report includes an incomplete analysis."}</small>
    </footer>}
    {actionError && <p role="alert" className="run-message has-error">{actionError}</p>}
    {showCollection && collection && discovery && <CollectionModal collection={collection} discovery={discovery} onClose={() => setShowCollection(false)} />}
  </>;
}
