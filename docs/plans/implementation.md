# NetScry implementation plan

`PROMPT.md` is the source of truth for product requirements. This plan is the execution record. Each implementation task is completed, validated, reviewed, and committed separately. Production deployments, publishing, paid services, and live DNS changes remain out of scope without explicit approval.

## Preflight record

- Baseline branch at first inspection: Git could not resolve this directory as a repository. The existing upstream `origin/main` points to `b8ca548` (`first commit`, README only). A T3 checkpoint snapshot also exists at `53288c6`; it includes the starter files and editor settings.
- Working tree at first inspection: root project files present; no app or package source beyond the Bun `index.ts` greeting. The pre-existing `.vscode/` and `.zed/` settings are intentionally left untracked and untouched.
- Git setup performed to satisfy the requested per-task history: `main` now tracks `origin/main`; `a9d10f9` records the starter files as the initial project baseline. Repository-local `commit.gpgsign=false` overrides the user's global signing setting for unattended unsigned commits. No `Co-Authored-By` trailer is used.
- Applicable instruction: `C:\Users\mynameistito\AGENTS.md` says not to add `Co-Authored-By` lines.
- Repository: Bun 1.4.4, `bun.lock` lockfile version 2, private root package. Existing checks are `bun run check` (`ultracite check`) and `bun run typecheck` (`bun check`). There are no test, build, e2e, workspace, CI, deployment, changeset, or application scripts/configurations yet. TypeScript strict mode and Ultracite/Oxlint/Oxfmt configuration exist.
- Baseline `bun run check`: fails because the supplied `PROMPT.md` is not formatted by the installed Ultracite formatter.
- Baseline `bun run typecheck`: fails for the same pre-existing `PROMPT.md` formatting issue; the script delegates to `bun check`/Ultracite.
- Baseline `bun run test`: unavailable (`Script not found "test"`).
- Baseline `bun run build`: unavailable (`Script not found "build"`).
- Baseline `bunx ultracite check`: reports the same pre-existing `PROMPT.md` formatting issue.
- The first repository-wide checks after Git setup also report formatting issues in the unchanged starter `README.md`; subsequent checks confirm only `PROMPT.md` and `README.md` fail formatting, and both are outside the current implementation diff.
- Existing dependency/toolchain baseline: Bun 1.4.4. The root manifest has only starter and lint/format dependencies; no framework, Effect, Cloudflare, testing, docs, UI, or infrastructure dependencies are installed as project dependencies.
- Commit handling requested by the user: configure this repository for unsigned commits to avoid signing prompts during unattended work. Required validation and review still run before commits.

## Verified implementation constraints

- Effect v4 documentation uses the `effect/Schema` API and recommends strict TypeScript; keep shared contracts inferred from schemas.
- Prefer Effect for domain services, async workflows, provider boundaries, and typed failures where it improves composability and testability. Keep declarative configuration and framework-native UI state idiomatic instead of forcing them through Effect.
- TanStack Start's current Cloudflare guide uses Vite and `@cloudflare/vite-plugin`.
- shadcn/ui's current CLI supports a TanStack Start monorepo and installs shared UI components into the UI workspace.
- mapcn installation expects Tailwind and shadcn/ui to be configured first; its component uses MapLibre and documents tile and worker/CSP implications.
- Blume's current npm documentation specifies its own `blume dev` and `blume build` commands and static output. It does not require a hand-built Astro application.
- The checked-out `mynameistito/alchemy-deploy` repository provides a root action pinned to an immutable release SHA, `workflow_run` exact-SHA gating, and artifact-backed previews. The latest local release tag is v3.1.8 at `68f577f3032660bd4919dfcc5725db21d5b64f9d`; inspect that exact release's template/interface before deployment integration. CI builds must not receive deployment credentials.
- Registry metadata checked during setup: TanStack Start `1.169.4` requires Vite 8 and React; React `19.3.1`, Vite `8.3.5`, Cloudflare Vite plugin `1.65.0` (Vite 6/7/8, Wrangler 4.152+), Tailwind Vite plugin `4.3.3`, Effect `4.0.6`, Alchemy `2.0.0-beta.84` (Vite 8.0.7+, Effect 4.0.5+), Blume `2.2.6` (Node 22.19+), Vitest `5.0.5` (Node 22.12+), and Playwright `1.64.1` (Node 20+) are mutually aligned for this Bun 1.4.4 project. Alchemy's beta API is the current published release and will be validated against its official docs/types before infrastructure implementation.
- Wrangler `4.152.0` local dev rejected compatibility date `2026-10-27` as unsupported; `2026-10-19` starts the Worker-mode dev server successfully. Revisit this date when the Wrangler/Miniflare bundle supports a newer date.
- Alchemy `2.0.0-beta.84`'s documented `bun alchemy dev` path failed on Windows because the Worker child attempted to import the omitted `bin/register-dev-mode.js`; the repository launcher resolves Node to an absolute path and clears Bun's inherited `npm_execpath`. The Vite injection guard avoids duplicate Cloudflare plugins when Alchemy owns the Vite server. A local Alchemy Worker returned HTTP 200, and SIGINT stopped the launcher and all Alchemy child processes and released port 5173.
- Official sources reviewed: <https://effect.website/docs/v4/schema/introduction>, <https://effect.website/docs/v4/schema/filters>, <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>, <https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/>, <https://ui.shadcn.com/docs/monorepo>, <https://ui.shadcn.com/docs/installation/tanstack>, <https://www.mapcn.dev/docs/installation>, <https://www.npmjs.com/package/blume>, <https://github.com/mynameistito/alchemy-deploy>.
- IP special-purpose classification follows the IANA <https://www.iana.org/assignments/iana-ipv4-special-registry> and <https://www.iana.org/assignments/iana-ipv6-special-registry>; the registries explicitly caution that special-purpose allocation alone does not guarantee routability.
- ASN parsing uses the IANA <https://www.iana.org/assignments/as-numbers> registry's 32-bit range and its reserved endpoint values; numeric normalization does not claim the number is allocated.
- Domain normalization uses the WHATWG URL Standard's domain-to-ASCII processing for IDNA lookup and RFC 5891's A-label requirements (<https://url.spec.whatwg.org/>, <https://www.rfc-editor.org/rfc/rfc5891.html>).
- DNS resource data follows RFC 1035 and its type-specific presentation formats, with CAA from RFC 8659 (<https://www.rfc-editor.org/rfc/rfc1035.html>, <https://www.rfc-editor.org/rfc/rfc8659.html>).
- Approximate geographic distance uses the haversine great-circle calculation with NASA's 6,371 km volumetric mean Earth radius (<https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html>); latency variation terminology follows the IETF's RFC 3393 (<https://datatracker.ietf.org/doc/rfc3393/>), while the UI calculation is explicitly a browser RTT sample statistic rather than IP packet delay variation.
- Alchemy-managed Cloudflare deployment and local Vite development follow the official <https://alchemy.run/cloudflare/frontend/tanstack-start/>, <https://alchemy.run/cloudflare/frontend/vite/>, and <https://alchemy.run/environments/local-development/> guides. Alchemy 2.0.0-beta.84 splits provider packages and documents the Vite injection guard in <https://alchemy.run/blog/2026-10-22-beta-84/>.
- Blume workspace configuration and its static build follow the official <https://useblume.dev/docs/quickstart>, <https://useblume.dev/docs/configuration/theming>, and <https://useblume.dev/docs/cli> references.
- Bun workspace filters target each app; `concurrently` manages both processes and kills their process trees on interruption. Blume accepts explicit host/port options, while Vite also supports strict port binding (<https://bun.sh/docs/pm/filter>, <https://github.com/open-cli-tools/concurrently>, <https://useblume.dev/docs/cli>).
- The map setup follows mapcn's current <https://www.mapcn.dev/docs/installation> and <https://www.mapcn.dev/docs/basic-map> guidance. OpenFreeMap's <https://openfreemap.org/quick_start/> and <https://openfreemap.org/tos/> document its public MapLibre styles, required attribution, and terms.
- First product-screen direction selected for the visitor diagnostics overview: framed sheet, seed `819559637`; a blue-grey frame, mono type for IDs, and a request-path trace as the product-specific element. The screen's question and its dataset will be documented before that screen's markup is implemented.

## Phase 1 — Repository and monorepo foundation

- [x] Establish Git history for the currently unversioned starter, record the initial baseline, and configure repository-local unsigned commits.
  - Commit: `a9d10f9`
  - Verified: starter files are committed; `.vscode/` and `.zed/` remain untracked and unchanged; local signing is disabled.
- [x] Verify compatible current package versions, declare Bun workspace boundaries, and confirm a reproducible lockfile.
  - Commit: `9b65da3`
  - Verified: Bun recognized the workspace patterns; `bun install --frozen-lockfile` passed with no lockfile changes; targeted formatting checks passed. Project-wide formatting/typecheck remain blocked by the recorded, unchanged `PROMPT.md` and `README.md`; test/build scripts did not exist yet.
- [x] Add the first real `@netscry/core` workspace with strict IPv4/IPv6 parsing, canonicalization, Vitest coverage, and a working root typecheck/test command.
  - Commit: `f2305fd`
  - Verified: 22 Vitest cases pass; `bun run typecheck` passes; targeted Ultracite and frozen-lockfile checks pass. Full `bun run check` still reports only unchanged `PROMPT.md` and `README.md`; `build` is not available until a production application exists.
- [x] Add `@netscry/schemas` with Effect Schema contracts for provenance, availability, sensitivity, and typed network/visitor metadata.
  - Commit: `56e26d1`
  - Verified: 11 schema decode cases pass; shared typecheck passes; targeted Ultracite and frozen-lockfile checks pass.
- [ ] Complete shared TypeScript settings and root check, typecheck, test, build, and development commands across workspaces while preserving Ultracite.
- [ ] Add CI checks for formatting/lint, typechecking, tests, and builds without deployment credentials.
- [ ] Add `packages/config` only when shared configuration is justified; `packages/core` and `packages/schemas` are implemented in their own foundation tasks.

## Phase 2 — Web, docs, and UI foundation

- [x] Create the Cloudflare-compatible TanStack Start application and verify its local and production builds.
  - Commit: `3a694c0`
  - Verified: local Worker-mode dev server returned HTTP 200 and rendered the NetScry route; TanStack Start produced client and Cloudflare SSR builds; shared typecheck, all 33 unit tests, targeted Ultracite, and frozen-lockfile checks pass. The full formatter check still reports only unchanged `PROMPT.md` and `README.md`.
- [x] Create `packages/ui` and configure shadcn's monorepo component paths, Tailwind CSS v4 tokens, and accessible theme switching.
  - Commit: `d5ce9a9`
  - Verified: shadcn CLI recognizes TanStack Start, Tailwind v4, shared UI paths, and both workspace aliases; the app source generates shared Tailwind utilities; IBM Plex fonts are bundled locally; theme toggle tests pass in light and dark modes; local Worker mode returns HTTP 200; React Doctor scores 100/100. Shared typecheck, all 35 tests, web production build, targeted Ultracite, and frozen-lockfile checks pass. Full Ultracite still reports only unchanged `PROMPT.md` and `README.md`.
- [x] Add Lucide React to the shared UI workspace for the project-standard interface icons.
  - Commit: `5021456`
  - Verified: dependency resolves through the workspace lockfile; typecheck, 35 tests, and targeted formatting checks pass.
- [x] Create the runnable Blume docs workspace with verified configuration and local/build commands.
  - Commit: `cb6d26c`
  - Verified: Blume check reports no errors/warnings/hints; doctor and link validation pass; static build emits the docs, search index, `llms.txt`, and agent metadata; frozen-lockfile install, strict typecheck, 35 tests, and targeted Ultracite pass. Full `bun run check` reports only the pre-existing `PROMPT.md` and `README.md` formatting issues. Dev server binds to loopback, but an HTTP smoke request hangs under the environment's Socket Firewall, so interactive dev serving remains unverified here.
- [x] Establish app shell, navigation, search, responsive layouts, and shared loading, empty, error, and data-display components.
  - Commit: `5d829fa`
  - Verified: responsive shell and navigation, theme control, honest search-unavailable feedback, and shared data/loading/empty/error components are implemented; 5 test files / 40 tests pass; strict typecheck and Cloudflare client/SSR production build pass; React Doctor scores 100/100; targeted Ultracite passes. Full Ultracite reports only the baseline formatting issues in `PROMPT.md` and `README.md`.
- [x] Integrate mapcn/MapLibre after UI setup, with SSR-safe loading, attribution, appropriate tiles, and mobile behavior.
  - Commit: `578a35a`
  - Verified: mapcn's base map, marker, popup, and controls are installed; MapLibre is dynamically loaded only when validated location coordinates exist; its worker is bundled locally; OpenFreeMap light/dark tiles have visible OpenMapTiles/OpenStreetMap attribution and a notice that the browser contacts the tile provider. Invalid and missing coordinates have honest fallback states. Frozen-lockfile install, strict typecheck, 42 tests, targeted Ultracite, and web client/Cloudflare SSR builds pass. The map library remains a separate lazy chunk; the production bundler emits its size advisory. No real location source exists yet, so a live tile/WebGL render is not verifiable until location data is implemented. The copied mapcn registry component is excluded from Oxlint because its upstream ref/effect patterns conflict with repo rules; strict TypeScript, format, and build checks still cover it. Full Ultracite reports only unchanged `PROMPT.md` and `README.md`.
- [x] Add a cross-platform process-tree manager for root dev orchestration, so interrupting the root process reliably stops both dev servers.
  - Commit: `391c37f`
  - Verified: frozen-lockfile install, strict typecheck, and 42 tests pass. `bun run check` reports only baseline formatting issues in `PROMPT.md` and `README.md`.
- [x] Add a cross-platform root development command for web and docs, with predictable ports and clean process shutdown.
  - Commit: `493082a`
  - Verified: both apps start from `bun run dev` at `127.0.0.1:5173` and `127.0.0.1:4321`; Ctrl+C in Windows Terminal exits and closes both task-owned listeners. Targeted Ultracite, strict typecheck, and 42 tests pass. Full `bun run check` reports only the baseline formatting errors in `PROMPT.md` and `README.md`.

## Phase 3 — Effect, contracts, and Cloudflare integration

- [x] Declare direct Effect v4 and shared-schema workspace dependencies in the web application before adding app-owned services.
  - Commit: `7fc7705`
  - Verified: frozen-lockfile install, strict typecheck, and 42 tests pass; targeted Ultracite passes. Full `bun run check` reports only the baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Declare the direct `@netscry/core` workspace dependency needed by web-side network service code.
  - Commit: `ec1ccae`
  - Verified: frozen-lockfile install, strict typecheck, and all 48 tests pass.
- [x] Implement a request-scoped visitor metadata Effect service with typed Cloudflare request properties and explicit live, local, and fixture Layers.
  - Commit: `7de31d2`
  - Verified: `wrangler types`, targeted Ultracite, strict typecheck, 50 tests, and the web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Document provider HTTP trust boundaries and resource limits in an ADR before shared provider client integration.
  - Commit: `f80f847`
  - Verified: targeted Ultracite formatting and lint check passes.
- [x] Add the shared typed external-provider error model and reusable bounded Effect HTTP client policy.
  - Commit: `453696a`
  - Verified: frozen-lockfile install, targeted Ultracite, strict typecheck, 62 tests, and the web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add an Effect cache service with request-safe separation and TTL behavior for public lookup data.
  - Commit: `fb706dd`
  - Verified: targeted Ultracite, strict typecheck, all 68 tests, and web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add CIDR parsing, canonical network calculations, range bounds, and containment checks to the portable core package, with IPv4/IPv6 boundary tests.
  - Commit: `dcf15b0`
  - Verified: targeted Ultracite, strict typecheck, all 82 tests, and web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add standards-informed IP classification to the portable core package, with IPv4/IPv6 special-purpose boundary tests.
  - Commit: `e689265`
  - Verified: targeted Ultracite, strict typecheck, all 104 tests, and web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add ASN normalization and validation to the portable core package, with boundary tests.
  - Commit: `efae476`
  - Verified: targeted Ultracite, strict typecheck, all 118 tests, and web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add IDNA-aware domain normalization to the portable core package, with boundary tests.
  - Commit: `4aa03d4`
  - Verified: targeted Ultracite, strict typecheck, all 140 tests, and web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add DNS record utilities to the portable core package, with typed records and unit tests.
  - Commit: `e15ddf1`
  - Verified: targeted Ultracite, strict typecheck, all 165 tests, and web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add network data formatting, geographic distance, and RTT/jitter calculations to the portable core package, with unit tests.
  - Commit: `46fe126`
  - Verified: targeted Ultracite, strict typecheck, all 192 tests, and web Cloudflare production build pass. Full `bun run check` still reports only the documented baseline formatting errors in `PROMPT.md` and `README.md`.
- [x] Add the current Alchemy CLI and Cloudflare provider packages as pinned workspace development dependencies.
  - Commit: `2482b3b`
  - Verified: exact beta.84 package metadata checked; frozen-lockfile install, strict typecheck, and targeted Ultracite pass.
- [x] Add Alchemy's required Effect Node platform peer for Worker bundling and local development.
  - Commit: `82f75e4`
  - Verified: frozen-lockfile install, strict typecheck, and targeted Ultracite pass.
- [x] Add a cross-platform process-tree termination dependency for Alchemy local development.
  - Commit: `f7df7a6`
  - Verified: frozen-lockfile install, strict typecheck, and targeted Ultracite pass.
- [x] Implement Alchemy-managed Cloudflare Worker infrastructure with typed native bindings, isolated local/live stages, and a process-tree-safe local Vite/Worker launcher.
  - Verified: Alchemy beta.84 Vite integration, `bun run dev:web` HTTP 200, and SIGINT shutdown with no Alchemy child processes or port 5173 listener remaining; targeted Ultracite, strict typecheck, 192 unit tests, and web production build pass. Full repository check retains the baseline formatting issues in `PROMPT.md` and `README.md`.
  - Commit: `302f475`
- [x] Implement a safe raw Cloudflare metadata schema and Effect sanitizer with availability/provenance labels and redaction coverage.
  - Verified: 7 sanitizer tests cover preserved names/provenance/units, unavailable fields, local header handling, sensitive TLS/bot/custom metadata redaction, malformed values, unknown future fields, and cookie/authorization exclusion; all 199 unit tests pass, strict typecheck and web production build pass, and targeted Ultracite passes. Full repository check reports only the documented baseline formatting issues in `PROMPT.md` and `README.md`.
  - Commit: `3c18392`

## Phase 4 — `/me` API and visitor dashboard

- [x] Implement the versioned API shell, shared Effect execution boundary, schema-validated responses, typed errors, content negotiation, security/CORS headers, and health endpoint.
  - Verified: 12 focused API tests and all 211 unit tests pass; strict repository typecheck, web Cloudflare production build, targeted Ultracite, and a local Alchemy Worker HTTP smoke test pass. The smoke test returned `200` JSON with `no-store`; shutdown removed all task-owned processes and port 5173. Full `bun run check` still reports only the documented baseline formatting issues in `PROMPT.md` and `README.md`.
  - Commit: `6569b59`
- [x] Add focused visitor metadata readers for the `/me/ip`, `/me/asn`, `/me/country`, and `/me/colo` fast paths.
  - Verified: scalar reader tests cover IPv6 and field provenance/source labels, plus rejection of spoofed Cloudflare-looking headers in local mode; all 213 unit tests pass, strict typecheck and web production build pass, and targeted Ultracite passes. Full repository check reports only the documented baseline formatting issues in `PROMPT.md` and `README.md`.
  - Commit: `8a2262a`
- [x] Add a focused visitor AS-organization reader for the `/me/asn` fast path.
  - Verified: the fast-path test checks ASN and organization values with independent field availability and provenance; strict typecheck, all 213 unit tests, web production build, and targeted Ultracite pass. Full repository check reports only the documented baseline formatting issues in `PROMPT.md` and `README.md`.
  - Commit: `54da224`
- [x] Implement all required granular `/api/v1/me/*` endpoints from request-scoped metadata, including fast scalar paths and plain-text IP/ASN responses.
  - Verified: 17 endpoint tests cover every `/me` route, schema validation, local unavailable IP, plain-text scalar outputs, errors, and header-secret exclusion; all 230 tests pass, strict typecheck and web production build pass, and targeted Ultracite passes. Local Alchemy Worker returned HTTP 200 with `no-store` for `/me` and each granular endpoint; local IP text returned a safe typed 503 because the local runtime cannot establish the visitor's public IP. Full repository check reports only the documented baseline formatting issues in `PROMPT.md` and `README.md`.
  - Commit: `e808a6e`
- [x] Add API integration tests for all `/me` endpoints, IPv4/IPv6, unavailable fields, `Accept` variants, no-store behavior, errors, and redaction.
  - Verified: 21 API handler integration cases exercise every route and schema, IPv4/IPv6 identity, local unavailable IP, weighted/wildcard Accept negotiation, no-store, typed 404/406/503 errors, and cookie/authorization exclusion. All 234 unit tests and strict typecheck pass; targeted Ultracite passes. Full repository check reports only the documented baseline formatting issues in `PROMPT.md` and `README.md`.
- [ ] Build the visitor overview with IP, ASN/network, location, edge, connection, and security panels that distinguish missing data honestly.
- [ ] Add the safe raw JSON viewer/export, copy controls, responsive states, and dashboard browser tests.

## Phase 5 — Public network intelligence

- [ ] Implement validated IP and CIDR lookup routes/pages, using legitimate sources and never treating current-request `request.cf` data as arbitrary-IP enrichment.
- [ ] Implement standards-based RDAP bootstrap/discovery for IP, ASN, and domain records with bounded upstream requests and normalization.
- [ ] Implement DNS lookup routes/pages for the requested record types using a documented resolver and TTL-aware caching.
- [ ] Implement replaceable public ASN/BGP enrichment for announced prefixes and origin information, with attribution and graceful partial results.
- [ ] Add public lookup cache policies, timeout/size/redirect protections, rate limiting, and provider failure tests.
- [ ] Build lookup search and IP, ASN, domain, RDAP, DNS, and BGP detail views with provenance and uncertainty labels.

## Phase 6 — Diagnostics and mapping

- [ ] Implement verified Cloudflare colo, protocol, TLS, RTT, and available connection/security field display with units and availability.
- [ ] Implement real browser HTTP latency sampling and median/min/max/jitter calculations; label it as HTTP measurement rather than ICMP.
- [ ] Implement privacy-preserving browser diagnostics, kept distinct from edge-observed metadata.
- [ ] Add approximate IP and connected-colo maps using mapcn with trustworthy data, theme behavior, accessibility, and non-blocking lazy loading.
- [ ] Add tests for timing calculations, missing fields, map inputs, and browser diagnostic boundaries.

## Phase 7 — SDK, documentation, and release readiness

- [ ] Implement a small ESM typed fetch-based SDK with injectable fetch/base URL, schema-aligned results, and SDK tests if package boundaries permit.
- [ ] Prepare publishable package metadata/exports and Changesets conventions without publishing packages; verify npm naming before assigning public names.
- [ ] Write comprehensive Blume documentation for product, privacy, data sources, local modes, every implemented API route, SDK, development, and deployment.
- [ ] Generate or validate API documentation from canonical schemas/contracts and ensure docs builds detect stale required artifacts.
- [ ] Add consumer-facing READMEs, license/repository metadata, package contents checks, and runtime support declarations for publishable packages.

## Phase 8 — Hardening, deployment, and completion audit

- [ ] Complete unit, service integration, API integration, and Playwright coverage for implemented requirements.
- [ ] Audit input validation, SSRF boundaries, redirects, response sizes, rate limits, CORS/CSP, caching, logging, privacy, and metadata exposure.
- [ ] Validate local live/local/fixture modes, Windows workflows, HMR, SSR, bindings, and clean shutdown.
- [ ] Integrate the current `mynameistito/alchemy-deploy` action and artifact flow using immutable release pins and least-privilege CI; add no direct Wrangler deployment path.
- [ ] Validate web/docs builds, Alchemy configuration, CI-equivalent checks, package consistency, changesets, and generated artifacts.
- [ ] Re-read `PROMPT.md`, audit every requirement against code and command evidence, review all commits, and inspect final Git status.

## Final completion

- [ ] Every requirement in `PROMPT.md` audited
- [ ] Every implementation task completed
- [ ] Every completed implementation task committed
- [ ] Commits are atomic and logically scoped
- [ ] Ultracite passes
- [ ] Formatting passes
- [ ] Lint/static analysis passes
- [ ] Typechecking passes
- [ ] Unit tests pass
- [ ] Integration tests pass where applicable
- [ ] End-to-end tests pass where applicable
- [ ] Production build passes
- [ ] Relevant package builds pass
- [ ] Documentation is current
- [ ] Relevant ADRs exist
- [ ] Required changesets exist
- [ ] Deployment configuration verified
- [ ] Final Git diff/status reviewed
- [ ] No unintended working-tree changes remain
- [ ] Final `PROMPT.md` audit completed
