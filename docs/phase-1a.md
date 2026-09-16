# Phase 1A — visual foundation

## Implemented scope

- Responsive English workbench with three selectable scenarios.
- Explicit two-step workflow: Scan website, then Run analysis.
- Honest empty states. Operational buttons disabled until their integrations exist.
- API setup preview with demo/personal selection. Key input and connection test disabled.
- Independent visual identity, self-hosted fonts, SVG logos, favicon, Apple icon and OG card.
- App Router, TypeScript, Tailwind, lint/type checks and component tests.

## Next boundaries

1B: Discover current URLs from the source sitemap and internal links. Display
the actual discovery run before fetching review content on Run analysis.
No historical URL list or captured patient text should become a product dataset.

1C: Analyze only the selected scenario through server-side NVIDIA integration.
Add validation, limits, evidence, error handling and a session-only personal key.
Do not expose a shared key before effective abuse protection is in place.

1D: Verify the real workflow and deploy to the existing production project.

## Acceptance checks for this phase

- All three menu choices change their explanations and checklists.
- Navigation between / and /setup works; no key or review request is made.
- Disabled controls never show fake success or progress.
- Desktop and narrow screens remain usable with no horizontal overflow.
- Metadata references the actual 1200x630 social card and favicon files.
- Font licenses accompany self-hosted assets.
- No private assessment URL, credentials, historical patient text or hardcoded
  clinic inventory is included.

The build chronology must remain accurate: this foundation is preparation;
it must not later be described as work completed during a timed session.

## Tooling compatibility note

ESLint is pinned to 9.39.5 because eslint-config-next 16.3.5's React plugin
failed under ESLint 10.10.0 (removed getFilename context API). npm marks ESLint 9
deprecated. This is a development-tool maintenance item, not a runtime
dependency; recheck plugin compatibility before upgrading. The current npm
audit reported no known vulnerabilities at installation.
