import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],

      // Scope, and why it is not `src/**`.
      //
      // Without an explicit `include`, v8 only measures files that some test
      // actually imported. Measured on this repo, that reports 70.35% lines -
      // and it is an illusion: adding a brand-new component that nothing
      // imports lowers the number by exactly nothing, so the gate would sit
      // green over the one case it most needs to catch. Widening to `src/**`
      // tells the truth (7.89% lines over 2015 lines) but that number is
      // dominated by untested UI and would only mean "the demo shell has no
      // tests", which is already known and is not what this gate is for.
      //
      // So the gate scopes to the perp workflow's logic core: the maths the
      // demo actually depends on, where a silent regression is a stage
      // failure. This mirrors the contracts side, which likewise gates
      // `INCLUDED_PREFIXES` rather than everything under `contracts/`.
      include: ["src/lib/perp.ts", "src/lib/perpConfig.ts"],

      // Floors. Measured at 76.74% lines / 60% branches when set.
      //
      // Deliberately a few points under the measurement, for the reason the
      // contracts floor records after its own first CI failure: a floor set at
      // the current number goes red on the next unrelated refactor and then
      // gets deleted by whoever is in a hurry. A floor a few points down still
      // catches a real drop.
      //
      // Branch data IS present here (unlike the Hardhat side, which emits line
      // records only), so branches are gated too.
      thresholds: {
        lines: 72,
        branches: 55,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
