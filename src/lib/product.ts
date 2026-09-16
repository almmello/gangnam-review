export const site = {
  name: "Gangnam Review",
  url: "https://gangnam-review.vercel.app",
  sourceUrl: "https://gangnambeautyguide.com/en/",
  sourceHost: "gangnambeautyguide.com",
} as const;

export const scenarios = [
  {
    id: "missing-information", number: "01", icon: "document",
    title: "Missing information", short: "Find the gaps in each story.",
    description: "See what a published review tells you — and what it leaves unanswered.",
    checks: ["Procedure and treatment details", "Surgeon, price and dates", "Original source and provenance"],
    takeaway: "Missing information is a gap in the published record, not a judgment about a patient or clinic.",
  },
  {
    id: "clinic-identity", number: "02", icon: "identity",
    title: "Clinic identity", short: "Different names. Same clinic?",
    description: "Connect alternate names to a clinic’s canonical profile, without guessing identities.",
    checks: ["Canonical clinic links", "Names and observed aliases", "Unresolved or ambiguous matches"],
    takeaway: "An abbreviation is not an error. A shared profile link is stronger evidence than a similar name.",
  },
  {
    id: "review-similarity", number: "03", icon: "compare",
    title: "Review similarity", short: "Find related stories.",
    description: "Find meaningfully related reviews and records without an established match.",
    checks: ["Shared details and narrative", "Meaningful differences", "Source texts and citations"],
    takeaway: "Similarity is a reason to review, not proof of duplication. No records are merged or deleted.",
  },
] as const;
export type ScenarioId = (typeof scenarios)[number]["id"];
