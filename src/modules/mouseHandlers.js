// Mouse event handler module
// Handles mouse interactions for both value and speed graph canvases

import { speedToCubicBezier } from './conversions.js';
<<<<<<< HEAD
import {
    getPlotBounds,
    snapToGrid,
    pixelToNormalized,
    getHandleOrigin,
    GRID_DIVISIONS
} from './graphGeometry.js';

function getEasingCoords(state, dragHandle) {
    if (dragHandle === 'cp1') {
        return { x: state.currentEasing.x1, y: state.currentEasing.y1 };
    }
    return { x: state.currentEasing.x2, y: state.currentEasing.y2 };
}

function setEasingCoords(state, dragHandle, x, y) {
    if (dragHandle === 'cp1') {
        state.currentEasing.x1 = x;
        state.currentEasing.y1 = y;
    } else {
        state.currentEasing.x2 = x;
        state.currentEasing.y2 = y;
    }
}

function mirrorOtherHandle(state, dragHandle) {
    if (dragHandle === 'cp1') {
        state.currentEasing.x2 = 1 - state.currentEasing.x1;
        state.currentEasing.y2 = 1 - state.currentEasing.y1;
    } else {
        state.currentEasing.x1 = 1 - state.currentEasing.x2;
        state.currentEasing.y1 = 1 - state.currentEasing.y2;
    }
}

function snapLockedAxis(state, dragHandle, axisConstraint) {
    var coords = getEasingCoords(state, dragHandle);
    if (axisConstraint === 'x') {
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
    var step = 1 / GRID_DIVISIONS;

    var dx = Math.abs(currentX - startX);
    var dy = Math.abs(currentY - startY);

    if (dx < step && dy < step) {
        return null;
    }

    return dx >= dy ? 'x' : 'y';
}

function beginShiftConstraint(state, dragHandle) {
    state.shiftEngageCoords = getEasingCoords(state, dragHandle);

    if (state.lastAxisConstraint !== null) {
        state.axisConstraint = state.lastAxisConstraint === 'x' ? 'y' : 'x';
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

    if (state.axisConstraint === 'x') {
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
        y: origin.y + projectedLength * Math.sin(state.lockedAngle)
    };
}

function applyCtrlLockLength(state, dragHandle, normX, normY) {
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
        y: origin.y + state.lockedLength * Math.sin(mouseAngle)
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
=======

/**
 * Create mouse handlers for the value graph canvas
 * @param {Object} options - Handler options
 * @param {Object} options.canvas - The graph canvas element
 * @param {Object} options.state - Shared state object
 * @param {Function} options.getConfig - Function that returns current graph configuration
 * @param {Function} options.onUpdate - Callback when values are updated
 * @param {Function} options.onDragEnd - Callback when drag ends
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
 */
export function setupValueGraphHandlers(options) {
    var canvas = options.canvas;
    var state = options.state;
    var getConfig = options.getConfig;
    var onUpdate = options.onUpdate;
    var onDragEnd = options.onDragEnd;
<<<<<<< HEAD

    canvas.onMousePress = function(position, button) {
        var config = getConfig();
        var bounds = getPlotBounds(config);

        var actualCp1X = bounds.startX + state.currentEasing.x1 * (bounds.endX - bounds.startX);
        var actualCp1Y = bounds.endY + state.currentEasing.y1 * (bounds.startY - bounds.endY);
        var actualCp2X = bounds.startX + state.currentEasing.x2 * (bounds.endX - bounds.startX);
        var actualCp2Y = bounds.endY + state.currentEasing.y2 * (bounds.startY - bounds.endY);

        var cp1X = Math.max(bounds.startX - 20, Math.min(bounds.endX + 20, actualCp1X));
        var cp1Y = Math.max(bounds.endY - 20, Math.min(bounds.startY + 20, actualCp1Y));
        var cp2X = Math.max(bounds.startX - 20, Math.min(bounds.endX + 20, actualCp2X));
        var cp2Y = Math.max(bounds.endY - 20, Math.min(bounds.startY + 20, actualCp2Y));

        var dist1 = Math.sqrt((position.x - cp1X) * (position.x - cp1X) + (position.y - cp1Y) * (position.y - cp1Y));
        var dist2 = Math.sqrt((position.x - cp2X) * (position.x - cp2X) + (position.y - cp2Y) * (position.y - cp2Y));

=======
    
    canvas.onMousePress = function(position, button) {
        var config = getConfig();
        var startX = config.padding;
        var startY = config.height - config.padding;
        var endX = config.width - config.padding;
        var endY = config.padding;
        
        // Calculate actual handle positions
        var actualCp1X = startX + state.currentEasing.x1 * (endX - startX);
        var actualCp1Y = endY + state.currentEasing.y1 * (startY - endY);
        var actualCp2X = startX + state.currentEasing.x2 * (endX - startX);
        var actualCp2Y = endY + state.currentEasing.y2 * (startY - endY);
        
        // Clamp handle positions for click detection
        var cp1X = Math.max(startX - 20, Math.min(endX + 20, actualCp1X));
        var cp1Y = Math.max(endY - 20, Math.min(startY + 20, actualCp1Y));
        var cp2X = Math.max(startX - 20, Math.min(endX + 20, actualCp2X));
        var cp2Y = Math.max(endY - 20, Math.min(startY + 20, actualCp2Y));
        
        var dist1 = Math.sqrt((position.x - cp1X) * (position.x - cp1X) + (position.y - cp1Y) * (position.y - cp1Y));
        var dist2 = Math.sqrt((position.x - cp2X) * (position.x - cp2X) + (position.y - cp2Y) * (position.y - cp2Y));
        
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
        if (dist1 < config.handleRadius * 2) {
            state.isDragging = true;
            state.dragHandle = 'cp1';
            state.dragStartPosition = { x: position.x, y: position.y };
            state.dragStartEasing = {
                x1: state.currentEasing.x1,
                y1: state.currentEasing.y1,
                x2: state.currentEasing.x2,
                y2: state.currentEasing.y2
            };
<<<<<<< HEAD
            resetDragModifiers(state);
            if (api.isShiftHeld()) {
                beginShiftConstraint(state, state.dragHandle);
                state.wasShiftHeld = true;
            }
=======
            state.axisConstraint = null;
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
        } else if (dist2 < config.handleRadius * 2) {
            state.isDragging = true;
            state.dragHandle = 'cp2';
            state.dragStartPosition = { x: position.x, y: position.y };
            state.dragStartEasing = {
                x1: state.currentEasing.x1,
                y1: state.currentEasing.y1,
                x2: state.currentEasing.x2,
                y2: state.currentEasing.y2
            };
<<<<<<< HEAD
            resetDragModifiers(state);
            if (api.isShiftHeld()) {
                beginShiftConstraint(state, 'cp2');
                state.wasShiftHeld = true;
            }
        }
    };

    canvas.onMouseMove = function(position) {
        if (!state.isDragging) return;

        var config = getConfig();
        var bounds = getPlotBounds(config);
        var norm = pixelToNormalized(position.x, position.y, bounds);

        var shiftPressed = api.isShiftHeld();
        var cmdPressed = api.isControlHeld();
        var altPressed = api.isAltHeld();
        var coords;

        if (shiftPressed && cmdPressed) {
            coords = { x: norm.x, y: norm.y };
        } else if (altPressed) {
            state.lockedLength = null;
            coords = applyAltLockAngle(state, state.dragHandle, norm.x, norm.y);
        } else if (cmdPressed) {
            state.lockedAngle = null;
            coords = applyCtrlLockLength(state, state.dragHandle, norm.x, norm.y);
        } else if (shiftPressed) {
            state.lockedAngle = null;
            state.lockedLength = null;

            if (!state.wasShiftHeld) {
                beginShiftConstraint(state, state.dragHandle);
            }

            state.wasShiftHeld = true;
            coords = applyShiftGridConstraint(state, state.dragHandle, norm.x, norm.y);
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

        if (shiftPressed && cmdPressed) {
            mirrorOtherHandle(state, state.dragHandle);
        }

        if (onUpdate) onUpdate();
    };

    canvas.onMouseRelease = function() {
=======
            state.axisConstraint = null;
        }
    };
    
    canvas.onMouseMove = function(position, modifiers) {
        if (!state.isDragging) return;
        
        var config = getConfig();
        var startX = config.padding;
        var startY = config.height - config.padding;
        var endX = config.width - config.padding;
        var endY = config.padding;
        
        var x = position.x;
        var y = position.y;
        
        var shiftPressed = api.isShiftHeld();
        
        if (shiftPressed) {
            if (state.dragStartPosition) {
                var currentX, currentY, originX, originY;
                
                if (state.dragHandle === 'cp1') {
                    currentX = state.currentEasing.x1;
                    currentY = state.currentEasing.y1;
                    originX = 0.0;
                    originY = 0.0;
                } else if (state.dragHandle === 'cp2') {
                    currentX = state.currentEasing.x2;
                    currentY = state.currentEasing.y2;
                    originX = 1.0;
                    originY = 1.0;
                }
                
                var deltaX = currentX - originX;
                var deltaY = currentY - originY;
                var angle = Math.atan2(Math.abs(deltaY), Math.abs(deltaX));
                
                if (angle < Math.PI / 4) {
                    state.axisConstraint = 'x';
                    var snapToY = (Math.abs(currentY - 0.0) < Math.abs(currentY - 1.0)) ? 0.0 : 1.0;
                    if (state.dragHandle === 'cp1') {
                        state.currentEasing.y1 = snapToY;
                    } else if (state.dragHandle === 'cp2') {
                        state.currentEasing.y2 = snapToY;
                    }
                } else {
                    state.axisConstraint = 'y';
                    var snapToX = (Math.abs(currentX - 0.0) < Math.abs(currentX - 1.0)) ? 0.0 : 1.0;
                    if (state.dragHandle === 'cp1') {
                        state.currentEasing.x1 = snapToX;
                    } else if (state.dragHandle === 'cp2') {
                        state.currentEasing.x2 = snapToX;
                    }
                }
            }
            
            if (state.axisConstraint === 'x') {
                y = state.dragStartPosition.y;
            } else if (state.axisConstraint === 'y') {
                x = state.dragStartPosition.x;
            }
        } else {
            state.axisConstraint = null;
        }
        
        if (state.dragHandle === 'cp1') {
            if (!shiftPressed || state.axisConstraint !== 'y') {
                state.currentEasing.x1 = (x - startX) / (endX - startX);
            }
            if (!shiftPressed || state.axisConstraint !== 'x') {
                state.currentEasing.y1 = (y - endY) / (startY - endY);
            }
        } else if (state.dragHandle === 'cp2') {
            if (!shiftPressed || state.axisConstraint !== 'y') {
                state.currentEasing.x2 = (x - startX) / (endX - startX);
            }
            if (!shiftPressed || state.axisConstraint !== 'x') {
                state.currentEasing.y2 = (y - endY) / (startY - endY);
            }
        }
        
        if (onUpdate) onUpdate();
    };
    
    canvas.onMouseRelease = function(position, button) {
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
        if (state.isDragging) {
            state.isDragging = false;
            state.dragHandle = null;
            state.dragStartPosition = null;
            state.dragStartEasing = null;
<<<<<<< HEAD
            resetDragModifiers(state);

=======
            state.axisConstraint = null;
            
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
            if (onDragEnd) onDragEnd();
        }
    };
}

/**
 * Create mouse handlers for the speed graph canvas
<<<<<<< HEAD
=======
 * @param {Object} options - Handler options
 * @param {Object} options.canvas - The speed graph canvas element
 * @param {Object} options.state - Shared state object
 * @param {Function} options.getConfig - Function that returns current graph configuration
 * @param {Function} options.onUpdate - Callback when values are updated
 * @param {Function} options.onDragEnd - Callback when drag ends
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
 */
export function setupSpeedGraphHandlers(options) {
    var canvas = options.canvas;
    var state = options.state;
    var getConfig = options.getConfig;
    var onUpdate = options.onUpdate;
    var onDragEnd = options.onDragEnd;
<<<<<<< HEAD

    canvas.onMousePress = function(position, button) {
        var config = getConfig();
        var bounds = getPlotBounds(config);
        var startX = bounds.startX;
        var startY = bounds.startY;
        var endX = bounds.endX;
        var endY = bounds.endY;
        var midX = startX + (endX - startX) / 2;
        var graphHeight = startY - endY;

=======
    
    canvas.onMousePress = function(position, button) {
        var config = getConfig();
        var startX = config.padding;
        var startY = config.height - config.padding;
        var endX = config.width - config.padding;
        var endY = config.padding;
        var midX = startX + (endX - startX) / 2;
        var graphHeight = startY - endY;
        
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
        var outHandleX = startX + (state.speedEasing.outInfluence / 100) * (midX - startX);
        var inHandleX = endX - (state.speedEasing.inInfluence / 100) * (endX - midX);
        var outHandleY = endY + (state.speedEasing.outSpeedY * graphHeight);
        var inHandleY = endY + (state.speedEasing.inSpeedY * graphHeight);
<<<<<<< HEAD

        var dist1 = Math.sqrt(Math.pow(position.x - outHandleX, 2) + Math.pow(position.y - outHandleY, 2));
        var dist2 = Math.sqrt(Math.pow(position.x - inHandleX, 2) + Math.pow(position.y - inHandleY, 2));

=======
        
        var dist1 = Math.sqrt(Math.pow(position.x - outHandleX, 2) + Math.pow(position.y - outHandleY, 2));
        var dist2 = Math.sqrt(Math.pow(position.x - inHandleX, 2) + Math.pow(position.y - inHandleY, 2));
        
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
        if (dist1 < config.handleRadius * 2) {
            state.speedDragging = true;
            state.speedDragHandle = 'out';
        } else if (dist2 < config.handleRadius * 2) {
            state.speedDragging = true;
            state.speedDragHandle = 'in';
        }
    };
<<<<<<< HEAD

    canvas.onMouseMove = function(position) {
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
        var cmdPressed = api.isControlHeld();

        if (state.speedDragHandle === 'out') {
            var clampedX = Math.max(startX, Math.min(midX, position.x));
            state.speedEasing.outInfluence = ((clampedX - startX) / (midX - startX)) * 100;

=======
    
    canvas.onMouseMove = function(position, modifiers) {
        if (!state.speedDragging) return;
        
        var config = getConfig();
        var startX = config.padding;
        var startY = config.height - config.padding;
        var endX = config.width - config.padding;
        var endY = config.padding;
        var midX = startX + (endX - startX) / 2;
        var graphHeight = startY - endY;
        
        var shiftPressed = api.isShiftHeld();
        var cmdPressed = api.isControlHeld();
        
        if (state.speedDragHandle === 'out') {
            var clampedX = Math.max(startX, Math.min(midX, position.x));
            state.speedEasing.outInfluence = ((clampedX - startX) / (midX - startX)) * 100;
            
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
            if (!shiftPressed) {
                var clampedY = Math.max(endY, Math.min(startY, position.y));
                state.speedEasing.outSpeedY = (clampedY - endY) / graphHeight;
            }
<<<<<<< HEAD

=======
            
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
            if (cmdPressed) {
                state.speedEasing.inInfluence = state.speedEasing.outInfluence;
                state.speedEasing.inSpeedY = state.speedEasing.outSpeedY;
            }
        } else if (state.speedDragHandle === 'in') {
            var clampedX = Math.max(midX, Math.min(endX, position.x));
            state.speedEasing.inInfluence = ((endX - clampedX) / (endX - midX)) * 100;
<<<<<<< HEAD

=======
            
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
            if (!shiftPressed) {
                var clampedY = Math.max(endY, Math.min(startY, position.y));
                state.speedEasing.inSpeedY = (clampedY - endY) / graphHeight;
            }
<<<<<<< HEAD

=======
            
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
            if (cmdPressed) {
                state.speedEasing.outInfluence = state.speedEasing.inInfluence;
                state.speedEasing.outSpeedY = state.speedEasing.inSpeedY;
            }
        }
<<<<<<< HEAD

        var cubic = speedToCubicBezier(
            state.speedEasing.outInfluence,
            state.speedEasing.inInfluence,
            state.speedEasing.outSpeedY,
            state.speedEasing.inSpeedY
        );
=======
        
        // Sync speed to value
        var cubic = speedToCubicBezier(state.speedEasing.outInfluence, state.speedEasing.inInfluence, state.speedEasing.outSpeedY, state.speedEasing.inSpeedY);
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
        state.currentEasing.x1 = cubic.x1;
        state.currentEasing.y1 = cubic.y1;
        state.currentEasing.x2 = cubic.x2;
        state.currentEasing.y2 = cubic.y2;
<<<<<<< HEAD

        if (onUpdate) onUpdate();
    };

    canvas.onMouseRelease = function() {
        if (state.speedDragging) {
            state.speedDragging = false;
            state.speedDragHandle = null;

=======
        
        if (onUpdate) onUpdate();
    };
    
    canvas.onMouseRelease = function(position, button) {
        if (state.speedDragging) {
            state.speedDragging = false;
            state.speedDragHandle = null;
            
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
            if (onDragEnd) onDragEnd();
        }
    };
}
