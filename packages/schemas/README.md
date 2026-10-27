# `@netscry/schemas`

Canonical Effect Schema contracts and inferred TypeScript types shared by the NetScry API, documentation generator, and SDK. Contracts cover API errors and health, current-request metadata, public IP/ASN/BGP lookups, DNS, and RDAP records, including field availability and provenance.

## Workspace use

This package is private and is not currently available from npm. From the repository root:

```sh
bun install
bun run build:packages
```

Import schemas and types from the public entrypoint, for example:

```ts
import { ApiHealthResponseSchema } from "@netscry/schemas";
import { Schema } from "effect";

const isHealthResponse = Schema.is(ApiHealthResponseSchema);
```

The package depends on `@netscry/core` and Effect. Its build emits ESM and TypeScript declarations under `dist/`; the manifest currently declares Node.js 20 or newer.

## Development

Keep wire contracts here so the server, clients, and generated API reference share the same definitions. Run the repository's test and validation commands from the root with `bun run test` and `bun run check:code`.
