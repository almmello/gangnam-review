import { describe, expect, it } from "vitest";
import { z } from "zod";
import { interpretationRules, similarityRules, validationCategory } from "../src/lib/analysis/diagnostics";
describe("sanitized validation diagnosis", () => {
  it("distinguishes format, evidence, coverage and unknown failures without disclosing raw values", () => {
    expect(validationCategory(new SyntaxError("private raw text"))).toBe("invalid JSON");
    const parsed = z.string().safeParse(42);
    if (!parsed.success) expect(validationCategory(parsed.error)).toBe("response structure or field types (response: invalid_type)");
    expect(validationCategory(new Error("Quote not grounded"))).toContain("quotation");
    expect(validationCategory(new Error("Incomplete or repeated units"))).toContain("record IDs");
    expect(validationCategory(new Error("Unknown candidate"))).toContain("candidate URL");
    expect(validationCategory(new Error("private raw text or API key"))).toBe("response validation");
  });
  it("identifies overlong quotation arrays without exposing model-controlled keys or values", () => {
    const parsed = z.object({ findings: z.array(z.object({ quotes: z.array(z.string()).max(4) }).strict()) }).safeParse({ findings: [{ quotes: ["a", "b", "c", "d", "e"], "PRIVATE-KEY": "PRIVATE-VALUE" }] });
    if (parsed.success) throw new Error("Expected schema rejection");
    const category = validationCategory(parsed.error);
    expect(category).toContain("findings.item.quotes: too_big");
    expect(category).not.toContain("PRIVATE");
  });
  it("explicitly distinguishes a treating surgeon, timing and plain-language procedures", () => {
    expect(interpretationRules).toContain("performing this patient's procedure");
    expect(interpretationRules).toContain("after two prior surgeries");
    expect(interpretationRules).toContain("technical medical term is NOT required");
    expect(interpretationRules).toContain("missing detail in a summary");
    expect(interpretationRules).toContain("Evidence entailment");
    expect(interpretationRules).toContain("supply NO amount");
    expect(interpretationRules).toContain("I had it done by Dr. Lee");
  });
  it("classifies text resemblance without requiring patient identity evidence", () => {
    expect(interpretationRules).not.toContain("Review-similarity decision rubric");
    expect(similarityRules).toContain("Patient identity and medical quality are outside scope");
    expect(similarityRules).toContain("remain related: similar");
    expect(similarityRules).toContain("without an assigned partner");
    expect(similarityRules).toContain("No extra JSON keys");
    expect(similarityRules).toContain("Do not distinguish copies from related accounts");
    expect(similarityRules).not.toContain("SAME UNDERLYING EXPERIENCE");
  });
});
