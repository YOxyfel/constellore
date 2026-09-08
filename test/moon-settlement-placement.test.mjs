import assert from "node:assert/strict";
import test from "node:test";

import {
  MOON_SETTLEMENT_PARCEL_CELL_SIZE,
  MOON_SETTLEMENT_PLOT_LANE_CELLS,
  MOON_SETTLEMENT_PLOT_REGISTRY,
  MOON_SETTLEMENT_PLOT_STRIDE,
  createMoonSettlementParcelCells,
  labelMoonSettlementParcelCell,
  normalizeMoonSettlementPlacement,
  offsetMoonSettlementParcelPosition,
  resolveMoonSettlementPlotPosition,
  validateMoonSettlementPlacement
} from "../public/moon-settlement-placement.mjs";

test("Moon parcel placements snap, rotate, label, and offset deterministically", () => {
  const placement = normalizeMoonSettlementPlacement({
    parcelId: "wrong",
    cellX: 9,
    cellZ: -9,
    rotationQuarter: -1
  }, { siteId: "utility-west" });
  assert.deepEqual(placement, {
    parcelId: "utility-west",
    cellX: 1,
    cellZ: -1,
    rotationQuarter: 3,
    footprint: [3, 3]
  });
  assert.equal(labelMoonSettlementParcelCell(0, 0), "C3");
  assert.deepEqual(offsetMoonSettlementParcelPosition([2, 0, 3], placement), [
    2 + MOON_SETTLEMENT_PARCEL_CELL_SIZE,
    0,
    3 - MOON_SETTLEMENT_PARCEL_CELL_SIZE
  ]);
});

test("parcel validation rejects unsnapped, outside, wrong, and occupied anchors", () => {
  assert.equal(validateMoonSettlementPlacement({ cellX: 0.5 }, { siteId: "power" }).reason, "cell_not_snapped");
  assert.equal(validateMoonSettlementPlacement({ cellX: 2 }, { siteId: "power" }).reason, "outside_parcel");
  assert.equal(validateMoonSettlementPlacement({ parcelId: "signal" }, { siteId: "power" }).reason, "wrong_parcel");
  assert.equal(validateMoonSettlementPlacement({ rotationQuarter: 0.5 }, { siteId: "power" }).reason, "rotation_not_snapped");
  assert.equal(validateMoonSettlementPlacement({ cellX: 0, cellZ: 0 }, {
    siteId: "power",
    occupied: [{ parcelId: "power", cellX: 1, cellZ: 1 }]
  }).reason, "occupied");
  assert.equal(validateMoonSettlementPlacement({ cellX: -1, cellZ: 1, rotationQuarter: 2 }, { siteId: "power" }).valid, true);
});

test("a 5 by 5 parcel exposes nine valid footprint anchors without mutable aliases", () => {
  const cells = createMoonSettlementParcelCells({ siteId: "greenhouse", selected: { cellX: 1, cellZ: -1 } });
  assert.equal(cells.length, 25);
  assert.equal(cells.filter((cell) => cell.valid).length, 9);
  assert.equal(cells.find((cell) => cell.selected).label, "D2");
  assert.equal(Object.isFrozen(cells), true);
  assert.equal(Object.isFrozen(cells[0].localPosition), true);
});

test("every authored plot belongs to one unique metre-based settlement lattice", () => {
  assert.equal(MOON_SETTLEMENT_PARCEL_CELL_SIZE, 1.25);
  assert.equal(MOON_SETTLEMENT_PLOT_LANE_CELLS, 2);
  assert.equal(MOON_SETTLEMENT_PLOT_STRIDE, 8.75);
  const plots = Object.entries(MOON_SETTLEMENT_PLOT_REGISTRY);
  const coordinates = plots.map(([, plot]) => `${plot.plotX}:${plot.plotZ}`);
  assert.equal(new Set(coordinates).size, coordinates.length);
  for (const [siteId, plot] of plots) {
    assert.equal(Number.isInteger(plot.plotX), true);
    assert.equal(Number.isInteger(plot.plotZ), true);
    assert.deepEqual(resolveMoonSettlementPlotPosition(siteId), [
      plot.plotX * MOON_SETTLEMENT_PLOT_STRIDE,
      0,
      plot.plotZ * MOON_SETTLEMENT_PLOT_STRIDE
    ]);
  }
  const customCells = createMoonSettlementParcelCells({ siteId: "power", cellSize: 1.5 });
  assert.deepEqual(customCells.find((cell) => cell.cellX === 1 && cell.cellZ === -1).localPosition, [1.5, 0, -1.5]);
});
