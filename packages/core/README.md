# `@netscry/core`

Shared, runtime-neutral networking helpers used by NetScry's API and SDK. The package includes IP/CIDR and ASN parsing, domain normalization, DNS record parsing, network formatting and distance helpers, and a small `Result` type.

## Workspace use

This package is private and is not currently available from npm. From the repository root:

```sh
bun install
bun run build:packages
```

Import its public entrypoint with `import { parseIpAddress, parseCidr } from "@netscry/core"`. Consumers should use the package exports rather than reaching into `src` files. The build emits ESM and TypeScript declarations under `dist/`; the package manifest currently declares Node.js 20 or newer.

## Development

Run the repository's focused tests with `bun run test` and format/lint checks with `bun run check:code`.
