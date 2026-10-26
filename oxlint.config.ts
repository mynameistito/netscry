import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";
import vitest from "ultracite/oxlint/vitest";

const jsPlugins = selectJsPlugins([
  "github",
  "jsdoc-js",
  "tsdoc",
  "sonarjs",
  "react-doctor",
]);

export default defineConfig({
  env: core.env,
  extends: [
    core,
    react,
    tanstack,
    vitest,
    tanstackJsPlugins,
    shadcn,
    antiSlop,
    jsPlugins,
  ],
  // mapcn's copied MapLibre lifecycle code is checked by strict TypeScript and
  // the production build; upstream effect/ref patterns conflict with local lint rules.
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "packages/ui/src/components/map.tsx",
  ],
  jsPlugins: [...jsPlugins.jsPlugins, ...shadcn.jsPlugins],
  options: { typeAware: true },
  settings: jsPluginSettings,
});
