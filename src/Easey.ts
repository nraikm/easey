import {
  DEFAULT_LIBRARIES,
  DEFAULT_EASING,
  GRAPH_CONFIG,
  DEFAULT_SPEED_EASING,
  GRAPH_COLORS,
  GITHUB_REPO,
  SCRIPT_NAME,
  CURRENT_VERSION,
  calculateDynamicPadding,
} from "./modules/constants.ts";
import iconGet from "./icons/icon-get.png";
import chevronDownIcon from "./icons/chevron-down.png";
import { checkForUpdate } from "./modules/updateChecker.ts";
import { getCompositionFrameRate } from "./modules/conversions.ts";
import {
  getEasingFromKeyframes,
  applyEasingToKeyframes,
  fixHoldPaths,
  setClampHoldsEnabled,
  copyKeyframeDuration,
  copyKeyframeValues,
  copyAllKeyframeInfo,
} from "./modules/keyframeOps.ts";
import {
  savePresetToLibrary,
  savePresetToNewLibrary,
  loadLibrariesFromPreferences,
  saveLibrariesToPreferences,
  saveApplyOnDragSetting,
  loadApplyOnDragSetting,
  saveLivePresetsApplySetting,
  loadLivePresetsApplySetting,
  saveConfirmActionsSetting,
  loadConfirmActionsSetting,
  saveClampIdenticalSetting,
  loadClampIdenticalSetting,
  saveLastCurveBehaviorSetting,
  loadLastCurveBehaviorSetting,
  saveLastSelectedTab,
  loadLastSelectedTab,
  savePresetsViewModeSetting,
  loadPresetsViewModeSetting,
  saveSplitGraphWidthSetting,
  loadSplitGraphWidthSetting,
  saveSplitGraphHeightSetting,
  loadSplitGraphHeightSetting,
  savePresetsOrientationLeftTopSetting,
  loadPresetsOrientationLeftTopSetting,
  saveDisableScrollbarSetting,
  loadDisableScrollbarSetting,
  saveGraphResolutionSetting,
  loadGraphResolutionSetting,
  copyCubicBezierToClipboard,
  copyEasingNumbersToClipboard,
  exportCurrentCurveToJson,
  exportLibraryToFlowFile,
  importLibraryFromFlowFile,
  mergeImportIntoLibrary,
  reorderPresetInLibrary,
  movePresetBetweenLibraries,
  reorderLibrary,
  savePresetAsJson,
  renamePresetInLibrary,
  deletePresetFromLibrary,
  renameLibrary,
} from "./modules/presetManager.ts";
import { setGridDivisions } from "./modules/graphGeometry.ts";
import { confirmMenuAction, createContextMenus } from "./modules/contextMenus.ts";
import { parsePastedEasingEntries } from "./modules/presetsPanel.ts";
import { createLayoutShell } from "./modules/layoutShell.ts";
import { createPresetActions } from "./modules/presetsPanel.ts";
import { createEditorPanel } from "./modules/editorPanel.ts";
import { createMouseSharedState } from "./modules/mouseHandlers.ts";


// Set the window title
ui.setTitle("Easey");

// Check for updates
checkForUpdate(GITHUB_REPO, SCRIPT_NAME, CURRENT_VERSION);

// ============================================================================
// STATE
// ============================================================================

// Copy presets from defaults so user changes can be persisted independently.
var libraries: any = {};

// UI-only state. Collapsed groups should survive tab rebuilds, but are not
// written to preferences because they do not change preset data.
var collapsedLibraries = {};
var showingSpeed = false;
var activePastePanel = "editor";

var currentEasing = Object.assign({}, DEFAULT_EASING);

// Speed graph state
var speedEasing = Object.assign({}, DEFAULT_SPEED_EASING);

// Value graph dimensions (mutable for dynamic resizing of the UI)
var graphWidth = GRAPH_CONFIG.width;
var graphHeight = GRAPH_CONFIG.height;
var graphPadding = calculateDynamicPadding(graphWidth, graphHeight);
var handleRadius = GRAPH_CONFIG.handleRadius;

// Speed graph dimensions
var speedGraphWidth = GRAPH_CONFIG.width;
var speedGraphHeight = GRAPH_CONFIG.height;
var speedGraphPadding = calculateDynamicPadding(
  speedGraphWidth,
  speedGraphHeight,
);
var speedHandleRadius = GRAPH_CONFIG.handleRadius;

// Drag state variables for managing user interaction with the value graph handles
var isDragging = false;
var dragHandle = null;
var dragStartPosition = null;
var dragStartEasing = null;
var axisConstraint = null;
var wasShiftHeld = false;
var lockedAngle = null;
var lockedLength = null;
var lastAxisConstraint = null;
var shiftEngageCoords = null;

// Drag state for speed graph
var speedDragging = false;
var speedDragHandle = null;

// User configuration and settings (persisted across sessions)
var applyOnDragEnabled = false;
var livePresetsApplyEnabled = false;
var confirmActionsEnabled = true;
var clampHoldsEnabled = true;
var lastCurveBehavior = 0; // 0 = Off, 1 = Before Edit, 2 = After Edit
var presetsViewMode = "tab";
var presetsOrientationLeftTop = false;
var disableScrollbarEnabled = false;
var splitGraphWidth = 250;
var splitGraphHeight = 180;
var graphResolution = 0.1;
var appliedGraphWidth = 250;
var appliedGraphHeight = 180;

// Last curve state
var lastEasing = null;
var activeEditSession = false;

/**
 * Start an edit session. Caches the curve before edit to allow for undo-like behavior
 * or restoring the last curve state.
 */
function startEditSession() {
  if (!activeEditSession) {
    activeEditSession = true;
    if (lastCurveBehavior === 1) {
      // BEFORE_EDIT
      lastEasing = Object.assign({}, currentEasing);
    }
  }
}

/**
 * End an edit session. Finalizes the curve state.
 */
function endEditSession() {
  if (activeEditSession) {
    activeEditSession = false;
    if (lastCurveBehavior === 2) {
      // AFTER_EDIT
      lastEasing = Object.assign({}, currentEasing);
      redrawGraphs();
    }
  }
}

/**
 * Update the last easing state for an atomic change (e.g., clicking a preset or pasting),
 * which doesn't follow the drag start/end session pattern.
 * @param {Object} prevEasing - The easing state before the atomic change.
 */
function updateLastEasingForAtomicChange(prevEasing) {
  endEditSession();
  if (lastCurveBehavior === 1) {
    // BEFORE_EDIT
    lastEasing = Object.assign({}, prevEasing);
  } else if (lastCurveBehavior === 2) {
    // AFTER_EDIT
    lastEasing = Object.assign({}, currentEasing);
  }
  redrawGraphs();
}

// Flags
var isUpdatingTextInput = false;

var isInitializingTab = false;
var lastPresetClick = {
  libName: "",
  presetName: "",
  time: 0,
};
var trackedApplyModifiers = {
  shift: false,
  option: false,
  command: false,
  control: false,
};

var appState = {
  get libraries() { return libraries; },
  get currentEasing() { return currentEasing; },
  get speedEasing() { return speedEasing; },
  get collapsedLibraries() { return collapsedLibraries; },
  get activePastePanel() { return activePastePanel; },
  set activePastePanel(value) { activePastePanel = value; },
  get presetsViewMode() { return presetsViewMode; },
  get splitGraphWidth() { return splitGraphWidth; },
  set splitGraphWidth(value) { splitGraphWidth = value; },
  get splitGraphHeight() { return splitGraphHeight; },
  set splitGraphHeight(value) { splitGraphHeight = value; },
  get appliedGraphWidth() { return appliedGraphWidth; },
  set appliedGraphWidth(value) { appliedGraphWidth = value; },
  get appliedGraphHeight() { return appliedGraphHeight; },
  set appliedGraphHeight(value) { appliedGraphHeight = value; },
  get graphWidth() { return graphWidth; },
  set graphWidth(value) { graphWidth = value; },
  get graphHeight() { return graphHeight; },
  set graphHeight(value) { graphHeight = value; },
  get graphPadding() { return graphPadding; },
  set graphPadding(value) { graphPadding = value; },
  get speedGraphWidth() { return speedGraphWidth; },
  set speedGraphWidth(value) { speedGraphWidth = value; },
  get speedGraphHeight() { return speedGraphHeight; },
  set speedGraphHeight(value) { speedGraphHeight = value; },
  get speedGraphPadding() { return speedGraphPadding; },
  set speedGraphPadding(value) { speedGraphPadding = value; },
  get showingSpeed() { return showingSpeed; },
  set showingSpeed(value) { showingSpeed = value; },
  get isDragging() { return isDragging; },
  set isDragging(value) { isDragging = value; },
  get dragHandle() { return dragHandle; },
  set dragHandle(value) { dragHandle = value; },
  get dragStartPosition() { return dragStartPosition; },
  set dragStartPosition(value) { dragStartPosition = value; },
  get dragStartEasing() { return dragStartEasing; },
  set dragStartEasing(value) { dragStartEasing = value; },
  get axisConstraint() { return axisConstraint; },
  set axisConstraint(value) { axisConstraint = value; },
  get wasShiftHeld() { return wasShiftHeld; },
  set wasShiftHeld(value) { wasShiftHeld = value; },
  get lockedAngle() { return lockedAngle; },
  set lockedAngle(value) { lockedAngle = value; },
  get lockedLength() { return lockedLength; },
  set lockedLength(value) { lockedLength = value; },
  get lastAxisConstraint() { return lastAxisConstraint; },
  set lastAxisConstraint(value) { lastAxisConstraint = value; },
  get shiftEngageCoords() { return shiftEngageCoords; },
  set shiftEngageCoords(value) { shiftEngageCoords = value; },
  get speedDragging() { return speedDragging; },
  set speedDragging(value) { speedDragging = value; },
  get speedDragHandle() { return speedDragHandle; },
  set speedDragHandle(value) { speedDragHandle = value; },
  get applyOnDragEnabled() { return applyOnDragEnabled; },
  set applyOnDragEnabled(value) { applyOnDragEnabled = value; },
  get livePresetsApplyEnabled() { return livePresetsApplyEnabled; },
  set livePresetsApplyEnabled(value) { livePresetsApplyEnabled = value; },
  get confirmActionsEnabled() { return confirmActionsEnabled; },
  set confirmActionsEnabled(value) { confirmActionsEnabled = value; },
  get clampHoldsEnabled() { return clampHoldsEnabled; },
  set clampHoldsEnabled(value) { clampHoldsEnabled = value; },
  get disableScrollbarEnabled() { return disableScrollbarEnabled; },
  set disableScrollbarEnabled(value) { disableScrollbarEnabled = value; },
  get lastCurveBehavior() { return lastCurveBehavior; },
  set lastCurveBehavior(value) { lastCurveBehavior = value; },
  get lastEasing() { return lastEasing; },
  set lastEasing(value) { lastEasing = value; },
  get presetsOrientationLeftTop() { return presetsOrientationLeftTop; },
  set presetsOrientationLeftTop(value) { presetsOrientationLeftTop = value; },
  set presetsViewMode(value) { presetsViewMode = value; },
  get graphResolution() { return graphResolution; },
  set graphResolution(value) { graphResolution = value; },
};

// ============================================================================
// UI ELEMENTS
// Definition of all Cavalry UI widgets, buttons, canvases, and layout containers.
// ============================================================================

var editorPanel = createEditorPanel({
  graphConfig: GRAPH_CONFIG,
  icons: {
    get: iconGet,
    settings: api.getAppAssetsPath() + "/icons/options.png",
  },
  setUpdatingTextInput: function (value) {
    isUpdatingTextInput = value;
  },
});

var graphCanvas = editorPanel.graphCanvas;
var speedGraphCanvas = editorPanel.speedGraphCanvas;
var graphComponent = editorPanel.graphComponent;
var applyButton = editorPanel.applyButton;
var getButton = editorPanel.getButton;
var mainContextButton = editorPanel.mainContextButton;

var COORDINATE_LABEL_WIDTH = editorPanel.metrics.COORDINATE_LABEL_WIDTH;
var COORDINATE_VALUE_WIDTH = editorPanel.metrics.COORDINATE_VALUE_WIDTH;
var COORDINATE_BORDER_WIDTH = editorPanel.metrics.COORDINATE_BORDER_WIDTH;
var COORDINATE_CONTAINER_WIDTH =
  editorPanel.metrics.COORDINATE_CONTAINER_WIDTH;

// Dependent minimum widths for layout elements and window
var CONTROLS_LAYOUT_MARGINS = 4 + 4; // left margin 4, right margin 4
var CONTROLS_LAYOUT_SPACING = 5 * 1; // 5 gaps between 6 controls
var GRAPH_MODE_BTN_WIDTH = 20;
var MAIN_CONTEXT_BTN_WIDTH = 20;
var MAIN_LAYOUT_MARGINS = 2 + 2; // left margin 2, right margin 2
var MIN_WINDOW_BREATHING_ROOM = 8;
var MIN_GRAPH_SECTION_WIDTH = 0;
var MIN_PRESETS_SIDE_WIDTH = 72;
var MIN_PRESETS_CONTENT_WIDTH = 120;
var MIN_DIALOG_WIDTH = 320;

// Minimum width of the controls layout (also the minimum width of the graph section in side-by-side mode)
var MIN_GRAPH_WIDTH = Math.max(
  MIN_GRAPH_SECTION_WIDTH,
  GRAPH_MODE_BTN_WIDTH +
    MAIN_CONTEXT_BTN_WIDTH +
    CONTROLS_LAYOUT_MARGINS +
    CONTROLS_LAYOUT_SPACING +
    4 * COORDINATE_CONTAINER_WIDTH,
);

// Minimum width of the entire window
var MIN_WINDOW_WIDTH =
  MIN_GRAPH_WIDTH + MAIN_LAYOUT_MARGINS + MIN_WINDOW_BREATHING_ROOM;

var x1Input = editorPanel.x1Input;
var y1Input = editorPanel.y1Input;
var x2Input = editorPanel.x2Input;
var y2Input = editorPanel.y2Input;

var coordinateInputs = editorPanel.coordinateInputs;
var coordinateKeys = editorPanel.coordinateKeys;
var coordinateFieldEditing = [false, false, false, false];
var COORDINATE_SCRUB_PIXELS_PER_STEP = 0.01;
var COORDINATE_SCRUB_DRAG_THRESHOLD = 3;
var graphModeBtn = editorPanel.graphModeBtn;

// Quick Presets Dropdown
var presetSearchInput = new ui.LineEdit();
var presetSearchBtn = new ui.ImageButton(chevronDownIcon);
presetSearchBtn.setToolTip("Show presets");
presetSearchBtn.setImageSize(14, 14);
var presetSearchGroupContainer;

var isUpdatingPresetSearchInputText = false;

/**
 * Synchronize the visual selection state of the preset pane with the current easing.
 */
function syncPresetPaneSelection() {
  if (typeof presetsPanel !== "undefined" && presetsPanel) {
    presetsPanel.syncPresetPaneSelection();
  }
}

function resetPresetDropdown() {
  if (presetSearchInput && presetSearchInput.getText() !== "") {
    isUpdatingPresetSearchInputText = true;
    presetSearchInput.setText("");
    isUpdatingPresetSearchInputText = false;
  }
  syncPresetPaneSelection();
}

/**
 * Check if the user has selected any keyframes in the Cavalry editor.
 * @returns {boolean} True if keyframes are selected, otherwise false.
 */
function hasSelectedKeyframes() {
  try {
    var keyframeIds = api.getSelectedKeyframeIds();
    return keyframeIds && keyframeIds.length >= 1;
  } catch (e) {
    return false;
  }
}

/**
 * Determine if the current platform is macOS.
 * @returns {boolean} True if running on macOS, otherwise false.
 */
function isMacPlatform() {
  try {
    if (!api.getPlatform) return true;
    var platform = String(api.getPlatform()).toLowerCase();
    return platform.indexOf("mac") !== -1 || platform.indexOf("darwin") !== -1;
  } catch (e) {
    return true;
  }
}

/**
 * Safely read a modifier key state from the Cavalry API.
 * @param {string} fnName - The API function name to call (e.g., "isShiftHeld").
 * @returns {boolean} True if the modifier is held, otherwise false.
 */
function readModifierState(fnName) {
  try {
    return !!(api[fnName] && api[fnName]());
  } catch (e) {
    return false;
  }
}

/**
 * Normalize a key name string to a standard lowercase format for easier comparison.
 * @param {string|number|null} key - The key name or code.
 * @returns {string} The normalized key name.
 */
function normalizeKeyName(key) {
  if (key === undefined || key === null) return "";
  return String(key)
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
}

function updateTrackedApplyModifiersFromEvent(event) {
  if (!event) return;
  if (event.shiftKey !== undefined)
    trackedApplyModifiers.shift = !!event.shiftKey;
  if (event.altKey !== undefined) trackedApplyModifiers.option = !!event.altKey;
  if (event.optionKey !== undefined)
    trackedApplyModifiers.option = !!event.optionKey;
  if (event.metaKey !== undefined)
    trackedApplyModifiers.command = !!event.metaKey;
  if (event.commandKey !== undefined)
    trackedApplyModifiers.command = !!event.commandKey;
  if (event.ctrlKey !== undefined)
    trackedApplyModifiers.control = !!event.ctrlKey;
  if (event.controlKey !== undefined)
    trackedApplyModifiers.control = !!event.controlKey;
}

function updateTrackedApplyModifiersFromKey(key, event, isDown) {
  updateTrackedApplyModifiersFromEvent(event);

  var name = normalizeKeyName(key);
  if (name === "shift" || name === "keyshift" || name === "16777248") {
    trackedApplyModifiers.shift = isDown;
  } else if (
    name === "alt" ||
    name === "option" ||
    name === "keyalt" ||
    name === "keyoption" ||
    name === "16777251"
  ) {
    trackedApplyModifiers.option = isDown;
  } else if (
    name === "meta" ||
    name === "cmd" ||
    name === "command" ||
    name === "keymeta" ||
    name === "keycommand" ||
    name === "16777250"
  ) {
    trackedApplyModifiers.command = isDown;
  } else if (
    name === "control" ||
    name === "ctrl" ||
    name === "keycontrol" ||
    name === "keyctrl" ||
    name === "16777249"
  ) {
    trackedApplyModifiers.control = isDown;
  }
}

function clearTrackedApplyModifiers() {
  trackedApplyModifiers.shift = false;
  trackedApplyModifiers.option = false;
  trackedApplyModifiers.command = false;
  trackedApplyModifiers.control = false;
}

function captureLiveApplyModifiers() {
  trackedApplyModifiers.shift =
    trackedApplyModifiers.shift || readModifierState("isShiftHeld");
  trackedApplyModifiers.option =
    trackedApplyModifiers.option || readModifierState("isAltHeld");
  trackedApplyModifiers.command =
    trackedApplyModifiers.command ||
    readModifierState("isControlHeld") ||
    readModifierState("isMetaHeld");
  trackedApplyModifiers.control =
    trackedApplyModifiers.control || readModifierState("isMetaHeld");
}

function getHeldApplyTargetSections() {
  var targetSections = {
    incoming: false,
    middle: false,
    outgoing: false,
  };

  var shiftHeld =
    readModifierState("isShiftHeld") || trackedApplyModifiers.shift;
  var controlHeld =
    readModifierState("isControlHeld") || trackedApplyModifiers.control;
  var metaHeld =
    readModifierState("isMetaHeld") || trackedApplyModifiers.command;
  var altHeld = readModifierState("isAltHeld") || trackedApplyModifiers.option;
  var isMac = isMacPlatform();

  targetSections.incoming = shiftHeld;
  if (isMac) {
    targetSections.outgoing = controlHeld || metaHeld;
    targetSections.middle = altHeld;
  } else {
    targetSections.middle = controlHeld;
    targetSections.outgoing = altHeld;
    if (!controlHeld && !altHeld && metaHeld) {
      targetSections.middle = true;
    }
  }

  return targetSections.incoming ||
    targetSections.middle ||
    targetSections.outgoing
    ? targetSections
    : null;
}

function applyEasingToSelectionIfAvailable(targetSections?) {
  if (!hasSelectedKeyframes()) return false;
  applyEasingToKeyframes(currentEasing, targetSections);
  return true;
}

// Live presets are applied via handlePresetClick.

/**
 * Apply a specific preset's data to the current curve, updating UI and potentially the selection.
 * @param {Object} pData - The preset easing data containing x1, y1, x2, y2.
 * @param {boolean} applyImmediately - Whether to apply the easing to keyframes right away.
 * @param {Object} [targetSections] - Optional sections of the curve to apply to (e.g. incoming).
 */
function applyPresetData(pData, applyImmediately, targetSections?) {
  ui.clearContextMenu();
  var prev = Object.assign({}, currentEasing);
  currentEasing.x1 = pData.x1;
  currentEasing.y1 = pData.y1;
  currentEasing.x2 = pData.x2;
  currentEasing.y2 = pData.y2;
  updateLastEasingForAtomicChange(prev);
  updateTextInput();
  redrawGraphs();
  saveTabPreference();
  if (applyOnDragEnabled || applyImmediately) {
    applyEasingToSelectionIfAvailable(targetSections);
  }
  buildPresetsTab();
}

function confirmPresetAction(title, message) {
  return confirmMenuAction(confirmActionsEnabled, title, message);
}

function handlePresetClick(
  libName,
  presetName,
  presetData,
  pressedTargetSections = null,
) {
  var now = Date.now();
  var targetSections = pressedTargetSections || getHeldApplyTargetSections();
  var isDoubleClick =
    lastPresetClick.libName === libName &&
    lastPresetClick.presetName === presetName &&
    now - lastPresetClick.time <= 450;

  lastPresetClick.libName = libName;
  lastPresetClick.presetName = presetName;
  lastPresetClick.time = now;

  if (targetSections) {
    applyPresetData(presetData, true, targetSections);
    clearTrackedApplyModifiers();
    return;
  }

  if (livePresetsApplyEnabled || isDoubleClick) {
    applyPresetData(presetData, true);
    return;
  }

  setCurrentEasingFromData(presetData);
  buildPresetsTab();
}

function applyCurrentEasingToSelection(targetSections = null) {
  updateFromTextInput();
  applyEasingToKeyframes(currentEasing, targetSections);
  saveTabPreference();
}

var presetActions = createPresetActions({
  state: appState,
  widgets: {
    presetSearchInput: presetSearchInput,
  },
  actions: {
    applyPresetData: applyPresetData,
    buildPresetsTab: buildPresetsTab,
    resetPresetDropdown: resetPresetDropdown,
    updateTextInput: updateTextInput,
    redrawGraphs: redrawGraphs,
    saveTabPreference: saveTabPreference,
    updateLastEasingForAtomicChange: updateLastEasingForAtomicChange,
    applyEasingToSelectionIfAvailable: applyEasingToSelectionIfAvailable,
  },
});
function showPresetSuggestions(filterText, showAllWithCompletions) { return presetActions.showPresetSuggestions(filterText, showAllWithCompletions); }
function applyPresetByNameOrFilter(text) { return presetActions.applyPresetByNameOrFilter(text); }
function getExactPresetByName(text) { return presetActions.getExactPresetByName(text); }
function setCurrentEasingFromData(pData) { return presetActions.setCurrentEasingFromData(pData); }
function isCurrentPreset(preset) { return presetActions.isCurrentPreset(preset); }
function pasteEasingToEditor() { return presetActions.pasteEasingToEditor(); }
function pasteEasingToPresets(targetOverride?) { return presetActions.pasteEasingToPresets(targetOverride); }
function getPresetInsertTargetAfter(libName, presetName) { return presetActions.getPresetInsertTargetAfter(libName, presetName); }

function handlePasteShortcut() {
  var currentTab: any = tabView ? tabView.currentTab() : null;
  if (currentTab === "Presets" || currentTab === 1) {
    activePastePanel = "presets";
  } else if (currentTab === "Editor" || currentTab === 0) {
    activePastePanel = "editor";
  }

  if (activePastePanel === "presets") {
    return pasteEasingToPresets();
  }
  return pasteEasingToEditor();
}

function isPasteKey(key) {
  if (key === undefined || key === null) return false;
  var text = String(key).toLowerCase();
  return text === "v" || text === "key_v" || text === "keyv" || text === "86";
}

function isApplyKey(key) {
  if (key === undefined || key === null) return false;
  var text = String(key).toLowerCase();
  return (
    text === "return" ||
    text === "enter" ||
    text === "key_return" ||
    text === "key_enter" ||
    text === "16777220" ||
    text === "16777221" ||
    text === "13"
  );
}

function isPasteModifierHeld(event) {
  if (event && (event.metaKey || event.ctrlKey || event.commandKey))
    return true;
  try {
    return api.isMetaHeld() || api.isControlHeld();
  } catch (e) {
    return false;
  }
}

function handleKeyShortcut(key, event) {
  updateTrackedApplyModifiersFromKey(key, event, true);

  if (isPasteKey(key) && isPasteModifierHeld(event)) {
    handlePasteShortcut();
    return true;
  }
  if (isApplyKey(key)) {
    var targetSections = getHeldApplyTargetSections();
    applyCurrentEasingToSelection(targetSections);
    clearTrackedApplyModifiers();
    return true;
  }
  return false;
}

function handleKeyRelease(key, event) {
  updateTrackedApplyModifiersFromKey(key, event, false);
  return false;
}

function attachPasteShortcutHandlers(widget) {
  if (!widget) return;
  widget.onKeyPress = function (key, event) {
    return handleKeyShortcut(key, event);
  };
  widget.onKeyDown = widget.onKeyPress;
  widget.onKeyRelease = handleKeyRelease;
  widget.onKeyUp = handleKeyRelease;
}

// ============================================================================
// HELPER FUNCTIONS
// Helper methods for formatting, mathematical calculations, and parsing inputs.
// ============================================================================

var sharedState = createMouseSharedState(appState);

// Get current graph config
function getGraphConfig() {
  return {
    width: graphWidth,
    height: graphHeight,
    padding: graphPadding,
    handleRadius: handleRadius,
  };
}

function getSpeedGraphConfig() {
  return {
    width: speedGraphWidth,
    height: speedGraphHeight,
    padding: speedGraphPadding,
    handleRadius: speedHandleRadius,
  };
}

function syncPresetSearchInputText() {
  if (!presetSearchInput) return;
  var foundName = "";
  var libNames = Object.keys(libraries);
  for (var i = 0; i < libNames.length; i++) {
    var libName = libNames[i];
    var libPresets = libraries[libName];
    for (var presetName in libPresets) {
      var pData = libPresets[presetName];
      if (
        Math.abs(currentEasing.x1 - pData.x1) < 0.01 &&
        Math.abs(currentEasing.y1 - pData.y1) < 0.01 &&
        Math.abs(currentEasing.x2 - pData.x2) < 0.01 &&
        Math.abs(currentEasing.y2 - pData.y2) < 0.01
      ) {
        foundName = presetName;
        break;
      }
    }
    if (foundName) break;
  }
  isUpdatingPresetSearchInputText = true;
  presetSearchInput.setText(foundName);
  isUpdatingPresetSearchInputText = false;
  syncPresetPaneSelection();
}

function lockCoordinateField(index) {}
function focusCoordinateField(index) {}

function setCoordinateFieldValuesFromEasing() {
  isUpdatingTextInput = true;
  x1Input.setValue(currentEasing.x1);
  y1Input.setValue(currentEasing.y1);
  x2Input.setValue(currentEasing.x2);
  y2Input.setValue(currentEasing.y2);
  isUpdatingTextInput = false;
}

function applyCoordinateScrubValue(index, value) {
  currentEasing[coordinateKeys[index]] = value;
  isUpdatingTextInput = true;
  coordinateInputs[index].setValue(value);
  isUpdatingTextInput = false;
  redrawGraphs();
}

function getClipboardEasingValue() {
  try {
    var parsed = parsePastedEasingEntries(api.getClipboardText());
    return parsed.entries.length > 0 ? parsed.entries[0].data : null;
  } catch (e) {
    return null;
  }
}

function getCoordinateFieldText(input) {
  try {
    if (input && typeof input.getText === "function") {
      return input.getText();
    }
  } catch (e) {}

  try {
    if (input && typeof input.getValue === "function") {
      return String(input.getValue());
    }
  } catch (e) {}

  return "";
}

function applyParsedCoordinateValues(pasted, applyImmediately) {
  if (!pasted) return false;

  var prev = Object.assign({}, currentEasing);
  currentEasing.x1 = pasted.x1;
  currentEasing.y1 = pasted.y1;
  currentEasing.x2 = pasted.x2;
  currentEasing.y2 = pasted.y2;
  updateLastEasingForAtomicChange(prev);

  setCoordinateFieldValuesFromEasing();
  resetPresetDropdown();
  redrawGraphs();
  if (applyImmediately) {
    applyEasingToSelectionIfAvailable();
  }
  return true;
}

function applyPastedCoordinateValues(applyImmediately) {
  return applyParsedCoordinateValues(
    getClipboardEasingValue(),
    applyImmediately,
  );
}



function wireCoordinateInput(input, index) {
  input.onValueChanged = function () {
    if (isUpdatingTextInput) return;

    var newValue = input.getValue();
    if (isNaN(newValue)) return;

    startEditSession();
    resetPresetDropdown();
    currentEasing[coordinateKeys[index]] = newValue;
    redrawGraphs();
    if (applyOnDragEnabled) {
      applyEasingToSelectionIfAvailable();
    }
  };

  input.onValueCommitted = function () {
    if (isUpdatingTextInput) return;

    var committedValue = input.getValue();
    if (isNaN(committedValue)) {
      isUpdatingTextInput = true;
      input.setValue(currentEasing[coordinateKeys[index]]);
      isUpdatingTextInput = false;
      return;
    }

    resetPresetDropdown();
    currentEasing[coordinateKeys[index]] = committedValue;

    isUpdatingTextInput = true;
    input.setValue(committedValue);
    isUpdatingTextInput = false;

    redrawGraphs();
    if (applyOnDragEnabled) {
      applyEasingToSelectionIfAvailable();
    }
    endEditSession();
    saveTabPreference();
  };
}

function setupCoordinateScrub(widgets, coordinateIndex) {
  var scrubState = {
    pressed: false,
    dragging: false,
    startX: 0,
    startValue: 0,
  };

  function onMousePress(position, button) {
    if (button !== "left") return;
    scrubState.pressed = true;
    scrubState.dragging = false;
    scrubState.startX = position.x;
    scrubState.startValue = currentEasing[coordinateKeys[coordinateIndex]];
  }

  function onMouseMove(position) {
    if (!scrubState.pressed) return;

    var delta = position.x - scrubState.startX;
    if (
      !scrubState.dragging &&
      Math.abs(delta) < COORDINATE_SCRUB_DRAG_THRESHOLD
    ) {
      return;
    }

    if (!scrubState.dragging) {
      startEditSession();
      scrubState.dragging = true;
    }

    applyCoordinateScrubValue(
      coordinateIndex,
      scrubState.startValue + delta * COORDINATE_SCRUB_PIXELS_PER_STEP,
    );
  }

  function onMouseRelease(position, button) {
    if (button !== "left" || !scrubState.pressed) return;
    var didDrag = scrubState.dragging;
    scrubState.pressed = false;
    scrubState.dragging = false;
    if (!didDrag) return;

    resetPresetDropdown();
    if (applyOnDragEnabled) applyEasingToSelectionIfAvailable();
    endEditSession();
    saveTabPreference();
  }

  widgets.forEach(function (widget) {
    if (!widget) return;

    try {
      if (typeof widget.useHoverEvents === "function") {
        widget.useHoverEvents(true);
      }
    } catch (e) {}

    widget.onMousePress = onMousePress;
    widget.onMouseMove = onMouseMove;
    widget.onMouseRelease = onMouseRelease;
  });
}

// Update text input with current easing values
function updateTextInput() {
  var x1 = currentEasing.x1 !== undefined ? currentEasing.x1 : 0.25;
  var y1 = currentEasing.y1 !== undefined ? currentEasing.y1 : 0.1;
  var x2 = currentEasing.x2 !== undefined ? currentEasing.x2 : 0.25;
  var y2 = currentEasing.y2 !== undefined ? currentEasing.y2 : 1.0;

  isUpdatingTextInput = true;
  x1Input.setValue(x1);
  y1Input.setValue(y1);
  x2Input.setValue(x2);
  y2Input.setValue(y2);
  isUpdatingTextInput = false;

  syncPresetSearchInputText();
}

// Parse text input and update curve
/**
 * Parse the text input fields and update the current easing curve, then redraw graphs.
 */
function updateFromTextInput() {
  resetPresetDropdown();
  var vX1 = x1Input.getValue();
  var vY1 = y1Input.getValue();
  var vX2 = x2Input.getValue();
  var vY2 = y2Input.getValue();
  if (!isNaN(vX1)) currentEasing.x1 = vX1;
  if (!isNaN(vY1)) currentEasing.y1 = vY1;
  if (!isNaN(vX2)) currentEasing.x2 = vX2;
  if (!isNaN(vY2)) currentEasing.y2 = vY2;
  redrawGraphs();
}

// Redraw both graphs
/**
 * Redraw both the value and speed graphs with the current easing configuration.
 */
function redrawGraphs() {
  graphComponent.redraw({
    currentEasing: currentEasing,
    graphConfig: getGraphConfig(),
    lastEasing: lastCurveBehavior !== 0 ? lastEasing : null,
    speedEasing: speedEasing,
    speedGraphConfig: getSpeedGraphConfig(),
  });
}

// Save tab preference wrapper
function saveTabPreference() {
  if (!isInitializingTab) {
    saveLastSelectedTab(tabView.currentTab());
  }
}

// ============================================================================
// MOUSE HANDLERS
// ============================================================================

editorPanel.setupGraphHandlers({
  sharedState: sharedState,
  getGraphConfig: getGraphConfig,
  getSpeedGraphConfig: getSpeedGraphConfig,
  onDragStart: function () {
    startEditSession();
  },
  onValueUpdate: function () {
    resetPresetDropdown();
    updateTextInput();
    redrawGraphs();
  },
  onValueDragEnd: function () {
    if (applyOnDragEnabled) applyEasingToSelectionIfAvailable();
    endEditSession();
    saveTabPreference();
  },
  onMouseFocus: function () {
    activePastePanel = "editor";
    endEditSession();
  },
  onContextMenu: function () {
    activePastePanel = "editor";
    showEditorContextMenu();
  },
  onSpeedUpdate: function () {
    resetPresetDropdown();
    updateTextInput();
    redrawGraphs();
    if (applyOnDragEnabled) {
      applyEasingToSelectionIfAvailable();
    }
  },
  onSpeedDragEnd: function () {
    endEditSession();
    saveTabPreference();
  },
});

attachPasteShortcutHandlers(graphCanvas);
attachPasteShortcutHandlers(speedGraphCanvas);

// ============================================================================
// CONTEXT MENUS
var contextMenus = createContextMenus({
  state: appState,
  actions: {
    buildPresetsTab: buildPresetsTab,
    pasteEasingToEditor: pasteEasingToEditor,
    pasteEasingToPresets: pasteEasingToPresets,
    getPresetInsertTargetAfter: getPresetInsertTargetAfter,
    updateLastEasingForAtomicChange: updateLastEasingForAtomicChange,
    resetPresetDropdown: resetPresetDropdown,
    updateTextInput: updateTextInput,
    redrawGraphs: redrawGraphs,
    saveTabPreference: saveTabPreference,
    applyEasingToSelectionIfAvailable: applyEasingToSelectionIfAvailable,
    applyScrollbarPreference: applyScrollbarPreference,
    handleResize: handleResize,
    applyLayoutMode: applyLayoutMode,
    confirmPresetAction: confirmPresetAction,
    resetDragState: resetDragState,
  },
});
function showPresetItemContextMenu(libName, presetName, presetData) {
  return contextMenus.showPresetItemContextMenu(libName, presetName, presetData);
}
function showEditorContextMenu() {
  return contextMenus.showEditorContextMenu();
}
function showPresetContextMenu() {
  return contextMenus.showPresetContextMenu();
}
function showPresetsPageContextMenu() {
  return contextMenus.showPresetsPageContextMenu();
}
function showLibraryContextMenu(libName) {
  return contextMenus.showLibraryContextMenu(libName);
}

// ============================================================================
// EVENT HANDLERS
// Logic for button clicks, keyboard shortcuts, and search inputs.
// ============================================================================

applyButton.onClick = function () {
  var targetSections = getHeldApplyTargetSections();
  applyCurrentEasingToSelection(targetSections);
  clearTrackedApplyModifiers();
};

applyButton.onMousePress = function (position, button) {
  if (button === "left") {
    captureLiveApplyModifiers();
  }
};

if (typeof applyButton.setDefault === "function") {
  applyButton.setDefault(true);
}
if (typeof applyButton.setAutoDefault === "function") {
  applyButton.setAutoDefault(true);
}
if (typeof ui.setDefaultButton === "function") {
  ui.setDefaultButton(applyButton);
}

getButton.onClick = function () {
  var prev = Object.assign({}, currentEasing);
  if (getEasingFromKeyframes(currentEasing)) {
    updateLastEasingForAtomicChange(prev);
    updateTextInput();
    redrawGraphs();
  }
  saveTabPreference();
};

mainContextButton.onClick = function () {
  showPresetContextMenu();
};

// Wire the inputs up cleanly
wireCoordinateInput(x1Input, 0);
wireCoordinateInput(y1Input, 1);
wireCoordinateInput(x2Input, 2);
wireCoordinateInput(y2Input, 3);

coordinateInputs.forEach(attachPasteShortcutHandlers);

presetSearchInput.onValueChanged = function () {
  if (isUpdatingPresetSearchInputText) return;

  var exactPreset = getExactPresetByName(presetSearchInput.getText());
  if (exactPreset) {
    applyPresetData(exactPreset, true);
  }
};

presetSearchInput.onValueCommitted = function () {
  var text = presetSearchInput.getText();
  if (text) {
    applyPresetByNameOrFilter(text);
  } else {
    applyCurrentEasingToSelection();
  }
};

presetSearchBtn.onClick = function () {
  showPresetSuggestions(presetSearchInput.getText(), true);
};

// ============================================================================
// INITIALIZATION
// ============================================================================

// Load saved presets
loadLibrariesFromPreferences(libraries, DEFAULT_LIBRARIES);

// Load apply on drag setting
applyOnDragEnabled = loadApplyOnDragSetting();

// Load live presets apply setting
livePresetsApplyEnabled = loadLivePresetsApplySetting();

// Load destructive action confirmation setting
confirmActionsEnabled = loadConfirmActionsSetting();

// Load clamp holds setting
clampHoldsEnabled = loadClampIdenticalSetting();
setClampHoldsEnabled(clampHoldsEnabled);

// Load disable scrollbar setting
disableScrollbarEnabled = loadDisableScrollbarSetting();

// Load last curve behavior setting
lastCurveBehavior = loadLastCurveBehaviorSetting();
if (lastCurveBehavior !== 0) {
  lastEasing = Object.assign({}, currentEasing);
}

// Load graph resolution setting
graphResolution = loadGraphResolutionSetting();
setGridDivisions(Math.round(1 / graphResolution));

// ============================================================================
// UI LAYOUT
var layoutShell = createLayoutShell({
  state: appState,
  widgets: {
    getButton: getButton,
    applyButton: applyButton,
    presetSearchInput: presetSearchInput,
    presetSearchBtn: presetSearchBtn,
    coordinateInputs: coordinateInputs,
    graphModeBtn: graphModeBtn,
    mainContextButton: mainContextButton,
    graphComponent: graphComponent,
    graphCanvas: graphCanvas,
    speedGraphCanvas: speedGraphCanvas,
  },
  actions: {
    setupCoordinateScrub: setupCoordinateScrub,
    redrawGraphs: redrawGraphs,
    attachPasteShortcutHandlers: attachPasteShortcutHandlers,
    handleKeyShortcut: handleKeyShortcut,
    handleKeyRelease: handleKeyRelease,
    showLibraryContextMenu: showLibraryContextMenu,
    showPresetItemContextMenu: showPresetItemContextMenu,
    showPresetsPageContextMenu: showPresetsPageContextMenu,
    captureLiveApplyModifiers: captureLiveApplyModifiers,
    handlePresetClick: handlePresetClick,
    updateTextInput: updateTextInput,
    saveTabPreference: saveTabPreference,
    calculateDynamicPadding: calculateDynamicPadding,
  },
  metrics: {
    COORDINATE_CONTAINER_WIDTH: COORDINATE_CONTAINER_WIDTH,
    COORDINATE_BORDER_WIDTH: COORDINATE_BORDER_WIDTH,
    COORDINATE_LABEL_WIDTH: COORDINATE_LABEL_WIDTH,
    COORDINATE_VALUE_WIDTH: COORDINATE_VALUE_WIDTH,
    MIN_PRESETS_CONTENT_WIDTH: MIN_PRESETS_CONTENT_WIDTH,
    MIN_PRESETS_SIDE_WIDTH: MIN_PRESETS_SIDE_WIDTH,
    MIN_GRAPH_WIDTH: MIN_GRAPH_WIDTH,
    MIN_WINDOW_WIDTH: MIN_WINDOW_WIDTH,
  },
});
var tabView = layoutShell.tabView;
var graphContainer = layoutShell.graphContainer;
var presetsPanel = layoutShell.presetsPanel;
var presetsScroll = layoutShell.presetsScroll;
var presetsScrollWrapper = layoutShell.presetsScrollWrapper;
var dragState = layoutShell.dragState;
function applyLayoutMode() { return layoutShell.applyLayoutMode(); }
function handleResize() { return layoutShell.handleResize(); }
function applyWindowMinimumWidth() { return layoutShell.applyWindowMinimumWidth(); }
function applyScrollbarPreference() { return layoutShell.applyScrollbarPreference(); }
function buildPresetsTab() { return layoutShell.buildPresetsTab(); }
function resetDragState() { return layoutShell.resetDragState(); }
function pointFromLocalPosition(widget, position) { return layoutShell.pointFromLocalPosition(widget, position); }
function updateLibraryHeaderTitle(titleDraw, libName, availableWidth) { return layoutShell.updateLibraryHeaderTitle(titleDraw, libName, availableWidth); }

// Show window
ui.show();

// Restore last selected tab
isInitializingTab = true;
if (presetsViewMode === "tab") {
  var savedTab = loadLastSelectedTab();
  if (savedTab !== null) {
    tabView.setTab(savedTab);
  }
}

// Reset init flag after delay
var initTimerCallback = {
  onTimeout: function () {
    isInitializingTab = false;
  },
};
var initTimer = new api.Timer(initTimerCallback);
initTimer.setInterval(100);
initTimer.setRepeating(false);
initTimer.start();
