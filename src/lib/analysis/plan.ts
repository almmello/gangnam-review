import type { CollectedPage } from "../crawl/contracts";
import { type AnalysisRecord, type Result, type Task, taskSchema } from "./contracts";
// Data minimization, not full anonymization. Patient names may remain in prose.
export function redact(text: string) { return text.replace(/\b[\w.+-]{1,64}@[\w.-]{1,253}\.[a-z]{2,24}\b/gi, "[email removed]").replace(/(?:\+?\d[\d ().-]{7,48}\d)/g, (match) => match.replace(/\D/g, "").length >= 10 ? "[contact number removed]" : match).replace(/\bmy name is\s+[A-Z][a-z]{1,60}(?:\s+[A-Z][a-z]{1,60})?/g, "[self-identification removed]"); }
function tokens(value: string) { return new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []); }
function overlapSets(x: Set<string>, y: Set<string>) { let shared = 0; for (const word of x) if (y.has(word)) shared++; return shared / Math.max(1, x.size + y.size - shared); }
// Clinic brands may be short (DA, ID, G). Generic suffixes must not displace
// a brand match from the bounded candidate list. This ranks suggestions only.
const genericClinicWords = new Set(["clinic", "clinics", "plastic", "surgery", "hospital", "center", "centre", "ps", "the", "and", "same"]);
function clinicTokens(value: string) { return new Set((value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !genericClinicWords.has(word))); }
function clinicOverlap(a: string, b: string) { return overlapSets(clinicTokens(a), clinicTokens(b)); }
export function buildPlan(pages: CollectedPage[], lens: Task["lens"]) {
  const warnings: string[] = [];
  const records: AnalysisRecord[] = pages.flatMap((p) => p.reviews.map((r) => ({ id: r.id, text: redact(r.text), pageUrl: r.pageUrl, clinic: r.clinicName ?? "Clinic not stated", clinicUrl: r.clinicUrl, kind: r.contentKind })));
  const deterministic: Result[] = [];
  let units: { records: AnalysisRecord[]; unit: Task["units"][number]; group: string; score: number }[] = [];
  let eligible = 0;
  if (pages.some((p) => p.truncated || p.reviews.some((r) => r.textTruncated))) warnings.push("Some source text was truncated during collection. Findings only cover the collected text.");
  if (lens === "clinic-identity") {
    const catalog = new Map<string, string>();
    pages.forEach((p) => p.clinics.forEach((c) => { if (c.url) catalog.set(c.url, c.name); }));
    const names = pages.flatMap((p, pi) => p.clinics.map((c, ci) => ({ id: `name-${pi}-${ci}`, text: redact(c.name), pageUrl: c.pageUrl, clinic: c.name, clinicUrl: c.url, kind: "clinic-name" })));
    eligible = names.length;
    for (const record of names) {
      if (record.clinicUrl) deterministic.push({ unitId: record.id, status: "linked_identity", reason: "This name links to the published clinic profile. Link-based identity, not independent clinic verification.", quotes: [{ recordId: record.id, text: record.text }], fields: [], candidateUrl: record.clinicUrl, records: [record], method: "published_link", surface: null });
      else {
        const candidates = [...catalog].map(([url, name]) => ({ url, name, score: clinicOverlap(record.text, name) })).filter((c) => c.score > 0).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, 6).map(({ url, name }) => ({ url, name }));
        units.push({ records: [record], unit: { id: record.id, recordIds: [record.id], candidates }, group: "unlinked-names", score: 0 });
      }
    }
    warnings.push("Published links resolve aliases without AI. Unlinked names receive suggestions only; name similarity never establishes identity.");
  } else if (lens === "missing-information") {
    eligible = records.length;
    units = records.map((r) => ({ records: [r], unit: { id: r.id, recordIds: [r.id], candidates: [] }, group: r.clinicUrl ?? r.pageUrl, score: 0 }));
    warnings.push("Fields refer only to each review body, not clinic-profile facts. Dates of publication do not establish procedure dates. Provenance metadata remains in the collected records.");
  } else {
    const groups = new Map<string, AnalysisRecord[]>();
    const words = new Map(records.map((r) => [r.id, tokens(r.text)]));
    for (const r of records) if (r.clinicUrl) groups.set(r.clinicUrl, [...(groups.get(r.clinicUrl) ?? []), r]);
    for (const [group, rows] of groups) for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      eligible++;
      units.push({ group, score: overlapSets(words.get(rows[i].id)!, words.get(rows[j].id)!), records: [rows[i], rows[j]], unit: { id: `pair-${eligible}`, recordIds: [rows[i].id, rows[j].id], candidates: [] } });
    }
    // Bounded candidate screening: one highest-scoring pair per clinic first,
    // then the remaining strongest pairs. Coverage is reported, never exhaustive.
    units.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const first = units.filter((u) => { if (seen.has(u.group)) return false; seen.add(u.group); return true; });
    const ids = new Set(first.map((u) => u.unit.id));
    units = [...first, ...units.filter((u) => !ids.has(u.unit.id))].slice(0, 60);
    warnings.push(`Candidate screening: at most 60 pairs, ranked by word overlap within linked clinics. ${records.filter((r) => !r.clinicUrl).length} records without a canonical clinic link cannot enter pair comparison. Unselected pairs are not cleared as distinct.`);
  }
  const tasks: Task[] = [];
  let task: Task = { lens, records: [], units: [] }, group = "";
  const flush = () => { if (task.units.length) tasks.push(taskSchema.parse(task)); task = { lens, records: [], units: [] }; };
  let omitted = 0;
  for (const item of units.sort((a, b) => a.group.localeCompare(b.group))) {
    if (item.records.reduce((n, r) => n + r.text.length, 0) > 40000) { omitted++; continue; }
    let added = item.records.filter((r) => !task.records.some((existing) => existing.id === r.id));
    if (group !== item.group || task.units.length >= 6 || task.records.length + added.length > 20 || [...task.records, ...added].reduce((n, r) => n + r.text.length, 0) > 40000) { flush(); added = item.records; }
    group = item.group; task.records.push(...added); task.units.push(item.unit);
  }
  flush();
  if (omitted) warnings.push(`${omitted} units exceeded the per-request text limit and were not analyzed.`);
  return { tasks, deterministic, eligible, selected: deterministic.length + tasks.reduce((n, t) => n + t.units.length, 0), warnings };
}
