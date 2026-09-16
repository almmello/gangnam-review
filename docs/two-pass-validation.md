# Two-call similarity evaluation — 2026-09-16

Historical experiment, superseded by the single-pass semantic MVP. The current
application only classifies Similar pairs and individual Inconclusive records;
it has no textual second pass or manual corrections. See `single-pass-validation.md`.

Local experiment, not a claim of production accuracy. Provider/model were unchanged:
DeepSeek `deepseek-flash`. Saved correction guidance was disabled for both calls.

## Implementation verified

- Semantic screening returns related or inconclusive; only related pairs reach a
  separate textual-comparison prompt with their complete original record bodies.
- The textual call does not receive the semantic reasoning or saved corrections.
- No percentage threshold or automatic mechanical fallback is active.
- Output schema, allowed status per pass and exact source quotations are validated.
  Bounded output repair and client-side item isolation remain in place.
- Shared corrections reset was confirmed: zero before and after, generation changed.
  Manual editing/storage still exist separately and are not used by the model.
- 103 unit/integration tests passed. Lint, TypeScript and production build passed.

## Live fixture test

`node scripts/verify-similarity.mjs` made three local batch requests and returned
validated findings for all 15 controls. **14 matched the expected category; one did
not. The script correctly exited with failure.** Expected labels were not changed
to accommodate the model.

- Literal and near-literal controls: possibly repeated.
- Unrelated and sparse controls: inconclusive.
- The user-reviewed Braun rewrite: similar, but distinct in this fixture batch.
- `distinctive-story`: expected similar, but distinct; received possibly repeated.
  The model treated reused phrases and reordered narrative clauses as near-copying.

## Real website counterexample

In the subsequent fresh website run, comparison 6 (Braun PS) was classified as
**possibly repeated**, despite the same complete text bodies being classified as
**similar, but distinct** in the fixture test. Both complete bodies were checked in
the interface, not inferred from a short quote.

Source: https://gangnambeautyguide.com/en/reviews/

- Record A: `b3a6683aafdbee7fd9a6b851`
- Record B: `08ac6cd8bba25db8c7651515`

The live rationale called the rewritten clauses localized edits; the fixture
rationale called them rebuilt wording. This is a classification inconsistency.
Different batch context is a possible contributor, not an isolated proven cause.

## Acceptance

The fresh website run completed all 60 selected checks (1,334 eligible pairs) in
3m06s, without interruption: **48 possibly repeated pairs, 12 similar-but-distinct
pairs, zero inconclusive records**. The selection deliberately favors high word
overlap; zero inconclusives and these proportions do not establish accuracy. Only
Review similarity was run live in this experiment; the other lenses were covered
by the automated regression suite, not by a new full live run.

The two-call pipeline works technically, but its textual decision is **not accepted
as reliably meeting the user's rubric**. A better-looking category distribution
would not remove the counterexample. The planned mechanical alternative and removal
of manual-review machinery have not been executed. No deployment or assessment
submission was performed.
