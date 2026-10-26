# Package changesets

After a package is approved for publication and its manifest is no longer private, run `bun run changeset` for package changes and add the generated file to the same commit as the implementation. Select the affected package, choose the semver impact, and write a user-facing summary.

Private packages are excluded from versioning and tagging. Review the generated version and changelog changes with `bun run changeset:version`. This repository has no publishing command; publishing remains disabled until package names and licensing are resolved and release approval is given.

See the [Changesets configuration guide](https://changesets.dev/guide/config) for the available release settings.
