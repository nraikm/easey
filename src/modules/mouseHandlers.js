// Mouse event handler module
// Handles mouse interactions for both value and speed graph canvases

import { speedToCubicBezier } from "./conversions.js";
import {
  getPlotBounds,
  snapToGrid,
  pixelToNormalized,
  getHandleOrigin,
  getGridDivisions,
} from "./graphGeometry.js";

function getEasingCoords(state, dragHandle) {
  if (dragHandle === "cp1") {
    return { x: state.currentEasing.x1, y: state.currentEasing.y1 };
  }
  return { x: state.currentEasing.x2, y: state.currentEasing.y2 };
}

function setEasingCoords(state, dragHandle, x, y) {
  if (dragHandle === "cp1") {
    state.currentEasing.x1 = x;
    state.currentEasing.y1 = y;
  } else {
    state.currentEasing.x2 = x;
    state.currentEasing.y2 = y;
  }
}

function mirrorOtherHandle(state, dragHandle) {
  if (dragHandle === "cp1") {
    state.currentEasing.x2 = 1 - state.currentEasing.x1;
    state.currentEasing.y2 = 1 - state.currentEasing.y1;
  } else {
    state.currentEasing.x1 = 1 - state.currentEasing.x2;
    state.currentEasing.y1 = 1 - state.currentEasing.y2;
  }
}

function isMacPlatform() {
  try {
    return api.getPlatform && api.getPlatform() === "macOS";
  } catch (e) {
    return false;
  }
}

function isPhysicalControlHeld() {
  return isMacPlatform() ? api.isMetaHeld() : api.isControlHeld();
}

function isPlatformCommandHeld() {
  return isMacPlatform() ? api.isControlHeld() : api.isMetaHeld();
}

function snapLockedAxis(state, dragHandle, axisConstraint) {
  var coords = getEasingCoords(state, dragHandle);
  if (axisConstraint === "x") {
    setEasingCoords(state, dragHandle, coords.x, snapToGrid(coords.y));
  } else {
    setEasingCoords(state, dragHandle, snapToGrid(coords.x), coords.y);
  }
}

function detectAxisFromMovement(startCoords, currentCoords) {
  var startX = snapToGrid(startCoords.x);
  var startY = snapToGrid(startCoords.y);
  var currentX = snapToGrid(currentCoords.x);
  var currentY = snapToGrid(currentCoords.y);
  var step = 1 / getGridDivisions();

  var dx = Math.abs(currentX - startX);
  var dy = Math.abs(currentY - startY);

  if (dx < step && dy < step) {
    return null;
  }

  return dx >= dy ? "x" : "y";
}

function beginShiftConstraint(state, dragHandle) {
  state.shiftEngageCoords = getEasingCoords(state, dragHandle);

  if (state.lastAxisConstraint !== null) {
    state.axisConstraint = state.lastAxisConstraint === "x" ? "y" : "x";
    snapLockedAxis(state, dragHandle, state.axisConstraint);
  } else {
    state.axisConstraint = null;
  }
}

function applyShiftGridConstraint(state, dragHandle, normX, normY) {
  if (state.axisConstraint === null) {
    var snapped = { x: snapToGrid(normX), y: snapToGrid(normY) };
    var detected = detectAxisFromMovement(state.shiftEngageCoords, snapped);

    if (detected !== null) {
      state.axisConstraint = detected;
      snapLockedAxis(state, dragHandle, detected);
      return applyShiftGridConstraint(state, dragHandle, snapped.x, snapped.y);
    }

    return snapped;
  }

  if (state.axisConstraint === "x") {
    return { x: snapToGrid(normX), y: getEasingCoords(state, dragHandle).y };
  }
  return { x: getEasingCoords(state, dragHandle).x, y: snapToGrid(normY) };
}

function applyAltLockAngle(state, dragHandle, normX, normY) {
  var origin = getHandleOrigin(dragHandle);
  var dx = normX - origin.x;
  var dy = normY - origin.y;

  if (state.lockedAngle === null) {
    var coords = getEasingCoords(state, dragHandle);
    state.lockedAngle = Math.atan2(coords.y - origin.y, coords.x - origin.x);
  }

  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.0001) {
    return getEasingCoords(state, dragHandle);
  }

  var mouseAngle = Math.atan2(dy, dx);
  var projectedLength = dist * Math.cos(mouseAngle - state.lockedAngle);

  return {
    x: origin.x + projectedLength * Math.cos(state.lockedAngle),
    y: origin.y + projectedLength * Math.sin(state.lockedAngle),
  };
}

function applyCommandLockLength(state, dragHandle, normX, normY) {
  var origin = getHandleOrigin(dragHandle);
  var dx = normX - origin.x;
  var dy = normY - origin.y;

  if (state.lockedLength === null) {
    var coords = getEasingCoords(state, dragHandle);
    var ox = coords.x - origin.x;
    var oy = coords.y - origin.y;
    state.lockedLength = Math.sqrt(ox * ox + oy * oy);
  }

  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.0001) {
    return getEasingCoords(state, dragHandle);
  }

  var mouseAngle = Math.atan2(dy, dx);
  return {
    x: origin.x + state.lockedLength * Math.cos(mouseAngle),
    y: origin.y + state.lockedLength * Math.sin(mouseAngle),
  };
}

function resetDragModifiers(state) {
  state.axisConstraint = null;
  state.wasShiftHeld = false;
  state.lockedAngle = null;
  state.lockedLength = null;
  state.lastAxisConstraint = null;
  state.shiftEngageCoords = null;
}

/**
 * Create mouse handlers for the value graph canvas
 */
export function setupValueGraphHandlers(options) {
  var canvas = options.canvas;
  var state = options.state;
  var getConfig = options.getConfig;
  var onUpdate = options.onUpdate;
  var onDragStart = options.onDragStart;
  var onDragEnd = options.onDragEnd;
  var onContextMenu = options.onContextMenu;
  var onMouseFocus = options.onMouseFocus;

  canvas.onMousePress = function (position, button) {
    if (onMouseFocus) onMouseFocus();
    if (button === "right") {
      if (onContextMenu) onContextMenu(position);
      return;
    }

    var config = getConfig();
    var bounds = getPlotBounds(config);

    var actualCp1X =
      bounds.startX + state.currentEasing.x1 * (bounds.endX - bounds.startX);
    var actualCp1Y =
      bounds.endY + state.currentEasing.y1 * (bounds.startY - bounds.endY);
    var actualCp2X =
      bounds.startX + state.currentEasing.x2 * (bounds.endX - bounds.startX);
    var actualCp2Y =
      bounds.endY + state.currentEasing.y2 * (bounds.startY - bounds.endY);

    var cp1X = Math.max(
      bounds.startX - 20,
      Math.min(bounds.endX + 20, actualCp1X),
    );
    var cp1Y = Math.max(
      bounds.endY - 20,
      Math.min(bounds.startY + 20, actualCp1Y),
    );
    var cp2X = Math.max(
      bounds.startX - 20,
      Math.min(bounds.endX + 20, actualCp2X),
    );
    var cp2Y = Math.max(
      bounds.endY - 20,
      Math.min(bounds.startY + 20, actualCp2Y),
    );

    var dist1 = Math.sqrt(
      (position.x - cp1X) * (position.x - cp1X) +
        (position.y - cp1Y) * (position.y - cp1Y),
    );
    var dist2 = Math.sqrt(
      (position.x - cp2X) * (position.x - cp2X) +
        (position.y - cp2Y) * (position.y - cp2Y),
    );

    if (dist1 < config.handleRadius * 2) {
      if (onDragStart) onDragStart();
      state.isDragging = true;
      state.dragHandle = "cp1";
      state.dragStartPosition = { x: position.x, y: position.y };
      state.dragStartEasing = {
        x1: state.currentEasing.x1,
        y1: state.currentEasing.y1,
        x2: state.currentEasing.x2,
        y2: state.currentEasing.y2,
      };
      resetDragModifiers(state);
      if (api.isShiftHeld()) {
        beginShiftConstraint(state, state.dragHandle);
        state.wasShiftHeld = true;
      }
    } else if (dist2 < config.handleRadius * 2) {
      if (onDragStart) onDragStart();
      state.isDragging = true;
      state.dragHandle = "cp2";
      state.dragStartPosition = { x: position.x, y: position.y };
      state.dragStartEasing = {
        x1: state.currentEasing.x1,
        y1: state.currentEasing.y1,
        x2: state.currentEasing.x2,
        y2: state.currentEasing.y2,
      };
      resetDragModifiers(state);
      if (api.isShiftHeld()) {
        beginShiftConstraint(state, "cp2");
        state.wasShiftHeld = true;
      }
    }
  };

  canvas.onMouseMove = function (position) {
    if (!state.isDragging) return;

    var config = getConfig();
    var bounds = getPlotBounds(config);
    var norm = pixelToNormalized(position.x, position.y, bounds);

    var shiftPressed = api.isShiftHeld();
    var controlPressed = isPhysicalControlHeld();
    var commandPressed = isPlatformCommandHeld();
    var altPressed = api.isAltHeld();
    var coords;

    if (altPressed) {
      state.lockedLength = null;
      coords = applyAltLockAngle(state, state.dragHandle, norm.x, norm.y);
    } else if (commandPressed) {
      state.lockedAngle = null;
      coords = applyCommandLockLength(state, state.dragHandle, norm.x, norm.y);
    } else if (shiftPressed) {
      state.lockedAngle = null;
      state.lockedLength = null;

      if (!state.wasShiftHeld) {
        beginShiftConstraint(state, state.dragHandle);
      }

      state.wasShiftHeld = true;
      coords = applyShiftGridConstraint(
        state,
        state.dragHandle,
        norm.x,
        norm.y,
      );
    } else {
      if (state.wasShiftHeld && state.axisConstraint !== null) {
        state.lastAxisConstraint = state.axisConstraint;
      }
      state.axisConstraint = null;
      state.wasShiftHeld = false;
      state.shiftEngageCoords = null;
      state.lockedAngle = null;
      state.lockedLength = null;
      coords = { x: norm.x, y: norm.y };
    }

    setEasingCoords(state, state.dragHandle, coords.x, coords.y);

    if (controlPressed) {
      mirrorOtherHandle(state, state.dragHandle);
    }

    if (onUpdate) onUpdate();
  };

  canvas.onMouseRelease = function () {
    if (state.isDragging) {
      state.isDragging = false;
      state.dragHandle = null;
      state.dragStartPosition = null;
      state.dragStartEasing = null;
      resetDragModifiers(state);

      if (onDragEnd) onDragEnd();
    }
  };
}

/**
 * Create mouse handlers for the speed graph canvas
 */
export function setupSpeedGraphHandlers(options) {
  var canvas = options.canvas;
  var state = options.state;
  var getConfig = options.getConfig;
  var onUpdate = options.onUpdate;
  var onDragStart = options.onDragStart;
  var onDragEnd = options.onDragEnd;
  var onContextMenu = options.onContextMenu;
  var onMouseFocus = options.onMouseFocus;

  canvas.onMousePress = function (position, button) {
    if (onMouseFocus) onMouseFocus();
    if (button === "right") {
      if (onContextMenu) onContextMenu(position);
      return;
    }

    var config = getConfig();
    var bounds = getPlotBounds(config);
    var startX = bounds.startX;
    var startY = bounds.startY;
    var endX = bounds.endX;
    var endY = bounds.endY;
    var midX = startX + (endX - startX) / 2;
    var graphHeight = startY - endY;

    var outHandleX =
      startX + (state.speedEasing.outInfluence / 100) * (midX - startX);
    var inHandleX =
      endX - (state.speedEasing.inInfluence / 100) * (endX - midX);
    var outHandleY = endY + state.speedEasing.outSpeedY * graphHeight;
    var inHandleY = endY + state.speedEasing.inSpeedY * graphHeight;

    var dist1 = Math.sqrt(
      Math.pow(position.x - outHandleX, 2) +
        Math.pow(position.y - outHandleY, 2),
    );
    var dist2 = Math.sqrt(
      Math.pow(position.x - inHandleX, 2) + Math.pow(position.y - inHandleY, 2),
    );

    if (dist1 < config.handleRadius * 2) {
      if (onDragStart) onDragStart();
      state.speedDragging = true;
      state.speedDragHandle = "out";
    } else if (dist2 < config.handleRadius * 2) {
      if (onDragStart) onDragStart();
      state.speedDragging = true;
      state.speedDragHandle = "in";
    }
  };

  canvas.onMouseMove = function (position) {
    if (!state.speedDragging) return;

    var config = getConfig();
    var bounds = getPlotBounds(config);
    var startX = bounds.startX;
    var startY = bounds.startY;
    var endX = bounds.endX;
    var endY = bounds.endY;
    var midX = startX + (endX - startX) / 2;
    var graphHeight = startY - endY;

    var shiftPressed = api.isShiftHeld();
    var controlPressed = isPhysicalControlHeld();

    if (state.speedDragHandle === "out") {
      var clampedX = Math.max(startX, Math.min(midX, position.x));
      state.speedEasing.outInfluence =
        ((clampedX - startX) / (midX - startX)) * 100;

      if (!shiftPressed) {
        var clampedY = Math.max(endY, Math.min(startY, position.y));
        state.speedEasing.outSpeedY = (clampedY - endY) / graphHeight;
      }

      if (controlPressed) {
        state.speedEasing.inInfluence = state.speedEasing.outInfluence;
        state.speedEasing.inSpeedY = state.speedEasing.outSpeedY;
      }
    } else if (state.speedDragHandle === "in") {
      var clampedX = Math.max(midX, Math.min(endX, position.x));
      state.speedEasing.inInfluence = ((endX - clampedX) / (endX - midX)) * 100;

      if (!shiftPressed) {
        var clampedY = Math.max(endY, Math.min(startY, position.y));
        state.speedEasing.inSpeedY = (clampedY - endY) / graphHeight;
      }

      if (controlPressed) {
        state.speedEasing.outInfluence = state.speedEasing.inInfluence;
        state.speedEasing.outSpeedY = state.speedEasing.inSpeedY;
      }
    }

    var cubic = speedToCubicBezier(
      state.speedEasing.outInfluence,
      state.speedEasing.inInfluence,
      state.speedEasing.outSpeedY,
      state.speedEasing.inSpeedY,
    );
    state.currentEasing.x1 = cubic.x1;
    state.currentEasing.y1 = cubic.y1;
    state.currentEasing.x2 = cubic.x2;
    state.currentEasing.y2 = cubic.y2;

    if (onUpdate) onUpdate();
  };

  canvas.onMouseRelease = function () {
    if (state.speedDragging) {
      state.speedDragging = false;
      state.speedDragHandle = null;

      if (onDragEnd) onDragEnd();
    }
  };
}
