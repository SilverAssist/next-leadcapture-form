import { defineConfig } from "tsdown";

// Single-entry client component -- every export in this package needs the
// "use client" boundary, so the whole bundle carries the directive (unlike
// @silverassist/recaptcha's split client/server build).
export default defineConfig({
  entry: ["src/index.tsx"],
  banner: '"use client";',
  format: ["cjs", "esm"],
  fixedExtension: false,
  dts: { sourcemap: false },
  clean: true,
  sourcemap: true,
  deps: { neverBundle: ["react", "react-dom", "next"] },
  treeshake: true,
  minify: false,
});
