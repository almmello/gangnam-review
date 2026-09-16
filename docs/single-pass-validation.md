# Single-pass semantic MVP — 2026-09-16

Alexandre approved simplifying review similarity to two outcomes: Similar pairs
and individual Inconclusive records without an assigned partner. Copies,
paraphrases and meaningfully related stories all belong to Similar. The app no
longer attempts to establish duplication or patient identity.

## Implemented

- One semantic DeepSeek call per batch, with bounded output repair only.
- Removed the textual second pass, percentage classifier and manual corrections.
- Removed correction UI, API, storage code and the Blob dependency.
- Preserved exact citation validation and isolation of invalid items.
- Export schema 7 includes all available lens reports without correction metadata.
- Other lenses and reuse of collected pages are unchanged.

## Verification

- 81 automated tests passed; lint and production build passed.
- Live DeepSeek controls: 15/15 matched expectations (13 Similar, 2 Inconclusive).
- Controls include literal copies, paraphrases, materially different but related
  experiences, unrelated/sparse texts and the user-reviewed Braun example.
- This small control set does not establish general accuracy. Candidate selection
  is bounded and favors related content; the distribution is not a quality score.

- Fresh website run: 60/60 selected comparisons out of 1,334 eligible pairs,
  completed in 1m09s without interruption: 60 Similar pairs, 0 Inconclusive items.
  Other lenses were covered by regression tests, not rerun fully against the live
  provider in this round.

Remote storage deletion is a separate operational action. No deployment, commit,
push or assessment submission was performed as part of this change.
