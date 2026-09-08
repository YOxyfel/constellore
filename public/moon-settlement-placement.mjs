/**
 * Shared, pure placement rules for the isolated Moon Settlement Lab.
 *
 * A parcel is a visible 5 x 5 construction grid. Structures use a 3 x 3
 * footprint, so their anchor may occupy the inner 3 x 3 cells only. Keeping
 * these rules outside the renderer makes previews, saves, rollback, keyboard
 * input, and the 2.5D fallback agree exactly.
 */

export const MOON_SETTLEMENT_PARCEL_GRID_SIZE = 5;
// Settlement coordinates are metres. A five-cell plot is 6.25 m wide and
// neighbouring plots retain a two-cell service lane, so the whole settlement
// reads as one surveyed lattice instead of unrelated pads.
export const MOON_SETTLEMENT_PARCEL_CELL_SIZE = 1.25;
export const MOON_SETTLEMENT_PARCEL_FOOTPRINT = Object.freeze([3, 3]);
export const MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT = 1;
export const MOON_SETTLEMENT_PLOT_LANE_CELLS = 2;
export const MOON_SETTLEMENT_PLOT_STRIDE_CELLS = MOON_SETTLEMENT_PARCEL_GRID_SIZE + MOON_SETTLEMENT_PLOT_LANE_CELLS;
export const MOON_SETTLEMENT_PLOT_STRIDE = MOON_SETTLEMENT_PLOT_STRIDE_CELLS * MOON_SETTLEMENT_PARCEL_CELL_SIZE;

const freezePlot = (plotX, plotZ, kind = "buildable") => Object.freeze({ plotX, plotZ, kind });

/**
 * One authored settlement lattice. Existing saves retain local cellX/cellZ;
 * these plot coordinates are derived presentation data and can safely reflow
 * old placements without changing receipts or rollback state.
 */
export const MOON_SETTLEMENT_PLOT_REGISTRY = Object.freeze({
  lander: freezePlot(0, 0, "arrival"),
  power: freezePlot(-1, 1),
  shelter: freezePlot(0, 1),
  signal: freezePlot(1, 1),
  "utility-west": freezePlot(-1, 2),
  "utility-east": freezePlot(0, 2),
  archive: freezePlot(1, 2),
  greenhouse: freezePlot(0, 3),
  "seed-cradle": freezePlot(1, 3, "reserved")
});

const integer = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
};

const cleanId = (value) => String(value || "")
  .toLocaleLowerCase("en-US")
  .replace(/[^a-z0-9:_-]/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 80);

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function normalizeMoonSettlementPlacement(source = {}, { siteId = "" } = {}) {
  const raw = source && typeof source === "object" ? source : {};
  const parcelId = cleanId(siteId || raw.parcelId || raw.siteId);
  const cellX = clamp(integer(raw.cellX), -MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT, MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT);
  const cellZ = clamp(integer(raw.cellZ), -MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT, MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT);
  const rotationQuarter = ((integer(raw.rotationQuarter ?? raw.rotation) % 4) + 4) % 4;
  return Object.freeze({
    parcelId,
    cellX,
    cellZ,
    rotationQuarter,
    footprint: MOON_SETTLEMENT_PARCEL_FOOTPRINT
  });
}

export function validateMoonSettlementPlacement(source = {}, { siteId = "", occupied = [] } = {}) {
  const raw = source && typeof source === "object" ? source : {};
  const expectedSiteId = cleanId(siteId);
  const providedSiteId = cleanId(raw.parcelId || raw.siteId || expectedSiteId);
  const cellX = Number(raw.cellX ?? 0);
  const cellZ = Number(raw.cellZ ?? 0);
  const rotationQuarter = Number(raw.rotationQuarter ?? raw.rotation ?? 0);
  let reason = "ready";
  if (expectedSiteId && providedSiteId !== expectedSiteId) reason = "wrong_parcel";
  else if (!Number.isInteger(cellX) || !Number.isInteger(cellZ)) reason = "cell_not_snapped";
  else if (Math.abs(cellX) > MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT || Math.abs(cellZ) > MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT) reason = "outside_parcel";
  else if (!Number.isInteger(rotationQuarter)) reason = "rotation_not_snapped";

  const placement = normalizeMoonSettlementPlacement(raw, { siteId: expectedSiteId });
  if (reason === "ready") {
    const collision = (Array.isArray(occupied) ? occupied : []).some((entry) => {
      const other = normalizeMoonSettlementPlacement(entry, { siteId: expectedSiteId });
      if (other.parcelId !== placement.parcelId) return false;
      const halfWidth = (placement.footprint[0] + other.footprint[0]) / 2 - 1;
      const halfDepth = (placement.footprint[1] + other.footprint[1]) / 2 - 1;
      return Math.abs(other.cellX - placement.cellX) <= halfWidth
        && Math.abs(other.cellZ - placement.cellZ) <= halfDepth;
    });
    if (collision) reason = "occupied";
  }
  return Object.freeze({ valid: reason === "ready", reason, placement });
}

export function labelMoonSettlementParcelCell(cellX = 0, cellZ = 0) {
  const half = Math.floor(MOON_SETTLEMENT_PARCEL_GRID_SIZE / 2);
  const column = String.fromCharCode(65 + clamp(integer(cellX) + half, 0, MOON_SETTLEMENT_PARCEL_GRID_SIZE - 1));
  const row = clamp(integer(cellZ) + half + 1, 1, MOON_SETTLEMENT_PARCEL_GRID_SIZE);
  return `${column}${row}`;
}

export function offsetMoonSettlementParcelPosition(anchor = [0, 0, 0], source = {}) {
  const placement = normalizeMoonSettlementPlacement(source);
  const sourcePosition = Array.isArray(anchor) ? anchor : [0, 0, 0];
  return Object.freeze([
    (Number(sourcePosition[0]) || 0) + placement.cellX * MOON_SETTLEMENT_PARCEL_CELL_SIZE,
    Number(sourcePosition[1]) || 0,
    (Number(sourcePosition[2]) || 0) + placement.cellZ * MOON_SETTLEMENT_PARCEL_CELL_SIZE
  ]);
}

export function resolveMoonSettlementPlotPosition(siteId = "") {
  const plot = MOON_SETTLEMENT_PLOT_REGISTRY[cleanId(siteId)];
  if (!plot) return null;
  return Object.freeze([
    plot.plotX * MOON_SETTLEMENT_PLOT_STRIDE,
    0,
    plot.plotZ * MOON_SETTLEMENT_PLOT_STRIDE
  ]);
}

export function createMoonSettlementParcelCells(parcel = {}) {
  const siteId = cleanId(parcel.siteId || parcel.parcelId || "parcel");
  const selected = normalizeMoonSettlementPlacement(parcel.selected || parcel.placement, { siteId });
  const requestedCellSize = Number(parcel.cellSize);
  const cellSize = Number.isFinite(requestedCellSize) && requestedCellSize > 0
    ? requestedCellSize
    : MOON_SETTLEMENT_PARCEL_CELL_SIZE;
  const half = Math.floor(MOON_SETTLEMENT_PARCEL_GRID_SIZE / 2);
  const cells = [];
  for (let cellZ = -half; cellZ <= half; cellZ += 1) {
    for (let cellX = -half; cellX <= half; cellX += 1) {
      const valid = Math.abs(cellX) <= MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT
        && Math.abs(cellZ) <= MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT;
      cells.push(Object.freeze({
        id: `parcel-cell:${siteId}:${cellX}:${cellZ}`,
        siteId,
        cellX,
        cellZ,
        label: labelMoonSettlementParcelCell(cellX, cellZ),
        valid,
        selected: cellX === selected.cellX && cellZ === selected.cellZ,
        localPosition: Object.freeze([
          cellX * cellSize,
          0,
          cellZ * cellSize
        ])
      }));
    }
  }
  return Object.freeze(cells);
}
