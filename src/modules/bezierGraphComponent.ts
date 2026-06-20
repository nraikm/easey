import { drawCurve, drawSpeedCurve } from "./graphRenderer.ts";
import {
  setupSpeedGraphHandlers,
  setupValueGraphHandlers,
} from "./mouseHandlers.ts";

/**
 * Reusable Cavalry UI component for a cubic bezier value graph plus speed graph.
 *
 * The component owns the ui.Draw widgets and all pointer dragging behavior, while
 * app-specific state updates, context menus, and persistence stay injected.
 */
export function createBezierGraphComponent(options) {
  var graphConfig = options.graphConfig;

  var valueCanvas = new ui.Draw();
  valueCanvas.setSize(graphConfig.width, graphConfig.height);

  var speedCanvas = new ui.Draw();
  speedCanvas.setSize(graphConfig.width, graphConfig.height);

  function setupHandlers(handlerOptions) {
    setupValueGraphHandlers({
      canvas: valueCanvas,
      state: handlerOptions.sharedState,
      getConfig: handlerOptions.getGraphConfig,
      onDragStart: handlerOptions.onDragStart,
      onUpdate: handlerOptions.onValueUpdate,
      onDragEnd: handlerOptions.onValueDragEnd,
      onMouseFocus: handlerOptions.onMouseFocus,
      onContextMenu: handlerOptions.onContextMenu,
    });

    setupSpeedGraphHandlers({
      canvas: speedCanvas,
      state: handlerOptions.sharedState,
      getConfig: handlerOptions.getSpeedGraphConfig,
      onDragStart: handlerOptions.onDragStart,
      onUpdate: handlerOptions.onSpeedUpdate,
      onDragEnd: handlerOptions.onSpeedDragEnd,
      onMouseFocus: handlerOptions.onMouseFocus,
      onContextMenu: handlerOptions.onContextMenu,
    });
  }

  function drawValue(currentEasing, config, lastEasing) {
    drawCurve(valueCanvas, currentEasing, config, lastEasing);
  }

  function drawSpeed(currentEasing, speedEasing, config) {
    drawSpeedCurve(speedCanvas, currentEasing, speedEasing, config);
  }

  function redraw(drawOptions) {
    drawValue(
      drawOptions.currentEasing,
      drawOptions.graphConfig,
      drawOptions.lastEasing,
    );
    drawSpeed(
      drawOptions.currentEasing,
      drawOptions.speedEasing,
      drawOptions.speedGraphConfig,
    );
  }

  function setValueGraphSize(width, height) {
    valueCanvas.setSize(width, height);
  }

  function setSpeedGraphSize(width, height) {
    speedCanvas.setSize(width, height);
  }

  function setShowingSpeed(showingSpeed) {
    valueCanvas.setHidden(!!showingSpeed);
    speedCanvas.setHidden(!showingSpeed);
  }

  return {
    graphCanvas: valueCanvas,
    speedGraphCanvas: speedCanvas,
    valueCanvas: valueCanvas,
    speedCanvas: speedCanvas,
    setupHandlers: setupHandlers,
    drawValue: drawValue,
    drawSpeed: drawSpeed,
    redraw: redraw,
    setValueGraphSize: setValueGraphSize,
    setSpeedGraphSize: setSpeedGraphSize,
    setShowingSpeed: setShowingSpeed,
  };
}
