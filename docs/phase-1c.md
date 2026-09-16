# Phase 1C — selectable AI providers and evidence reports

Historical checkpoint. The current implementation is DeepSeek-only; see
[September 16 quality review](quality-review-2026-09-16.md) for the superseding changes.

Local implementation, September 15, 2026. No deployment, assessment start or submission.

## Design

Source → lens → analysis. Live collection belongs to the source run, not the lens.
Each report retains collection times, lens, provider, model, eligible/selected/analyzed units,
completed batches, warnings and errors. Switching lenses never makes source requests.
Completed results are reused; partial results resume from the first incomplete batch.
Reports are keyed by provider and lens. Changing provider preserves the source dataset
but never mixes that provider's work with another report. Export schema version 4 separates
analysis reports (references and quotations, no full record bodies) from collected data
(discovery/collection, no reports). Refresh invalidates every provider's reports.

Missing-field tasks group reviews by canonical clinic and inspect only their bodies.
Identity uses published profile links without AI; unlinked names get a maximum of six
lexically shortlisted catalog candidates. A suggested match remains unverified.
Similarity candidates are bounded to 60 pairs within linked clinics. Highest lexical
overlap pair per clinic first, then remaining pairs by overlap; output says how many
eligible pairs were not selected. No cross-clinic matching or automatic deduplication.

## Provider boundary

- AI SDK `generateText`, OpenAI-compatible adapters with fixed HTTPS endpoints.
- NVIDIA: `https://integrate.api.nvidia.com/v1`, model `deepseek-ai/deepseek-v4-flash-0731`; `reasoning_effort=none` and the
  NVIDIA template switch `chat_template_kwargs.thinking=false`.
- Direct DeepSeek: `https://api.deepseek.com`, model `deepseek-flash`,
  `thinking.type=disabled`. Explicit provider selection, no automatic fallback.
- 6 units, 20 records, 40,000 text characters/request; 180 KB HTTP body limit.
- Maximum 7,000 output tokens, 90-second analysis timeout, 30-second connection test.
- No automatic transport retries. One schema/evidence repair; same overall timeout.
- Exact unit coverage, record IDs, candidate URLs and verbatim quotes validated.
- Both sides required for pair comparisons. Missing-field output requires four unique fields.
- Prompt/data separation, no tools, no model access to credentials or navigation.
- One job per provider per process; 30 starts/minute and 300/hour per provider;
  429 imposes provider-specific cooldown. NVIDIA overload does not block DeepSeek.
  Repair may make one additional call within a job. These are not distributed limits.
- Same-origin requests required; origin checks are not authentication.
- Shared key disabled whenever `VERCEL` is set. Public shared access remains Phase 1D.

## Privacy and failure handling

Server keys stay in separate git-ignored environment variables, `NVIDIA_API_KEY` and
`DEEPSEEK_API_KEY`. Only the selected provider's key is read. BYOK stays in tab memory and
is sent only for explicit test/analysis; no browser storage, cookies or exported keys.
Setup is also available inline so replacing a key need not clear the dataset.
BYOK values and connection modes are separate per provider; clearing one leaves the
other untouched. Controls are locked during a run/test. Changing provider resets
connection-test feedback, not collection. Model/provider mismatches in reports fail closed.
Only relevant structured text is sent. Basic contact redaction is not full anonymization.
Raw model errors/bodies/headers are not logged or returned. Invalid citations are not shown.
Quota, authentication, timeout, cancellation and validation failures keep completed results.

## Initial verification (historical checkpoint)

Automated tests cover output grounding, ID/schema mismatch, both pair quotes, candidate
validation, batch/text limits, deterministic aliases, bounded pair selection, source reuse,
partial resume, cancellation, reset, private-key memory/clear, public shared-key disabling,
same-origin/body restrictions, repair limits and sanitized provider errors.

Live connection succeeded locally using the server key on September 15, 2026.
Live collection: 142 pages, 212 review occurrences, zero page failures. Identity:
278 link-resolved occurrences plus six AI findings before provider interruption.
Similarity: four pairs validated in the first live batch (60 selected of 1,334 eligible).
Missing information: one independently collected live AB review returned a grounded
procedure quote and three absent fields, without repair. Larger runs encountered
HTTP 529 and timeout, so **full end-to-end completion is not yet validated**.
Cancellation retained completed results. 43 automated tests, lint, types and build
passed; production dependency audit reported zero vulnerabilities. Exact-key scan
of public build assets found zero occurrences. These results are observations, not
guarantees of future NVIDIA availability.
Synthetic fixtures exist only in tests and are never presented as live results.

### Provider selector verification — September 15, 2026

50 automated tests, type checking, lint and production build passed after the change.
New checks cover credential isolation, selection without AI calls, per-provider reports,
source reuse, completed-report reuse, mismatched provider rejection and independent cooldown.
The direct DeepSeek model-list request, browser connection test and one real missing-field
analysis all succeeded. The analysis used a freshly collected AB clinic review (six reviews
on the collected page); its schema and verbatim evidence passed without a repair call.
This is a bounded smoke test, not full three-lens acceptance. Both environment keys were
absent from all 21 public build asset files checked; `.env.local` remains git-ignored.
Provider setup was inspected in the local browser with direct DeepSeek selected.
No production deployment, account modification or assessment interaction occurred.

## Results-first refinement

Collected records are visible only through a source-adjacent, low-emphasis modal trigger.
The native dialog traps focus, supports Escape and restores focus to the trigger; tables
are paginated and filterable. Raw collection download lives inside the modal. Analysis
download is at the bottom, only after a run stops, with explicit incomplete/not-run coverage.
No extra model call is needed to summarize the already validated findings.

Analysis progress is independent of collection and uses validated unit counts. A running
panel stays visible while scrolling; zero eligible units is not a fake 100% success.
Summaries are lens-specific and explicitly limited to processed results. Filters group
clinic names only by published canonical URL, never by fuzzy similarity. Compact findings
retain exact quotations, linked source pages and side-by-side comparison records.

Interpretation instructions distinguish treating surgeons from reputation/consultation
mentions, plain-language procedures from missing procedure information, elapsed intervals
from mere event order, and missing summary details from missing original-review details.
These instructions improve consistency but are not semantic proof. Exact-citation/schema
validation remains mandatory. A failed response gets one category-specific repair hint;
only allowlisted error categories reach the UI (with batch number), not rejected model text.
Historical failures without retained raw output cannot be assigned a precise category retroactively.

### Results-first verification — September 15, 2026

Story: scan the current source → collect once → analyze with three lenses → inspect
findings and citations → optionally consult collection tables → download separate JSON files.

- 62 tests across 10 files, lint, type checking and production build passed.
- Live browser collection: 142/142 pages, zero failures, 212 reviews and 321 name
  occurrences. Collection timestamps stayed at 22:42:40–22:43:11 America/Sao_Paulo
  throughout all three lenses; no new source collection was needed.
- Direct DeepSeek missing information completed 212/212. Cancellation at 136 preserved
  results; resume continued from there. Treating-surgeon reputation and mere sequence
  versus procedure-date distinctions were inspected in actual returned findings.
- Clinic identity completed 321/321: 278 published-link resolutions, one AI suggestion,
  42 unresolved names. A suggestion is not a verified identity.
- Similarity completed 60/60 selected pairs of 1,334 eligible: 57 possible repeated
  experiences, three similar-but-distinct, zero inconclusive. Selection prioritizes
  lexical overlap: these counts do not estimate the site's overall duplication rate.
- Similarity initially stopped on schema validation. The prompt omitted schema length
  and quote-count limits; these are now explicit. Sanitized schema diagnostics now
  identify allowlisted field paths and error types, never raw model values. After the
  change, resume completed all 60 with strict validators unchanged. The exact original
  violation was not retained, so the limit omission is a candidate cause, not proven.
- Modal tables/pagination/categories, close/focus return, sticky progress, A/B source
  quotations, independent source/analysis status and partial report labels were checked
  in the live browser. Unit tests also cover filters, Escape cancellation, zero eligible
  records and exports. Desktop visual inspection at 1280px passed without page overflow.
- Both downloaded JSON types were parsed: schema 4, separate payloads, no complete
  record bodies in analysis exports, six provider/lens coverage entries. Collected
  export contained 142 pages, 212 reviews and 321 names, without AI reports.
- Exact-key scan found zero occurrences of either configured server key in 21 public
  assets. No raw credentials were displayed or persisted in reports.
- Original user tab/partial execution preserved; testing used a separate tab. No
  deployment, assessment interaction, Supabase change, push or account change.

Remaining acceptance: narrow/mobile viewport and real keyboard focus-trap/Escape checks,
production safeguards and production smoke tests. Unit coverage is not a substitute for
those remaining browser/environment checks. AI interpretations still require human review.

### Remaining Phase 1D work

Distributed abuse protection, review of deployment origin/HTTPS handling and token budgets,
production smoke tests, mobile final acceptance, and explicit publication authorization.
The source manifest is not cryptographically attested: requests cannot prove a record was
collected by this UI. Do not treat browser-submitted records as server-authenticated facts.
No key exposure, unlimited public proxy, fake data, persistence, Supabase or assessment actions.
