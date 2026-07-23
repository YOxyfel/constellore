import { fileURLToPath } from "node:url";
import { generateLocalWorldData } from "./build-local-world.mjs";

export async function generateWorldGraphAudit() {
  const data = await generateLocalWorldData();
  return structuredClone(data.worldGraph);
}

const isMainModule = Boolean(process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`)));

if (isMainModule) {
  const report = await generateWorldGraphAudit();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`World Graph ${report.graphVersion}`);
    console.log(`${report.totals.recipes} deterministic recipes · ${report.totals.reachableConcepts}/${report.totals.concepts} reachable concepts`);
    console.log(`${report.intentCoverage.covered}/${report.intentCoverage.attempts} expected attempts covered · ${(report.intentCoverage.weightedCoverage * 100).toFixed(1)}% weighted`);
    console.log(`${report.targets.reachable}/${report.targets.count} official targets reachable · ${report.targets.withMultipleFinalRecipes} with alternate final recipes`);
    console.log(`${report.topology.intentionalTerminalDeadEndCount} intentional endpoints · ${report.topology.problematicDeadEndCount} problematic dead ends · ${report.topology.thinConceptCount} concepts with one or fewer continuations`);
    if (report.validationIssues.length) {
      console.error(report.validationIssues.join("\n"));
      process.exitCode = 1;
    }
  }
}
