# `@netscry/sdk`

Typed Fetch client for the versioned NetScry HTTP API. Requests use standard `fetch`, successful JSON responses are checked against `@netscry/schemas`, and client methods return Effect values with typed `NetScrySdkError` failures.

## Availability

The SDK and its shared dependencies are private workspace packages. They are not currently published to npm. Inside this repository, build the packages before importing the generated ESM from a Node consumer:

```sh
bun install
bun run build:packages
```

The package manifest declares Node.js 20 or newer and the implementation uses the standard Fetch API. React, Worker framework, and website infrastructure packages are not SDK dependencies.

## Usage

```ts
import { createNetScryClient } from "@netscry/sdk";
import { Effect } from "effect";

const client = createNetScryClient({
  baseUrl: "https://netscry.example",
});

const health = await Effect.runPromise(client.health());
const network = await Effect.runPromise(client.lookupNetwork("1.1.1.1"));
```

The base URL must be an HTTP or HTTPS origin. You can inject a Fetch-compatible function for custom transport or tests. See the [SDK guide](../../apps/docs/content/sdk/index.mdx) for supported methods, error handling, and examples.

## Current-request behavior

The `me()` method reports metadata for the request that reaches NetScry. When called from a server, that is generally the server's public egress IP, not the original website visitor's address. The SDK does not provide header-spoofing options to change this behavior.

## Development

Run `bun run build:packages` and `bun run verify:packages` from the repository root to build the ESM/declaration outputs and exercise a Node consumer. `bun run test` runs the package and repository test suites.
