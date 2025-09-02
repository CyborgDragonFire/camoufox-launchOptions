import { defineConfig } from "tsdown";

export default defineConfig({
    entry: "src/index.ts",
    outDir: "dist",
    format: ["esm"],
    platform: "node",
    target: ["es2024", "node22"],
    tsconfig: "./tsconfig.json",
    dts: {
        sourcemap: true,
        resolve: ["playwright-core", "zod/v4/mini", /^@types\//],
    },
    nodeProtocol: true,
    shims: false,
    hash: true,
    treeshake: true,
    minify: false,
    logLevel: "info",
    failOnWarn: true,
    exports: false,
});
