import assert from "node:assert/strict";
import test from "node:test";
import { contentQualityReport, generateLocalWorldData } from "../scripts/build-local-world.mjs";

test("machine-readable content quality gates protect ranked and local goal play", async () => {
  const data = await generateLocalWorldData();
  const report = contentQualityReport(data);
  const serialized = JSON.stringify(report);

  assert.deepEqual(JSON.parse(serialized), report, "the report must stay JSON/machine readable");
  assert.equal(report.schemaVersion, 3);
  assert.match(report.graphVersion, /^3\./);
  assert.ok(report.authoredCoverage.authoredPairs >= 1_050);
  assert.ok(report.authoredCoverage.sameWordPairs >= 135);
  assert.equal(report.authoredCoverage.totalPairs, data.matrix.length);
  assert.equal(report.intentCoverage.attempts >= 750, true);
  assert.equal(report.intentCoverage.weightedCoverage, 1);
  assert.deepEqual(report.intentCoverage.failures, []);
  assert.equal(report.intentCorpus.attempts, report.intentCoverage.attempts);
  assert.ok(report.intentCorpus.sameWordAttempts >= 80);
  assert.ok(report.officialTargetCount >= 30);
  assert.ok(Object.values(report.difficultyBands).every((count) => count > 0));

  assert.ok(report.routeValidity.checked > report.officialTargetCount);
  assert.equal(report.routeValidity.reachable, report.routeValidity.checked);
  assert.equal(report.routeValidity.withinLimit, report.routeValidity.checked);
  assert.deepEqual(report.routeValidity.failures, []);

  assert.equal(report.dailyRotation.cycleLength, 90, "the local catalog should ship a ninety-challenge Daily season");
  assert.equal(report.dailyRotation.distinctChallenges, 90);
  assert.ok(report.dailyRotation.distinctTargets >= 28, "Daily should rotate for at least four weeks without repeating a target");
  assert.equal(report.dailyRotation.distinctModifiers, 3);
  assert.ok(report.outputConcentration.distinctOutputs >= 715);
  assert.ok(report.outputConcentration.maximumPairsPerOutput <= 5);
  assert.ok(report.outputConcentration.maximumShare < 0.01);
  assert.ok(report.logicalSpotChecks.length >= 10);
  assert.ok(report.logicalSpotChecks.every((check) => check.pass));

  assert.equal(report.worldGraph.schemaVersion, 3);
  assert.equal(report.worldGraph.validationIssues.length, 0);
  assert.ok(report.worldGraph.topology.intentionalTerminalDeadEndCount >= 190);
  assert.ok(report.worldGraph.topology.problematicDeadEndCount <= report.worldGraph.topology.problematicDeadEndLimit);
  assert.equal(report.worldGraph.topology.deadEndCount, report.worldGraph.topology.problematicDeadEndCount);
  assert.ok(report.worldGraph.topology.thinConceptCount <= 220);
  assert.equal(report.worldGraph.targets.reachable, report.worldGraph.targets.count);
  assert.equal(
    report.worldGraph.targets.withMultipleFinalRecipes,
    report.worldGraph.targets.count,
    "every official goal should retain alternate final combinations"
  );
  assert.ok(report.worldGraph.targets.withMultipleOpenings >= 12, "official routes should not all share one opening branch");
  const energyBottleneck = report.worldGraph.topology.bottlenecks.find((item) => item.word === "Energy");
  assert.ok((energyBottleneck?.share || 0) <= 0.2, "Energy must not dominate shortest official routes");
});
