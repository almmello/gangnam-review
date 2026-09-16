# Gangnam Review

A source-first workbench for reviewing published clinic reviews on Gangnam Beauty Guide.
Built with Next.js, TypeScript, React and Tailwind CSS.

## Features

- Discover current URLs from the live website rather than a fixed list of reviews.
- Collect once and reuse the dataset across three lenses:
  - **Missing information:** procedure, treating surgeon, price/currency and procedure date.
  - **Clinic identity:** published profile links, aliases and unresolved candidate matches.
  - **Review similarity:** related pairs (**Similar**) and individual records with no
    established match (**Inconclusive**).
- Inspect explanations, exact supporting quotations and original source links.
- Track collection and analysis separately; cancel and resume incomplete analysis.
- Continue after isolated invalid model responses, without accepting ungrounded citations.
- View collected data in a discreet modal with filters, pagination and its own JSON export.
- Download all completed or partial lens reports together at the bottom of the workbench.

There is no manual classification editor or shared correction storage in the application.

## Run locally from GitHub

Requirements: Node.js 22 or later, npm and a DeepSeek API account/key.

```sh
git clone https://github.com/almmello/gangnam-review.git
cd gangnam-review
npm ci
npm run dev
```

Open [the local workbench](http://localhost:3000).

Choose one connection method:

1. For shared local access, copy `.env.example` to `.env.local`, set
   `DEEPSEEK_API_KEY`, then restart the server.
2. Alternatively, open **API setup** and enter your own DeepSeek key. This key stays
   in this tab's memory and is sent to the server only for an explicit model request.

Obtain/manage a key at [DeepSeek Platform](https://platform.deepseek.com/).
Provider charges and limits apply. The direct provider/model is pinned in
`src/lib/analysis/providers.ts`; requests use `https://api.deepseek.com`.

Never commit real keys, paste them into source code or prefix secrets with
`NEXT_PUBLIC_`. No database, Blob token or correction-storage setup is required.

### Deploy on Vercel

Import this repository or deploy it with the Vercel CLI. `vercel.json` selects
Next.js and a clean `npm ci` installation. For shared demo access, add
`DEEPSEEK_API_KEY` as a sensitive **Production** environment variable and set
`ENABLE_SHARED_AI=true`, then redeploy. Never include either secret value in Git.
Visitors can use the server's connection without receiving its key; calls consume
the owner's DeepSeek balance. Set `ENABLE_SHARED_AI=false` and redeploy to disable
shared access. Personal keys remain an alternative when demo access is unavailable.

## Using the workbench

1. Select the supported source and click **Scan website**.
2. Choose a lens and click **Run analysis**. The first run collects the current pages.
3. Switch lenses to reuse that collection. Switching alone does not call AI.
4. Inspect results and supporting text. A completed lens shows a disabled
   **Analysis complete** button; select an unprocessed lens to continue. Incomplete
   analyses can still be resumed. **Refresh sources** starts a new dataset and clears
   the current collection and reports.
5. Use **Download all analyses (JSON)** to save all available lens reports.

Collection and results live only in the current tab. Reloading or leaving clears
them. A personal API key also disappears when its in-memory connection is lost.
There are no accounts, persistent user reports or shared manual corrections.

## Similarity: one semantic pass

Each batch gets one semantic analysis, with at most one repair request if the output
fails validation. There is no second comparison pass or percentage-based classifier.

- **Similar:** meaningful shared content in the concern, treatment, recovery, outcome
  or service experience. Exact copies, paraphrases and related accounts all belong here.
  Similarity does not establish duplication or the same patient.
- **Inconclusive:** an individual record without an assigned partner from that check.
  The model did not establish a meaningful relation, or its response failed evidence
  validation. The displayed reason distinguishes these cases. A technical failure
  does not prove there is no related review elsewhere.

Similarity examines at most **60 selected pairs** within published clinic links:
the highest word-overlap pair per clinic first, then the remaining highest-overlap
pairs. Word overlap selects candidates; it is not the final classification.
The remaining eligible pairs are not analyzed. Counts are selected coverage, not
a website-wide duplication rate or a count of unique patients.

**Similar counts pairs; Inconclusive counts individual records**, deduplicated by
source-record ID. Do not add these counters as if they used the same unit.
An item can participate in a related pair and also have an inconclusive check with
another candidate; no partner is shown in the inconclusive item.

Both categories remain available in the filters, including when their count is zero.
Nothing is merged or deleted. Decisions are AI interpretations, not verified facts.

## Other lenses and evidence

Missing information examines the published record: a gap in a summary does not prove
a gap in the original review. A consultation with a named doctor does not establish
who performed the procedure; publication dates are not procedure dates.

Clinic identity resolves published links first. Its AI progress starts at zero for
the remaining unlinked names. It reuses collected pages, not another lens's conclusions.

Output schemas, record IDs and exact quotation substrings are validated. A failed
batch is isolated into individual checks; persistently invalid items become
inconclusive and later checks continue. Authentication, quota or service outages
can still require an explicit resume. Citation validation proves text provenance,
not that the interpretation is correct.

## JSON downloads

- **Analysis report, schema v7:** all completed/partial lens reports, source coverage,
  timestamps, explanations, supporting quotations and source references. Lenses not
  run are identified. Filters and the currently open lens do not restrict the export.
  No manual corrections, two-pass metadata or full source bodies are included.
- **Collected data, schema v4:** the discovered URLs and complete collected dataset,
  available inside **View collected data**.

Downloads are generated in the browser without consulting external storage.
Neither export includes API credentials or connection settings.

## Checks and local production preview

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

With the local server running on port 3000, optional live checks:

```sh
node scripts/verify-similarity.mjs
node scripts/verify-fields.mjs
```

These use the configured shared local DeepSeek key and incur provider usage.
The similarity script checks 15 fixtures, including copies, paraphrases, unrelated
content and a user-reviewed real-text pair. It does not certify general accuracy.

`node scripts/audit-exports.mjs path/to/analysis.json path/to/collected.json` performs
an offline provenance/coverage audit of exported reports.

## MVP boundaries

- Only the supported English Gangnam Beauty Guide pages are collected. Discovery,
  fetching, candidate selection and batch sizes are bounded.
- Robots policy, same-origin requests and source-host restrictions remain in place.
  No attempt is made to bypass website access controls.
- There is no external Korean-source syndication, original-source verification or
  guaranteed translation/medical accuracy. Published summaries may omit context.
- Relevant review text is sent to DeepSeek. Basic contact redaction is not full
  anonymization; do not use the prototype for confidential patient data.
- Rate/concurrency guards are per-process, not production-grade distributed quotas
  or a guaranteed global spending cap. Shared access on Vercel is disabled by default
  and requires the explicit `ENABLE_SHARED_AI=true` opt-in. This assessment demo
  enables it with the owner's authorization; visitors consume the owner's balance.
  Add distributed limits and authentication before broader public use.
- A future authenticated per-user database could persist collections and reports.
  It is not needed to reproduce this version.

See `LICENSE` and `THIRD_PARTY_NOTICES.md` for rights and third-party assets.
