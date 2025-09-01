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
        resolve: ["playwright-core"],
    },
    copy: ["./README.md", "./LICENSE"],
    shims: false,
    nodeProtocol: true,
    minify: false,
    treeshake: true,
    hash: true,
    logLevel: "info",
    failOnWarn: true,
    exports: true,
});
