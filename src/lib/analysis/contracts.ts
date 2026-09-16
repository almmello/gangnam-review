import { z } from "zod";
import { normalizeSourceUrl } from "../crawl/policy";
import type { ProviderId } from "./providers";
export const lensSchema = z.enum(["missing-information", "clinic-identity", "review-similarity"]);
const source = z.string().max(2048).refine((v) => normalizeSourceUrl(v) === v);
export const recordSchema = z.object({ id: z.string().min(1).max(180), text: z.string().min(1).max(20000), pageUrl: source, clinic: z.string().max(500), clinicUrl: source.nullable(), kind: z.string().max(40) }).strict();
export const unitSchema = z.object({ id: z.string().max(200), recordIds: z.array(z.string()).min(1).max(2), candidates: z.array(z.object({ name: z.string().max(500), url: source })).max(6) }).strict();
export const taskSchema = z.object({ lens: lensSchema, records: z.array(recordSchema).min(1).max(20), units: z.array(unitSchema).min(1).max(8) }).strict().superRefine((task, ctx) => {
  const ids = new Set(task.records.map((r) => r.id));
  if (ids.size !== task.records.length || new Set(task.units.map((u) => u.id)).size !== task.units.length || task.records.reduce((n, r) => n + r.text.length, 0) > 40000) ctx.addIssue({ code: "custom", message: "Duplicate IDs or text limit exceeded" });
  for (const unit of task.units) {
    if (unit.recordIds.some((id) => !ids.has(id)) || new Set(unit.recordIds).size !== unit.recordIds.length || unit.recordIds.length !== (task.lens === "review-similarity" ? 2 : 1)) ctx.addIssue({ code: "custom", message: "Invalid unit records" });
    if (task.lens === "review-similarity") {
      const pair = unit.recordIds.map((id) => task.records.find((r) => r.id === id));
      if (!pair[0]?.clinicUrl || pair[0].clinicUrl !== pair[1]?.clinicUrl) ctx.addIssue({ code: "custom", message: "Pairs must share a canonical clinic" });
    }
  }
});
export const fieldNames = ["procedure", "surgeon", "price_and_currency", "procedure_date"] as const;
const fieldSchema = z.object({ name: z.enum(fieldNames), state: z.enum(["stated", "not_stated", "unclear"]), quote: z.string().min(1).max(1600).nullable() }).strict();
export const findingSchema = z.object({ unitId: z.string(), status: z.enum(["gaps_found", "all_fields_stated", "candidate_match", "unresolved", "similar", "inconclusive", "linked_identity"]), reason: z.string().min(1).max(1600), quotes: z.array(z.object({ recordId: z.string(), text: z.string().min(1).max(1600) }).strict()).max(4), fields: z.array(fieldSchema).max(4), candidateUrl: source.nullable() }).strict();
export const outputSchema = z.object({ findings: z.array(findingSchema).min(1).max(8) }).strict();
export type AnalysisRecord = z.infer<typeof recordSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Result = Finding & { records: AnalysisRecord[]; method: "published_link" | "ai"; surface: string | null };
export type ReviewIssue = { record: AnalysisRecord; reasons: ("invalid_output" | "insufficient_evidence")[] };
export type Report = { provider: ProviderId; lens: Task["lens"]; collectionStartedAt: string; collectionFinishedAt: string | null; startedAt: string; finishedAt: string | null; status: "running" | "complete" | "partial"; stopReason?: "cancelled" | "error"; results: Result[]; processedUnitIds?: string[]; issues?: ReviewIssue[]; tasks: number; completedTasks: number; eligible: number; selected: number; warnings: string[]; error: string | null; model: string;
};
export type ReportKey = `${ProviderId}:${Task["lens"]}`;

export function validateOutput(task: Task, raw: unknown) {
  const output = outputSchema.parse(raw);
  if (output.findings.length !== task.units.length || new Set(output.findings.map((f) => f.unitId)).size !== task.units.length) throw new Error("Incomplete or repeated units");
  for (const finding of output.findings) {
    const unit = task.units.find((u) => u.id === finding.unitId);
    if (!unit) throw new Error("Unknown unit");
    const records = unit.recordIds.map((id) => task.records.find((r) => r.id === id)!);
    for (const quote of finding.quotes) if (!records.some((r) => r.id === quote.recordId && r.text.includes(quote.text))) throw new Error("Quote not grounded");
    if (task.lens === "missing-information") {
      if (!["gaps_found", "all_fields_stated"].includes(finding.status) || finding.fields.length !== 4 || new Set(finding.fields.map((f) => f.name)).size !== 4) throw new Error("Invalid fields");
      for (const field of finding.fields) {
        if (field.state === "not_stated" ? field.quote !== null : !field.quote || !records[0].text.includes(field.quote)) throw new Error("Field evidence not grounded");
      }
      if ((finding.status === "all_fields_stated") !== finding.fields.every((f) => f.state === "stated")) throw new Error("Inconsistent field status");
    } else {
      if (finding.fields.length) throw new Error("Unexpected fields");
      if (task.lens === "review-similarity") {
        if (!["similar", "inconclusive"].includes(finding.status) || records.some((r) => !finding.quotes.some((q) => q.recordId === r.id))) throw new Error("Missing pair evidence");
      } else if (!["candidate_match", "unresolved"].includes(finding.status) || !finding.quotes.some((q) => q.recordId === records[0].id)) throw new Error("Invalid identity evidence");
    }
    if (finding.candidateUrl !== null && (task.lens !== "clinic-identity" || finding.status !== "candidate_match" || !unit.candidates.some((c) => c.url === finding.candidateUrl))) throw new Error("Unknown candidate");
    if (finding.status === "candidate_match" && !finding.candidateUrl) throw new Error("Candidate required");
  }
  return output.findings;
}
