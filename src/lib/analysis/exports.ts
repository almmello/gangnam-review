import type { Report, ReportKey } from "./contracts";
import { lensSchema } from "./contracts";
import { PROVIDERS, type ProviderId } from "./providers";
import type { Discovery } from "../crawl/contracts";
import type { Collection } from "../../components/use-live-sources";
import { inconclusiveItems, processedCount } from "./presentation";

export function collectionExport(discovery: Discovery, collection: Collection) {
  return { schemaVersion: 4, exportType: "collected-data", exportedAt: new Date().toISOString(), discovery, collection };
}
export function analysisExport(discovery: Discovery, collection: Collection, reports: Partial<Record<ReportKey, Report>>, provider: ProviderId, lens: Report["lens"]) {
  // Explicit projection: no complete review bodies, connection settings or keys.
  const projected = Object.fromEntries(Object.entries(reports).map(([key, report]) => [key, {
    provider: report.provider, lens: report.lens, model: report.model,
    collectionStartedAt: report.collectionStartedAt, collectionFinishedAt: report.collectionFinishedAt,
    startedAt: report.startedAt, finishedAt: report.finishedAt, status: report.status,
    stopReason: report.stopReason, tasks: report.tasks, completedTasks: report.completedTasks,
    eligible: report.eligible, selected: report.selected, warnings: report.warnings, error: report.error,
    processedUnitIds: report.processedUnitIds, processedUnits: processedCount(report), inconclusiveChecks: processedCount(report) - report.results.filter((result) => result.status !== "inconclusive").length, issues: inconclusiveItems(report).map((issue) => ({ reasons: issue.reasons, record: { id: issue.record.id, pageUrl: issue.record.pageUrl, clinic: issue.record.clinic, clinicUrl: issue.record.clinicUrl, kind: issue.record.kind } })), results: report.results.filter((result) => result.status !== "inconclusive").map((result) => ({ ...result, records: result.records.map((record) => ({
      id: record.id, pageUrl: record.pageUrl, clinic: record.clinic, clinicUrl: record.clinicUrl, kind: record.kind,
    })) })),
  }]));
  // selectedScenario is retained for compatibility: it describes UI context, not scope.
  return { schemaVersion: 7, exportType: "analysis-report", exportScope: "all-lenses", exportedAt: new Date().toISOString(), selectedProvider: provider, selectedScenario: lens, activeLensAtExport: lens,
    runId: discovery.id, sourceCoverage: { discovered: discovery.sources.length, attempted: collection.pages.length, failures: collection.pages.filter((p) => p.error).length, collectionComplete: collection.complete, startedAt: collection.startedAt, finishedAt: collection.finishedAt, warnings: discovery.warnings, note: collection.note },
    coverage: (Object.keys(PROVIDERS) as ProviderId[]).flatMap((id) => lensSchema.options.map((scenario) => ({ provider: id, lens: scenario, status: reports[`${id}:${scenario}`]?.status ?? "not_run" }))),
    reports: projected,
  };
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
