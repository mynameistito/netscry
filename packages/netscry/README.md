# `netscry`

The top-level NetScry npm package. It brings together `@netscry/core`, `@netscry/schemas`, and `@netscry/sdk` under the unscoped `netscry` package. The scoped packages remain independently installable.

## Usage

```ts
import { Effect } from "effect";
import { createNetScryClient } from "netscry";

const client = createNetScryClient({
  baseUrl: "https://netscry.mynameistito.com",
});

const health = await Effect.runPromise(client.health());
```

The core utilities and schemas are available from package subpaths:

```ts
import { parseIpAddress } from "netscry/core";
import { ApiHealthResponseSchema } from "netscry/schemas";

const address = parseIpAddress("1.1.1.1");
const healthSchema = ApiHealthResponseSchema;
```

The client uses standard Fetch APIs, validates responses against the shared contracts, and returns Effects with typed SDK failures. `me()` reports the IP address of the request reaching NetScry; when called from a server, this is generally the server's egress IP, not its original visitor's IP.

## Runtime and package contents

The package supports Node.js 20 or newer and other runtimes with standard Fetch APIs. Its npm tarball contains the ESM entry point, TypeScript declarations, README, and MIT license only.

## Development

From the repository root, run `bun run build:packages` to build all workspace libraries. `bun run verify:packages` also exercises this package from Node without Bun workspace source aliases.
