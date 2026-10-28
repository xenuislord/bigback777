import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["apps/server/src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist-server",
  external: ["electron", "node:sqlite"],
  removeNodeProtocol: false,
});
