// Optional live regression. One provider request; synthetic data, no key reads.
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3000";
const pageUrl = "https://gangnambeautyguide.com/en/clinics/rubric-fixture/";
const fields = ["procedure", "surgeon", "price_and_currency", "procedure_date"];
const cases = [
  { id: "consultant-not-surgeon", text: "I consulted Dr. Lee. Later I had rhinoplasty here. Two months after surgery the swelling was gone. The price was reasonable.", states: ["stated", "unclear", "not_stated", "unclear"] },
  { id: "explicit-complete", text: "I had eyelid surgery done by Dr. Lee on March 12, 2025. I paid 500 USD for this eyelid surgery.", states: ["stated", "stated", "stated", "stated"] },
  { id: "generic-procedure", text: "I had a procedure here. The doctor was kind and the result was satisfying. It was affordable and improved over time.", states: ["unclear", "not_stated", "not_stated", "not_stated"] },
  { id: "amount-no-currency", text: "I had rhinoplasty. I had it done by Dr. Kim. It cost 500, but I do not know the currency. This is my 15-month review after surgery.", states: ["stated", "stated", "unclear", "unclear"] },
];
const task = { lens: "missing-information", records: cases.map((c) => ({ id: c.id, text: c.text, pageUrl, clinicUrl: pageUrl, clinic: "Synthetic fixture", kind: "published-review" })), units: cases.map((c) => ({ id: c.id, recordIds: [c.id], candidates: [] })) };
const response = await fetch(`${base}/api/ai/analyze`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ provider: "deepseek", task }), signal: AbortSignal.timeout(100000) });
const data = await response.json();
if (!response.ok) throw new Error(`Local analysis returned HTTP ${response.status}: ${data.error ?? "analysis failed"}`);
assert.equal(data.findings.length, cases.length);
const results = cases.map((c) => {
  const finding = data.findings.find((f) => f.unitId === c.id);
  assert.ok(finding);
  const actual = fields.map((name) => finding.fields.find((f) => f.name === name)?.state);
  finding.fields.forEach((f) => f.state === "not_stated" ? assert.equal(f.quote, null) : assert.ok(c.text.includes(f.quote)));
  return { id: c.id, expected: c.states, actual, pass: actual.every((v, i) => v === c.states[i]) };
});
console.log(JSON.stringify({ synthetic: true, fields, results }, null, 2));
assert.ok(results.every((r) => r.pass), "Field interpretation regression; inspect mismatches, do not override labels.");
