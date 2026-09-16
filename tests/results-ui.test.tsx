import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisResults } from "../src/components/analysis-results";
import { AnalysisProgress } from "../src/components/analysis-progress";
import { CollectionModal } from "../src/components/collection-modal";
import { fieldNames, type Report, type Result } from "../src/lib/analysis/contracts";
import { analysisExport, collectionExport } from "../src/lib/analysis/exports";
import type { Collection } from "../src/components/use-live-sources";
import type { Discovery } from "../src/lib/crawl/contracts";
const url = "https://gangnambeautyguide.com/en/clinics/test/";
const time = "2026-09-15T22:00:00Z";
const finding: Result = { unitId: "r1", status: "gaps_found", reason: "No details stated.", quotes: [], fields: fieldNames.map((name) => ({ name, state: "not_stated", quote: null })), candidateUrl: null, method: "ai", surface: null, records: [{ id: "r1", text: "PRIVATE-TEST-BODY-not-for-analysis-export", pageUrl: url, clinicUrl: url, clinic: "Test PS", kind: "summary" }] };
const report: Report = { provider: "deepseek", lens: "missing-information", model: "deepseek-flash", collectionStartedAt: time, collectionFinishedAt: time, startedAt: time, finishedAt: time, status: "partial", stopReason: "error", results: [finding], tasks: 2, completedTasks: 1, eligible: 2, selected: 2, warnings: [], error: "Batch 2 failed validation." };
const discovery: Discovery = { id: "fixture", startedAt: time, finishedAt: time, sources: [{ url, kind: "clinic", discoveredAt: time, discoveredFrom: [] }], totalFound: 1, omitted: 0, partial: false, warnings: [] };
const collection: Collection = { startedAt: time, finishedAt: time, complete: true, note: null, pages: [{ url, finalUrl: url, kind: "clinic", collectedAt: time, status: "collected", httpStatus: 200, title: "Test", error: null, warnings: [], truncated: false, stopRequested: false, reportedReviewCount: null,
  clinics: [{ name: "Test PS", url, pageUrl: url }], reviews: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, pageUrl: url, position: i + 1, locator: `Review ${i}`, collectedAt: time, clinicName: "Test PS", clinicUrl: url, rating: null, sourceLabel: null, publishedAt: null, originalReviewUrl: null, text: `Published text ${i}`, contentKind: "summary" as const, language: "en", translationLabel: null, textTruncated: false })) }] };

describe("results-first presentation", () => {
  it("reports actual analyzed units separately from collection and supports resume", async () => {
    const resume = vi.fn();
    render(<AnalysisProgress report={report} onCancel={vi.fn()} onResume={resume} disabled={false} />);
    expect(screen.getByRole("progressbar", { name: "Analysis completion" })).toHaveAttribute("value", "1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("max", "2");
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("interrupted");
    expect(screen.getByRole("alert")).toHaveTextContent("Batch 2");
    await userEvent.click(screen.getByRole("button", { name: "Resume interrupted analysis" }));
    expect(resume).toHaveBeenCalledOnce();
  });
  it("makes running and cancellation explicit", async () => {
    const cancel = vi.fn();
    const { rerender } = render(<AnalysisProgress report={{ ...report, status: "running", finishedAt: null, error: null }} onCancel={cancel} onResume={vi.fn()} disabled={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("in progress");
    await userEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    expect(cancel).toHaveBeenCalledOnce();
    rerender(<AnalysisProgress report={{ ...report, stopReason: "cancelled" }} onCancel={cancel} onResume={vi.fn()} disabled={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
  });
  it("does not invent a 100 percent result when nothing is eligible", () => {
    render(<AnalysisProgress report={{ ...report, status: "complete", selected: 0, eligible: 0, results: [], error: null }} onCancel={vi.fn()} onResume={vi.fn()} disabled={false} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Not applicable")).toBeInTheDocument();
  });
  it("starts identity AI progress at zero independently of published links, then counts AI results", () => {
    const linked: Result = { ...finding, status: "linked_identity", method: "published_link", fields: [] };
    const identity: Report = { ...report, lens: "clinic-identity", status: "running", finishedAt: null, error: null, results: [linked, { ...linked, unitId: "r2" }], selected: 3, eligible: 3 };
    const props = { onCancel: vi.fn(), onResume: vi.fn(), disabled: false };
    const { rerender } = render(<AnalysisProgress report={identity} {...props} />);
    expect(screen.getByRole("progressbar", { name: "AI name review completion" })).toHaveAttribute("value", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("max", "1");
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 / 1 remaining names processed with AI")).toBeInTheDocument();
    expect(screen.getByText(/Overall coverage: 2 \/ 3/)).toBeInTheDocument();
    expect(screen.getByText(/not another lens's conclusions/)).toBeInTheDocument();
    rerender(<AnalysisProgress report={{ ...identity, status: "complete", finishedAt: time, results: [...identity.results, { ...finding, unitId: "r3", status: "unresolved", fields: [] }] }} {...props} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText(/Overall coverage: 3 \/ 3/)).toBeInTheDocument();
  });
  it("handles identity with only published links without inventing an AI run", () => {
    render(<AnalysisProgress report={{ ...report, lens: "clinic-identity", status: "complete", error: null, results: [{ ...finding, method: "published_link" }], selected: 1 }} onCancel={vi.fn()} onResume={vi.fn()} disabled={false} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("No AI review needed")).toBeInTheDocument();
    expect(screen.getByText(/Overall coverage: 1 \/ 1/)).toBeInTheDocument();
  });
  it("summarizes processed records only and merges filter aliases by published URL", async () => {
    const alias: Result = { ...finding, unitId: "r2", records: [{ ...finding.records[0], id: "r2", clinic: "Test Plastic Surgery" }] };
    render(<AnalysisResults report={{ ...report, results: [finding, alias], selected: 3, eligible: 3 }} />);
    expect(screen.getByText(/Partial results.*2 processed/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Clinic", { selector: "select" })).getAllByRole("option")).toHaveLength(2);
    await userEvent.selectOptions(screen.getByLabelText("Clinic", { selector: "select" }), url);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    await userEvent.selectOptions(screen.getByLabelText("Missing or unclear field"), "surgeon");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("EVIDENCE, WITH CONTEXT")).not.toBeInTheDocument();
    expect(screen.getAllByText("View details")[0].closest("details")).not.toHaveAttribute("open");
    await userEvent.click(screen.getAllByText("View details")[0]);
    expect(screen.getAllByText("View details")[0].closest("details")).toHaveAttribute("open");
  });
  it("shows comparison records A and B with independent source links", async () => {
    const pair: Result = { ...finding, status: "similar", fields: [], records: [finding.records[0], { ...finding.records[0], id: "r2", pageUrl: "https://gangnambeautyguide.com/en/reviews/" }] };
    render(<AnalysisResults report={{ ...report, lens: "review-similarity", results: [pair], selected: 1 }} />);
    await userEvent.click(screen.getByText("View details"));
    expect(screen.getByRole("heading", { name: /Record A/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Record B/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open source page ↗" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Inconclusive" })).toBeInTheDocument();
    expect(screen.getByText(/No matched partner is assigned here/)).toBeInTheDocument();
    expect(screen.getByText(/Meaningfully related content/)).toBeInTheDocument();
  });
  it("renders an inconclusive comparison as individual records, never as a displayed pair", () => {
    const uncertain: Result = { ...finding, status: "inconclusive", fields: [], records: [finding.records[0], { ...finding.records[0], id: "r2" }] };
    render(<AnalysisResults report={{ ...report, lens: "review-similarity", results: [uncertain], selected: 1 }} />);
    expect(screen.getAllByRole("article", { name: "Inconclusive item" })).toHaveLength(2);
    expect(screen.queryByText(/Record A/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Record B/)).not.toBeInTheDocument();
    expect(screen.queryByText("View details")).not.toBeInTheDocument();
    expect(screen.getAllByText("View item details")).toHaveLength(2);
    expect(screen.getByText(/1 \/ 1 checks processed · 0 paired findings/)).toBeInTheDocument();
  });
  it("filters individual inconclusive records by finding, clinic and record type", async () => {
    const pair: Result = { ...finding, status: "similar", fields: [], records: [finding.records[0], { ...finding.records[0], id: "r2" }] };
    const otherUrl = "https://gangnambeautyguide.com/en/clinics/other/";
    render(<AnalysisResults report={{ ...report, lens: "review-similarity", results: [pair], issues: [
      { record: { ...finding.records[0], id: "r3" }, reasons: ["insufficient_evidence"] },
      { record: { ...finding.records[0], id: "r4", clinic: "Other PS", clinicUrl: otherUrl, kind: "translation" }, reasons: ["invalid_output"] },
    ] }} />);
    const filter = screen.getByLabelText("Finding");
    expect(within(filter).getByRole("option", { name: "Inconclusive" })).toBeInTheDocument();
    expect(within(filter).getByRole("option", { name: "Similar" })).toBeInTheDocument();
    await userEvent.selectOptions(filter, "inconclusive");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("View details")).not.toBeInTheDocument();
    expect(screen.queryByText("No findings match these filters.")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Record type"), "translation");
    expect(screen.getAllByRole("article", { name: "Inconclusive item" })).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText("Clinic", { selector: "select" }), url);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText("No findings match these filters.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Record type"), "");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await userEvent.selectOptions(filter, "similar");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByRole("article", { name: "Inconclusive item" })).not.toBeInTheDocument();

  });
  it("offers both similarity categories even when only inconclusive items exist", async () => {
    render(<AnalysisResults report={{ ...report, lens: "review-similarity", results: [], issues: [{ record: finding.records[0], reasons: ["invalid_output"] }] }} />);
    expect(within(screen.getByLabelText("Finding")).getAllByRole("option")).toHaveLength(3);
    await userEvent.selectOptions(screen.getByLabelText("Finding"), "inconclusive");
    expect(screen.getByRole("article", { name: "Inconclusive item" })).toBeInTheDocument();
  });
  it("finishes progress with unresolved records without presenting them as validated findings", () => {
    render(<AnalysisProgress report={{ ...report, status: "complete", results: [], processedUnitIds: ["one", "two"], issues: [{ record: finding.records[0], reasons: ["invalid_output"] }], error: null }} onCancel={vi.fn()} onResume={vi.fn()} disabled={false} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("inconclusive items need review");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/1 individual records need review/)).toBeInTheDocument();
  });
});
describe("collection reference modal", () => {
  it("opens only on demand, paginates, filters, closes and restores trigger focus without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    function Wrapper() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>View collected data</button>{open && <CollectionModal collection={collection} discovery={discovery} onClose={() => setOpen(false)} />}</>; }
    try {
      render(<Wrapper />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      const trigger = screen.getByRole("button", { name: "View collected data" });
      await userEvent.click(trigger);
      expect(screen.getByRole("dialog")).toHaveAttribute("open");
      expect(screen.getAllByRole("row")).toHaveLength(11);
      await userEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(screen.getAllByRole("row")).toHaveLength(3);
      await userEvent.click(screen.getByRole("button", { name: "Clinic names (1)" }));
      expect(screen.getAllByRole("row")).toHaveLength(2);
      expect(screen.queryByLabelText("Collected record type")).not.toBeInTheDocument();
      fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
describe("separate export contracts", () => {
  it("exports inconclusive records individually without pair membership, raw bodies or rejected citations", () => {
    const uncertain: Result = { ...finding, status: "inconclusive", fields: [], records: [finding.records[0], { ...finding.records[0], id: "r2" }] };
    const file = analysisExport(discovery, collection, { "deepseek:review-similarity": { ...report, lens: "review-similarity", results: [uncertain], selected: 1 } }, "deepseek", "review-similarity");
    const exported = file.reports["deepseek:review-similarity"];
    expect(file.schemaVersion).toBe(7);
    expect(exported.results).toHaveLength(0);
    expect(exported.issues).toHaveLength(2);
    expect(exported.processedUnits).toBe(1);
    expect(exported.issues[0]).not.toHaveProperty("records");
    expect(JSON.stringify(file)).not.toContain("PRIVATE-TEST-BODY");
    expect(exported.issues[0].record).not.toHaveProperty("text");
  });
  it("exports all lens reports even when a different lens is active, including partial status", () => {
    const reports = {
      "deepseek:missing-information": report,
      "deepseek:clinic-identity": { ...report, lens: "clinic-identity" as const, status: "complete" as const },
      "deepseek:review-similarity": { ...report, lens: "review-similarity" as const, status: "complete" as const },
    };
    const file = analysisExport(discovery, collection, reports, "deepseek", "review-similarity");
    expect(file.exportScope).toBe("all-lenses");
    expect(file.activeLensAtExport).toBe("review-similarity");
    expect(file.selectedScenario).toBe(file.activeLensAtExport);
    expect(Object.keys(file.reports)).toHaveLength(3);
    expect(file.coverage.map((r) => r.status)).toEqual(["partial", "complete", "complete"]);
    expect(Object.values(file.reports).every((r) => r.results.length === 1)).toBe(true);
  });
  it("keeps supporting quotes but excludes complete bodies from the analysis export", () => {
    const file = analysisExport(discovery, collection, { "deepseek:missing-information": report }, "deepseek", "missing-information");
    expect(JSON.stringify(file)).not.toContain("PRIVATE-TEST-BODY");
    expect(file).not.toHaveProperty("collection");
    expect(file.coverage).toHaveLength(3);
    expect(file.coverage.filter((r) => r.status === "not_run")).toHaveLength(2);
    expect(file.reports["deepseek:missing-information"].results[0].records[0].pageUrl).toBe(url);
    const data = collectionExport(discovery, collection);
    expect(data.collection.pages[0].reviews).toHaveLength(12);
    expect(data).not.toHaveProperty("reports");
    expect(JSON.stringify([file, data])).not.toContain('"key":');
  });
});
