# ADR 0001: Bound and pin external provider requests

- Status: Accepted
- Date: 2026-10-27

## Context

Public lookup features will call external RDAP, DNS, ASN, and BGP providers with parts of the request derived from visitor input. Those calls must not become an arbitrary URL fetcher, follow a provider redirect to another host, wait without limit, buffer unbounded bodies, or expose upstream response details in errors. The backend uses Effect v4 and Cloudflare Workers, so the policy should use the Effect HTTP client and Web APIs supported by Workers.

## Decision

- Use Effect v4 `HttpClient` with the fetch implementation for Workers.
- Configure provider origins in server-owned Layers. Each request names a configured provider, and its HTTPS URL must resolve to that provider's exact origin. Reject credentials, fragments, unknown providers, and non-HTTPS origins before sending a request.
- Set Fetch redirect handling to `manual`; treat redirect responses as provider status failures so a provider cannot redirect a request to an unapproved host.
- Bound each request to at most eight seconds total, two transient retries, and one mebibyte of response content. A provider can choose tighter request limits but cannot raise these caps.
- Stream response bytes through the size limit before JSON parsing, then decode the result with the caller's Effect Schema.
- Return a shared typed error containing only provider id, operation id, safe failure reason, optional HTTP status, and retryability. Do not retain the request URL, upstream body, headers, or transport cause in that error.

## Consequences

Provider services must declare fixed origins in their Layer configuration. Provider-discovery protocols such as RDAP must validate discovered origins before adding them to a trusted provider Layer. Large provider datasets need a separate bounded streaming design instead of raising the shared response cap. Callers receive consistent typed failures and can safely decide whether partial results or cache fallbacks are appropriate.
