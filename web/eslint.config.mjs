import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strict,
  {
    rules: {
      // New with Next 16's React Compiler rules. The flagged effects are deliberate: reading
      // localStorage after mount (the static export can't read it while prerendering), seeding a
      // form from fetched data, and starting a fetch. Moving them to useSyncExternalStore / keyed
      // remounts is a separate refactor.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**", "next-env.d.ts"]),
]);
