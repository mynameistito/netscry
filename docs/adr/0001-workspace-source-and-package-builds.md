# ADR 0001: Workspace source and consumer package builds

- Status: Accepted
- Date: 2026-10-27

## Context

The `@netscry/core`, `@netscry/schemas`, and `@netscry/sdk` workspaces currently export TypeScript source for local development. The SDK is intended to become usable outside this repository. Node.js supports type stripping for local TypeScript files, but its loader refuses TypeScript files located under `node_modules`; publishing the current source-only export would therefore fail for Node consumers. See the [Node.js TypeScript documentation](https://nodejs.org/api/typescript.html).

The web app and Bun workspace can continue to resolve TypeScript source during development, while Node consumers need standard ESM JavaScript and declaration files.

## Decision

Keep TypeScript source entrypoints for Bun and development-mode workspace resolution. Build and expose ESM JavaScript plus `.d.ts` declarations for standard package imports. Build the packages in dependency order: `@netscry/core`, then `@netscry/schemas`, then `@netscry/sdk`.

Package source and test files remain outside the published file whitelist; distribution artifacts and consumer-facing documentation are included when the package manifests are prepared. All packages remain private until npm naming and licensing are resolved. This decision does not authorize publishing.

## Consequences

- Workspace development can continue to use source files and hot reload.
- A clean build must generate package outputs before Node consumer verification and production consumers run.
- Package tests must check both source behavior and the built Node entrypoints.
- Package name and license decisions remain separate from the build boundary.
