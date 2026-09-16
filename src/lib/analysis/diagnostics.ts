import { z } from "zod";
// Only allowlisted categories leave validation. Never return model text or raw Zod issues.
export function validationCategory(error: unknown): string {
  if (error instanceof SyntaxError) return "invalid JSON";
  if (error instanceof z.ZodError) {
    const allowed = new Set(["findings", "unitId", "status", "reason", "quotes", "recordId", "text", "fields", "name", "state", "quote", "candidateUrl"]);
    const codes = new Set(["invalid_type", "invalid_value", "too_big", "too_small", "unrecognized_keys", "custom"]);
    const details = [...new Set(error.issues.slice(0, 4).map((issue) => {
      const path = issue.path.map((part) => typeof part === "number" ? "item" : allowed.has(String(part)) ? String(part) : "field").join(".");
      return `${path || "response"}: ${codes.has(issue.code) ? issue.code : "invalid"}`;
    }))];
    return `response structure or field types (${details.join("; ")})`;
  }
  const message = error instanceof Error ? error.message : "";
  if (["Incomplete or repeated units", "Unknown unit"].includes(message)) return "incomplete, repeated or unknown record IDs";
  if (["Quote not grounded", "Field evidence not grounded"].includes(message)) return "quotation does not exactly match its source record";
  if (["Invalid fields", "Inconsistent field status", "Unexpected fields"].includes(message)) return "field classification or count";
  if (message === "Missing pair evidence") return "comparison classification or missing evidence from both records";
  if (["Invalid identity evidence", "Unknown candidate", "Candidate required"].includes(message)) return "clinic identity evidence or candidate URL";
  return "response validation";
}
export const interpretationRules = `Additional interpretation rules:
- Procedure: an explicit plain-language description is enough; a technical medical term is NOT required. Distinguish a recommended/planned procedure from one the writer actually underwent. Previous surgery is not automatically the procedure being reviewed.
- Treating surgeon: stated ONLY when the review explicitly links the named clinician to performing this patient's procedure. A name alone, a consultation, a recommendation, or being 'known for' a procedure is insufficient. A named doctor without that link is unclear with its exact supporting quote; no named doctor is not_stated.
- Procedure date: a calendar date explicitly tied to the reviewed procedure is stated. An elapsed interval such as 'two months after surgery' is unclear. Mere sequence ('after two prior surgeries'), 'over time', or 'wish I had done it sooner' is not a date or usable interval: not_stated, quote null. Never calculate a date from publication metadata.
- Inspect only the supplied record body. A missing detail in a summary or translation is not proof that the original review lacks it. Do not infer poor clinical quality or fraud.
- Keep reason consistent with the four field states. Quotes must be copied exactly as contiguous substrings from ONE supplied record; never paraphrase, translate, concatenate excerpts or replace characters with ellipses. Keep explanations concise.
- Evidence entailment: the selected field quote must itself support the assigned state, not merely occur in the body. For procedure=stated it must identify WHAT treatment was actually received, using nearby context when necessary. 'I had surgery', 'the procedure was thorough', 'I wanted surgery', 'I booked a consultation', 'the result was satisfying', and an unnamed treatment do NOT state what was performed. If the body contains a better explicit passage, quote that passage; otherwise use unclear or not_stated, not stated. A named treatment only considered/recommended but not reported as received is unclear.
- Surgeon examples: 'I consulted Dr. Lee' => unclear; 'Dr. Lee recommended treatment' => unclear; 'Dr. Lee performed my surgery' or 'I had it done by Dr. Lee' => stated. A named consultant is not a confirmed operating surgeon. 'The doctor/director was kind' without a person's name => not_stated, quote null. Do not invert these rules.
- Procedure timing examples: 'two months after surgery', 'by 6 weeks after the procedure', '15-month review after breast surgery', and 'by three weeks the swelling had gone' are relative timing => unclear with that quote, NOT not_stated and NOT stated. Only a calendar date explicitly tied to the reviewed procedure qualifies as stated. 'Sooner', 'over time', and a sequence of previous surgeries without an elapsed interval => not_stated.
- Price examples: 'reasonable', 'affordable', 'expensive', 'the same price as quoted', or 'cost more than expected' supply NO amount => not_stated, quote null. '500' without currency => unclear. '500 USD' explicitly charged for the reviewed treatment => stated. Do not label qualitative affordability as a partially stated price.
- Before emitting JSON, check EACH of the four fields independently against these examples and its own quote. A correct overall gaps_found label does not compensate for incorrect field states. Return no extra fields or confidence keys.`;

export const similarityRules = `Review-similarity: semantic relevance (apply independently to EVERY pair).
- Decide only whether the two texts have meaningful shared content: concern, treatment, recovery, outcome or service experience. If yes, return similar. This is the final classification.
- Identical texts, close paraphrases and loosely related accounts ALL receive similar. Do not distinguish copies from related accounts or estimate percentages.
- If there is no meaningful shared content, or text is too sparse, return inconclusive. A shared clinic name, page, isolated generic words or positive sentiment alone is insufficient. A breast implant result versus a parking/payment complaint => inconclusive; 'Good' versus 'Thanks' => inconclusive.
- Related treatments with differences (first rhinoplasty versus revision, swelling versus makeup recovery, donated versus own tissue) remain related: similar. Mention differences without claiming identical facts or separate patients.
- Compare complete supplied bodies. Missing author IDs or dates do not prevent a meaningful match. Patient identity and medical quality are outside scope. Do not target a label distribution or infer a match from preselection.
- reason must be a short string: 'Shared: [concrete shared content or none]. Differences: [concrete differences or none].' Include exact contiguous quotes from BOTH records. No extra JSON keys, invented quotations, medical recommendations or authenticity claims.
- Inconclusive outcomes are shown as individual records without an assigned partner. This describes the checks performed, not proof that no related record exists elsewhere.`;
