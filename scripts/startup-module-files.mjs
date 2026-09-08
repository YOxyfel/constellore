import { build } from "esbuild";

// The offline entry must include its complete static import graph. Optional
// imports stay outside this graph and retain their existing lazy boundaries.
export async function startupModuleFiles(directory, entryPoints = ["app.js", "hero-recipes.mjs"]) {
  const result = await build({
    absWorkingDir: directory,
    entryPoints,
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    outdir: ".startup-graph",
    logLevel: "silent",
    plugins: [{
      name: "startup-static-imports",
      setup(buildApi) {
        buildApi.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === "dynamic-import") return { path: args.path, external: true };
          return undefined;
        });
      }
    }]
  });
  return [...new Set(Object.keys(result.metafile.inputs)
    .map((path) => path.split("?", 1)[0].replaceAll("\\", "/")))]
    .sort((left, right) => left.localeCompare(right, "en"));
}
