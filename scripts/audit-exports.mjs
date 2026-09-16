// Independent audit of downloaded JSON files. Prints metadata/checks, not credentials.
// Usage: node scripts/audit-exports.mjs <analysis.json> <collected.json>
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const [analysisPath, collectionPath] = process.argv.slice(2);
assert.ok(analysisPath && collectionPath, "Provide both exported JSON paths.");
const report = JSON.parse(readFileSync(analysisPath, "utf8"));
const data = JSON.parse(readFileSync(collectionPath, "utf8"));
assert.equal(report.exportType, "analysis-report");
assert.equal(data.exportType, "collected-data");
assert.equal(report.runId, data.discovery.id);
assert.equal(report.sourceCoverage.startedAt, data.collection.startedAt);
const reviews = data.collection.pages.flatMap((p) => p.reviews);
const names = data.collection.pages.flatMap((p, pi) => p.clinics.map((c, ci) => ({ id: `name-${pi}-${ci}`, text: c.name, pageUrl: c.pageUrl, clinicUrl: c.url })));
const records = new Map([...reviews, ...names].map((r) => [r.id, r]));
assert.equal(records.size, reviews.length + names.length, "Repeated record IDs");
const summarize = [];
let citations = 0;
for (const [key, run] of Object.entries(report.reports)) {
  assert.equal(run.provider, "deepseek"); assert.equal(run.status, "complete");
  const processed = run.processedUnits ?? run.results.length;
  assert.equal(processed, run.selected);
  if (report.schemaVersion >= 5) {
    assert.equal(run.inconclusiveChecks, processed - run.results.length);
    assert.ok(run.inconclusiveChecks >= 0);
    if (run.processedUnitIds) {
      assert.equal(new Set(run.processedUnitIds).size, processed);
      run.results.forEach((finding) => assert.ok(run.processedUnitIds.includes(finding.unitId)));
    }
    assert.equal(new Set(run.issues.map((issue) => issue.record.id)).size, run.issues.length);
    for (const issue of run.issues) {
      assert.equal(Object.hasOwn(issue, "records"), false, "An inconclusive item must not assign a pair");
      assert.equal(Object.hasOwn(issue.record, "text"), false, "Full body in analysis export");
      const source = records.get(issue.record.id); assert.ok(source, "Unknown inconclusive source");
      assert.equal(issue.record.pageUrl, source.pageUrl); assert.equal(issue.record.clinicUrl, source.clinicUrl);
      assert.ok(issue.reasons.length && issue.reasons.every((reason) => ["invalid_output", "insufficient_evidence"].includes(reason)));
    }
  }
  assert.equal(new Set(run.results.map((r) => r.unitId)).size, run.results.length);
  assert.equal(run.collectionStartedAt, data.collection.startedAt);
  const counts = {};
  for (const f of run.results) {
    counts[f.status] = (counts[f.status] ?? 0) + 1;
    for (const r of f.records) {
      const source = records.get(r.id); assert.ok(source, `Unknown source ${r.id}`);
      assert.equal(r.pageUrl, source.pageUrl); assert.equal(r.clinicUrl, source.clinicUrl);
      assert.equal(Object.hasOwn(r, "text"), false, "Full body in analysis export");
    }
    const check = (id, quote) => {
      assert.ok(f.records.some((r) => r.id === id), "Citation outside the finding");
      assert.ok(records.get(id)?.text.includes(quote), `Citation not in original collected text: ${id}`); citations++;
    };
    f.quotes.forEach((q) => check(q.recordId, q.text));
    if (run.lens === "missing-information") {
      assert.deepEqual(f.fields.map((v) => v.name).sort(), ["price_and_currency", "procedure", "procedure_date", "surgeon"]);
      f.fields.forEach((v) => v.state === "not_stated" ? assert.equal(v.quote, null) : check(f.records[0].id, v.quote));
      assert.equal(f.status === "all_fields_stated", f.fields.every((v) => v.state === "stated"));
    }
    if (run.lens === "review-similarity") {
      if (report.schemaVersion >= 5) assert.notEqual(f.status, "inconclusive", "Inconclusive records belong in individual issues, not paired findings");
      assert.equal(f.records.length, 2); assert.equal(f.records[0].clinicUrl, f.records[1].clinicUrl);
      f.records.forEach((r) => assert.ok(f.quotes.some((q) => q.recordId === r.id), "Missing pair evidence"));
    }
    if (f.status === "linked_identity") assert.equal(f.candidateUrl, records.get(f.records[0].id).clinicUrl);
    if (f.status === "candidate_match") assert.ok(names.some((n) => n.clinicUrl === f.candidateUrl), "Unknown candidate clinic");
  }
  summarize.push({ lens: run.lens, eligible: run.eligible, selected: run.selected, processed, validatedFindings: run.results.length, inconclusiveItems: run.issues?.length ?? 0, counts, key });
}
assert.equal(summarize.length, 3, "Expected all three lenses");
console.log(JSON.stringify({ runId: report.runId, collectedAt: data.collection.finishedAt, pages: data.collection.pages.length, reviews: reviews.length, names: names.length, citationsChecked: citations, structuralAndProvenanceChecks: "passed", semanticTruthCertified: false, lenses: summarize }, null, 2));
