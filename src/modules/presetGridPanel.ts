import { GRAPH_COLORS } from "./constants.ts";
import {
  saveLibrariesToPreferences,
  reorderPresetInLibrary,
  movePresetBetweenLibraries,
  reorderLibrary,
} from "./presetManager.ts";
import { createDraggableGridComponent } from "./draggableGridComponent.ts";
import chevronIcon from "../icons/chevron.png";
import chevronDownIcon from "../icons/chevron-down.png";

function isPresetEasingEqual(currentEasing, preset) {
  return (
    Math.abs(currentEasing.x1 - preset.x1) < 0.01 &&
    Math.abs(currentEasing.y1 - preset.y1) < 0.01 &&
    Math.abs(currentEasing.x2 - preset.x2) < 0.01 &&
    Math.abs(currentEasing.y2 - preset.y2) < 0.01
  );
}

function drawPresetPreviewWidget(drawWidget, preset, width, height) {
  var w = width;
  var h = height;
  var p = 4;

  var curvePath = new cavalry.Path();
  curvePath.moveTo(p, h - p);
  curvePath.cubicTo(
    p + preset.x1 * (w - 2 * p),
    h - p - preset.y1 * (h - 2 * p),
    p + preset.x2 * (w - 2 * p),
    h - p - preset.y2 * (h - 2 * p),
    w - p,
    p,
  );
  if (curvePath && curvePath.toObject) {
    drawWidget.addPath(curvePath.toObject(), {
      color: "#f07888",
      stroke: true,
      strokeWidth: 2,
    });
  }

  var cp1X = p + preset.x1 * (w - 2 * p);
  var cp1Y = h - p - preset.y1 * (h - 2 * p);
  var cp2X = p + preset.x2 * (w - 2 * p);
  var cp2Y = h - p - preset.y2 * (h - 2 * p);

  var handlePath = new cavalry.Path();
  handlePath.moveTo(p, h - p);
  handlePath.lineTo(cp1X, cp1Y);
  handlePath.moveTo(w - p, p);
  handlePath.lineTo(cp2X, cp2Y);
  if (handlePath && handlePath.toObject) {
    drawWidget.addPath(handlePath.toObject(), {
      color: "#a8a8a8",
      stroke: true,
      strokeWidth: 1,
    });
  }

  var dotsPath = new cavalry.Path();
  dotsPath.addEllipse(cp1X, cp1Y, 2.5, 2.5);
  dotsPath.addEllipse(cp2X, cp2Y, 2.5, 2.5);
  if (dotsPath && dotsPath.toObject) {
    drawWidget.addPath(dotsPath.toObject(), {
      color: ui.getThemeColor("Accent1"),
      stroke: false,
    });
  }

  var keyframesPath = new cavalry.Path();
  var dSize = 2;
  keyframesPath.moveTo(p, h - p - dSize);
  keyframesPath.lineTo(p + dSize, h - p);
  keyframesPath.lineTo(p, h - p + dSize);
  keyframesPath.lineTo(p - dSize, h - p);
  keyframesPath.close();

  keyframesPath.moveTo(w - p, p - dSize);
  keyframesPath.lineTo(w - p + dSize, p);
  keyframesPath.lineTo(w - p, p + dSize);
  keyframesPath.lineTo(w - p - dSize, p);
  keyframesPath.close();

  if (keyframesPath && keyframesPath.toObject) {
    drawWidget.addPath(keyframesPath.toObject(), {
      color: "#f0f0f0",
      stroke: false,
    });
  }

  drawWidget.redraw();
}


export function createPresetGridPanel(options) {
var state = options.state;
var actions = options.actions;
var metrics = options.metrics;

// PRESETS TAB
var presetsScroll = new ui.ScrollView();
var presetsContainer = new ui.VLayout();
presetsScroll.setLayout(presetsContainer);

var presetsScrollWrapper = new ui.Container();
var presetsScrollWrapperLayout = new ui.HLayout();
presetsScrollWrapperLayout.setMargins(0, 0, 0, 0);
presetsScrollWrapperLayout.setSpaceBetween(0);
presetsScrollWrapper.setLayout(presetsScrollWrapperLayout);
presetsScrollWrapperLayout.add(presetsScroll);

function applyScrollbarPreference() {
  // Scrollbar visibility is managed dynamically via layout size adjustment in handleResize().
}
applyScrollbarPreference();

var PRESET_TILE_WIDTH = 68;
var PRESET_TILE_HEIGHT = 74;
var PRESET_GRAPH_WIDTH = 62;
var PRESET_GRAPH_HEIGHT = 56;

var PRESET_SURFACE_COLOR = GRAPH_COLORS.canvas;
var PRESET_SELECTED_COLOR = "#3a3a3a";
var PRESET_TARGET_COLOR = "#4a4a4a";
var LIB_TARGET_COLOR = "#333333";

var dragGrid = createDraggableGridComponent({
  config: {
    itemWidth: PRESET_TILE_WIDTH,
    itemHeight: PRESET_TILE_HEIGHT,
    showItemTitles: true,
    surfaceColor: PRESET_SURFACE_COLOR,
    selectedColor: PRESET_SELECTED_COLOR,
    targetColor: PRESET_TARGET_COLOR,
    groupTargetColor: LIB_TARGET_COLOR,
  },
  getGroupItemCount: function (libName) {
    return Object.keys(state.libraries[libName] || {}).length;
  },
  onPointerFocus: function () {
    state.activePastePanel = "presets";
  },
  onGroupContextMenu: function (libName) {
    actions.showLibraryContextMenu(libName);
  },
  onItemContextMenu: function (libName, presetIndex, entry) {
    if (!entry) return;
    actions.showPresetItemContextMenu(libName, entry.name, entry.data);
  },
  onItemMoved: function (fromLibName, fromPresetIndex, toLibName, toPresetIndex) {
    var moved = false;
    if (
      fromLibName &&
      fromPresetIndex !== -1 &&
      toLibName &&
      toPresetIndex !== -1
    ) {
      if (fromLibName === toLibName) {
        if (fromPresetIndex !== toPresetIndex) {
          moved = reorderPresetInLibrary(
            state.libraries,
            fromLibName,
            fromPresetIndex,
            toPresetIndex,
          );
        }
      } else {
        moved = movePresetBetweenLibraries(
          state.libraries,
          fromLibName,
          fromPresetIndex,
          toLibName,
          toPresetIndex,
        );
      }
    }
    if (moved) saveLibrariesToPreferences(state.libraries);
    buildPresetsTab();
    return moved;
  },
  onGroupMoved: function (fromLibIndex, toLibIndex) {
    var moved = false;
    if (
      fromLibIndex !== -1 &&
      toLibIndex !== -1 &&
      fromLibIndex !== toLibIndex
    ) {
      moved = reorderLibrary(state.libraries, fromLibIndex, toLibIndex);
    }
    if (moved) saveLibrariesToPreferences(state.libraries);
    buildPresetsTab();
    return moved;
  },
  onRebuild: function () {
    buildPresetsTab();
  },
});
var dragState = dragGrid.dragState;

function resetDragState() {
  dragGrid.resetDragState();
}

function triggerTemporaryHighlight(libName, presetIndex, duration) {
  dragGrid.highlightItem(libName, presetIndex, duration);
}

function updatePresetHighlightStyles() {
  if (typeof dragState === "undefined" || !dragState || !dragState.itemEntries)
    return;
  dragState.itemEntries.forEach(function (entry) {
    var libPresets = state.libraries[entry.groupId];
    if (!libPresets) return;
    var presetNames = Object.keys(libPresets);
    var pName = presetNames[entry.itemIndex];
    if (!pName) return;
    var pData = libPresets[pName];
    if (!pData) return;

    dragGrid.setItemSelected(entry.groupId, entry.itemIndex, isCurrentPreset(pData));
  });
}

function pointFromLocalPosition(widget, position) {
  return dragGrid.pointFromLocalPosition(widget, position);
}

function pointerMovedEnough(position) {
  return dragGrid.pointerMovedEnough(position);
}

function updateTargetFromPointer(widget, position) {
  return dragGrid.updateTargetFromPointer(widget, position);
}

function startLibraryDrag(libIndex, widget, position) {
  return dragGrid.startGroupDrag(libIndex, widget, position);
}

function startPresetDrag(libName, presetIndex, widget, position) {
  return dragGrid.startItemDrag(libName, presetIndex, widget, position);
}

function completeDrag() {
  return dragGrid.completeDrag();
}

function getOffsetWrtHeader(widget, headerContainer, defaultDx, defaultDy) {
  return dragGrid.getOffsetBetweenWidgets(
    widget,
    headerContainer,
    defaultDx,
    defaultDy,
  );
}

function attachLibraryChildDragHandlers(
  childWidget,
  headerContainer,
  libIndex,
  defaultDx,
  defaultDy,
  libName,
) {
  actions.attachPasteShortcutHandlers(childWidget);
  childWidget.onMousePress = function (position, button) {
    state.activePastePanel = "presets";
    if (button !== "left") return;
    var offset = getOffsetWrtHeader(
      childWidget,
      headerContainer,
      defaultDx,
      defaultDy,
    );
    var translatedPosition = {
      x: position.x + offset.dx,
      y: position.y + offset.dy,
    };
    startLibraryDrag(libIndex, headerContainer, translatedPosition);
  };
  childWidget.onMouseMove = function (position) {
    var offset = getOffsetWrtHeader(
      childWidget,
      headerContainer,
      defaultDx,
      defaultDy,
    );
    var translatedPosition = {
      x: position.x + offset.dx,
      y: position.y + offset.dy,
    };
    updateTargetFromPointer(headerContainer, translatedPosition);
  };
  childWidget.onMouseEnter = function () {};
  childWidget.onMouseRelease = function (position, button) {
    if (button === "right") {
      actions.showLibraryContextMenu(libName);
      return;
    }
    if (button !== "left") return;
    var offset = getOffsetWrtHeader(
      childWidget,
      headerContainer,
      defaultDx,
      defaultDy,
    );
    var translatedPosition = {
      x: position.x + offset.dx,
      y: position.y + offset.dy,
    };
    updateTargetFromPointer(headerContainer, translatedPosition);
    if (dragState.dragType) completeDrag();
  };
}

function attachLibraryDragHandlers(widget, libIndex, libName) {
  actions.attachPasteShortcutHandlers(widget);
  widget.onMousePress = function (position, button) {
    state.activePastePanel = "presets";
    if (button !== "left") return;
    startLibraryDrag(libIndex, widget, position);
  };
  widget.onMouseMove = function (position) {
    updateTargetFromPointer(widget, position);
  };
  widget.onMouseEnter = function () {};
  widget.onMouseRelease = function (position, button) {
    if (button === "right") {
      actions.showLibraryContextMenu(libName);
      return;
    }
    if (button !== "left") return;
    updateTargetFromPointer(widget, position);
    if (dragState.dragType) completeDrag();
  };
}

function attachPresetDragHandlers(widget, onPress, onMove, onRelease) {
  actions.attachPasteShortcutHandlers(widget);
  widget.onMousePress = function (position, button) {
    state.activePastePanel = "presets";
    onPress(widget, position, button);
  };
  widget.onMouseMove = function (position) {
    onMove(widget, position);
  };
  widget.onMouseEnter = function () {};
  widget.onMouseRelease = function (position, button) {
    onRelease(widget, position, button);
  };
}

function isCurrentPreset(preset) {
  return isPresetEasingEqual(state.currentEasing, preset);
}

function drawPresetPreview(drawWidget, preset) {
  drawPresetPreviewWidget(
    drawWidget,
    preset,
    PRESET_GRAPH_WIDTH,
    PRESET_GRAPH_HEIGHT,
  );
}

function updateLibraryHeaderTitle(titleDraw, libName, availableWidth) {
  var titleW = Math.max(50, availableWidth - 54);
  var estimatedCharWidth = 6.5;
  var maxChars = Math.floor(titleW / estimatedCharWidth);
  var displayLibName = libName;
  if (libName.length > maxChars && maxChars > 3) {
    displayLibName = libName.substring(0, maxChars - 3) + "...";
  }

  titleDraw.setFixedWidth(titleW);
  if (typeof titleDraw.clearPaths === "function") {
    titleDraw.clearPaths();
  }
  var titleTextPath = new cavalry.Path();
  titleTextPath.addText(displayLibName, 13, 2, 5);
  titleDraw.addPath(titleTextPath.toObject(), { color: "#c8c8c8" });
  if (typeof titleDraw.redraw === "function") {
    titleDraw.redraw();
  }
}

function buildPresetsTab() {
  presetsContainer.clear();
  resetDragState();

  var libNames = Object.keys(state.libraries);
  libNames.forEach(function (libName, libIndex) {
    var headerW = Math.max(
      metrics.MIN_PRESETS_CONTENT_WIDTH,
      ui.size().width - (state.disableScrollbarEnabled ? 24 : 40),
    );
    if (state.presetsViewMode === "right") {
      var availableWidth = ui.size().width - 22;
      var presetsW = Math.max(
        metrics.MIN_PRESETS_SIDE_WIDTH,
        availableWidth - state.splitGraphWidth,
      );
      headerW = Math.max(
        metrics.MIN_PRESETS_SIDE_WIDTH - 24,
        presetsW - (state.disableScrollbarEnabled ? 8 : 24),
      );
    }

    // ── Library header ──────────────────────────────────────────────
    var isCollapsed = !!state.collapsedLibraries[libName];
    var collapseBtn = new ui.ImageButton(
      isCollapsed ? chevronIcon : chevronDownIcon,
    );
    collapseBtn.setFixedWidth(18);
    collapseBtn.setFixedHeight(18);
    collapseBtn.setBackgroundColor("#00000000");
    collapseBtn.setDrawStroke(false);
    collapseBtn.setImageSize(14, 14);
    collapseBtn.setToolTip(
      isCollapsed ? "Expand collection" : "Collapse collection",
    );
    collapseBtn.onClick = function () {
      state.collapsedLibraries[libName] = !state.collapsedLibraries[libName];
      buildPresetsTab();
    };
    collapseBtn.onMouseRelease = function (position, button) {
      if (button === "right") {
        actions.showLibraryContextMenu(libName);
      }
    };

    var titleDraw = new ui.Draw();
    titleDraw.setFixedHeight(18);
    titleDraw.setBackgroundColor("#00000000");
    updateLibraryHeaderTitle(titleDraw, libName, headerW);
    var libMenuBtn = new ui.Button("≡");
    libMenuBtn.setFixedWidth(20);

    libMenuBtn.onClick = function () {
      actions.showLibraryContextMenu(libName);
    };

    var headerLayout = new ui.HLayout();
    headerLayout.setMargins(4, 2, 4, 2);
    headerLayout.setSpaceBetween(4);
    headerLayout.add(collapseBtn);
    headerLayout.add(titleDraw);
    headerLayout.addStretch();
    headerLayout.add(libMenuBtn);

    var headerContainer = new ui.Container();
    headerContainer.setLayout(headerLayout);
    headerContainer.useHoverEvents(true);
    headerContainer.setFixedWidth(headerW);
    headerContainer.setFixedHeight(22);

    presetsContainer.add(headerContainer);

    dragGrid.registerGroup({
      container: headerContainer,
      titleDraw: titleDraw,
      groupId: libName,
      groupIndex: libIndex,
    });

    attachLibraryDragHandlers(headerContainer, libIndex, libName);
    attachLibraryChildDragHandlers(
      titleDraw,
      headerContainer,
      libIndex,
      26,
      2,
      libName,
    );

    if (isCollapsed) {
      presetsContainer.addSpacing(10);
      return;
    }

    // ── Preset items ────────────────────────────────────────────────
    var flow = dragGrid.createGridLayout(2, 2);
    var libPresets = state.libraries[libName];
    var presetNames = Object.keys(libPresets);

    presetNames.forEach(function (pName, presetIndex) {
      var pData = libPresets[pName];
      var isSelected = isCurrentPreset(pData);

      var miniGraph = new ui.Draw();
      miniGraph.setFixedWidth(PRESET_GRAPH_WIDTH);
      miniGraph.setFixedHeight(PRESET_GRAPH_HEIGHT);
      miniGraph.setBackgroundColor("#2a2a2a");
      drawPresetPreview(miniGraph, pData);

      var gridItem = dragGrid.createGridItem({
        title: pName,
        tooltip: pName,
        contentWidget: miniGraph,
        isSelected: isSelected,
      });
      var itemContainer = gridItem.container;
      var pLabel = gridItem.label;
      flow.add(itemContainer);

      dragGrid.registerItem({
        container: itemContainer,
        miniGraph: miniGraph,
        label: pLabel,
        groupId: libName,
        groupIndex: libIndex,
        itemIndex: presetIndex,
        isSelected: isSelected,
        name: pName,
        data: pData,
      });

      function onPresetPress() {
        actions.captureLiveApplyModifiers();
      }

      function onPresetClick() {
        triggerTemporaryHighlight(libName, presetIndex, 300);
        actions.handlePresetClick(libName, pName, pData);
      }

      function handlePresetPress(widget, position, button) {
        if (dragState.dragType === "item") {
          return;
        }
        if (button === "left") {
          onPresetPress();
          if (dragState.dragType && !dragState.didDrag) {
            resetDragState();
          }
          startPresetDrag(libName, presetIndex, widget, position);
        }
      }

      function hoverPreset(widget, position) {
        if (dragState.dragType !== "item") return;
        updateTargetFromPointer(widget, position);
      }

      function releasePreset(widget, position, button) {
        if (button === "right") {
          resetDragState();
          actions.showPresetItemContextMenu(libName, pName, pData);
          return;
        }
        if (button !== "left") return;
        if (dragState.dragType !== "item") return;

        var isClick = !dragState.didDrag && !pointerMovedEnough(position);
        if (isClick) {
          resetDragState();
          onPresetClick();
          return;
        }

        updateTargetFromPointer(widget, position);
        completeDrag();
      }

      function attachPresetChildDragHandlers(
        childWidget,
        parentContainer,
        defaultDx,
        defaultDy,
      ) {
        attachPresetDragHandlers(
          childWidget,
          function (w, pos, btn) {
            var offset = getOffsetWrtHeader(
              childWidget,
              parentContainer,
              defaultDx,
              defaultDy,
            );
            var transPos = { x: pos.x + offset.dx, y: pos.y + offset.dy };
            handlePresetPress(parentContainer, transPos, btn);
          },
          function (w, pos) {
            var offset = getOffsetWrtHeader(
              childWidget,
              parentContainer,
              defaultDx,
              defaultDy,
            );
            var transPos = { x: pos.x + offset.dx, y: pos.y + offset.dy };
            hoverPreset(parentContainer, transPos);
          },
          function (w, pos, btn) {
            var offset = getOffsetWrtHeader(
              childWidget,
              parentContainer,
              defaultDx,
              defaultDy,
            );
            var transPos = { x: pos.x + offset.dx, y: pos.y + offset.dy };
            releasePreset(parentContainer, transPos, btn);
          },
        );
      }

      miniGraph.useHoverEvents(true);
      if (typeof pLabel.useHoverEvents === "function") {
        pLabel.useHoverEvents(true);
      }
      attachPresetChildDragHandlers(miniGraph, itemContainer, 4, 4);
      attachPresetChildDragHandlers(pLabel, itemContainer, 4, 4);
      attachPresetDragHandlers(
        itemContainer,
        handlePresetPress,
        hoverPreset,
        releasePreset,
      );
    });

    presetsContainer.add(flow);
    presetsContainer.addSpacing(10);
  });

  var emptySpaceContainer = new ui.Container();
  var emptySpaceLayout = new ui.VLayout();
  emptySpaceLayout.setMargins(0, 0, 0, 0);
  emptySpaceContainer.setLayout(emptySpaceLayout);
  emptySpaceContainer.setFixedHeight(120);
  emptySpaceContainer.useHoverEvents(true);
  emptySpaceContainer.onMousePress = function (position, button) {
    state.activePastePanel = "presets";
  };
  emptySpaceContainer.onMouseRelease = function (position, button) {
    if (button === "right") {
      actions.showPresetsPageContextMenu();
    }
  };
  emptySpaceContainer.onMouseMove = function (position) {};
  presetsContainer.add(emptySpaceContainer);
  presetsContainer.addStretch();
}


function syncPresetPaneSelection() {
  if (!dragState || !dragState.itemEntries) return;
  dragState.itemEntries.forEach(function (entry) {
    var libPresets = state.libraries[entry.groupId];
    if (!libPresets) return;
    var presetNames = Object.keys(libPresets);
    var pName = presetNames[entry.itemIndex];
    if (!pName) return;
    var pData = libPresets[pName];
    if (!pData) return;

    var shouldBeSelected = isCurrentPreset(pData);
    if (entry.isSelected !== shouldBeSelected) {
      entry.isSelected = shouldBeSelected;
      dragGrid.setItemSelected(entry.groupId, entry.itemIndex, shouldBeSelected);
    }
  });
}

return {
  presetsScroll: presetsScroll,
  presetsContainer: presetsContainer,
  presetsScrollWrapper: presetsScrollWrapper,
  dragState: dragState,
  applyScrollbarPreference: applyScrollbarPreference,
  buildPresetsTab: buildPresetsTab,
  resetDragState: resetDragState,
  syncPresetPaneSelection: syncPresetPaneSelection,
  pointFromLocalPosition: pointFromLocalPosition,
  updateLibraryHeaderTitle: updateLibraryHeaderTitle,
};
}
