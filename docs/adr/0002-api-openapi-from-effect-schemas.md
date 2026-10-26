# ADR 0002: Generate the NetScry OpenAPI document from Effect schemas

- Status: Accepted
- Date: 2026-10-27

## Context

NetScry's HTTP response contracts are defined by Effect schemas in `packages/schemas`. The API guide describes the route behavior, but the documentation site's generated `openapi.json` describes Blume's own search and MCP endpoints. Treating that file as the NetScry API reference would expose the wrong contract, while maintaining a separate handwritten response schema would allow the API and its reference to drift.

## Decision

Generate a versioned OpenAPI 3.1 document for `/api/v1` from the canonical Effect response schemas using Effect's JSON Schema document conversion. Keep HTTP-only metadata—paths, parameters, descriptions, status codes, and content negotiation—in a focused docs generator. Compare the generated route inventory with the web application's API route files so adding or removing an endpoint requires updating the specification mapping.

Check the committed static specification during docs checks and builds. Provide an explicit generation command for intentional contract updates. Keep the static `/api/v1/openapi.json` artifact distinct from Blume's `/openapi.json`, which remains the docs site's own API description.

## Consequences

- Response shapes remain sourced from the schemas used by the API and SDK.
- Route metadata still requires review because Effect schemas do not define HTTP paths, cache policies, or media negotiation.
- A stale or missing generated specification fails docs validation and production builds.
- The NetScry API reference can be consumed without running the Worker, and the docs site's own service OpenAPI remains unchanged.
