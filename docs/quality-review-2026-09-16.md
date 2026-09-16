# Quality review — September 16, 2026

Local verification by Codex, requested by Alexandre Mello. No deployment,
assessment acceptance, start or submission was performed.

## Changes

- Direct DeepSeek is the only supported provider (`deepseek-flash`). Legacy NVIDIA
  requests are rejected; server credentials are never exposed to the client.
- Removed development-stage badges/copy from the interface and README.
- README now describes features, GitHub installation, configuration, operation,
  limits, verification and hosting requirements.
- LICENSE is an assessment ownership notice, not a permissive open-source license.
  It defers to the applicable accepted Flywheel agreement, including assignment,
  without purporting to sign that agreement or transfer third-party rights.
- Similarity rules distinguish distinctive personal narratives, explicitly separate
  experiences and insufficient/conflicting evidence. Routine recovery and marketing
  templates do not establish a repeated experience. Important contradictions cannot
  be dismissed as translation differences without evidence.
- Similarity instructions are isolated from the missing-information rubric; the
  response schema remains strict. Explanations must stay inside the reason string.
- Missing-information examples now require evidence that entails the specific field:
  consultant versus operating surgeon, an identified treatment versus generic surgery,
  qualitative affordability versus an amount, and relative timing versus calendar date.

## Why the previous distribution needed investigation

The September 15 run returned 57 possible repeated experiences, three distinct and
zero inconclusive across 60 selected pairs. These are the highest word-overlap pairs,
not a representative sample of all 1,334 eligible pairs. Many contain long, matching
personal narratives, so a majority of possible repetitions is not inherently wrong.

The initial revision returned 55 possible, one distinct and four inconclusive.
Inspection of all 60 explanations and supporting quotations identified remaining
overconfidence around routine recovery, short templates and unresolved differences.
In particular, a donor-versus-own cartilage contradiction must not be waved away.
The rule was strengthened generally; no source-specific label override was added.
A subsequent run returned 43 possible and 17 inconclusive, but still overlooked a
donated-versus-autologous material contradiction. The rubric now explicitly defines
that terminology and requires comparison of the actual bodies before emission.
The meaning of autologous was checked against the [NCI dictionary](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/autologous).
Generic service/recovery details were also excluded as sufficient identifiers.

An intermediate missing-information run rejected extra output keys twice. No invalid
findings were accepted. Prompt interaction was a possible cause, not a proven one;
the raw model response was not retained. Rubrics were separated and exact output keys
reinforced before the final three-lens verification.

## Reproducible checks

- `npm test`: 63 tests in ten files passed.
- `npm run lint` and `npm run build`: passed; build includes TypeScript validation.
- `node scripts/verify-similarity.mjs`: all ten synthetic semantic cases passed
  against the live local DeepSeek adapter, with grounded quotes on both sides.
  Expected labels were specified independently: six inconclusive, two distinct,
  two possible repetitions. This is a regression suite, not an accuracy estimate.
- `node scripts/verify-fields.mjs`: all four synthetic records and 16 expected field
  states passed against the final local adapter, including the ambiguous consultant case.
- Public build inspection: 21 static files, zero matches for either configured key.
- No phase/NVIDIA text in `src/`, README or `.env.example`.
- Collected-data modal Escape closes the dialog and restores focus to its trigger
  in the real browser. Full mobile acceptance remains separate work.

## Final three-lens execution

Run `b79e7eab-37e5-40aa-a91e-c3ee1208d26b`; collection finished September 16,
2026 at 12:44:56 UTC (09:44:56 BRT). 142 pages attempted, zero collection failures;
24 contained collected review data and 118 had no supported review section.
212 review occurrences, 321 name occurrences; review IDs match the preceding run.
All three lenses reused this collection, with no refresh between lenses.

| Lens | Selected / completed | Result |
| --- | --- | --- |
| Missing information | 212 / 212 | 212 records with at least one missing/unclear field |
| Clinic identity | 321 / 321 | 278 published links, one candidate, 42 unresolved |
| Review similarity | 60 / 60 of 1,334 eligible | 39 possible, zero distinct, 21 inconclusive |

Final missing-information processing took 3m26s without interruption; identity 21s.
Similarity completed without a rejected batch in this final run. The server was
rebuilt between similarity and the other lenses only to update the field rubric;
the unchanged similarity rubric and the in-memory collection were preserved.

`scripts/audit-exports.mjs` passed on the two downloaded JSONs: all 593 findings,
IDs, coverage, source associations, field counts and 1,089 exact quotations checked
against the collected bodies. Analysis export has no full source bodies or credentials.
Files remain in Downloads as `gangnam-analysis-<runId> (1).json` and
`gangnam-collected-<runId>.json`; raw patient narratives were not committed.
No browser error logs were returned in the final check.

Structural validation and exact quotation checks establish provenance, not clinical
truth, patient identity or semantic correctness. All 60 final comparison reasons were
read; field-level review combined the complete intermediate field table with final
regression checks and inspection of all positive surgeon/price findings and previously
problematic examples. This is not a blinded, independently labelled clinical dataset.

## Review findings that must not be hidden

The final similarity run returns 39 possible repetitions, zero distinct and 21
inconclusive. The donor/autologous conflict (`pair-1049`), generic service template
(`pair-824`), routine three-week recovery (`pair-289`) and broad procedure ambiguity
(`pair-1050`) now remain inconclusive. Specific implant measurements and a distinctive
story (`pair-1256`) still support a possible repeated experience.

This is NOT semantic certification. Review of all 60 final reasons still flags
`pair-78`: its own explanation acknowledges different early-recovery symptoms, while
the status remains possible_same_experience. An inconclusive label would better fit
the conservative rubric. Several short summaries (`pair-704`, `pair-763`, `pair-785`,
`pair-609`, `pair-563`) are also borderline because their purported distinctiveness
depends on service/recovery details. They are reviewer flags, not independently proven
duplicates or distinct patients. No labels were edited manually to improve the totals.

The complete intermediate field audit also found consultant quotations marked as
operating-surgeon evidence, generic procedure quotations and inconsistent relative
timing. This triggered the added field examples and four live regression cases.
Schema/citation checks alone did not detect these semantic issues; a human review or
a separately evaluated adjudication model is still needed for consequential decisions.

Final field examples improved: consultation-only passages at Eight now remain unclear,
explicit 'done by' surgeon passages at Pleasure are stated, generic Wonjin procedure
descriptions are unclear, and no qualitative price claim becomes an amount. However,
relative timing is still inconsistent: record `3fef5231a16e09cd681aee81` contains a
three-week recovery reference but remains not_stated for procedure_date. Some surgeon
quotations also need a wider passage to identify the named person independently.
These residual findings are recorded, not hidden or silently corrected in exports.

Identity review also has a recall limit: the bounded lexical shortlist may omit an
abbreviated alias (for example an unlinked name containing a short brand abbreviation).
Unresolved means no supported link in that shortlist, not that the clinic does not
exist or has been proved different. A suggestion remains an unverified candidate.

## Ownership source and limits

Read-only inspection: [Flywheel assessment terms](https://wetheflywheel.com/onboarding/piia/assessment),
version 2.0, effective June 29, 2026. The LICENSE notice is aligned editorially with
those terms; it is not a legal opinion or a substitute for the accepted agreement.
Dependencies, fonts and source-site content retain their respective rights.

The app remains local. Shared-key public access is disabled on Vercel pending abuse
controls. Raw exported reviews stay outside the repository and this report.
