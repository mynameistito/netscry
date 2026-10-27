# `netscry`

The top-level NetScry npm package. It re-exports the typed Fetch client from `@netscry/sdk`, giving consumers a short unscoped import while retaining the separately installable scoped packages.

## Usage

```ts
import { Effect } from "effect";
import { createNetScryClient } from "netscry";

const client = createNetScryClient({
  baseUrl: "https://netscry.mynameistito.com",
});

const health = await Effect.runPromise(client.health());
```

The client uses standard Fetch APIs, validates responses against the shared contracts, and returns Effects with typed SDK failures. `me()` reports the IP address of the request reaching NetScry; when called from a server, this is generally the server's egress IP, not its original visitor's IP.

## Runtime and package contents

The package supports Node.js 20 or newer and other runtimes with standard Fetch APIs. Its npm tarball contains the ESM entry point, TypeScript declarations, README, and MIT license only.

## Development

From the repository root, run `bun run build:packages` to build all workspace libraries. `bun run verify:packages` also exercises this package from Node without Bun workspace source aliases.
