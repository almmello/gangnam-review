// Opt-in live semantic regression: synthetic records, never shown in the workbench.
// Uses the already-running local server and its configured DeepSeek connection.
// Three semantic model requests plus bounded output repairs; no keys read here.
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3000";
const source = "https://gangnambeautyguide.com/en/clinics/rubric-fixture/";
const cases = [
  { id: "generic", expected: "similar", a: "I had eyelid surgery. Friendly staff and I am happy with the natural result.", b: "Friendly staff. My eyelid surgery gave a natural result and I am happy." },
  { id: "emphasis", expected: "similar", a: "My eyes looked sleepy. After eyelid surgery they feel lighter and makeup is easier.", b: "My eyes looked sleepy. Eyelid surgery made my face brighter and makeup is easier." },
  { id: "revision", expected: "similar", a: "This was my first ever nose surgery. I had never had any operation on my nose before.", b: "This was my third revision rhinoplasty, after two previous failed nose operations." },
  { id: "specifications", expected: "similar", a: "For this breast surgery I chose 250cc saline implants on both sides, through an inframammary incision.", b: "For this breast surgery I chose 400cc silicone implants on both sides, through an armpit incision." },
  { id: "distinctive-story", expected: "similar", a: "I went from AAA to C with Mentor Boost implants: 325cc left and 340cc right through the armpit. My sister drove me home in her green bakery van, and I spilled strawberry tea on the seat.", b: "My sister took me home in her green bakery van and I spilled strawberry tea on its seat. The armpit surgery used Mentor Boost, 325cc on the left and 340cc on the right; I went from AAA to C." },
  { id: "long-paraphrase", expected: "similar", a: "After two failed nose surgeries I booked the third just before my 40th birthday. A thread lift had left a dent on my left cheek. I brought a blue notebook with 17 questions; the surgeon drew the answer to the last question on its back cover.", b: "Before turning 40, I booked my third nose operation after two failures. The left-cheek dent came from my thread lift. My blue notebook contained 17 questions, and the surgeon sketched the final answer on the back cover." },
  { id: "routine-milestones", expected: "similar", a: "Eyelid surgery for drooping eyes. Little pain, swelling gone by six weeks, kind consultation, reasonable price and a natural result. I recommend it.", b: "Drooping eyes led to eyelid surgery. By 6 weeks, swelling was gone. Little pain, friendly consultation, fair price and natural results; recommended." },
  { id: "service-template", expected: "similar", a: "Concern: skin improvement. Consultation: friendly. The location was hard to find, but waiting time was short and staff were kind.", b: "Concern: improving skin. Consultation: kind. It took time to find the location, but the wait was short and staff were friendly." },
  { id: "unresolved-material-conflict", expected: "similar", a: "On the morning before my 40th birthday I brought a blue notebook with 17 questions to my nose revision. The surgeon used donated rib cartilage. My sister took me home in her bakery van.", b: "Before my 40th birthday, my nose revision consultation used my blue notebook of 17 questions. The surgeon used an autologous rib cartilage graft. My sister drove me home in her bakery van." },
  { id: "unspecified-extra-detail", expected: "similar", a: "I had surgery around my eyes. Recovery was smooth and I liked the result.", b: "I had eyelid surgery with corner correction. Recovery was smooth and the result was nice." },
  { id: "unrelated", expected: "inconclusive", a: "My breast implants settled after six weeks and I like their shape.", b: "The parking garage payment machine rejected my card. I paid cash to the attendant." },
  { id: "too-sparse", expected: "inconclusive", a: "Good.", b: "Thanks." },
];
// Literal copies and paraphrases all count as similar in this MVP.
cases.push({ id: "literal-copy", expected: "similar", a: "The reviewer described a comfortable recovery after eyelid surgery and liked the natural result.", b: "The reviewer described a comfortable recovery after eyelid surgery and liked the natural result." });
cases.push({ id: "near-copy", expected: "similar", a: "The reviewer described a comfortable recovery after eyelid surgery and liked the natural result.", b: "The reviewer described a comfortable recovery after eyelid surgery and really liked the natural result." });
const results = [];
cases.push({ id: "user-braun-rewrite", expected: "similar", a: "The reviewer had eyelid surgery to address sagging lids and small eyes that had become a personal concern with age. They reported little pain during the procedure, a quick recovery, and being back to daily life within six weeks, with kind counseling and a reasonable price. They were very satisfied and recommended getting a consultation if someone had similar concerns.", b: "The reviewer had eyelid surgery to address drooping eyelids and small eyes, and by 6 weeks they reported little pain during the procedure and a fast recovery that allowed a quick return to daily life. They described the consultation as kind and the price as reasonable, felt satisfied with the result, and recommended starting with a consultation if considering the procedure." });
for (let offset = 0; offset < cases.length; offset += 6) {
const batch = cases.slice(offset, offset + 6);
const task = { lens: "review-similarity", records: batch.flatMap((c) => ["a", "b"].map((side) => ({ id: `${c.id}-${side}`, text: c[side], pageUrl: source, clinicUrl: source, clinic: "Synthetic rubric fixture", kind: "published-review" }))), units: batch.map((c) => ({ id: c.id, recordIds: [`${c.id}-a`, `${c.id}-b`], candidates: [] })) };
const response = await fetch(`${base}/api/ai/analyze`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ provider: "deepseek", task }), signal: AbortSignal.timeout(100000) });
const data = await response.json();
if (!response.ok) throw new Error(`Local analysis returned HTTP ${response.status}: ${data.error ?? "analysis failed"}`);
assert.equal(data.findings.length, batch.length);
assert.equal(data.textMatches, undefined);
assert.equal(data.guidance, undefined);
const batchResults = batch.map((c) => {
  const finding = data.findings.find((f) => f.unitId === c.id);
  assert.ok(finding, `Missing fixture ${c.id}`);
  for (const side of ["a", "b"]) assert.ok(finding.quotes.some((q) => q.recordId === `${c.id}-${side}` && c[side].includes(q.text)), `Missing grounded quote for ${c.id}-${side}`);
  return { id: c.id, expected: c.expected, actual: finding.status, pass: finding.status === c.expected, reason: finding.reason };
});
results.push(...batchResults);
}
console.log(JSON.stringify({ fixtures: "synthetic controls plus one user-reviewed real pair", results }, null, 2));
assert.ok(results.every((r) => r.pass), "Semantic rubric regression: review the mismatched cases, do not force labels.");
