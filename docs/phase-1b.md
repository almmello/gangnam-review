# Phase 1B — live source collection

Implemented locally on 2026-09-15. No deployment, NVIDIA call, Supabase change
or assessment action was performed in this phase.

## User story

Select the source → discover its current URLs → choose a lens → Run analysis →
collect once, browse and export evidence. Changing lenses and running again reuses
the collection without another website request. Refresh sources explicitly
invalidates the dataset. Actions currently prepare evidence only; AI evaluation
belongs to Phase 1C.

## Implementation

- Discovery reads current robots.txt, sitemap.xml (or up to four child sitemaps)
  and the English home, clinic directory and reviews page. It unions supported
  URLs and records where and when each one was discovered.
- Profiles are never generated from names or loaded from a saved inventory.
  An address in a sitemap is not proof that its page is available.
- Collection uses explicit client-orchestrated batches of at most two URLs.
  Each batch checks robots.txt again and fetches fresh HTML on the server.
- Cheerio parses the HTML without running website scripts. Only source text and
  metadata are returned; raw HTML is never injected into the app.
- Extractors distinguish home context, directory identities, index summaries,
  profile narratives and marked translations. Missing values remain null.
- A recognized clinic template without a review section is different from a
  changed/unrecognized template. Failed pages have explicit statuses and no
  fallback content. Counts do not certify authenticity or unique patients.
- Declared non-English review bodies are skipped with warnings. Language falls
  back to the document's declared language when the body has no language tag;
  this is markup provenance, not an AI language-detection claim.
- Run JSON includes the discovery manifest, selected lens, collection timestamps,
  page status/errors, source links, record locators and an explicit AI not-run flag.
- New scans invalidate previous results. Scenario changes do not trigger requests.
  After the first finished collection, clicking Run analysis again also reuses
  the dataset, preserving its timestamps, including partial-run warnings.
  Cancellation prevents later batches; in-flight upstream cancellation depends on
  runtime propagation. Navigation/unmount aborts the client operation.
- No database, cookies, browser storage or persistent HTML cache. An exported file
  is saved only when requested. Source text is not bundled in the repository.

## Bounds and security

Fixed HTTPS origin and allowed English path families; URL credentials, alternate
origins/protocols, unsafe redirects and unsupported content types are rejected.
Requests use no-store, manual redirects (at most three), 15-second timeouts and
bounded streamed reads (5 MB). Network failures and HTTP 5xx get one retry;
timeouts and 429 do not. HTTP 429 pauses the collector and observes Retry-After.
robots.txt failure pauses collection rather than assuming permission.

Run limits: 200 pages, 500 review occurrences; 100 cards per page and 20,000
characters per review. Truncation and uncollected pages are disclosed. Two
upstream requests may run at once per server instance; an excessive local queue
is rejected. A declared crawl delay makes each batch sequential; delays over
10 seconds pause this prototype.

These are local-prototype safeguards, not distributed anti-abuse protection.
Before public enablement: configure shared rate limits/protection, validate the
hosting plan/function timeouts and forwarded-origin behavior, and enforce a
server-verifiable discovery manifest if scan membership must be an API guarantee.
Currently the UI uses only its displayed manifest, while the server validates
the fixed origin/path scope of each submitted URL. Same-origin checks are not
authentication and per-instance limits do not cap all deployed instances.

## Verification

- Types, lint, production build and 27 tests pass.
- Production dependencies audit returned zero known vulnerabilities.
- Tests cover dynamic addition/removal of URLs, source changes between actions,
  removed pages, robots denial/unavailability, changed templates, absent sections,
  explicit language exclusions, extraction bounds, bad URLs/redirects, oversized
  JSON, unsupported content types, timeout, cancellation, retry and HTTP 429.
- Component tests cover the two separate actions, no auto-request on scenario
  change, invalidation on rescan, cancellation, errors and exported JSON.
  Source/lens/action document order and reuse across all lenses (including a
  partial collection) are covered; a repeated run makes no new collection request.
- Source-first browser check: collection finished at 20:38:32 BRT with 142 pages
  and 212 review occurrences. Switching to Clinic identity and running again
  preserved counts and collection timestamps and displayed the reuse notice.
- Local API rejects an internal/private destination with HTTP 400, cross-site
  origin with 403, and unsupported GET with 405.
- The browser test found and fixed a local origin mismatch: Next represented
  the request as localhost while the browser used 127.0.0.1. A regression test
  now checks the actual Host plus scheme without accepting a foreign origin.
- Live browser run on 2026-09-15, 20:07:40–20:08:13 America/Sao_Paulo:
  142 pages attempted, zero page failures; 90 index summaries plus 122 profile
  narratives = 212 occurrences; 321 clinic-name occurrences (not unique clinics).
  21 profiles had review sections; 118 recognized profiles had no such section.
  No extraction-count mismatch warnings. These are test observations, not constants.
- Earlier research counted 117 explicit English-tagged spans in profiles. Five
  additional English narratives had no body language/translation marker
  (four in Braun, one in Pleasure). Fresh markup inspection confirmed the
  difference; the extractor correctly preserves these published narratives.
- Source rows, expanded review/provenance and progress/results were inspected in
  the in-app browser. No horizontal overflow at the observed 730-pixel viewport.
  A full mobile/deployment verification matrix remains Phase 1D.
- The final local production build repeated discovery and collection successfully:
  142 pages, 212 review occurrences, zero failures; no horizontal overflow at
  1280 pixels. A stale browser error tab after the server restart was replaced
  with a fresh local preview tab; the assessment tab was not changed.

## Next

Phase 1C: secure NVIDIA integration, connection test, validated evidence-backed
outputs for the chosen scenario and user-provided key handling. Phase 1D:
public abuse protections, full regression/mobile checks and deployment.
Do not start the timed assessment automatically.
