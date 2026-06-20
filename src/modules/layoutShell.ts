import { GRAPH_COLORS } from "./constants.ts";
import { createPresetsPanel } from "./presetsPanel.ts";
import { loadPresetsViewModeSetting, loadPresetsOrientationLeftTopSetting, loadSplitGraphWidthSetting, loadSplitGraphHeightSetting, saveSplitGraphWidthSetting, saveSplitGraphHeightSetting } from "./presetManager.ts";

export function createLayoutShell(options) {
var state = options.state;
var widgets = options.widgets;
var actions = options.actions;
var metrics = options.metrics;

function getMinimumWindowWidthForMode(mode) {
  if (mode === "right") {
    return Math.max(
      metrics.MIN_WINDOW_WIDTH,
      metrics.MIN_GRAPH_WIDTH + metrics.MIN_PRESETS_SIDE_WIDTH + 6 + 16,
    );
  }
  return metrics.MIN_WINDOW_WIDTH;
}

function applyWindowMinimumWidth() {
  ui.setMinimumWidth(getMinimumWindowWidthForMode(state.presetsViewMode));
}

// UI LAYOUT
// ============================================================================

// Create main layout
var buttonRowContainer;
var presetSearchGroupContainer;
var mainLayout = new ui.VLayout();
mainLayout.setSpaceBetween(0);
mainLayout.setMargins(2, 2, 2, 0);

// Button row
var buttonRow = new ui.HLayout();
buttonRow.add(widgets.getButton);

function createPresetSearchGroup() {
  var container = new ui.Container();
  container.setFixedHeight(22);
  container.setBackgroundColor("#1c1c1c");
  container.setBorder("#2a2a2a", 1);

  var layout = new ui.HLayout();
  layout.setMargins(6, 0, 2, 0);
  layout.setSpaceBetween(2);

  widgets.presetSearchInput.setBackgroundColor("#1c1c1c");
  widgets.presetSearchInput.setPlaceholder("Search preset...");
  widgets.presetSearchInput.setFixedHeight(20);

  widgets.presetSearchBtn.setFixedWidth(18);
  widgets.presetSearchBtn.setFixedHeight(18);
  widgets.presetSearchBtn.setBackgroundColor("#1c1c1c");
  widgets.presetSearchBtn.setDrawStroke(false);

  layout.add(widgets.presetSearchInput);
  layout.add(widgets.presetSearchBtn);

  container.setLayout(layout);
  return container;
}

presetSearchGroupContainer = createPresetSearchGroup();
buttonRow.add(presetSearchGroupContainer);
buttonRow.add(widgets.applyButton);
buttonRow.setSpaceBetween(4);
buttonRow.setMargins(4, 0, 4, 0);

buttonRowContainer = new ui.Container();
buttonRowContainer.setLayout(buttonRow);

var tabView = new ui.TabView();

// EDITOR TAB
var editorTabLayout = new ui.VLayout();
editorTabLayout.setSpaceBetween(0);
editorTabLayout.setMargins(0, 0, 0, 0);

// Helper to group label and input inside a single bordered container matching Cavalry's native input style
function createInputGroup(labelName, coordinateIndex) {
  var coordinateInput = widgets.coordinateInputs[coordinateIndex];
  var container = new ui.Container();
  container.setFixedHeight(22);
  container.setFixedWidth(metrics.COORDINATE_CONTAINER_WIDTH);
  container.setBackgroundColor("#1c1c1c");
  container.setBorder("#2a2a2a", metrics.COORDINATE_BORDER_WIDTH);

  var layout = new ui.HLayout();
  layout.setMargins(1, 1, 0, 1);
  layout.setSpaceBetween(1);

  var label = new ui.Label(labelName);
  label.setTextColor("#555555");
  label.setFontSize(11);
  label.setFixedWidth(metrics.COORDINATE_LABEL_WIDTH);
  label.setFixedHeight(20);
  try {
    label.setTransparentForMouseEvents(true);
  } catch (e) {}

  var valueBox = new ui.Container();
  valueBox.setFixedWidth(metrics.COORDINATE_VALUE_WIDTH);
  valueBox.setFixedHeight(20);
  valueBox.setBackgroundColor("#1c1c1c");

  var valueLayout = new ui.HLayout();
  valueLayout.setMargins(0, 0, 0, 0);
  valueLayout.add(coordinateInput);
  valueBox.setLayout(valueLayout);

  layout.add(label);
  layout.add(valueBox);
  container.setLayout(layout);

  actions.setupCoordinateScrub([container, valueBox, coordinateInput], coordinateIndex);

  return container;
}

var editorControlsLayout = new ui.HLayout();
editorControlsLayout.setMargins(4, 2, 4, 2);
editorControlsLayout.setSpaceBetween(1);
editorControlsLayout.add(widgets.graphModeBtn);
editorControlsLayout.add(createInputGroup("X1", 0));
editorControlsLayout.add(createInputGroup("Y1", 1));
editorControlsLayout.add(createInputGroup("X2", 2));
editorControlsLayout.add(createInputGroup("Y2", 3));
editorControlsLayout.add(widgets.mainContextButton);

var graphContainer = new ui.Container();
var initGraphLayout = new ui.VLayout();
initGraphLayout.setMargins(0, 0, 0, 0);
initGraphLayout.setSpaceBetween(0);
initGraphLayout.add(widgets.graphCanvas);
initGraphLayout.add(widgets.speedGraphCanvas);
graphContainer.setLayout(initGraphLayout);

widgets.speedGraphCanvas.setHidden(true);

widgets.graphModeBtn.onClick = function () {
  state.showingSpeed = !state.showingSpeed;
  if (widgets.graphComponent && widgets.graphComponent.setShowingSpeed) {
    widgets.graphComponent.setShowingSpeed(state.showingSpeed);
  } else if (state.showingSpeed) {
    widgets.graphCanvas.setHidden(true);
    widgets.speedGraphCanvas.setHidden(false);
  } else {
    widgets.graphCanvas.setHidden(false);
    widgets.speedGraphCanvas.setHidden(true);
  }
  widgets.graphModeBtn.setText(state.showingSpeed ? "V" : "S");
  actions.redrawGraphs();
};

// PRESETS TAB
var presetsPanel = createPresetsPanel({
  state: state,
  actions: {
    attachPasteShortcutHandlers: actions.attachPasteShortcutHandlers,
    showLibraryContextMenu: actions.showLibraryContextMenu,
    showPresetItemContextMenu: actions.showPresetItemContextMenu,
    showPresetsPageContextMenu: actions.showPresetsPageContextMenu,
    captureLiveApplyModifiers: actions.captureLiveApplyModifiers,
    handlePresetClick: actions.handlePresetClick,
  },
  metrics: {
    MIN_PRESETS_CONTENT_WIDTH: metrics.MIN_PRESETS_CONTENT_WIDTH,
    MIN_PRESETS_SIDE_WIDTH: metrics.MIN_PRESETS_SIDE_WIDTH,
  },
});
var presetsScroll = presetsPanel.presetsScroll;
var presetsContainer = presetsPanel.presetsContainer;
var presetsScrollWrapper = presetsPanel.presetsScrollWrapper;
var dragState = presetsPanel.dragState;
function applyScrollbarPreference() {
  return presetsPanel.applyScrollbarPreference();
}
function buildPresetsTab() {
  return presetsPanel.buildPresetsTab();
}
function resetDragState() {
  return presetsPanel.resetDragState();
}
function pointFromLocalPosition(widget, position) {
  return presetsPanel.pointFromLocalPosition(widget, position);
}
function updateLibraryHeaderTitle(titleDraw, libName, availableWidth) {
  return presetsPanel.updateLibraryHeaderTitle(titleDraw, libName, availableWidth);
}
var presetsTabLayout = new ui.VLayout();
presetsTabLayout.setSpaceBetween(0);
presetsTabLayout.setMargins(2, 2, 2, 2);

// Wrap tabView inside a container wrapper because TabView does not support setHidden
var tabContainerWrapper = new ui.Container();
var tabContainerWrapperLayout = new ui.VLayout();
tabContainerWrapperLayout.setMargins(0, 0, 0, 0);
tabContainerWrapperLayout.setSpaceBetween(0);
tabContainerWrapperLayout.add(tabView);
tabContainerWrapper.setLayout(tabContainerWrapperLayout);

tabView.add("Editor", editorTabLayout);
tabView.add("Presets", presetsTabLayout);

// Initialize graph section container (groups graph + coordinates controls together)
var graphSectionContainer = new ui.Container();
var graphSectionLayout = new ui.VLayout();
graphSectionLayout.setMargins(0, 0, 0, 0);
graphSectionLayout.setSpaceBetween(4);
graphSectionContainer.setLayout(graphSectionLayout);

graphSectionLayout.add(editorControlsLayout);
graphSectionLayout.add(graphContainer);

// Initialize split layouts and containers
var splitViewContainer = new ui.Container();
var splitViewLayout = new ui.VLayout();
splitViewLayout.setMargins(2, 2, 2, 0);
splitViewLayout.setSpaceBetween(0);
splitViewContainer.setLayout(splitViewLayout);

// Right split container
var rightSplitContainer = new ui.Container();
var rightSplitLayout = new ui.HLayout();
rightSplitLayout.setMargins(0, 0, 0, 0);
rightSplitLayout.setSpaceBetween(0);
rightSplitContainer.setLayout(rightSplitLayout);

var rightSplitter = new ui.Container();
rightSplitter.setFixedWidth(6);
rightSplitter.setBackgroundColor("#181818");

// Bottom split container
var bottomSplitContainer = new ui.Container();
var bottomSplitLayout = new ui.VLayout();
bottomSplitLayout.setMargins(0, 0, 0, 0);
bottomSplitLayout.setSpaceBetween(0);
bottomSplitContainer.setLayout(bottomSplitLayout);

var bottomSplitter = new ui.Container();
bottomSplitter.setFixedHeight(6);
bottomSplitter.setBackgroundColor("#181818");

// Add split containers to the wrapper layout
splitViewLayout.add(rightSplitContainer);
splitViewLayout.add(bottomSplitContainer);

// Splitter mouse handlers
var isDraggingSplitter = false;
var dragStartAbsX = 0;
var dragStartAbsY = 0;
var dragStartGraphSize = 0;

rightSplitter.onMousePress = function (position, button) {
  if (button === "left") {
    isDraggingSplitter = true;
    var absPoint = pointFromLocalPosition(rightSplitter, position)[0];
    dragStartAbsX = absPoint.x;
    dragStartGraphSize = state.splitGraphWidth;
    rightSplitter.setBackgroundColor("#4ffd7a");
  }
};

rightSplitter.onMouseMove = function (position) {
  if (isDraggingSplitter) {
    var absPoint = pointFromLocalPosition(rightSplitter, position)[0];
    var dx = absPoint.x - dragStartAbsX;

    var newGraphWidth;
    if (state.presetsOrientationLeftTop) {
      newGraphWidth = dragStartGraphSize - dx;
    } else {
      newGraphWidth = dragStartGraphSize + dx;
    }

    var windowWidth = ui.size().width;
    var minGraphW = metrics.MIN_GRAPH_WIDTH;
    var minPresetsW = metrics.MIN_PRESETS_SIDE_WIDTH;
    var maxGraphW = windowWidth - 22 - minPresetsW;

    state.splitGraphWidth = Math.max(minGraphW, Math.min(maxGraphW, newGraphWidth));
    handleResize();
  }
};

rightSplitter.onMouseRelease = function (position, button) {
  if (button === "left") {
    isDraggingSplitter = false;
    rightSplitter.setBackgroundColor("#181818");
    saveSplitGraphWidthSetting(state.splitGraphWidth);
  }
};

bottomSplitter.onMousePress = function (position, button) {
  if (button === "left") {
    isDraggingSplitter = true;
    var absPoint = pointFromLocalPosition(bottomSplitter, position)[0];
    dragStartAbsY = absPoint.y;
    dragStartGraphSize = state.splitGraphHeight;
    bottomSplitter.setBackgroundColor("#4ffd7a");
  }
};

bottomSplitter.onMouseMove = function (position) {
  if (isDraggingSplitter) {
    var absPoint = pointFromLocalPosition(bottomSplitter, position)[0];
    var dy = absPoint.y - dragStartAbsY;

    var newGraphHeight;
    if (state.presetsOrientationLeftTop) {
      newGraphHeight = dragStartGraphSize - dy;
    } else {
      newGraphHeight = dragStartGraphSize + dy;
    }

    var windowHeight = ui.size().height;
    var minGraphH = 100;
    var minPresetsH = 80;
    var maxGraphH = windowHeight - 139;

    state.splitGraphHeight = Math.max(minGraphH, Math.min(maxGraphH, newGraphHeight));
    handleResize();
  }
};

bottomSplitter.onMouseRelease = function (position, button) {
  if (button === "left") {
    isDraggingSplitter = false;
    bottomSplitter.setBackgroundColor("#181818");
    saveSplitGraphHeightSetting(state.splitGraphHeight);
  }
};

function applyLayoutMode() {
  if (state.presetsViewMode === "tab") {
    editorTabLayout.add(graphSectionContainer);
    presetsTabLayout.add(presetsScrollWrapper);

    var currentTab: any = tabView.currentTab();
    state.activePastePanel =
      currentTab === "Presets" || currentTab === 1 ? "presets" : "editor";

    applyWindowMinimumWidth();
  } else {
    if (state.presetsViewMode === "right") {
      if (state.presetsOrientationLeftTop) {
        rightSplitLayout.add(presetsScrollWrapper);
        rightSplitLayout.add(rightSplitter);
        rightSplitLayout.add(graphSectionContainer);
      } else {
        rightSplitLayout.add(graphSectionContainer);
        rightSplitLayout.add(rightSplitter);
        rightSplitLayout.add(presetsScrollWrapper);
      }
      applyWindowMinimumWidth();
    } else {
      if (state.presetsOrientationLeftTop) {
        bottomSplitLayout.add(presetsScrollWrapper);
        bottomSplitLayout.add(bottomSplitter);
        bottomSplitLayout.add(graphSectionContainer);
      } else {
        bottomSplitLayout.add(graphSectionContainer);
        bottomSplitLayout.add(bottomSplitter);
        bottomSplitLayout.add(presetsScrollWrapper);
      }
      applyWindowMinimumWidth();
    }
  }

  handleResize();
}

mainLayout.add(tabContainerWrapper);
mainLayout.add(splitViewContainer);
mainLayout.add(buttonRowContainer);

ui.onKeyPress = function (key, event) {
  return actions.handleKeyShortcut(key, event);
};
ui.onKeyDown = ui.onKeyPress;
ui.onKeyRelease = actions.handleKeyRelease;
ui.onKeyUp = actions.handleKeyRelease;
actions.attachPasteShortcutHandlers(graphContainer);
actions.attachPasteShortcutHandlers(presetsScroll);

presetsScroll.onMouseMove = function (position) {
  if (state.presetsViewMode !== "tab") {
    state.activePastePanel = "presets";
  }
};

// Zero out mainLayout margins to be 100% flush
mainLayout.setMargins(0, 0, 0, 0);

// Override Cavalry's default root UI padding
ui.setMargins(0, 0, 0, 0);
ui.setSpaceBetween(0);

ui.add(mainLayout);
ui.setBackgroundColor(GRAPH_COLORS.canvas);

// Initialize display
state.presetsViewMode = loadPresetsViewModeSetting();
state.presetsOrientationLeftTop = loadPresetsOrientationLeftTopSetting();
state.splitGraphWidth = loadSplitGraphWidthSetting();
state.splitGraphHeight = loadSplitGraphHeightSetting();
state.appliedGraphWidth = state.splitGraphWidth;
state.appliedGraphHeight = state.splitGraphHeight;

actions.updateTextInput();
actions.redrawGraphs();
buildPresetsTab();
applyLayoutMode();

// Tab change handler
tabView.onTabChanged = function () {
  actions.redrawGraphs();
  actions.saveTabPreference();
  var currentTab: any = tabView.currentTab();
  state.activePastePanel =
    currentTab === "Presets" || currentTab === 1 ? "presets" : "editor";
  if (currentTab === "Presets" || currentTab === 1) {
    buildPresetsTab();
  }
};

// Window size
applyWindowMinimumWidth();
ui.setMinimumHeight(265);

function safeSetHidden(widget, hidden) {
  if (!widget) return;
  if (typeof widget.setHidden === "function") {
    try {
      widget.setHidden(hidden);
      return;
    } catch (e) {}
  }
  if (typeof widget.setVisible === "function") {
    try {
      widget.setVisible(!hidden);
      return;
    } catch (e) {}
  }
  if (hidden) {
    if (typeof widget.setFixedWidth === "function") widget.setFixedWidth(0);
    if (typeof widget.setFixedHeight === "function") widget.setFixedHeight(0);
  }
}

// Resize handler
/**
 * Handle resizing of the main UI window, adjusting graphs and preset layouts based on the view mode.
 */
function handleResize() {
  var newWidth = Math.max(
    ui.size().width,
    getMinimumWindowWidthForMode(state.presetsViewMode),
  );
  var newHeight = ui.size().height;

  var newGraphWidth, newGraphHeight;
  var presetsContentWidth = Math.max(
    metrics.MIN_PRESETS_CONTENT_WIDTH,
    newWidth - (state.disableScrollbarEnabled ? 24 : 40),
  );

  if (state.presetsViewMode === "tab") {
    safeSetHidden(tabContainerWrapper, false);
    safeSetHidden(splitViewContainer, true);
    safeSetHidden(rightSplitContainer, true);
    safeSetHidden(bottomSplitContainer, true);

    tabContainerWrapper.setFixedWidth(newWidth - 12);
    tabContainerWrapper.setFixedHeight(newHeight - 50);
    splitViewContainer.setFixedWidth(0);
    splitViewContainer.setFixedHeight(0);
    rightSplitContainer.setFixedWidth(0);
    rightSplitContainer.setFixedHeight(0);
    bottomSplitContainer.setFixedWidth(0);
    bottomSplitContainer.setFixedHeight(0);

    newGraphWidth = Math.max(150, newWidth - 12);
    newGraphHeight = Math.max(100, newHeight - 112);

    graphSectionContainer.setFixedWidth(newWidth - 12);
    graphSectionContainer.setFixedHeight(newHeight - 78);
    graphContainer.setFixedWidth(newGraphWidth);
    graphContainer.setFixedHeight(newGraphHeight);

    var wrapperW = newWidth - 16;
    var wrapperH = newHeight - 82;
    presetsScrollWrapper.setFixedWidth(wrapperW);
    presetsScrollWrapper.setFixedHeight(wrapperH);
    presetsScroll.setFixedWidth(wrapperW + (state.disableScrollbarEnabled ? 16 : 0));
    presetsScroll.setFixedHeight(wrapperH);
  } else if (state.presetsViewMode === "right") {
    safeSetHidden(tabContainerWrapper, true);
    safeSetHidden(splitViewContainer, false);

    safeSetHidden(rightSplitContainer, false);
    safeSetHidden(bottomSplitContainer, true);

    splitViewContainer.setFixedWidth(newWidth - 12);
    splitViewContainer.setFixedHeight(newHeight - 50);

    bottomSplitContainer.setFixedWidth(0);
    bottomSplitContainer.setFixedHeight(0);

    var minGraphW = metrics.MIN_GRAPH_WIDTH;
    var minPresetsW = metrics.MIN_PRESETS_SIDE_WIDTH;
    var availableWidth = newWidth - 22;

    if (state.splitGraphWidth > availableWidth - minPresetsW) {
      state.splitGraphWidth = Math.max(minGraphW, availableWidth - minPresetsW);
    }
    state.splitGraphWidth = Math.max(minGraphW, state.splitGraphWidth);

    newGraphWidth = state.splitGraphWidth;
    newGraphHeight = Math.max(100, newHeight - 86);

    rightSplitContainer.setFixedWidth(newWidth - 16);
    rightSplitContainer.setFixedHeight(newHeight - 52);

    graphSectionContainer.setFixedWidth(state.splitGraphWidth);
    graphSectionContainer.setFixedHeight(newHeight - 52);
    graphContainer.setFixedWidth(state.splitGraphWidth);
    graphContainer.setFixedHeight(newGraphHeight);

    var presetsW = Math.max(minPresetsW, availableWidth - state.splitGraphWidth);
    var wrapperH = newHeight - 52;
    presetsScrollWrapper.setFixedWidth(presetsW);
    presetsScrollWrapper.setFixedHeight(wrapperH);
    presetsScroll.setFixedWidth(presetsW + (state.disableScrollbarEnabled ? 16 : 0));
    presetsScroll.setFixedHeight(wrapperH);

    presetsContentWidth = Math.max(
      metrics.MIN_PRESETS_SIDE_WIDTH - 24,
      presetsW - (state.disableScrollbarEnabled ? 8 : 24),
    );
  } else if (state.presetsViewMode === "bottom") {
    safeSetHidden(tabContainerWrapper, true);
    safeSetHidden(splitViewContainer, false);

    safeSetHidden(bottomSplitContainer, false);
    safeSetHidden(rightSplitContainer, true);

    splitViewContainer.setFixedWidth(newWidth - 12);
    splitViewContainer.setFixedHeight(newHeight - 50);

    rightSplitContainer.setFixedWidth(0);
    rightSplitContainer.setFixedHeight(0);

    var minGraphH = 100;
    var minPresetsH = 80;
    var availableHeight = newHeight - 59;

    if (state.splitGraphHeight > availableHeight - minPresetsH) {
      state.splitGraphHeight = Math.max(minGraphH, availableHeight - minPresetsH);
    }
    state.splitGraphHeight = Math.max(minGraphH, state.splitGraphHeight);

    newGraphWidth = Math.max(150, newWidth - 16);
    newGraphHeight = state.splitGraphHeight - 34;

    bottomSplitContainer.setFixedWidth(newWidth - 16);
    bottomSplitContainer.setFixedHeight(newHeight - 52);

    graphSectionContainer.setFixedWidth(newWidth - 16);
    graphSectionContainer.setFixedHeight(state.splitGraphHeight);
    graphContainer.setFixedWidth(newGraphWidth);
    graphContainer.setFixedHeight(newGraphHeight);

    var presetsH = Math.max(minPresetsH, availableHeight - state.splitGraphHeight);
    var wrapperW = newWidth - 16;
    presetsScrollWrapper.setFixedWidth(wrapperW);
    presetsScrollWrapper.setFixedHeight(presetsH);
    presetsScroll.setFixedWidth(wrapperW + (state.disableScrollbarEnabled ? 16 : 0));
    presetsScroll.setFixedHeight(presetsH);
  }

  if (presetSearchGroupContainer) {
    var searchGroupWidth = Math.max(100, newWidth - 97);
    presetSearchGroupContainer.setFixedWidth(searchGroupWidth);
    widgets.presetSearchInput.setFixedWidth(searchGroupWidth - 28);
  }

  if (buttonRowContainer) {
    buttonRowContainer.setFixedWidth(newWidth - 12);
    buttonRowContainer.setFixedHeight(24);
  }

  state.graphWidth = newGraphWidth;
  state.graphHeight = newGraphHeight;
  state.speedGraphWidth = newGraphWidth;
  state.speedGraphHeight = newGraphHeight;

  state.graphPadding = actions.calculateDynamicPadding(state.graphWidth, state.graphHeight);
  state.speedGraphPadding = actions.calculateDynamicPadding(
    state.speedGraphWidth,
    state.speedGraphHeight,
  );

  if (widgets.graphComponent) {
    widgets.graphComponent.setValueGraphSize(state.graphWidth, state.graphHeight);
    widgets.graphComponent.setSpeedGraphSize(
      state.speedGraphWidth,
      state.speedGraphHeight,
    );
  } else {
    widgets.graphCanvas.setSize(state.graphWidth, state.graphHeight);
    widgets.speedGraphCanvas.setSize(state.speedGraphWidth, state.speedGraphHeight);
  }

  state.appliedGraphWidth = state.splitGraphWidth;
  state.appliedGraphHeight = state.splitGraphHeight;

  actions.redrawGraphs();

  if (dragState && dragState.groupEntries) {
    dragState.groupEntries.forEach(function (entry) {
      if (
        entry.container &&
        typeof entry.container.setFixedWidth === "function"
      ) {
        entry.container.setFixedWidth(presetsContentWidth);
      }
      if (
        entry.titleDraw &&
        typeof entry.titleDraw.setFixedWidth === "function"
      ) {
        updateLibraryHeaderTitle(
          entry.titleDraw,
          entry.groupId,
          presetsContentWidth,
        );
      }
    });
  }
}
ui.onResize = handleResize;


return {
  tabView: tabView,
  graphContainer: graphContainer,
  presetsPanel: presetsPanel,
  presetsScroll: presetsScroll,
  presetsScrollWrapper: presetsScrollWrapper,
  dragState: dragState,
  applyLayoutMode: applyLayoutMode,
  handleResize: handleResize,
  applyWindowMinimumWidth: applyWindowMinimumWidth,
  applyScrollbarPreference: applyScrollbarPreference,
  buildPresetsTab: buildPresetsTab,
  resetDragState: resetDragState,
  pointFromLocalPosition: pointFromLocalPosition,
  updateLibraryHeaderTitle: updateLibraryHeaderTitle,
};
}
