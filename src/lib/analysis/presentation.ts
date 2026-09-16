import type { AnalysisRecord, Finding, Report, Result, ReviewIssue } from "./contracts";
export const fieldLabels = { procedure: "Procedure", surgeon: "Treating surgeon", price_and_currency: "Price & currency", procedure_date: "Procedure date" };
export const stateLabels = { stated: "✓ Stated", not_stated: "— Not stated", unclear: "? Unclear" };
export const findingLabels: Record<Finding["status"], string> = {
  gaps_found: "Missing or unclear details", all_fields_stated: "All four fields stated",
  candidate_match: "Suggested match · needs review", unresolved: "Unresolved name",
  similar: "Similar",
  inconclusive: "Inconclusive", linked_identity: "Linked by source website",
};
export const similarityDescriptions: Partial<Record<Finding["status"], string>> = {
  similar: "Meaningfully related content. Similarity does not establish duplication or the same patient.",
  inconclusive: "No meaningful text match, or an item whose analysis could not be validated. No matched partner is assigned here.",
};
export const issueReasons: Record<ReviewIssue["reasons"][number], string> = {
  invalid_output: "The AI response for this item did not pass evidence validation. No invalid citation or conclusion was accepted; analysis continued with other items.",
  insufficient_evidence: "The analysis did not establish a conclusive relationship in one or more checks involving this record. No pair is assigned by an inconclusive check; this does not prove the record is unique.",
};
export const processedCount = (report: Report) => report.processedUnitIds?.length ?? report.results.length;
export function inconclusiveItems(report: Report): ReviewIssue[] {
  const map = new Map<string, ReviewIssue>();
  for (const issue of report.issues ?? []) {
    const current = map.get(issue.record.id);
    map.set(issue.record.id, { record: issue.record, reasons: [...new Set([...(current?.reasons ?? []), ...issue.reasons])] });
  }
  // Present older in-memory reports using the same single-record contract.
  for (const result of report.results.filter((r) => r.status === "inconclusive")) for (const record of result.records) {
    const current = map.get(record.id);
    map.set(record.id, { record, reasons: [...new Set([...(current?.reasons ?? []), "insufficient_evidence" as const])] });
  }
  return [...map.values()];
}
export const kindLabel = (kind: string) => ({ summary: "Published summary", translation: "Published translation", "published-review": "Published review", "clinic-name": "Clinic name" }[kind] ?? kind);
export const unitLabel = (lens: Report["lens"]) => lens === "review-similarity" ? "pairs compared" : lens === "clinic-identity" ? "name occurrences examined" : "review records analyzed";
export const clinicKey = (record: AnalysisRecord) => record.clinicUrl ?? `unlinked:${record.clinic}`;
export function clinicOptions(results: Pick<Result, "records">[]) {
  const map = new Map<string, Set<string>>();
  for (const result of results) for (const record of result.records) {
    const key = clinicKey(record);
    const names = map.get(key) ?? new Set<string>(); names.add(record.clinic); map.set(key, names);
  }
  return [...map].map(([key, names]) => ({ key, label: [...names].sort().join(" / ") })).sort((a, b) => a.label.localeCompare(b.label));
}
export function reportState(report: Report) {
  if (report.status === "running") return "Analysis in progress";
  if (report.status === "complete") return !report.selected ? "No eligible records to analyze" : inconclusiveItems(report).length ? "Analysis finished · inconclusive items need review" : "Selected analysis complete";
  return report.stopReason === "cancelled" ? "Analysis cancelled · results preserved" : "Analysis interrupted · results preserved";
}
