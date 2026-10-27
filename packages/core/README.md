# `@netscry/core`

Shared, runtime-neutral networking helpers used by NetScry's API and SDK. The package includes IP/CIDR and ASN parsing, domain normalization, DNS record parsing, network formatting and distance helpers, and a small `Result` type.

## Workspace use

Version `0.1.1` is published on npm as `@netscry/core`. From the repository root, build the workspace artifacts with:

```sh
bun install
bun run build:packages
```

Import its public entrypoint with `import { parseIpAddress, parseCidr } from "@netscry/core"`. Consumers should use the package exports rather than reaching into `src` files. The build emits ESM and TypeScript declarations under `dist/`; the package manifest currently declares Node.js 20 or newer.

## Development

Run the repository's focused tests with `bun run test` and format/lint checks with `bun run check:code`.
