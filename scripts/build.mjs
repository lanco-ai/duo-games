import { build } from "vite";
import { build as bundle } from "esbuild";
await build();
await bundle({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/server.js",
  packages: "external",
});
