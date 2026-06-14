// Shared geometry helpers for graph rendering and interaction

export var GRID_DIVISIONS = 10;
export var GRID_OVERFLOW_CELLS = 1;

/**
 * Square plot area centered inside the canvas padding.
 */
export function getPlotBounds(config) {
  var width = config.width;
  var height = config.height;
  var padding = config.padding;
  var availableWidth = width - 2 * padding;
  var availableHeight = height - 2 * padding;
  var plotSize = Math.min(availableWidth, availableHeight);
  var offsetX = (availableWidth - plotSize) / 2;
  var offsetY = (availableHeight - plotSize) / 2;

  return {
    startX: padding + offsetX,
    endX: padding + offsetX + plotSize,
    startY: height - padding - offsetY,
    endY: height - padding - offsetY - plotSize,
    plotSize: plotSize,
  };
}

export function getGridCellSize(bounds) {
  return bounds.plotSize / GRID_DIVISIONS;
}

export function getGridOverflowBounds(bounds, overflowCells) {
  var cellSize = getGridCellSize(bounds);
  var overflow =
    cellSize *
    (overflowCells !== undefined ? overflowCells : GRID_OVERFLOW_CELLS);

  return {
    startX: bounds.startX - overflow,
    endX: bounds.endX + overflow,
    startY: bounds.startY + overflow,
    endY: bounds.endY - overflow,
    plotSize: bounds.plotSize + 2 * overflow,
  };
}

export function snapToGrid(value) {
  return Math.round(value * GRID_DIVISIONS) / GRID_DIVISIONS;
}

export function pixelToNormalized(x, y, bounds) {
  return {
    x: (x - bounds.startX) / (bounds.endX - bounds.startX),
    y: (y - bounds.endY) / (bounds.startY - bounds.endY),
  };
}

export function normalizedToPixel(normX, normY, bounds) {
  return {
    x: bounds.startX + normX * (bounds.endX - bounds.startX),
    y: bounds.endY + normY * (bounds.startY - bounds.endY),
  };
}

export function getHandleOrigin(dragHandle) {
  return dragHandle === "cp1" ? { x: 0, y: 0 } : { x: 1, y: 1 };
}

export function determineAxisConstraint(normX, normY, originX, originY) {
  var deltaX = normX - originX;
  var deltaY = normY - originY;
  var angle = Math.atan2(Math.abs(deltaY), Math.abs(deltaX));
  return angle < Math.PI / 4 ? "x" : "y";
}

export function drawSquareGrid(gridPath, bounds, divisions) {
  var cellSize = bounds.plotSize / divisions;
  drawSquareGridByCellSize(gridPath, bounds, cellSize);
}

export function drawSquareGridByCellSize(gridPath, bounds, cellSize) {
  var cols = Math.round((bounds.endX - bounds.startX) / cellSize);
  var rows = Math.round((bounds.startY - bounds.endY) / cellSize);

  for (var i = 0; i <= cols; i++) {
    var x = bounds.startX + i * cellSize;
    gridPath.moveTo(x, bounds.endY);
    gridPath.lineTo(x, bounds.startY);
  }

  for (var j = 0; j <= rows; j++) {
    var y = bounds.endY + j * cellSize;
    gridPath.moveTo(bounds.startX, y);
    gridPath.lineTo(bounds.endX, y);
  }
}

export function addFillRect(path, x1, y1, x2, y2) {
  path.addRect(x1, y1, x2, y2);
}
