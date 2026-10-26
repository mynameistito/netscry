# NetScry — Complete Production Implementation Specification

## Role and mission

You are the lead architect and implementing engineer for **NetScry**, an open-source, Cloudflare-native IP intelligence, network diagnostics and developer tooling platform.

Build the project end-to-end in the existing repository.

NetScry should combine the capabilities of IPinfo, IP geolocation tools, WHOIS/RDAP explorers, ASN/BGP intelligence platforms, DNS lookup services, and Cloudflare connection diagnostics into one cohesive product.

Its distinguishing feature is **comprehensive visibility into the requesting visitor's Cloudflare connection metadata**, with useful explanations, real diagnostics, publicly available network enrichment, an excellent web interface, and a clean developer API.

The project must be structured as a **maintainable TypeScript monorepo** supporting:

- A production Cloudflare-hosted web application.
- A public REST API.
- A Blume documentation site.
- Reusable, independently testable packages.
- An eventual public npm SDK.
- Shared Effect Schema contracts.
- Reusable shadcn/ui and mapcn components.
- Alchemy-managed infrastructure.
- Deployment through the existing `mynameistito/alchemy-deploy` workflow.

**Implement working code, not just a proposal.**

Research relevant current documentation before implementation, preserve existing repository conventions, and verify the result.

Do not deploy to production without explicit approval.

---

# 1. Initial repository audit

Before making changes:

1. Inspect the complete repository.
2. Read `AGENTS.md`, README, package manifests, configuration, existing source code and GitHub workflows.
3. Determine the existing package manager and lockfile.
4. Inspect existing Ultracite integration.
5. Identify pre-existing applications, packages, tests and deployment configuration.
6. Inspect the current Alchemy version and current Cloudflare bindings.
7. Inspect the latest compatible Effect v4 APIs.
8. Inspect current TanStack Start and shadcn/ui monorepo guidance.
9. Inspect mapcn's official component APIs.
10. Inspect Blume's current project structure, configuration and deployment model.
11. Inspect `mynameistito/alchemy-deploy`, including actual reusable workflow interfaces and consumer examples.
12. Identify potential compatibility problems before changing dependencies.

Relevant references:

- https://github.com/mynameistito/alchemy-deploy
- https://alchemy.run
- https://effect.website
- https://tanstack.com/start
- https://ui.shadcn.com
- https://www.mapcn.dev
- https://www.npmjs.com/package/blume
- https://developers.cloudflare.com/workers/

Follow verified current APIs. Do not invent package exports, workflow inputs, Blume configuration keys or Alchemy binding interfaces.

Preserve existing working functionality wherever possible.

---

# 2. Mandatory technology stack

| Area                     | Technology                                   |
| ------------------------ | -------------------------------------------- |
| Monorepo                 | Bun workspaces                               |
| Web framework            | TanStack Start                               |
| Routing                  | TanStack Router                              |
| Server/business logic    | Effect v4                                    |
| Validation and contracts | Effect Schema                                |
| Frontend async data      | TanStack Query where appropriate             |
| UI components            | shadcn/ui                                    |
| Styling                  | Tailwind CSS v4                              |
| Maps                     | mapcn + MapLibre GL                          |
| Icons                    | Lucide                                       |
| Documentation            | Blume                                        |
| Infrastructure           | Alchemy                                      |
| Runtime and hosting      | Cloudflare Workers                           |
| Language                 | TypeScript, strict mode                      |
| Formatting and linting   | Existing Ultracite                           |
| Unit/integration tests   | Vitest                                       |
| Browser tests            | Playwright                                   |
| Package publishing       | Changesets, when packages become publishable |
| Deployment               | `mynameistito/alchemy-deploy`                |

Prefer current stable, mutually compatible releases.

Use the existing package manager if migrating to Bun would unnecessarily disrupt a working repository. Otherwise standardize on Bun and one committed lockfile.

Do not introduce unrelated tools, frameworks, ORMs or persistent resources without justification.

---

# 3. Monorepo architecture

Organize the project so application, documentation, reusable libraries and infrastructure have clear ownership boundaries.

Target structure:

```text
netscry/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── features/
│   │   │   ├── server/
│   │   │   ├── hooks/
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── components.json
│   │   └── package.json
│   │
│   └── docs/
│       ├── docs/
│       │   ├── index.mdx
│       │   ├── getting-started/
│       │   ├── api/
│       │   ├── guides/
│       │   ├── cloudflare/
│       │   └── development/
│       ├── blume.config.ts
│       └── package.json
│
├── packages/
│   ├── core/
│   │   └── src/
│   ├── schemas/
│   │   └── src/
│   ├── client/
│   │   └── src/
│   ├── ui/
│   │   └── src/
│   └── config/
│
├── infra/
│   └── ...
│
├── .github/
│   └── workflows/
│
├── .changeset/
├── package.json
├── tsconfig.json
├── bun.lock
├── AGENTS.md
└── README.md
```

Adapt the exact layout to the existing repository and current framework conventions.

Do not blindly create empty packages or directories.

## 3.1 `apps/web`

The main application.

Responsibilities:

- Visitor dashboard.
- Public REST API.
- IP intelligence search.
- ASN and BGP exploration.
- Domain and DNS exploration.
- WHOIS/RDAP information.
- Cloudflare edge diagnostics.
- Browser and network diagnostics.
- Maps and visualizations.
- API playground.
- Public lookup pages.

Use TanStack Start with a Cloudflare-compatible deployment adapter.

Ensure the full-stack framework works correctly with Workers, request context and native bindings.

Do not introduce a separate API Worker unless there is a measurable architectural benefit.

## 3.2 `apps/docs`

A dedicated Blume documentation application.

Use Blume's documented Markdown/MDX conventions, navigation, search and available documentation features.

Do not replace Blume with another documentation framework.

The documentation app should be an actual runnable workspace with its own development and build commands.

Support local development concurrently with the web application.

Prepare documentation for a future `docs` subdomain without configuring live DNS automatically.

## 3.3 `packages/core`

Framework-agnostic network utilities.

Responsibilities:

- IPv4 parsing.
- IPv6 parsing.
- IP normalization.
- IP classification.
- CIDR parsing and calculations.
- ASN normalization.
- Domain normalization.
- DNS record utilities.
- Network data formatting.
- Geographic distance calculations.
- RTT/jitter calculations.
- Pure networking helpers.

Keep browser, server and Cloudflare-specific concerns out of this package unless explicitly documented and unavoidable.

Use portable TypeScript and Web Standard APIs.

Design it to be usable by future Node.js, Bun, browser and Workers consumers.

## 3.4 `packages/schemas`

Shared Effect Schema contracts.

Responsibilities:

- Public API response schemas.
- Network and visitor data models.
- RDAP and DNS normalization contracts.
- ASN models.
- Edge and diagnostics models.
- Structured error types.
- Data provenance.
- Availability states.

Infer TypeScript types from schemas.

Avoid duplicating types manually throughout the monorepo.

Keep this package independent of Cloudflare runtime objects and internal application services.

This package should eventually be publishable independently if there is sufficient demand.

## 3.5 `packages/client`

A future public npm SDK.

Create a small but genuinely functional typed client if doing so is straightforward, rather than publishing an empty placeholder.

The package is **not required to be published now**.

Suggested eventual package name:

`@mynameistito/netscry`

Verify npm naming availability and existing namespace conventions before committing public package metadata.

Design the package to support:

- Node.js.
- Bun.
- Browser environments.
- Cloudflare Workers.
- Other Web Standard-compatible JavaScript runtimes.

Use native `fetch` by default.

Allow users to inject their own fetch implementation and base URL.

Keep the package:

- ESM-first.
- Tree-shakeable.
- Lightweight.
- Side-effect-free where practical.
- Fully typed.
- Compatible with documented runtime support.
- Free of Node-specific runtime requirements.
- Independent from the website's React and infrastructure dependencies.

Example target usage:

```ts
import { NetScry } from "@mynameistito/netscry";

const client = new NetScry();

const ip = await client.me.ip();
const asn = await client.me.asn();
const info = await client.ip.lookup("1.1.1.1");
```

**Critical behaviour:** `/me` endpoints identify the IP address of the request reaching NetScry.

When the SDK runs in a server, the result is generally the server's public egress IP, not the original application user's IP.

Document this explicitly and do not create unsafe header-spoofing options as a workaround.

Make the SDK architecture future-proof, but prioritize the web application and real API.

Do not publish npm packages without approval.

## 3.6 `packages/ui`

A reusable component and design-system package.

Use shadcn/ui primitives and mapcn as the foundation.

Share components where they are genuinely useful across applications.

Keep React and browser-only dependencies out of core/schema packages.

Do not create circular dependencies.

Set up shadcn's monorepo-aware CLI and component paths correctly.

## 3.7 `packages/config`

Use only for genuinely shared configuration.

Potential candidates include shared TypeScript presets and carefully factored build/test configuration.

Do not force every application to share configuration that actually needs to differ.

---

# 4. Workspace and dependency management

Use proper workspace package boundaries.

Requirements:

- Explicit package names.
- Correct internal workspace dependencies.
- No accidental circular imports.
- No imports into another package's private `src` directory.
- Correct package exports.
- TypeScript project references where they genuinely improve the build.
- Clear dependency ownership.
- Reproducible lockfile.
- Deterministic CI installation.
- No unnecessary duplicated framework dependencies.

Prefer workspace package imports over fragile cross-directory aliases.

Do not create a complicated monorepo build system unless it provides a real advantage.

Use workspace scripts for development, checking, building and testing.

Suggested root commands:

```text
bun run dev
bun run dev:web
bun run dev:docs
bun run build
bun run check
bun run typecheck
bun run test
bun run test:e2e
```

`bun run dev` should start both applications when practical.

Use a robust, cross-platform orchestration method.

Avoid Unix-only shell constructs and fragile background process scripts.

Work well on Windows and PowerShell 7.

---

# 5. Effect v4 architecture

Use Effect as the primary backend/domain programming model.

Effect should handle meaningful application behaviour and managed side effects.

Use it for:

- Service composition.
- Dependency injection.
- Schema validation.
- HTTP operations.
- External provider integrations.
- Async concurrency.
- Retry/timeout policies.
- Cache access.
- Typed errors.
- Structured logging.
- Request processing.
- Resource lifecycle management.
- Result normalization.
- Testable business logic.

Use current Effect v4 APIs.

Suggested services:

```text
VisitorMetadataService
CloudflareEdgeService
IpIntelligenceService
RdapService
DnsService
AsnService
BgpService
NetworkDiagnosticsService
CacheService
```

Separate service interfaces from live, test and fixture implementations.

Use Layers where appropriate.

Avoid unnecessarily creating one Effect runtime per API request or React render.

Keep request-scoped data properly scoped.

Never share one visitor's request metadata with another visitor through global mutable state.

### Effect on the frontend

Use Effect when it meaningfully improves application behaviour, especially for shared schema parsing and complex async workflows.

Do not force Effect onto trivial React state, JSX or simple event handlers.

Use TanStack Query for client-facing remote state where beneficial.

Keep the boundary between Effect services, TanStack loaders/server functions and React components clear.

Use reusable hooks and presentation components.

---

# 6. Alchemy and Cloudflare infrastructure

Use Alchemy as the canonical infrastructure definition.

**Prefer native Alchemy bindings wherever supported.**

Requirements:

- Resource definitions in code.
- Typed binding access.
- Stage isolation.
- Local resource support.
- Native Workers APIs.
- Minimal permissions.
- Deterministic resource naming.
- No manually duplicated resource IDs.
- No secrets committed to source control.
- No unnecessary Cloudflare REST API calls.
- Avoid Wrangler-specific configuration duplication when Alchemy manages the same resource.

Investigate the currently supported native Effect/Alchemy integration.

Potential resources:

- Worker with static assets.
- KV or Cache API for public enrichment caching.
- Native rate-limit bindings.
- Analytics Engine where appropriate.
- Service Bindings only when justified.
- D1 only if persistent relational data becomes necessary.

Do not provision Durable Objects, D1 or queues simply because they are available.

Optimize for the Cloudflare Free plan and predictable billing.

Clearly document any paid-plan dependencies.

### Local development

Provide an excellent local development experience using the documented Alchemy development capabilities.

Requirements:

- Local Workers-compatible execution.
- Hot reload.
- Functional frontend and API.
- Locally available/emulated bindings.
- No production credentials for normal development.
- Minimal required setup.
- No production deployment during development.
- Clear error reporting.

---

# 7. Comprehensive Cloudflare visitor metadata

The primary feature is discovering and exposing every useful Cloudflare request metadata field made available to this Worker.

Inspect the current Cloudflare Workers type definitions and official documentation.

Do not assume the following inventory is exhaustive.

## 7.1 Visitor identity

Include:

- Public IPv4/IPv6.
- IP version.
- ASN.
- AS organisation.
- Available network ownership metadata.
- Related CIDR allocations through enrichment.

Use trusted Cloudflare request metadata rather than arbitrary user-controlled forwarded headers.

Handle local development separately and honestly.

## 7.2 Geographic information

Capture available fields such as:

- Country.
- Continent.
- Region.
- Region code.
- City.
- Postal code.
- Latitude.
- Longitude.
- Timezone.
- Metro code.
- EU country indicator.

Provide a map, but clearly state geolocation is approximate.

## 7.3 Cloudflare edge information

Include:

- Connected colo.
- Ray ID where available.
- Available request routing metadata.
- HTTP protocol.
- TLS information.
- Transport measurements.

Add other useful supported fields discovered in the current Worker runtime.

## 7.4 TLS and connection

Include available:

- TLS version.
- Cipher.
- ClientHello-derived metadata.
- TCP RTT.
- QUIC RTT.
- Estimated TCP delivery rate.
- HTTP protocol.
- Original accepted encoding.
- Relevant transport information.

Explain units and availability.

## 7.5 Security information

Inspect supported:

- JA3.
- JA4.
- Bot scores.
- Verified bot indicators.
- Detection metadata.
- Mutual TLS information.
- Other request security attributes.

Implement only fields actually accessible to the application.

Some information depends on Cloudflare plan, enabled products or request type.

Do not invent values or require upgrades without approval.

Do not expose sensitive cryptographic material or private security data merely because the underlying platform makes it accessible.

## 7.6 Raw metadata

Implement the most comprehensive **safe** raw Cloudflare metadata endpoint and JSON viewer possible.

Preserve original field names.

Handle newly introduced safe fields where practical.

Redact sensitive material.

Do not blindly serialize request objects, cookies, authorization headers or secrets.

Each field should identify:

- Source.
- Value.
- Availability.
- Units.
- Reason for absence.
- Sensitivity classification where relevant.

Separate the raw representation from the normalized presentation model.

---

# 8. Public REST API

Build a clean, versioned API suitable for terminal tools, applications, monitoring scripts and an eventual npm SDK.

Prefix:

`/api/v1`

All endpoints must use shared Effect services and Effect Schema contracts.

## 8.1 Complete `/me` API

Required endpoints:

```http
GET /api/v1/me
GET /api/v1/me/ip
GET /api/v1/me/asn
GET /api/v1/me/location
GET /api/v1/me/network
GET /api/v1/me/edge
GET /api/v1/me/connection
GET /api/v1/me/security
GET /api/v1/me/headers
GET /api/v1/me/trace
GET /api/v1/me/raw
```

Add additional useful granular endpoints where they genuinely improve the API.

Examples might include:

```http
GET /api/v1/me/country
GET /api/v1/me/colo
GET /api/v1/me/tls
GET /api/v1/me/protocol
```

These should reuse the same underlying request metadata extraction.

Do not duplicate extraction logic per endpoint.

Do not create expensive database reads or external calls for basic self-lookup endpoints.

### `/me/ip`

Return public IP and version.

Example:

```json
{
  "ip": "203.0.113.42",
  "version": 4
}
```

### `/me/asn`

Example:

```json
{
  "asn": 13335,
  "name": "CLOUDFLARENET"
}
```

These are illustrative API contract examples, not live visitor results.

### Plain-text support

Support `Accept: text/plain` for endpoints with an unambiguous single value.

Examples:

```bash
curl -H "Accept: text/plain" \
  https://netscry.example/api/v1/me/ip

curl -H "Accept: text/plain" \
  https://netscry.example/api/v1/me/asn
```

Plain-text responses should contain only the value and an optional trailing newline.

No JSON envelope, HTML or decoration.

For non-scalar endpoints, return JSON and use correct content negotiation behaviour.

Return appropriate `406 Not Acceptable` responses for unsupported representations.

Define a consistent policy for `Accept` handling, including wildcards and missing headers.

### Fast paths

Optimize:

- `/me/ip`
- `/me/asn`
- `/me/country`
- `/me/colo`

These should extract only the relevant trusted request metadata and return immediately.

No KV, D1, external HTTP requests or enrichment required.

## 8.2 General network intelligence API

Implement:

```http
GET /api/v1/ip/:address
GET /api/v1/asn/:asn
GET /api/v1/domain/:domain
GET /api/v1/rdap/ip/:address
GET /api/v1/rdap/domain/:domain
GET /api/v1/dns/:domain
GET /api/v1/health
```

Support CIDR/network lookups where the available data sources make them viable.

Use canonical URL handling for IPv6 and CIDR strings.

Do not assume arbitrary-IP geolocation is available from `request.cf`; that metadata refers to the current request.

Use external enrichment only when required.

## 8.3 API standards

Requirements:

- Effect Schema validation.
- Stable JSON representations.
- Typed error responses.
- Explicit HTTP status codes.
- Appropriate caching.
- Rate limiting.
- API versioning policy.
- Source attribution.
- Correct IPv6 behaviour.
- Consistent null/unavailable handling.
- No unnecessary visitor tracking.
- Correct `Cache-Control: no-store` for visitor-specific data.
- Appropriate CORS and security headers.
- OpenAPI 3.1 documentation.

Generate OpenAPI from shared contracts where supported and practical, or validate it against implementation and tests.

Do not maintain multiple inconsistent definitions of the same API shape.

---

# 9. Public IP, ASN, DNS and domain intelligence

Build useful arbitrary lookup capabilities.

## IP intelligence

Include:

- IP address.
- IP family.
- Registration information.
- Network allocation.
- CIDR ranges.
- ASN.
- Network organisation.
- Geographic information where a legitimate source exists.
- Reverse DNS.
- Public abuse contacts.
- Available hosting/proxy/VPN classification.

Do not misrepresent uncertain geolocation or classifications as guaranteed facts.

## RDAP / WHOIS

Use authoritative RDAP sources with standards-compliant bootstrap/discovery.

Support:

- IP allocation records.
- ASN registration.
- Domain registration.
- Public entity records.
- Registry and registrar.
- Registration dates.
- Abuse contacts.
- Relevant network ranges.
- Raw RDAP output.

Avoid unauthorized scraping and respect upstream request limits.

## DNS

Support:

- A
- AAAA
- CNAME
- MX
- TXT
- NS
- SOA
- CAA
- PTR
- SRV

Use a documented resolver or DNS-over-HTTPS service.

Cache according to appropriate TTLs.

## ASN/BGP

Enrich ASN results using appropriate public providers.

Include where available:

- ASN holder.
- Announced IPv4 prefixes.
- Announced IPv6 prefixes.
- BGP origin information.
- Network ownership.
- Relevant public routing information.

Make provider integrations replaceable.

Avoid adding paid services without approval.

---

# 10. UI design system — shadcn/ui

Use shadcn/ui as the project's main component system.

Use Tailwind CSS v4 and centralized semantic tokens.

Design for a polished, modern developer-tool appearance.

Required:

- Dark mode.
- Light mode.
- System theme.
- Accessible focus states.
- Keyboard navigation.
- Responsive layouts.
- Skeleton loading states.
- Proper empty and error states.
- Copy-to-clipboard tools.
- Search.
- Good mobile usability.

Do not install competing component libraries.

Use shadcn's supported monorepo structure and CLI configuration.

## Reusable UI components

Create reusable components such as:

```text
AppShell
AppHeader
AppSidebar
PageHeader
SectionHeader
MetricCard
DataField
DataGrid
DataTable
DataSourceBadge
AvailabilityBadge
CopyValue
JsonViewer
EmptyState
ErrorState
LoadingState
IpAddressDisplay
AsnDisplay
NetworkCard
CloudflareEdgeCard
ConnectionDetails
TlsDetails
DnsRecordTable
RdapDetails
LookupSearch
```

Adapt naming to existing conventions.

Do not create abstractions without a second use case or a meaningful separation-of-concerns benefit.

Components should receive typed props and avoid performing unrelated business logic.

Shared network formatting belongs in `packages/core`.

Shared data contracts belong in `packages/schemas`.

---

# 11. Maps — mapcn

Use mapcn and MapLibre GL for all interactive maps.

Do not independently implement a competing mapping component system.

Required:

- Approximate IP geolocation map.
- Cloudflare connected-colo map.
- Relevant Cloudflare edge location visualization.
- Geographic distance comparisons where appropriate.
- Reusable markers and popups.
- Theme-aware map styles.
- Mobile support.
- Correct attribution.
- Graceful loading/error behaviour.

Suggested components:

```text
NetworkMap
IpLocationMap
CloudflareEdgeMap
EdgeLocationMarker
LocationPopup
MapLegend
MapThemeControls
```

Ensure proper SSR/client boundaries within TanStack Start.

Lazy-load heavy browser-only map code when sensible.

Do not allow the map bundle to block initial display of the visitor's IP address.

Do not rely on an unlicensed or unsuitable tile provider.

Do not fabricate data centre coordinates or treat geographic distance as network latency.

---

# 12. Network diagnostics

Provide real connection diagnostics.

Include:

- Connected Cloudflare colo.
- HTTP version.
- TLS version.
- Available Cloudflare RTT values.
- Browser-measured latency.
- Median/min/max latency.
- Jitter.
- Relevant browser network timing metrics.

Distinguish:

- Cloudflare-observed values.
- Browser-measured values.
- Derived calculations.
- Third-party enrichment.

A browser HTTP request is not an ICMP ping.

Do not mislabel it.

For Cloudflare edge comparisons, use only destinations that can genuinely be measured.

Do not fabricate global latency results.

Explain why the connected colo may differ from the geographically closest data centre.

---

# 13. Browser diagnostics

Provide browser-derived information including:

- Browser and available version information.
- Operating system where detectable.
- Device category.
- User-Agent.
- Preferred languages.
- Timezone.
- Screen resolution.
- Viewport.
- Device pixel ratio.
- Colour scheme.
- Reduced-motion setting.
- Available network information.
- Navigation timing.
- Supported browser capabilities.

Keep browser-derived values distinct from edge-observed data.

Avoid invasive fingerprinting or persistent tracking identifiers.

---

# 14. Blume documentation site

Build a comprehensive documentation website using **Blume**.

This is a first-class application in the monorepo, not a placeholder.

It must support local development and production builds.

Use Blume's native conventions for:

- Navigation.
- Markdown/MDX content.
- Search.
- Code highlighting.
- Theming.
- API documentation.
- SEO.
- AI-friendly documentation features supported by the installed release.

Do not assume an API documentation extension exists without verifying it.

If Blume does not support a feature directly, use a clean supported integration rather than replacing the framework.

## Documentation structure

Suggested sections:

### Introduction

- What is NetScry?
- Features.
- Why Cloudflare?
- Data sources.
- Accuracy limitations.
- Privacy model.

### Getting started

- Using the website.
- Understanding your IP.
- Understanding ASN information.
- Reading Cloudflare diagnostics.
- Using public lookup tools.

### REST API

- Overview.
- Authentication policy.
- Rate limits.
- Versioning.
- Response formats.
- Error handling.
- Content negotiation.
- Data provenance.

### `/me` API

Document each endpoint individually with real request and response examples.

### Network intelligence

- IP lookup.
- ASN lookup.
- RDAP.
- DNS.
- BGP.
- Edge diagnostics.

### JavaScript SDK

Prepare documentation for eventual npm publication.

Only describe capabilities that the implemented SDK actually provides.

### Cloudflare integration

- Available Worker metadata.
- Conditional fields.
- Free versus paid capabilities.
- Data availability.
- Edge behaviour.
- Local development limitations.

### Development

- Repository structure.
- Local setup.
- Testing.
- Effect services.
- Alchemy bindings.
- Adding features.
- Deployment.
- Contributing.

## API documentation generation

Prefer a single canonical API contract.

Generate reusable API documentation artifacts when practical.

Avoid manually duplicating all request and response schemas in multiple places.

Ensure docs builds fail when required generated artifacts are missing or stale.

---

# 15. Future npm publishing

Prepare the monorepo for future public package releases.

Use proper package manifests and exports.

For potentially publishable packages:

- Correct package names.
- Versioning strategy.
- TypeScript declarations.
- Export maps.
- README.
- License.
- Repository metadata.
- Test coverage.
- Build scripts.
- Package contents whitelist.
- Tree-shaking compatibility.
- Runtime compatibility declarations.

Use Changesets where appropriate.

Do not release a package now unless explicitly requested.

Keep the SDK separate from Worker-only code.

Prevent accidental inclusion of:

- Cloudflare secrets.
- Alchemy state.
- Infrastructure code.
- React website dependencies.
- Internal development fixtures.
- Credentials.
- Unrelated build artifacts.

Test package consumers where feasible.

The SDK should eventually be usable without installing TanStack Start, React, Alchemy or Cloudflare packages.

---

# 16. Developer experience

Local development is a high-priority acceptance criterion.

A developer should be able to:

1. Clone the repository.
2. Install dependencies.
3. Run one development command.
4. Open the web application.
5. Open the documentation site.
6. Exercise local API endpoints.
7. Make changes with fast feedback.

Use real local Workers-compatible behaviour where possible.

Support three explicit data modes:

**Live:** Data actually returned by Cloudflare.

**Local:** Data available from the local runtime.

**Fixture:** Deterministic, clearly labelled sample data used for development and tests.

Fixture mode must never silently impersonate a real production connection.

Ensure:

- Working HMR.
- Reliable SSR.
- Safe map hydration.
- Correct monorepo imports.
- Local binding setup.
- Predictable ports.
- Useful error messages.
- Windows/PowerShell compatibility.
- Clean process shutdown.

Document environment variables in an example file.

Avoid adding unnecessary credentials to local development.

---

# 17. Deployment — existing alchemy-deploy

All supported preview and production deployments must use:

https://github.com/mynameistito/alchemy-deploy

Inspect the current repository before adding workflows.

Verify:

- Reusable workflow references.
- Current release versions.
- Supported inputs.
- Required secrets.
- Required permissions.
- Production gating.
- PR preview policies.
- Teardown.
- Stage isolation.
- Concurrency.
- Stale commit protections.
- Fork security.

Use the actual reusable workflow interface.

Do not invent configuration.

Do not create a parallel direct-Wrangler deployment pipeline.

## Monorepo deployment considerations

The deployment system must correctly handle:

- The web application's workspace.
- Alchemy infrastructure.
- Root workspace dependencies.
- Required package builds.
- Internal packages.
- Environment-specific resources.
- Preview deployment cleanup.

Evaluate a separate Blume docs deployment.

If the reusable deployment workflow supports the docs app, use it.

If it does not, inspect its extension mechanisms and recommend the smallest supported integration.

Do not arbitrarily modify the shared deployment system or bypass its security model.

Keep production and preview resources isolated.

Never deploy production or modify live DNS without approval.

---

# 18. Security and privacy

Treat NetScry as a public internet-facing application.

Implement:

- Strict input validation.
- SSRF prevention.
- No arbitrary URL fetching.
- Explicit trusted upstream providers.
- External request timeouts.
- Response size limits.
- Safe redirect handling.
- Rate limiting.
- Appropriate CORS.
- Appropriate CSP.
- Secure error handling.
- Redacted logs.
- No exposed secrets.
- No unnecessary analytics trackers.
- No persistent fingerprint tracking by default.
- Minimal personal data retention.

Avoid caching visitor-specific `/me` responses in shared caches.

Public RDAP, ASN and DNS data may be cached appropriately.

Clearly document when external enrichment providers receive a queried IP address or domain.

Ensure unsafe metadata is not exposed through the raw endpoint.

Review Cloudflare-provided fields for sensitivity before public exposure.

---

# 19. Testing strategy

Use Vitest for unit and service integration tests.

Use Playwright for browser testing.

## Unit tests

Cover:

- IPv4/IPv6 parsing.
- CIDR calculations.
- ASN validation.
- Domain normalization.
- Effect Schema decoding.
- Cloudflare metadata extraction.
- Optional field handling.
- Data provenance.
- Redaction.
- Geographic distance calculations.
- Network timing calculations.
- SDK response handling.

## Integration tests

Cover:

- Effect service composition.
- Live/test Layers.
- API endpoints.
- Content negotiation.
- RDAP.
- DNS.
- ASN enrichment.
- Cache behaviour.
- Timeouts.
- Error responses.
- Provider failures.
- Partial results.
- Local Cloudflare bindings.

## E2E tests

Cover:

- Landing page.
- Visitor overview.
- Search.
- IP details.
- ASN details.
- Domain details.
- Raw JSON.
- Copy functionality.
- Theme switching.
- mapcn rendering.
- Map markers and popups.
- Mobile responsiveness.
- Accessible navigation.
- Error states.
- Documentation links.

## Monorepo checks

Ensure all workspaces participate in the appropriate checks.

Run:

```text
check
typecheck
test
test:e2e
build
```

Reuse existing Ultracite commands.

Verify web and docs builds independently.

Do not mark tests as passed unless they actually ran.

---

# 20. Performance and cost efficiency

Prioritize Cloudflare-native efficiency.

Requirements:

- Minimal request CPU time.
- Fast `/me` endpoints.
- Avoid unnecessary network round trips.
- Concurrent independent enrichment.
- Cached public lookup results.
- No shared caching of visitor-specific data.
- Static asset caching.
- Lazy-loaded maps.
- Appropriate bundle splitting.
- Minimal runtime dependencies.
- No unnecessary database usage.
- Graceful provider failures.
- Predictable Cloudflare resource consumption.

Avoid introducing background processing unless a concrete use case requires it.

Keep public lookup costs bounded.

---

# 21. Git, CI and code quality

Follow repository conventions.

Use small, verified commits.

Preserve commit signing where configured.

Do not weaken existing GitHub Actions security.

Avoid `pull_request_target` for untrusted code execution.

Do not expose deployment credentials to fork PRs.

Respect the existing `alchemy-deploy` validation and deployment policies.

Maintain appropriate changesets for publishable package changes.

Do not generate meaningless version bumps.

Run Ultracite after meaningful changes and fix failures.

Prefer straightforward, readable code over complicated abstractions.

Avoid broad unrelated refactors.

---

# 22. Implementation phases

Implement in this order.

### Phase 1 — Repository and monorepo foundation

- Audit the repository.
- Verify dependency compatibility.
- Configure workspaces.
- Establish app/package boundaries.
- Preserve Ultracite.
- Configure root scripts.
- Verify local builds.

### Phase 2 — Web, docs and UI foundation

- Set up TanStack Start.
- Set up Blume.
- Configure shadcn/ui.
- Configure mapcn.
- Establish reusable UI components.
- Implement navigation and themes.
- Verify concurrent local development.

### Phase 3 — Effect and Cloudflare integration

- Implement canonical Effect schemas.
- Implement service boundaries.
- Integrate Alchemy bindings.
- Implement request-scoped Cloudflare metadata extraction.
- Add safe raw JSON.
- Add local fixtures.

### Phase 4 — `/me` API and dashboard

- Build complete granular `/me` endpoints.
- Implement text/plain negotiation.
- Build network overview.
- Build geolocation and edge panels.
- Show missing fields appropriately.
- Add JSON viewer and export.

### Phase 5 — Public intelligence

- IP lookup.
- ASN lookup.
- RDAP.
- DNS.
- BGP enrichment.
- Public caching.
- Data provenance.
- Lookup detail pages.

### Phase 6 — Diagnostics and mapping

- mapcn IP map.
- Cloudflare edge map.
- Connection details.
- TLS/security details.
- Browser diagnostics.
- Live latency measurements.

### Phase 7 — SDK and documentation

- Implement the reusable typed API client where practical.
- Build complete Blume documentation.
- Add tested API examples.
- Prepare package manifests and release conventions.
- Keep package publishing disabled until approved.

### Phase 8 — Hardening and deployment

- Complete test coverage.
- Optimize performance.
- Review security and privacy.
- Validate local development.
- Validate all workspaces.
- Integrate existing `alchemy-deploy`.
- Prepare deployment without performing unauthorized production changes.

---

# 23. Definition of done

The implementation is complete when:

- The monorepo works from a clean clone.
- Web and Blume docs applications run locally.
- Root development commands work.
- Workspace dependencies resolve correctly.
- TanStack Start works on the Cloudflare target.
- shadcn/ui is the primary UI library.
- mapcn powers the maps.
- Reusable components are implemented.
- Effect v4 handles appropriate application logic.
- Effect Schema defines shared data contracts.
- Alchemy native bindings are used wherever supported.
- Cloudflare metadata is comprehensively supported.
- Raw data is safely redacted.
- Granular `/api/v1/me/*` endpoints work.
- Plain-text IP and ASN endpoints work.
- IPv4 and IPv6 are supported.
- IP lookup works.
- ASN enrichment works.
- RDAP works.
- DNS works.
- Network diagnostics produce real measurements.
- Missing fields are represented honestly.
- Browser and Cloudflare data are distinguished.
- Blume documentation is complete and buildable.
- Future npm SDK boundaries are established.
- The SDK is tested if implemented.
- Existing Ultracite checks pass.
- TypeScript checks pass.
- Automated tests pass.
- Web and docs production builds pass.
- Deployment configuration uses `mynameistito/alchemy-deploy`.
- No unauthorized production deployment occurs.

---

# 24. Completion report

At the end, provide:

1. Summary of implemented functionality.
2. Final monorepo structure.
3. Applications and packages created or modified.
4. Reusable component inventory.
5. Effect services and Layers.
6. Shared Effect schemas.
7. Cloudflare data inventory.
8. Native Alchemy bindings.
9. API endpoints implemented.
10. npm SDK status and eventual publication requirements.
11. Blume documentation coverage.
12. Local development instructions.
13. Test and build results.
14. Deployment integration details.
15. Known limitations.
16. Relevant commits and PR links if created.

Document incomplete requirements precisely.

Never present fixtures, mocked data or unsupported Cloudflare fields as real results.

Do not claim deployment or test success without verification.

---

# Final engineering directives

**Build a real, maintainable, Cloudflare-native network intelligence platform—not a demo or disconnected collection of tools.**

The project should be designed for long-term expansion.

Prioritize:

1. A clean monorepo with future npm publishing capability.
2. Complete, safe Cloudflare visitor metadata visibility.
3. Fast, granular developer API endpoints.
4. Effect-first backend architecture.
5. Reusable shadcn/ui components.
6. mapcn-based visualizations.
7. Proper Blume documentation.
8. Native Alchemy resource bindings.
9. An outstanding local development experience.
10. Secure deployment through the existing `alchemy-deploy` workflow.

Favor correctness and cohesive architecture over complexity.

Use the simplest practical approach whenever multiple solutions are possible.

Make reasonable implementation decisions independently. Do not repeatedly request confirmation for ordinary engineering choices.

Do not introduce paid services, publish npm packages, modify production DNS, or deploy to production without explicit approval.

Implement and verify the code systematically, leaving the repository in a clean, reviewable, production-ready state.
