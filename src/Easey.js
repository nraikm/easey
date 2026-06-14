// Easey - Advanced Cubic Bezier Easing Plugin for Cavalry
//
// INSTALLATION:
// 1. Save this file as "Easey.js" in your Cavalry scripts folder
// 2. Find the scripts folder via: Help > Show Scripts Folder (or Scripts > Show Scripts Folder)
// 3. Restart Cavalry or refresh the Scripts menu
// 4. Access via: Window > Scripts > Easey
//
// FEATURES:
// - Interactive bezier curve editor with visual handles
// - Shift+drag axis constraint for precise editing
// - Multi-attribute keyframe support (apply to multiple layers/properties at once)
// - Preset management with alphabetical sorting
// - Context menu integration for keyframe analysis
// - Persistent preset storage with proper deletion handling
//
// CAVALRY API DISCOVERIES & LESSONS LEARNED:
//
// 1. MODIFIER KEY DETECTION:
//    - Mouse event 'modifiers' parameter is undefined in Cavalry
//    - Solution: Use api.isShiftHeld(), api.isControlHeld(), api.isMetaHeld() for reliable key detection
//    - api.isControlHeld() = Command on macOS, Control on Windows
//    - api.isMetaHeld() = Control on macOS, Meta on Windows
//    - Speed Graph: Shift locks Y (X-only movement), physical Control mirrors handles
//    - Reference: https://docs.cavalry.scenegroup.co/tech-info/scripting/api-module/#isshiftheld
//
// 2. KEYFRAME SELECTION HANDLING:
//    - api.getSelectedKeyframes() returns object with full attribute paths as keys
//    - api.getAttributeFromKeyframeId() returns FULL path (e.g., "basicShape#1.position.x")
//    - Key insight: Match keyframe IDs to attribute paths using full paths, not partial
//
// 3. MULTI-ATTRIBUTE KEYFRAME PROCESSING:
//    - Can process keyframes across different layers and properties simultaneously
//    - Group by full attribute path, then process each group independently
//    - Each attribute group needs separate unlocking and easing application
//
// 4. HANDLE BOUNDS & CLICK DETECTION:
//    - Visual handle positions and click targets can desync when dragging outside bounds
//    - Solution: Clamp visual positions for both drawing AND click detection consistently
//    - Allow easing values beyond 0-1 range while keeping handles clickable
//
// 5. PRESET PERSISTENCE:
//    - Default presets get re-added on script reload unless properly handled
//    - Solution: Replace entire presets object with saved data, not merge
//    - Use api.setPreferenceObject() and api.getPreferenceObject() for persistence
//
// 6. AXIS CONSTRAINT IMPLEMENTATION:
//    - Calculate handle angle from proper origin points (cp1: 0,0 | cp2: 1,1)
//    - Snap coordinate to grid boundary, then constrain mouse movement to other axis
//    - Recalculate constraint direction when shift is re-pressed during same drag
//
// USAGE:
// 1. Select keyframes in the Graph Editor or Time Editor (supports multiple attributes)
// 2. Use the interactive graph to adjust easing curve
// 3. Hold Shift while dragging handles for axis-constrained movement
// 4. Click Apply to apply the easing to selected keyframes
// 5. Use Get button to extract easing from selected keyframes
// 6. Click a preset to apply it; use the ≡ menu for save/import options
// 7. Use context menu items to copy keyframe duration, values, and easing info

// Import modules
import { DEFAULT_LIBRARIES, DEFAULT_EASING, GRAPH_CONFIG, DEFAULT_SPEED_EASING, GRAPH_COLORS } from './modules/constants.js';
import { checkForUpdate } from './modules/updateChecker.js';
import { getCompositionFrameRate } from './modules/conversions.js';
import { drawCurve, drawSpeedCurve } from './modules/graphRenderer.js';
import { setupValueGraphHandlers, setupSpeedGraphHandlers } from './modules/mouseHandlers.js';
import { getEasingFromKeyframes, applyEasingToKeyframes, fixHoldPaths, setClampHoldsEnabled, copyKeyframeDuration, copyKeyframeValues, copyAllKeyframeInfo } from './modules/keyframeOps.js';
import { 
    savePresetToLibrary, savePresetToNewLibrary, loadLibrariesFromPreferences, saveLibrariesToPreferences,
    saveApplyOnDragSetting, loadApplyOnDragSetting,
    saveLivePresetsApplySetting, loadLivePresetsApplySetting,
    saveConfirmActionsSetting, loadConfirmActionsSetting,
    saveClampIdenticalSetting, loadClampIdenticalSetting,
    saveLastCurveBehaviorSetting, loadLastCurveBehaviorSetting,
    saveLastSelectedTab, loadLastSelectedTab,
    copyCubicBezierToClipboard, copyEasingNumbersToClipboard, exportCurrentCurveToJson,
    exportLibraryToFlowFile, importLibraryFromFlowFile, mergeImportIntoLibrary,
    reorderPresetInLibrary, movePresetBetweenLibraries, reorderLibrary,
    savePresetAsJson, renamePresetInLibrary, deletePresetFromLibrary
} from './modules/presetManager.js';
import { initializeAssets, getAssetPath } from './modules/embeddedAssets.js';

// Initialize embedded assets (writes icons to temp folder if needed)
initializeAssets();

// Set the window title
ui.setTitle("Easey");

// Version info
var GITHUB_REPO = "sammularczyk/Easey";
var scriptName = "Easey";
var currentVersion = "1.4.1";

// Check for updates
checkForUpdate(GITHUB_REPO, scriptName, currentVersion);

// ============================================================================
// STATE
// ============================================================================

// Copy presets from defaults so user changes can be persisted independently.
var libraries = {};

// UI-only state. Collapsed groups should survive tab rebuilds, but are not
// written to preferences because they do not change preset data.
var collapsedLibraries = {};
var showingSpeed = false;
var activePastePanel = "editor";

var isContextMenuOpen = false;
var originalShowContextMenu = ui.showContextMenu;
ui.showContextMenu = function() {
    isContextMenuOpen = true;
    if (originalShowContextMenu) {
        originalShowContextMenu.apply(ui, arguments);
    }
};

var originalAddMenuItem = ui.addMenuItem;
ui.addMenuItem = function(item) {
    if (item && item.onMouseRelease) {
        var originalOnMouseRelease = item.onMouseRelease;
        item.onMouseRelease = function() {
            isContextMenuOpen = false;
            originalOnMouseRelease.apply(this, arguments);
        };
    }
    if (originalAddMenuItem) {
        originalAddMenuItem.call(ui, item);
    }
};

// Current easing values
var currentEasing = Object.assign({}, DEFAULT_EASING);

// Speed graph state
var speedEasing = Object.assign({}, DEFAULT_SPEED_EASING);

// Helper to calculate dynamic padding based on graph dimensions
function calculateDynamicPadding(w, h) {
    var minDim = Math.min(w, h);
    return Math.max(26, Math.min(40, Math.round(minDim * 0.12)));
}

// Graph dimensions (mutable for resize)
var graphWidth = GRAPH_CONFIG.width;
var graphHeight = GRAPH_CONFIG.height;
var graphPadding = calculateDynamicPadding(graphWidth, graphHeight);
var handleRadius = GRAPH_CONFIG.handleRadius;

// Speed graph dimensions
var speedGraphWidth = GRAPH_CONFIG.width;
var speedGraphHeight = GRAPH_CONFIG.height;
var speedGraphPadding = calculateDynamicPadding(speedGraphWidth, speedGraphHeight);
var speedHandleRadius = GRAPH_CONFIG.handleRadius;

// Drag state for value graph
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

// Settings
var applyOnDragEnabled = false;
var livePresetsApplyEnabled = false;
var confirmActionsEnabled = true;
var clampHoldsEnabled = true;
var lastCurveBehavior = 0; // 0 = Off, 1 = Before Edit, 2 = After Edit

// Last curve state
var lastEasing = null;
var activeEditSession = false;

function startEditSession() {
    if (!activeEditSession) {
        activeEditSession = true;
        if (lastCurveBehavior === 1) { // BEFORE_EDIT
            lastEasing = Object.assign({}, currentEasing);
        }
    }
}

function endEditSession() {
    if (activeEditSession) {
        activeEditSession = false;
        if (lastCurveBehavior === 2) { // AFTER_EDIT
            lastEasing = Object.assign({}, currentEasing);
            redrawGraphs();
        }
    }
}

function updateLastEasingForAtomicChange(prevEasing) {
    endEditSession();
    if (lastCurveBehavior === 1) { // BEFORE_EDIT
        lastEasing = Object.assign({}, prevEasing);
    } else if (lastCurveBehavior === 2) { // AFTER_EDIT
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
    time: 0
};

// ============================================================================
// UI ELEMENTS
// ============================================================================

// Create canvases
var graphCanvas = new ui.Draw();
graphCanvas.setSize(graphWidth, graphHeight);

var speedGraphCanvas = new ui.Draw();
speedGraphCanvas.setSize(speedGraphWidth, speedGraphHeight);

var applyButton = new ui.Button("Apply");
applyButton.setToolTip("Apply easing");
applyButton.setFixedWidth(45);
applyButton.setFixedHeight(22);

var getButton = new ui.ImageButton(getAssetPath("icon-get"));
getButton.setToolTip("Get easing from keyframes");
getButton.setImageSize(16,16);
getButton.setSize(24, 24);

// Context menu button for main actions
var mainContextButton = new ui.Button("≡");
mainContextButton.setFixedWidth(20);

// Cubic bezier coordinate inputs
var x1Input = createCoordinateInput(0.25);
var y1Input = createCoordinateInput(0.1);
var x2Input = createCoordinateInput(0.25);
var y2Input = createCoordinateInput(1.0);

var coordinateInputs = [x1Input, y1Input, x2Input, y2Input];
var coordinateKeys = ["x1", "y1", "x2", "y2"];
var coordinateFieldEditing = [false, false, false, false];
var COORDINATE_SCRUB_PIXELS_PER_STEP = 0.01;
var COORDINATE_SCRUB_DRAG_THRESHOLD = 3;
var graphModeBtn = new ui.Button("S"); graphModeBtn.setFixedWidth(20);
graphModeBtn.setToolTip("Toggle Speed/Value Graph");

// Quick Presets Dropdown
var presetSearchInput = new ui.LineEdit();
var presetSearchBtn = new ui.Button("▼");

var isUpdatingPresetSearchInputText = false;


function syncPresetPaneSelection() {
    if (typeof dragState === "undefined" || !dragState || !dragState.presetItems) return;
    dragState.presetItems.forEach(function(entry) {
        var libPresets = libraries[entry.libName];
        if (!libPresets) return;
        var presetNames = Object.keys(libPresets);
        var pName = presetNames[entry.presetIndex];
        if (!pName) return;
        var pData = libPresets[pName];
        if (!pData) return;

        var shouldBeSelected = isCurrentPreset(pData);
        var isTempHighlighted = (temporaryHighlightPreset && 
                                 temporaryHighlightPreset.libName === entry.libName && 
                                 temporaryHighlightPreset.presetIndex === entry.presetIndex);
        if (entry.isSelected !== shouldBeSelected) {
            entry.isSelected = shouldBeSelected;
            applyPresetStyle(entry.container, shouldBeSelected, isTempHighlighted, false);
            if (entry.label) {
                entry.label.setTextColor(shouldBeSelected ? "#ffffff" : "#a0a0a0");
            }
        }
    });
}

function resetPresetDropdown() {
    if (presetSearchInput && presetSearchInput.getText() !== "") {
        isUpdatingPresetSearchInputText = true;
        presetSearchInput.setText("");
        isUpdatingPresetSearchInputText = false;
    }
    syncPresetPaneSelection();
}

function hasSelectedKeyframes() {
    try {
        var keyframeIds = api.getSelectedKeyframeIds();
        return keyframeIds && keyframeIds.length >= 1;
    } catch (e) {
        return false;
    }
}

function applyEasingToSelectionIfAvailable() {
    if (!hasSelectedKeyframes()) return false;
    applyEasingToKeyframes(currentEasing);
    return true;
}

// Live presets are applied via handlePresetClick.

function applyPresetData(pData, applyImmediately) {
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
        applyEasingToSelectionIfAvailable();
    }
    buildPresetsTab();
}

function confirmPresetAction(title, message) {
    if (!confirmActionsEnabled) return true;

    try {
        var modal = new ui.Modal();
        return modal.showQuestion(title, message);
    } catch (e) {
        console.log("Could not show confirmation:", e.message);
        return false;
    }
}

function handlePresetClick(libName, presetName, presetData) {
    var now = Date.now();
    var isDoubleClick = (
        lastPresetClick.libName === libName &&
        lastPresetClick.presetName === presetName &&
        now - lastPresetClick.time <= 450
    );

    lastPresetClick.libName = libName;
    lastPresetClick.presetName = presetName;
    lastPresetClick.time = now;

    if (livePresetsApplyEnabled || isDoubleClick) {
        applyPresetData(presetData, true);
        return;
    }

    setCurrentEasingFromData(presetData);
    buildPresetsTab();
}

function applyCurrentEasingToSelection() {
    updateFromTextInput();
    applyEasingToKeyframes(currentEasing);
    saveTabPreference();
}

function showPresetSuggestions(filterText, showAllWithCompletions) {
    ui.clearContextMenu();
    
    var filter = (filterText || "").toLowerCase().trim();
    var libNames = Object.keys(libraries);
    
    function addAllLibrarySubmenus() {
        libNames.forEach(function(libName) {
            var libPresets = libraries[libName];
            var presetNames = Object.keys(libPresets);
            if (presetNames.length > 0) {
                var libMenu = new ui.Menu(libName);
                presetNames.forEach(function(presetName) {
                    var pData = libPresets[presetName];
                    libMenu.addMenuItem({
                        name: presetName,
                        onMouseRelease: function() {
                            applyPresetData(pData, true);
                        }
                    });
                });
                ui.addSubMenu(libMenu);
            }
        });
    }
    
    if (filter === "") {
        addAllLibrarySubmenus();
    } else {
        // Show matching presets in a flat list
        var matches = [];
        libNames.forEach(function(libName) {
            var libPresets = libraries[libName];
            for (var presetName in libPresets) {
                var nameLower = presetName.toLowerCase();
                if (nameLower.indexOf(filter) !== -1 || libName.toLowerCase().indexOf(filter) !== -1) {
                    if (nameLower === filter) {
                        continue;
                    }
                    matches.push({
                        fullName: libName + ": " + presetName,
                        libName: libName,
                        presetName: presetName,
                        data: libPresets[presetName]
                    });
                }
            }
        });
        
        if (matches.length > 0) {
            matches.forEach(function(match) {
                ui.addMenuItem({
                    name: match.fullName,
                    onMouseRelease: function() {
                        applyPresetData(match.data, true);
                    }
                });
            });
        } else if (!showAllWithCompletions) {
            ui.addMenuItem({
                name: "No matching presets",
                enabled: false
            });
        }
        
        if (showAllWithCompletions) {
            addAllLibrarySubmenus();
        }
    }
    
    ui.showContextMenu();
}

function applyPresetByNameOrFilter(text) {
    var filter = text.toLowerCase().trim();
    var libNames = Object.keys(libraries);
    var exactMatch = null;
    var matches = [];
    
    libNames.forEach(function(libName) {
        var libPresets = libraries[libName];
        for (var presetName in libPresets) {
            var nameLower = presetName.toLowerCase();
            if (nameLower === filter) {
                exactMatch = libPresets[presetName];
            }
            if (nameLower.indexOf(filter) !== -1 || libName.toLowerCase().indexOf(filter) !== -1) {
                matches.push({
                    fullName: libName + ": " + presetName,
                    libName: libName,
                    presetName: presetName,
                    data: libPresets[presetName]
                });
            }
        }
    });
    
    if (exactMatch) {
        applyPresetData(exactMatch, true);
        return true;
    } else if (matches.length > 0) {
        showPresetSuggestions(text, false);
    }
    return false;
}

function getExactPresetByName(text) {
    var filter = (text || "").toLowerCase().trim();
    if (!filter) return null;

    var libNames = Object.keys(libraries);
    for (var i = 0; i < libNames.length; i++) {
        var libPresets = libraries[libNames[i]];
        for (var presetName in libPresets) {
            if (presetName.toLowerCase() === filter) {
                return libPresets[presetName];
            }
        }
    }
    return null;
}

function parseEasingValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") {
        if (
            value.x1 !== undefined && value.y1 !== undefined &&
            value.x2 !== undefined && value.y2 !== undefined
        ) {
            var objectValues = [
                parseFloat(value.x1),
                parseFloat(value.y1),
                parseFloat(value.x2),
                parseFloat(value.y2)
            ];
            if (objectValues.every(function(v) { return !isNaN(v); })) {
                return {
                    x1: objectValues[0],
                    y1: objectValues[1],
                    x2: objectValues[2],
                    y2: objectValues[3]
                };
            }
        }
        if (value.easing !== undefined) {
            return parseEasingValue(value.easing);
        }
        return null;
    }

    var text = String(value).trim();
    if (!text) return null;
    var matches = text.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi);
    if (!matches || matches.length !== 4) return null;
    var values = matches.map(function(part) { return parseFloat(part); });
    if (!values.every(function(v) { return !isNaN(v); })) return null;
    return { x1: values[0], y1: values[1], x2: values[2], y2: values[3] };
}

function parsePastedEasingEntries(text) {
    var trimmed = (text || "").trim();
    if (!trimmed) return { type: "none", entries: [] };

    var looksLikeJson = trimmed.charAt(0) === "{" || trimmed.indexOf(":") !== -1;
    var rawCurve = looksLikeJson ? null : parseEasingValue(trimmed);
    if (rawCurve) {
        return {
            type: "numbers",
            entries: [{ name: null, data: rawCurve }]
        };
    }

    var jsonText = trimmed;
    if (jsonText.charAt(0) !== "{" && jsonText.indexOf(":") !== -1) {
        jsonText = "{" + jsonText + "}";
    }

    try {
        var parsed = JSON.parse(jsonText);
        var entries = [];

        var rootCurve = parseEasingValue(parsed);
        if (rootCurve) {
            entries.push({
                name: parsed.title || parsed.name || "Pasted Curve",
                data: rootCurve
            });
        } else {
            for (var key in parsed) {
                var curve = parseEasingValue(parsed[key]);
                if (curve) {
                    entries.push({ name: key, data: curve });
                }
            }
        }

        if (entries.length > 0) {
            return { type: "json", entries: entries };
        }
    } catch (e) {}

    return { type: "none", entries: [] };
}

function setCurrentEasingFromData(pData) {
    var prev = Object.assign({}, currentEasing);
    currentEasing.x1 = pData.x1;
    currentEasing.y1 = pData.y1;
    currentEasing.x2 = pData.x2;
    currentEasing.y2 = pData.y2;
    updateLastEasingForAtomicChange(prev);
    resetPresetDropdown();
    updateTextInput();
    redrawGraphs();
    saveTabPreference();
}

function getSelectedPresetLocation() {
    var libNames = Object.keys(libraries);
    for (var i = 0; i < libNames.length; i++) {
        var libName = libNames[i];
        var libPresets = libraries[libName];
        var presetNames = Object.keys(libPresets);
        for (var j = 0; j < presetNames.length; j++) {
            if (isCurrentPreset(libPresets[presetNames[j]])) {
                return { libName: libName, presetIndex: j };
            }
        }
    }
    return null;
}

function ensureUnnamedLibraryAtTop() {
    var existingNames = Object.keys(libraries);
    var snapshot = {};
    existingNames.forEach(function(name) {
        snapshot[name] = libraries[name];
    });
    existingNames.forEach(function(name) {
        delete libraries[name];
    });
    libraries.Unnamed = snapshot.Unnamed || {};
    existingNames.forEach(function(name) {
        if (name !== "Unnamed") {
            libraries[name] = snapshot[name];
        }
    });
}

function makeUniquePresetName(libName, presetName) {
    var baseName = (presetName || "Pasted Preset").trim();
    if (!baseName) baseName = "Pasted Preset";
    if (!libraries[libName] || !libraries[libName][baseName]) return baseName;

    var count = 2;
    var candidate = baseName + " " + count;
    while (libraries[libName][candidate]) {
        count++;
        candidate = baseName + " " + count;
    }
    return candidate;
}

function insertPresetIntoLibrary(libName, presetName, presetData, insertIndex) {
    if (!libraries[libName]) {
        libraries[libName] = {};
    }

    var uniqueName = makeUniquePresetName(libName, presetName);
    var names = Object.keys(libraries[libName]);
    var safeIndex = Math.max(0, Math.min(insertIndex, names.length));
    names.splice(safeIndex, 0, uniqueName);

    var reordered = {};
    names.forEach(function(name) {
        reordered[name] = (name === uniqueName) ? presetData : libraries[libName][name];
    });
    libraries[libName] = reordered;
}

function getPasteInsertTarget() {
    var selected = getSelectedPresetLocation();
    if (selected) {
        return { libName: selected.libName, insertIndex: selected.presetIndex + 1 };
    }
    ensureUnnamedLibraryAtTop();
    return { libName: "Unnamed", insertIndex: 0 };
}

function pasteEasingToEditor() {
    var parsed = parsePastedEasingEntries(api.getClipboardText());
    if (parsed.entries.length === 0) {
        console.log("Paste: clipboard does not contain easing values.");
        return false;
    }
    setCurrentEasingFromData(parsed.entries[0].data);
    return true;
}

function pasteEasingToPresets(targetOverride) {
    var parsed = parsePastedEasingEntries(api.getClipboardText());
    if (parsed.entries.length === 0) {
        console.log("Paste: clipboard does not contain easing values.");
        return false;
    }

    var entries = parsed.entries;
    if (parsed.type === "numbers") {
        var modal = new ui.Modal();
        var presetName = modal.showStringInput("New Preset", "Enter preset name (max 30 chars):", "Pasted Preset");
        if (!presetName || presetName.trim() === "") return false;
        presetName = presetName.trim();
        if (presetName.length > 30) {
            console.log("Preset name too long. Please use 30 characters or less.");
            return false;
        }
        entries = [{ name: presetName, data: entries[0].data }];
    }

    var target = targetOverride || getPasteInsertTarget();
    entries.forEach(function(entry, index) {
        insertPresetIntoLibrary(target.libName, entry.name, entry.data, target.insertIndex + index);
    });

    saveLibrariesToPreferences(libraries);
    buildPresetsTab();
    return true;
}

function getPresetInsertTargetAfter(libName, presetName) {
    var names = Object.keys(libraries[libName] || {});
    var presetIndex = names.indexOf(presetName);
    return {
        libName: libName,
        insertIndex: presetIndex === -1 ? names.length : presetIndex + 1
    };
}

function handlePasteShortcut() {
    var currentTab = tabView ? tabView.currentTab() : null;
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
    return text === "return" || text === "enter" || text === "key_return" ||
        text === "key_enter" || text === "16777220" || text === "16777221" || text === "13";
}

function isPasteModifierHeld(event) {
    if (event && (event.metaKey || event.ctrlKey || event.commandKey)) return true;
    try {
        return api.isMetaHeld() || api.isControlHeld();
    } catch (e) {
        return false;
    }
}

function handleKeyShortcut(key, event) {
    if (isPasteKey(key) && isPasteModifierHeld(event)) {
        handlePasteShortcut();
        return true;
    }
    if (isApplyKey(key)) {
        applyCurrentEasingToSelection();
        return true;
    }
    return false;
}

function attachPasteShortcutHandlers(widget) {
    if (!widget) return;
    widget.onKeyPress = function(key, event) {
        return handleKeyShortcut(key, event);
    };
    widget.onKeyDown = widget.onKeyPress;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Create shared state object for mouse handlers
var sharedState = {
    get currentEasing() { return currentEasing; },
    get speedEasing() { return speedEasing; },
    get isDragging() { return isDragging; },
    set isDragging(v) { isDragging = v; },
    get dragHandle() { return dragHandle; },
    set dragHandle(v) { dragHandle = v; },
    get dragStartPosition() { return dragStartPosition; },
    set dragStartPosition(v) { dragStartPosition = v; },
    get dragStartEasing() { return dragStartEasing; },
    set dragStartEasing(v) { dragStartEasing = v; },
    get axisConstraint() { return axisConstraint; },
    set axisConstraint(v) { axisConstraint = v; },
    get wasShiftHeld() { return wasShiftHeld; },
    set wasShiftHeld(v) { wasShiftHeld = v; },
    get lockedAngle() { return lockedAngle; },
    set lockedAngle(v) { lockedAngle = v; },
    get lockedLength() { return lockedLength; },
    set lockedLength(v) { lockedLength = v; },
    get lastAxisConstraint() { return lastAxisConstraint; },
    set lastAxisConstraint(v) { lastAxisConstraint = v; },
    get shiftEngageCoords() { return shiftEngageCoords; },
    set shiftEngageCoords(v) { shiftEngageCoords = v; },
    get speedDragging() { return speedDragging; },
    set speedDragging(v) { speedDragging = v; },
    get speedDragHandle() { return speedDragHandle; },
    set speedDragHandle(v) { speedDragHandle = v; }
};

// Get current graph config
function getGraphConfig() {
    return {
        width: graphWidth,
        height: graphHeight,
        padding: graphPadding,
        handleRadius: handleRadius
    };
}

function getSpeedGraphConfig() {
    return {
        width: speedGraphWidth,
        height: speedGraphHeight,
        padding: speedGraphPadding,
        handleRadius: speedHandleRadius
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

function formatCoordinateValue(val) {
    var rounded = Math.round(val * 100) / 100;
    var str = rounded.toString();
    if (str.indexOf(".") === -1) {
        return str + ".0";
    }
    return str;
}

function createCoordinateInput(initialValue) {
    var input = new ui.LineEdit();
    input.setText(formatCoordinateValue(initialValue));
    input.getValue = function() {
        return parseFloat(input.getText());
    };
    input.setValue = function(value) {
        input.setText(formatCoordinateValue(value));
    };
    return input;
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
    return applyParsedCoordinateValues(getClipboardEasingValue(), applyImmediately);
}

function parseCoordinateFieldEasingValue(input) {
    var text = getCoordinateFieldText(input);
    var clipboardValue = getClipboardEasingValue();
    if (clipboardValue && text.indexOf(",") !== -1) {
        return clipboardValue;
    }

    var exactValue = parseEasingValue(text);
    if (exactValue) return exactValue;

    var matches = String(text || "").match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi);
    if (!matches || matches.length < 4) return null;

    var values = matches.slice(matches.length - 4).map(function(part) {
        return parseFloat(part);
    });
    if (!values.every(function(v) { return !isNaN(v); })) return null;

    return { x1: values[0], y1: values[1], x2: values[2], y2: values[3] };
}

function applyCoordinateFieldTextIfPasted(input, applyImmediately) {
    return applyParsedCoordinateValues(parseCoordinateFieldEasingValue(input), applyImmediately);
}

function tryApplyPastedCoordinateValues(index, fieldValue, applyImmediately) {
    var pasted = getClipboardEasingValue();
    if (!pasted) return false;

    var values = [pasted.x1, pasted.y1, pasted.x2, pasted.y2];
    if (
        Math.abs(fieldValue - values[0]) >= 0.001 &&
        Math.abs(fieldValue - values[index]) >= 0.001
    ) {
        return false;
    }

    return applyPastedCoordinateValues(applyImmediately);
}

function attachCoordinatePasteShortcutHandler(input) {
    input.onKeyPress = function(key, event) {
        if (isPasteKey(key) && isPasteModifierHeld(event)) {
            return applyPastedCoordinateValues(false);
        }
        return handleKeyShortcut(key, event);
    };
    input.onKeyDown = input.onKeyPress;
}

function wireCoordinateInput(input, index) {
    input.onValueChanged = function() {
        if (isUpdatingTextInput) return;

        startEditSession();

        if (applyCoordinateFieldTextIfPasted(input, false)) return;

        var newValue = input.getValue();
        if (isNaN(newValue)) return;
        resetPresetDropdown();

        if (tryApplyPastedCoordinateValues(index, newValue, false)) return;

        currentEasing[coordinateKeys[index]] = newValue;
        redrawGraphs();
    };

    input.onValueCommitted = function() {
        if (isUpdatingTextInput) return;

        startEditSession();

        if (applyCoordinateFieldTextIfPasted(input, false)) return;

        resetPresetDropdown();

        var committedValue = input.getValue();
        if (isNaN(committedValue)) {
            setCoordinateFieldValuesFromEasing();
            endEditSession();
            return;
        }

        if (tryApplyPastedCoordinateValues(index, committedValue, false)) return;

        currentEasing[coordinateKeys[index]] = committedValue;
        redrawGraphs();
        endEditSession();
        saveTabPreference();
    };
}

function setupLabelScrub(container, coordinateIndex) {
    var scrubState = {
        active: false,
        startX: 0,
        startValue: 0
    };

    container.onMousePress = function(position, button) {
        if (button !== "left") return;
        startEditSession();
        scrubState.active = true;
        scrubState.startX = position.x;
        scrubState.startValue = currentEasing[coordinateKeys[coordinateIndex]];
    };

    container.useHoverEvents(true);

    container.onMouseMove = function(position) {
        if (!scrubState.active) return;
        var delta = position.x - scrubState.startX;
        applyCoordinateScrubValue(
            coordinateIndex,
            scrubState.startValue + delta * COORDINATE_SCRUB_PIXELS_PER_STEP
        );
    };

    container.onMouseRelease = function(position, button) {
        if (button !== "left" || !scrubState.active) return;
        scrubState.active = false;
        resetPresetDropdown();
        if (applyOnDragEnabled) applyEasingToSelectionIfAvailable();
        endEditSession();
        saveTabPreference();
    };
}

// Update text input with current easing values
function updateTextInput() {
    var x1 = (currentEasing.x1 !== undefined) ? currentEasing.x1 : 0.25;
    var y1 = (currentEasing.y1 !== undefined) ? currentEasing.y1 : 0.1;
    var x2 = (currentEasing.x2 !== undefined) ? currentEasing.x2 : 0.25;
    var y2 = (currentEasing.y2 !== undefined) ? currentEasing.y2 : 1.0;
    
    isUpdatingTextInput = true;
    x1Input.setValue(x1);
    y1Input.setValue(y1);
    x2Input.setValue(x2);
    y2Input.setValue(y2);
    isUpdatingTextInput = false;
    
    syncPresetSearchInputText();
}

// Parse text input and update curve
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
function redrawGraphs() {
    drawCurve(graphCanvas, currentEasing, getGraphConfig(), (lastCurveBehavior !== 0) ? lastEasing : null);
    drawSpeedCurve(speedGraphCanvas, currentEasing, speedEasing, getSpeedGraphConfig());
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

setupValueGraphHandlers({
    canvas: graphCanvas,
    state: sharedState,
    getConfig: getGraphConfig,
    onDragStart: function() {
        startEditSession();
    },
    onUpdate: function() {
        resetPresetDropdown();
        updateTextInput();
        redrawGraphs();
    },
    onDragEnd: function() {
        if (applyOnDragEnabled) applyEasingToSelectionIfAvailable();
        endEditSession();
        saveTabPreference();
    },
    onMouseFocus: function() {
        activePastePanel = "editor";
        endEditSession();
    },
    onContextMenu: function() {
        activePastePanel = "editor";
        showEditorContextMenu();
    }
});

setupSpeedGraphHandlers({
    canvas: speedGraphCanvas,
    state: sharedState,
    getConfig: getSpeedGraphConfig,
    onDragStart: function() {
        startEditSession();
    },
    onUpdate: function() {
        resetPresetDropdown();
        updateTextInput();
        redrawGraphs();
        if (applyOnDragEnabled) {
            applyEasingToSelectionIfAvailable();
        }
    },
    onDragEnd: function() {
        endEditSession();
        saveTabPreference();
    },
    onMouseFocus: function() {
        activePastePanel = "editor";
        endEditSession();
    },
    onContextMenu: function() {
        activePastePanel = "editor";
        showEditorContextMenu();
    }
});

attachPasteShortcutHandlers(graphCanvas);
attachPasteShortcutHandlers(speedGraphCanvas);

// ============================================================================
// CONTEXT MENUS
// ============================================================================

function showPresetItemContextMenu(libName, presetName, presetData) {
    ui.clearContextMenu();

    ui.addMenuItem({
        name: "Paste Preset After This",
        onMouseRelease: function() {
            pasteEasingToPresets(getPresetInsertTargetAfter(libName, presetName));
        }
    });

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Save As...",
        onMouseRelease: function() {
            savePresetAsJson(presetName, presetData);
        }
    });

    ui.addMenuItem({
        name: "Rename...",
        onMouseRelease: function() {
            renamePresetInLibrary(libraries, libName, presetName, function() {
                saveLibrariesToPreferences(libraries);
                buildPresetsTab();
            });
        }
    });

    ui.addMenuItem({
        name: "Delete",
        onMouseRelease: function() {
            if (!confirmPresetAction(
                "Delete Preset",
                "Delete preset '" + presetName + "' from '" + libName + "'?"
            )) {
                return;
            }
            deletePresetFromLibrary(libraries, libName, presetName, function() {
                saveLibrariesToPreferences(libraries);
                buildPresetsTab();
            });
        }
    });

    ui.showContextMenu();
}

function addSaveCurrentCurveMenuItems() {
    ui.addMenuItem({
        name: "Save to New Library...",
        onMouseRelease: function() {
            savePresetToNewLibrary(libraries, currentEasing, function() {
                saveLibrariesToPreferences(libraries);
                buildPresetsTab();
            });
        }
    });

    var saveMenu = new ui.Menu("Save to Library");
    var libNames = Object.keys(libraries);
    libNames.forEach(function(libName) {
        saveMenu.addMenuItem({
            name: libName,
            onMouseRelease: function() {
                savePresetToLibrary(libraries, libName, currentEasing, function() {
                    saveLibrariesToPreferences(libraries);
                    buildPresetsTab();
                });
            }
        });
    });
    ui.addSubMenu(saveMenu);
}

function invertEasingCurve() {
    var prev = Object.assign({}, currentEasing);
    var inverted = {
        x1: 1 - currentEasing.x2,
        y1: 1 - currentEasing.y2,
        x2: 1 - currentEasing.x1,
        y2: 1 - currentEasing.y1
    };
    currentEasing.x1 = inverted.x1;
    currentEasing.y1 = inverted.y1;
    currentEasing.x2 = inverted.x2;
    currentEasing.y2 = inverted.y2;
    updateLastEasingForAtomicChange(prev);
    resetPresetDropdown();
    updateTextInput();
    redrawGraphs();
    saveTabPreference();
    if (applyOnDragEnabled) {
        applyEasingToSelectionIfAvailable();
    }
}

function showEditorContextMenu() {
    ui.clearContextMenu();

    ui.addMenuItem({
        name: "Paste Coordinates",
        onMouseRelease: function() {
            pasteEasingToEditor();
        }
    });

    ui.addMenuItem({
        name: "Copy Numbers",
        onMouseRelease: function() {
            copyEasingNumbersToClipboard(currentEasing);
        }
    });

    ui.addMenuItem({
        name: "Invert Value",
        onMouseRelease: function() {
            invertEasingCurve();
        }
    });

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Export Current Curve to JSON...",
        onMouseRelease: function() {
            exportCurrentCurveToJson(currentEasing);
        }
    });

    addSaveCurrentCurveMenuItems();

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Apply Changes",
        onMouseRelease: function() {
            applyEasingToKeyframes(currentEasing);
            saveTabPreference();
        }
    });

    ui.showContextMenu();
}

function showPresetContextMenu() {
    ui.clearContextMenu();

    addSaveCurrentCurveMenuItems();

    ui.addMenuItem({
        name: "Import Library...",
        onMouseRelease: function() {
            importLibraryFromFlowFile(libraries, function() {
                saveLibrariesToPreferences(libraries);
                buildPresetsTab();
            }, function(libraryName, importCount) {
                return confirmPresetAction(
                    "Import Library",
                    "Import " + importCount + " preset(s) into existing library '" +
                        libraryName + "'? Existing presets will be kept and matching names may be replaced."
                );
            });
        }
    });

    ui.addMenuItem({ name: "" });
    
    ui.addMenuItem({
        name: "Set to Linear",
        onMouseRelease: function() {
            var prev = Object.assign({}, currentEasing);
            currentEasing.x1 = 0; currentEasing.y1 = 0;
            currentEasing.x2 = 1; currentEasing.y2 = 1;
            updateLastEasingForAtomicChange(prev);
            updateTextInput(); redrawGraphs();
        }
    });
    
    ui.addMenuItem({
        name: "Reset",
        onMouseRelease: function() {
            var prev = Object.assign({}, currentEasing);
            currentEasing.x1 = 0.25; currentEasing.y1 = 0.1;
            currentEasing.x2 = 0.25; currentEasing.y2 = 1.0;
            updateLastEasingForAtomicChange(prev);
            updateTextInput(); redrawGraphs();
        }
    });

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Copy Current Curve to Clipboard",
        onMouseRelease: function() {
            copyCubicBezierToClipboard(currentEasing);
        }
    });
    
    ui.addMenuItem({
        name: "Copy Keyframe Duration in ms",
        onMouseRelease: function() {
            copyKeyframeDuration();
        }
    });
    
    ui.addMenuItem({
        name: "Copy Keyframe Values",
        onMouseRelease: function() {
            copyKeyframeValues();
        }
    });
    
    ui.addMenuItem({
        name: "Copy All Keyframe Info",
        onMouseRelease: function() {
            copyAllKeyframeInfo();
        }
    });

    ui.addMenuItem({ name: "" });
    
    ui.addMenuItem({
        name: "Apply when dragging handles" + (applyOnDragEnabled ? " ✓" : ""),
        onMouseRelease: function() {
            applyOnDragEnabled = !applyOnDragEnabled;
            saveApplyOnDragSetting(applyOnDragEnabled);
        }
    });

    ui.addMenuItem({
        name: "Apply presets live" + (livePresetsApplyEnabled ? " ✓" : ""),
        onMouseRelease: function() {
            livePresetsApplyEnabled = !livePresetsApplyEnabled;
            saveLivePresetsApplySetting(livePresetsApplyEnabled);
        }
    });

    ui.addMenuItem({
        name: "Confirm destructive preset actions" + (confirmActionsEnabled ? " ✓" : ""),
        onMouseRelease: function() {
            confirmActionsEnabled = !confirmActionsEnabled;
            saveConfirmActionsSetting(confirmActionsEnabled);
        }
    });

    ui.addMenuItem({
        name: "Automatically clamp paths" + (clampHoldsEnabled ? " ✓" : ""),
        onMouseRelease: function() {
            clampHoldsEnabled = !clampHoldsEnabled;
            setClampHoldsEnabled(clampHoldsEnabled);
            saveClampIdenticalSetting(clampHoldsEnabled);
        }
    });

    var lastCurveText = "Last Curve: Off";
    if (lastCurveBehavior === 1) {
        lastCurveText = "Last Curve: Before Edit";
    } else if (lastCurveBehavior === 2) {
        lastCurveText = "Last Curve: After Edit";
    }

    ui.addMenuItem({
        name: lastCurveText,
        onMouseRelease: function() {
            lastCurveBehavior = (lastCurveBehavior + 1) % 3;
            saveLastCurveBehaviorSetting(lastCurveBehavior);
            if (lastCurveBehavior === 0) {
                lastEasing = null;
            } else {
                lastEasing = Object.assign({}, currentEasing);
            }
            redrawGraphs();
        }
    });

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Clamp motion paths between holds",
        onMouseRelease: function() {
            fixHoldPaths();
        }
    });

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Easey Version " + currentVersion,
        enabled: false
    });
    ui.addMenuItem({
        name: "By Canva Creative Team",
        enabled: false
    });
    ui.addMenuItem({
        name: "Get updates and more plugins...",
        enabled: true,
        onMouseRelease: function() {
            api.openURL("https://canvacreative.team/motion");
        }
    });

    ui.showContextMenu();
}

function showPresetsPageContextMenu() {
    ui.clearContextMenu();

    ui.addMenuItem({
        name: "Import Library...",
        onMouseRelease: function() {
            importLibraryFromFlowFile(libraries, function() {
                saveLibrariesToPreferences(libraries);
                buildPresetsTab();
            }, function(libraryName, importCount) {
                return confirmPresetAction(
                    "Import Library",
                    "Import " + importCount + " preset(s) into existing library '" +
                        libraryName + "'? Existing presets will be kept and matching names may be replaced."
                );
            });
        }
    });

    ui.showContextMenu();
}

function showLibraryContextMenu(libName) {
    resetDragState();
    ui.clearContextMenu();

    ui.addMenuItem({
        name: "Paste Preset Here",
        onMouseRelease: function() {
            pasteEasingToPresets({
                libName: libName,
                insertIndex: 0
            });
        }
    });

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Merge Import Collection...",
        onMouseRelease: function() {
            mergeImportIntoLibrary(libraries, libName, function() {
                saveLibrariesToPreferences(libraries);
                buildPresetsTab();
            }, function(libraryName, importCount) {
                return confirmPresetAction(
                    "Merge Import Collection",
                    "Merge " + importCount + " preset(s) into existing library '" +
                        libraryName + "'? Existing presets will be kept and matching names may be replaced."
                );
            });
        }
    });

    ui.addMenuItem({
        name: "Import Library Above...",
        onMouseRelease: function() {
            importLibraryFromFlowFile(libraries, function(importedLibName) {
                var names = Object.keys(libraries);
                var currentIdx = names.indexOf(libName);
                var importedIdx = names.indexOf(importedLibName);
                if (currentIdx !== -1 && importedIdx !== -1 && currentIdx !== importedIdx) {
                    reorderLibrary(libraries, importedIdx, currentIdx);
                }
                saveLibrariesToPreferences(libraries);
                buildPresetsTab();
            }, function(libraryName, importCount) {
                return confirmPresetAction(
                    "Import Library",
                    "Import " + importCount + " preset(s) into existing library '" +
                        libraryName + "'? Existing presets will be kept and matching names may be replaced."
                );
            });
        }
    });

    ui.addMenuItem({
        name: "Export Library...",
        onMouseRelease: function() {
            exportLibraryToFlowFile(libName, libraries);
        }
    });

    ui.addMenuItem({ name: "" });

    ui.addMenuItem({
        name: "Clear Library",
        onMouseRelease: function() {
            var presetCount = Object.keys(libraries[libName] || {}).length;
            if (presetCount === 0) return;
            if (!confirmPresetAction(
                "Clear Library",
                "Delete all " + presetCount + " preset(s) from library '" + libName + "'?"
            )) {
                return;
            }
            libraries[libName] = {};
            saveLibrariesToPreferences(libraries);
            buildPresetsTab();
        }
    });

    ui.addMenuItem({
        name: "Delete Library",
        onMouseRelease: function() {
            var presetCount = Object.keys(libraries[libName] || {}).length;
            if (!confirmPresetAction(
                "Delete Library",
                "Delete library '" + libName + "' and its " + presetCount + " preset(s)?"
            )) {
                return;
            }
            delete libraries[libName];
            delete collapsedLibraries[libName];
            saveLibrariesToPreferences(libraries);
            buildPresetsTab();
        }
    });

    ui.showContextMenu();
}

// ============================================================================
// BUTTON EVENT HANDLERS
// ============================================================================

applyButton.onClick = function() {
    applyCurrentEasingToSelection();
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

getButton.onClick = function() {
    var prev = Object.assign({}, currentEasing);
    if (getEasingFromKeyframes(currentEasing)) {
        updateLastEasingForAtomicChange(prev);
        updateTextInput();
        redrawGraphs();
    }
    saveTabPreference();
};

mainContextButton.onClick = function() {
    showPresetContextMenu();
};



wireCoordinateInput(x1Input, 0);
wireCoordinateInput(y1Input, 1);
wireCoordinateInput(x2Input, 2);
wireCoordinateInput(y2Input, 3);
coordinateInputs.forEach(attachCoordinatePasteShortcutHandler);

presetSearchInput.onValueChanged = function() {
    if (isUpdatingPresetSearchInputText) return;

    var exactPreset = getExactPresetByName(presetSearchInput.getText());
    if (exactPreset) {
        applyPresetData(exactPreset, true);
    }
};

presetSearchInput.onValueCommitted = function() {
    var text = presetSearchInput.getText();
    if (text) {
        applyPresetByNameOrFilter(text);
    } else {
        applyCurrentEasingToSelection();
    }
};


presetSearchBtn.onClick = function() {
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

// Load last curve behavior setting
lastCurveBehavior = loadLastCurveBehaviorSetting();
if (lastCurveBehavior !== 0) {
    lastEasing = Object.assign({}, currentEasing);
}


// ============================================================================
// UI LAYOUT
// ============================================================================

// Create main layout
var mainLayout = new ui.VLayout();
mainLayout.setSpaceBetween(0);
mainLayout.setMargins(3, 3, 3, 3);

// Button row
var buttonRow = new ui.HLayout();
buttonRow.add(getButton);

function createPresetSearchGroup() {
    var container = new ui.Container();
    container.setFixedHeight(22);
    container.setBackgroundColor("#1c1c1c");
    container.setBorder("#2a2a2a", 1);
    
    var layout = new ui.HLayout();
    layout.setMargins(6, 0, 2, 0);
    layout.setSpaceBetween(2);
    
    presetSearchInput.setBackgroundColor("#1c1c1c");
    presetSearchInput.setPlaceholder("Search preset...");
    presetSearchInput.setFixedHeight(20);
    
    presetSearchBtn.setFixedWidth(18);
    presetSearchBtn.setFixedHeight(18);
    presetSearchBtn.setBackgroundColor("#1c1c1c");
    presetSearchBtn.setDrawStroke(false);
    
    layout.add(presetSearchInput);
    layout.add(presetSearchBtn);
    
    container.setLayout(layout);
    return container;
}

buttonRow.add(createPresetSearchGroup());
buttonRow.add(applyButton);
buttonRow.setSpaceBetween(4);
buttonRow.setMargins(4, 4, 4, 4);

var tabView = new ui.TabView();

// EDITOR TAB
var editorTabLayout = new ui.VLayout();
editorTabLayout.setSpaceBetween(0);
editorTabLayout.setMargins(4, 4, 4, 4);

// Helper to group label and input inside a single bordered container matching Cavalry's native input style
function createInputGroup(labelName, coordinateIndex) {
    var coordinateInput = coordinateInputs[coordinateIndex];
    var container = new ui.Container();
    container.setFixedHeight(22);
    container.setFixedWidth(64);
    container.setBackgroundColor("#1c1c1c");
    container.setBorder("#2a2a2a", 1);

    var layout = new ui.HLayout();
    layout.setMargins(2, 1, 2, 1);
    layout.setSpaceBetween(2);

    var label = new ui.Label(labelName);
    label.setTextColor("#555555");
    label.setFontSize(11);
    label.setFixedWidth(14);
    label.setFixedHeight(20);
    try {
        label.setTransparentForMouseEvents(true);
    } catch (e) {}

    var valueBox = new ui.Container();
    valueBox.setFixedWidth(42);
    valueBox.setFixedHeight(20);
    valueBox.setBackgroundColor("#1c1c1c");

    coordinateInput.setBackgroundColor("#1c1c1c");
    coordinateInput.setFixedHeight(20);
    coordinateInput.setFixedWidth(42);

    var valueLayout = new ui.HLayout();
    valueLayout.setMargins(0, 0, 0, 0);
    valueLayout.add(coordinateInput);
    valueBox.setLayout(valueLayout);

    layout.add(label);
    layout.add(valueBox);
    container.setLayout(layout);

    setupLabelScrub(container, coordinateIndex);

    return container;
}

var editorControlsLayout = new ui.HLayout();
editorControlsLayout.setMargins(0, 0, 0, 0); // Explicitly zero out margins to prevent unequal default margins/padding
editorControlsLayout.setSpaceBetween(1);
editorControlsLayout.add(graphModeBtn);
editorControlsLayout.add(createInputGroup("X1", 0));
editorControlsLayout.add(createInputGroup("Y1", 1));
editorControlsLayout.add(createInputGroup("X2", 2));
editorControlsLayout.add(createInputGroup("Y2", 3));
editorControlsLayout.add(mainContextButton);

editorTabLayout.add(editorControlsLayout);

var graphContainer = new ui.Container();
var initGraphLayout = new ui.VLayout();
initGraphLayout.setMargins(0, 0, 0, 0);
initGraphLayout.setSpaceBetween(0);
initGraphLayout.add(graphCanvas);
initGraphLayout.add(speedGraphCanvas);
graphContainer.setLayout(initGraphLayout);

speedGraphCanvas.setHidden(true);

graphModeBtn.onClick = function() {
    showingSpeed = !showingSpeed;
    if (showingSpeed) {
        graphCanvas.setHidden(true);
        speedGraphCanvas.setHidden(false);
        graphModeBtn.setText("V");
    } else {
        graphCanvas.setHidden(false);
        speedGraphCanvas.setHidden(true);
        graphModeBtn.setText("S");
    }
    redrawGraphs();
};

editorTabLayout.add(graphContainer);
editorTabLayout.addStretch();

// PRESETS TAB
var presetsScroll = new ui.ScrollView();
var presetsContainer = new ui.VLayout();
presetsScroll.setLayout(presetsContainer);

var PRESET_TILE_WIDTH = 68;
var PRESET_TILE_HEIGHT = 74;
var PRESET_GRAPH_WIDTH = 62;
var PRESET_GRAPH_HEIGHT = 56;

var temporaryHighlightPreset = null; // { libName, presetIndex }
var temporaryHighlightTimer = null;

var dragState = {
    dragType: null,       // null | "preset" | "library"
    didDrag: false,
    startWidget: null,
    startPosition: null,
    startGeometry: null,
    lastPosition: null,
    fromLibName: null,
    fromPresetIndex: -1,
    hoverLibName: null,
    hoverPresetIndex: -1,
    hoverLibIndex: -1,
    toLibName: null,
    toPresetIndex: -1,
    fromLibIndex: -1,
    toLibIndex: -1,
    presetItems: [],      // Live card widgets for styling during a drag.
    libraryItems: [],     // {container, libName, libIndex}
    hitLibraryItems: [],  // Frozen geometry captured when a drag starts.
    hitPresetItems: []
};

function resetDragState() {
    dragState.dragType = null;
    dragState.didDrag = false;
    dragState.startWidget = null;
    dragState.startPosition = null;
    dragState.startGeometry = null;
    dragState.lastPosition = null;
    dragState.fromLibName = null;
    dragState.fromPresetIndex = -1;
    dragState.hoverLibName = null;
    dragState.hoverPresetIndex = -1;
    dragState.hoverLibIndex = -1;
    dragState.toLibName = null;
    dragState.toPresetIndex = -1;
    dragState.fromLibIndex = -1;
    dragState.toLibIndex = -1;
    dragState.presetItems = [];
    dragState.libraryItems = [];
    dragState.hitLibraryItems = [];
    dragState.hitPresetItems = [];
}

function triggerTemporaryHighlight(libName, presetIndex, duration) {
    if (temporaryHighlightTimer) {
        try {
            temporaryHighlightTimer.stop();
        } catch (e) {}
        temporaryHighlightTimer = null;
    }

    temporaryHighlightPreset = {
        libName: libName,
        presetIndex: presetIndex
    };

    // Apply styles immediately
    updatePresetHighlightStyles();

    var callback = {
        onTimeout: function() {
            temporaryHighlightPreset = null;
            updatePresetHighlightStyles();
            temporaryHighlightTimer = null;
        }
    };
    temporaryHighlightTimer = new api.Timer(callback);
    temporaryHighlightTimer.setInterval(duration || 300);
    temporaryHighlightTimer.setRepeating(false);
    temporaryHighlightTimer.start();
}

function updatePresetHighlightStyles() {
    if (typeof dragState === "undefined" || !dragState || !dragState.presetItems) return;
    dragState.presetItems.forEach(function(entry) {
        var libPresets = libraries[entry.libName];
        if (!libPresets) return;
        var presetNames = Object.keys(libPresets);
        var pName = presetNames[entry.presetIndex];
        if (!pName) return;
        var pData = libPresets[pName];
        if (!pData) return;

        var shouldBeSelected = isCurrentPreset(pData);
        var isTempHighlighted = (temporaryHighlightPreset && 
                                 temporaryHighlightPreset.libName === entry.libName && 
                                 temporaryHighlightPreset.presetIndex === entry.presetIndex);

        applyPresetStyle(entry.container, shouldBeSelected, isTempHighlighted, false);
    });
}

function applyPresetStyle(container, isSelected, isSource, isTarget) {
    if (isSource || isSelected) {
        container.setBackgroundColor("#3a3a3a");
        container.setBorder(ui.getThemeColor("Accent1"), 1.5);
    } else if (isTarget) {
        container.setBackgroundColor("#4a4a4a");
        container.setBorder(ui.getThemeColor("Accent1"), 1.5);
    } else {
        container.setBackgroundColor("#00000000");
        container.setBorder("#00000000", 0);
    }
    try {
        if (typeof container.redraw === "function") container.redraw();
        else if (typeof container.update === "function") container.update();
        else {
            var h = container.geometry().height;
            if (h) { container.setFixedHeight(h + 1); container.setFixedHeight(h); }
        }
    } catch(e) {}
}

function applyLibStyle(container, isSource, isTarget) {
    if (isSource) {
        container.setBackgroundColor("#3a3a3a");
        container.setBorder(ui.getThemeColor("Accent1"), 1.5);
    } else if (isTarget) {
        container.setBackgroundColor("#333333");
        container.setBorder(ui.getThemeColor("Accent1"), 1.5);
    } else {
        container.setBackgroundColor("#00000000");
        container.setBorder("#00000000", 0);
    }
    try {
        if (typeof container.redraw === "function") container.redraw();
        else if (typeof container.update === "function") container.update();
        else {
            var h = container.geometry().height;
            if (h) { container.setFixedHeight(h + 1); container.setFixedHeight(h); }
        }
    } catch(e) {}
}

function updateDragVisuals() {
    if (!dragState.dragType) return;
    if (dragState.dragType === "preset") {
        dragState.presetItems.forEach(function(entry) {
            var isSource = (entry.libName === dragState.fromLibName && entry.presetIndex === dragState.fromPresetIndex);
            var isTarget = dragState.didDrag && (entry.libName === dragState.hoverLibName && entry.presetIndex === dragState.hoverPresetIndex);
            applyPresetStyle(entry.container, entry.isSelected, isSource, isTarget);
        });
        dragState.libraryItems.forEach(function(entry) {
            var isTarget = dragState.didDrag && (entry.libName === dragState.toLibName && dragState.hoverPresetIndex === -1);
            applyLibStyle(entry.container, false, isTarget);
        });
    } else if (dragState.dragType === "library") {
        dragState.libraryItems.forEach(function(entry) {
            applyLibStyle(entry.container, entry.libIndex === dragState.fromLibIndex, dragState.didDrag && entry.libIndex === dragState.hoverLibIndex);
        });
    }
}

function getWidgetGeometry(widget) {
    try {
        if (widget && typeof widget.geometry === "function") {
            return widget.geometry();
        }
    } catch (e) {
        console.log("Could not read widget geometry:", e.message);
    }
    return null;
}

function captureDragHitGeometry() {
    // Freeze target bounds at drag start. This keeps hit-testing stable even
    // when highlight borders or scrolling cause Cavalry to refresh layouts.
    dragState.hitLibraryItems = [];
    dragState.hitPresetItems = [];

    // Get all header geometries and sort them by vertical position
    var headers = [];
    dragState.libraryItems.forEach(function(entry) {
        var geo = getWidgetGeometry(entry.container);
        if (geo) {
            headers.push({
                geo: geo,
                libName: entry.libName,
                libIndex: entry.libIndex
            });
        }
    });
    headers.sort(function(a, b) {
        var topA = a.geo.top !== undefined ? a.geo.top : a.geo.y;
        var topB = b.geo.top !== undefined ? b.geo.top : b.geo.y;
        return topA - topB;
    });

    // Expand the height of each category's hit target to fill the vertical range
    // between this header and the next. The last header extends down by 1000px.
    for (var i = 0; i < headers.length; i++) {
        var current = headers[i];
        var curTop = current.geo.top !== undefined ? current.geo.top : current.geo.y;
        var curHeight = current.geo.height;
        var nextTop = null;
        if (i < headers.length - 1) {
            var next = headers[i + 1];
            nextTop = next.geo.top !== undefined ? next.geo.top : next.geo.y;
        }
        var newHeight = (nextTop !== null) ? Math.max(curHeight, Math.abs(nextTop - curTop)) : Math.max(curHeight, 1000);
        
        var newGeo = {
            left: current.geo.left,
            right: current.geo.right,
            top: current.geo.top,
            bottom: current.geo.bottom,
            x: current.geo.x,
            y: current.geo.y,
            width: current.geo.width,
            height: newHeight
        };
        if (newGeo.bottom !== undefined && newGeo.top !== undefined) {
            newGeo.bottom = newGeo.top + newHeight;
        }
        dragState.hitLibraryItems.push({
            geo: newGeo,
            libName: current.libName,
            libIndex: current.libIndex
        });
    }

    dragState.presetItems.forEach(function(entry) {
        dragState.hitPresetItems.push({
            geo: getWidgetGeometry(entry.container),
            libName: entry.libName,
            presetIndex: entry.presetIndex
        });
    });
}

function pointFromLocalPosition(widget, position) {
    var geo = (widget === dragState.startWidget && dragState.startGeometry) ?
        dragState.startGeometry :
        getWidgetGeometry(widget);
    if (!geo || !position) return [];
    var left = geo.left !== undefined ? geo.left : geo.x;
    var top = geo.top !== undefined ? geo.top : geo.y;
    var bottom = geo.bottom !== undefined ? geo.bottom : (top + geo.height);
    var x = left + position.x;
    // Mouse positions are reported from the widget's bottom-left.
    return [{ x: x, y: bottom - position.y }];
}

function geometryContainsPoint(geo, point) {
    if (!geo || !point) return false;
    var left = geo.left !== undefined ? geo.left : geo.x;
    var right = geo.right !== undefined ? geo.right : (left + geo.width);
    var top = geo.top !== undefined ? geo.top : geo.y;
    var bottom = geo.bottom !== undefined ? geo.bottom : (top + geo.height);
    var minX = Math.min(left, right);
    var maxX = Math.max(left, right);
    var minY = Math.min(top, bottom);
    var maxY = Math.max(top, bottom);
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function verticalInsertIndexFromPoint(geo, point, itemIndex, position) {
    if (itemIndex > dragState.fromLibIndex) return itemIndex + 1;
    if (itemIndex < dragState.fromLibIndex) return itemIndex;
    var top = geo.top !== undefined ? geo.top : geo.y;
    var bottom = geo.bottom !== undefined ? geo.bottom : (top + geo.height);
    var height = Math.max(1, Math.abs(bottom - top));
    var topDistance = Math.abs(point.y - top);
    var bottomDistance = Math.abs(point.y - bottom);
    var edgeInset = Math.max(3, height * 0.12);
    if (topDistance <= edgeInset) return itemIndex;
    if (bottomDistance <= edgeInset) return itemIndex + 1;
    if (dragState.lastPosition && Math.abs(point.y - dragState.lastPosition.y) > 0.5) {
        return point.y < dragState.lastPosition.y ? itemIndex + 1 : itemIndex;
    }
    if (dragState.startPosition && position && Math.abs(position.y - dragState.startPosition.y) > 2) {
        return position.y < dragState.startPosition.y ? itemIndex + 1 : itemIndex;
    }
    return topDistance <= bottomDistance ? itemIndex : itemIndex + 1;
}

function horizontalInsertIndexFromPoint(geo, point, itemIndex) {
    var left = geo.left !== undefined ? geo.left : geo.x;
    var right = geo.right !== undefined ? geo.right : (left + geo.width);
    var centerX = (left + right) / 2;
    return point.x < centerX ? itemIndex : itemIndex + 1;
}

function getPresetInsertIndex(headerEntry, point) {
    var categoryCards = [];
    var minTop = Infinity;
    var maxBottom = -Infinity;

    for (var i = 0; i < dragState.hitPresetItems.length; i++) {
        var card = dragState.hitPresetItems[i];
        if (card.libName === headerEntry.libName) {
            var geo = card.geo;
            if (geo) {
                var top = geo.top !== undefined ? geo.top : geo.y;
                var bottom = geo.bottom !== undefined ? geo.bottom : (geo.y + geo.height);
                var left = geo.left !== undefined ? geo.left : geo.x;
                var right = geo.right !== undefined ? geo.right : (geo.x + geo.width);
                
                categoryCards.push({
                    card: card,
                    top: top,
                    bottom: bottom,
                    left: left,
                    right: right,
                    centerX: (left + right) / 2,
                    centerY: (top + bottom) / 2
                });

                if (top < minTop) minTop = top;
                if (bottom > maxBottom) maxBottom = bottom;
            }
        }
    }

    var presetCount = categoryCards.length;
    if (presetCount === 0) {
        return 0;
    }

    // If we are below the bottom of the last row of presets in this library, append to end
    if (point.y > maxBottom - 5) {
        return presetCount;
    }

    var bestCard = null;
    var minDistance = Infinity;

    for (var j = 0; j < categoryCards.length; j++) {
        var c = categoryCards[j];
        
        var dy = 0;
        if (point.y < c.top) {
            dy = c.top - point.y;
        } else if (point.y > c.bottom) {
            dy = point.y - c.bottom;
        }

        var dx = 0;
        if (point.x < c.left) {
            dx = c.left - point.x;
        } else if (point.x > c.right) {
            dx = point.x - c.right;
        }

        var distance = dy * 1000 + dx;
        if (distance < minDistance) {
            minDistance = distance;
            bestCard = c;
        }
    }

    if (bestCard) {
        if (point.x < bestCard.centerX) {
            return bestCard.card.presetIndex;
        } else {
            return bestCard.card.presetIndex + 1;
        }
    }

    return presetCount;
}

function pointerMovedEnough(position) {
    if (!dragState.startPosition || !position) return false;
    var dx = position.x - dragState.startPosition.x;
    var dy = position.y - dragState.startPosition.y;
    return (dx * dx + dy * dy) > 16;
}

function updateTargetFromPointer(widget, position) {
    if (!dragState.dragType || !widget || !position) return false;
    if (!pointerMovedEnough(position)) return false;
    dragState.didDrag = true;
    if (dragState.dragType === "library" && dragState.hoverLibIndex === -1) {
        dragState.hoverLibIndex = dragState.fromLibIndex;
        updateDragVisuals();
    }
    var points = pointFromLocalPosition(widget, position);
    for (var p = 0; p < points.length; p++) {
        var point = points[p];
        if (dragState.dragType === "library") {
            for (var l = 0; l < dragState.hitLibraryItems.length; l++) {
                var libEntry = dragState.hitLibraryItems[l];
                var libGeo = libEntry.geo;
                if (geometryContainsPoint(libGeo, point)) {
                    dragState.hoverLibIndex = libEntry.libIndex;
                    var libInsertIndex = verticalInsertIndexFromPoint(libGeo, point, libEntry.libIndex, position);
                    if (libInsertIndex !== null) {
                        hoverLibraryDragTarget(libInsertIndex);
                    }
                    updateDragVisuals();
                    dragState.lastPosition = point;
                    return true;
                }
            }
        } else if (dragState.dragType === "preset") {
            for (var i = 0; i < dragState.hitPresetItems.length; i++) {
                var presetEntry = dragState.hitPresetItems[i];
                var presetGeo = presetEntry.geo;
                if (geometryContainsPoint(presetGeo, point)) {
                    dragState.hoverLibName = presetEntry.libName;
                    dragState.hoverPresetIndex = presetEntry.presetIndex;
                    var presetInsertIndex = horizontalInsertIndexFromPoint(presetGeo, point, presetEntry.presetIndex);
                    if (presetInsertIndex !== null) {
                        hoverPresetDragTarget(presetEntry.libName, presetInsertIndex);
                    }
                    updateDragVisuals();
                    dragState.lastPosition = point;
                    return true;
                }
            }
            for (var h = 0; h < dragState.hitLibraryItems.length; h++) {
                var headerEntry = dragState.hitLibraryItems[h];
                if (geometryContainsPoint(headerEntry.geo, point)) {
                    var presetCount = Object.keys(libraries[headerEntry.libName] || {}).length;
                    var insertIndex = getPresetInsertIndex(headerEntry, point);
                    
                    dragState.didDrag = true;
                    dragState.toLibName = headerEntry.libName;
                    dragState.toPresetIndex = insertIndex;
                    
                    dragState.hoverLibName = headerEntry.libName;
                    if (presetCount > 0) {
                        if (insertIndex >= presetCount) {
                            dragState.hoverPresetIndex = presetCount - 1;
                        } else {
                            dragState.hoverPresetIndex = insertIndex;
                        }
                    } else {
                        dragState.hoverLibName = null;
                        dragState.hoverPresetIndex = -1;
                    }
                    
                    updateDragVisuals();
                    dragState.lastPosition = point;
                    return true;
                }
            }
        }
    }
    return false;
}

function startLibraryDrag(libIndex, widget, position) {
    if (dragState.dragType) return;
    dragState.dragType = "library";
    dragState.didDrag = false;
    dragState.startWidget = widget || null;
    dragState.startPosition = position || null;
    dragState.startGeometry = getWidgetGeometry(widget);
    dragState.lastPosition = null;
    dragState.fromLibIndex = libIndex;
    dragState.toLibIndex = libIndex;
    captureDragHitGeometry();
}

function hoverLibraryDragTarget(libIndex) {
    if (dragState.dragType !== "library") return;
    if (dragState.toLibIndex !== libIndex) {
        dragState.didDrag = true;
        dragState.toLibIndex = libIndex;
        updateDragVisuals();
    }
}

function startPresetDrag(libName, presetIndex, widget, position) {
    if (dragState.dragType) return;
    dragState.dragType = "preset";
    dragState.didDrag = false;
    dragState.startWidget = widget || null;
    dragState.startPosition = position || null;
    dragState.startGeometry = getWidgetGeometry(widget);
    dragState.lastPosition = null;
    dragState.fromLibName = libName;
    dragState.fromPresetIndex = presetIndex;
    dragState.toLibName = libName;
    dragState.toPresetIndex = presetIndex;
    captureDragHitGeometry();
    updateDragVisuals();
}

function hoverPresetDragTarget(libName, presetIndex) {
    if (dragState.dragType !== "preset") return;
    if (dragState.toLibName !== libName || dragState.toPresetIndex !== presetIndex) {
        dragState.didDrag = true;
        dragState.toLibName = libName;
        dragState.toPresetIndex = presetIndex;
        updateDragVisuals();
    }
}

function hoverPresetAppendTarget(libName) {
    if (dragState.dragType !== "preset") return;
    var endIndex = Object.keys(libraries[libName] || {}).length;
    if (dragState.toLibName !== libName || dragState.toPresetIndex !== endIndex) {
        dragState.didDrag = true;
        dragState.toLibName = libName;
        dragState.toPresetIndex = endIndex;
        updateDragVisuals();
    }
}

function completeDrag() {
    if (!dragState.dragType) return;
    var type = dragState.dragType;
    var didDrag = dragState.didDrag;
    var fromLibName = dragState.fromLibName;
    var fromPresetIndex = dragState.fromPresetIndex;
    var toLibName = dragState.toLibName;
    var toPresetIndex = dragState.toPresetIndex;
    var fromLibIndex = dragState.fromLibIndex;
    var toLibIndex = dragState.toLibIndex;
    resetDragState();
    if (!didDrag) {
        buildPresetsTab();
        return;
    }
    var moved = false;
    if (type === "preset") {
        if (fromLibName && fromPresetIndex !== -1 && toLibName && toPresetIndex !== -1) {
            if (fromLibName === toLibName) {
                if (fromPresetIndex !== toPresetIndex) {
                    moved = reorderPresetInLibrary(libraries, fromLibName, fromPresetIndex, toPresetIndex);
                }
            } else {
                moved = movePresetBetweenLibraries(libraries, fromLibName, fromPresetIndex, toLibName, toPresetIndex);
            }
        }
    } else if (type === "library") {
        if (fromLibIndex !== -1 && toLibIndex !== -1 && fromLibIndex !== toLibIndex) {
            moved = reorderLibrary(libraries, fromLibIndex, toLibIndex);
        }
    }
    if (moved) saveLibrariesToPreferences(libraries);
    buildPresetsTab();
}

function getOffsetWrtHeader(widget, headerContainer, defaultDx, defaultDy) {
    var widgetGeo = getWidgetGeometry(widget);
    var headerGeo = getWidgetGeometry(headerContainer);
    if (widgetGeo && headerGeo) {
        var widgetLeft = widgetGeo.left !== undefined ? widgetGeo.left : widgetGeo.x;
        var headerLeft = headerGeo.left !== undefined ? headerGeo.left : headerGeo.x;
        var widgetBottom = widgetGeo.bottom !== undefined ? widgetGeo.bottom : (widgetGeo.y + widgetGeo.height);
        var headerBottom = headerGeo.bottom !== undefined ? headerGeo.bottom : (headerGeo.y + headerGeo.height);
        return {
            dx: widgetLeft - headerLeft,
            dy: headerBottom - widgetBottom
        };
    }
    return { dx: defaultDx, dy: defaultDy };
}

function attachLibraryChildDragHandlers(childWidget, headerContainer, libIndex, defaultDx, defaultDy, libName) {
    attachPasteShortcutHandlers(childWidget);
    childWidget.onMousePress = function(position, button) {
        activePastePanel = "presets";
        if (isContextMenuOpen) {
            isContextMenuOpen = false;
            return;
        }
        if (button === "right") {
            showLibraryContextMenu(libName);
            return;
        }
        if (button !== "left") return;
        var offset = getOffsetWrtHeader(childWidget, headerContainer, defaultDx, defaultDy);
        var translatedPosition = {
            x: position.x + offset.dx,
            y: position.y + offset.dy
        };
        startLibraryDrag(libIndex, headerContainer, translatedPosition);
    };
    childWidget.onMouseMove = function(position) {
        if (isContextMenuOpen) return;
        var offset = getOffsetWrtHeader(childWidget, headerContainer, defaultDx, defaultDy);
        var translatedPosition = {
            x: position.x + offset.dx,
            y: position.y + offset.dy
        };
        updateTargetFromPointer(headerContainer, translatedPosition);
    };
    childWidget.onMouseEnter = function() {};
    childWidget.onMouseRelease = function(position, button) {
        if (button !== "left") return;
        var offset = getOffsetWrtHeader(childWidget, headerContainer, defaultDx, defaultDy);
        var translatedPosition = {
            x: position.x + offset.dx,
            y: position.y + offset.dy
        };
        updateTargetFromPointer(headerContainer, translatedPosition);
        if (dragState.dragType) completeDrag();
    };
}

function attachLibraryDragHandlers(widget, libIndex, libName) {
    attachPasteShortcutHandlers(widget);
    widget.onMousePress = function(position, button) {
        activePastePanel = "presets";
        if (isContextMenuOpen) {
            isContextMenuOpen = false;
            return;
        }
        if (button === "right") {
            showLibraryContextMenu(libName);
            return;
        }
        if (button !== "left") return;
        startLibraryDrag(libIndex, widget, position);
    };
    widget.onMouseMove = function(position) {
        updateTargetFromPointer(widget, position);
    };
    widget.onMouseEnter = function() {};
    widget.onMouseRelease = function(position, button) {
        if (button !== "left") return;
        updateTargetFromPointer(widget, position);
        if (dragState.dragType) completeDrag();
    };
}

function attachPresetDragHandlers(widget, onPress, onMove, onRelease) {
    attachPasteShortcutHandlers(widget);
    widget.onMousePress = function(position, button) {
        activePastePanel = "presets";
        onPress(widget, position, button);
    };
    widget.onMouseMove = function(position) {
        onMove(widget, position);
    };
    widget.onMouseEnter = function() {};
    widget.onMouseRelease = function(position, button) {
        onRelease(widget, position, button);
    };
}

function isCurrentPreset(preset) {
    return (
        Math.abs(currentEasing.x1 - preset.x1) < 0.01 &&
        Math.abs(currentEasing.y1 - preset.y1) < 0.01 &&
        Math.abs(currentEasing.x2 - preset.x2) < 0.01 &&
        Math.abs(currentEasing.y2 - preset.y2) < 0.01
    );
}

function drawPresetPreview(drawWidget, preset) {
    var w = PRESET_GRAPH_WIDTH;
    var h = PRESET_GRAPH_HEIGHT;
    var p = 4;

    var curvePath = new cavalry.Path();
    curvePath.moveTo(p, h - p);
    curvePath.cubicTo(
        p + preset.x1 * (w - 2 * p), h - p - preset.y1 * (h - 2 * p),
        p + preset.x2 * (w - 2 * p), h - p - preset.y2 * (h - 2 * p),
        w - p, p
    );
    if (curvePath && curvePath.toObject) {
        drawWidget.addPath(curvePath.toObject(), {"color": "#f07888", "stroke": true, "strokeWidth": 2});
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
            "color": "#a8a8a8",
            "stroke": true,
            "strokeWidth": 1
        });
    }

    var dotsPath = new cavalry.Path();
    dotsPath.addEllipse(cp1X, cp1Y, 2.5, 2.5);
    dotsPath.addEllipse(cp2X, cp2Y, 2.5, 2.5);
    if (dotsPath && dotsPath.toObject) {
        drawWidget.addPath(dotsPath.toObject(), {"color": ui.getThemeColor("Accent1"), "stroke": false});
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
        drawWidget.addPath(keyframesPath.toObject(), {"color": "#f0f0f0", "stroke": false});
    }

    drawWidget.redraw();
}

function buildPresetsTab() {
    presetsContainer.clear();
    resetDragState();

    var libNames = Object.keys(libraries);
    libNames.forEach(function(libName, libIndex) {
        // ── Library header ──────────────────────────────────────────────
        var isCollapsed = !!collapsedLibraries[libName];
        var collapseBtn = new ui.Button(isCollapsed ? "▶" : "▼");
        collapseBtn.setFixedWidth(18);
        collapseBtn.setFixedHeight(18);
        collapseBtn.setBackgroundColor("#00000000");
        collapseBtn.setDrawStroke(false);
        collapseBtn.setToolTip(isCollapsed ? "Expand collection" : "Collapse collection");
        collapseBtn.onClick = function() {
            collapsedLibraries[libName] = !collapsedLibraries[libName];
            buildPresetsTab();
        };
        collapseBtn.onMousePress = function(position, button) {
            if (isContextMenuOpen) {
                isContextMenuOpen = false;
                return;
            }
            if (button === "right") {
                showLibraryContextMenu(libName);
            }
        };

        var titleDraw = new ui.Draw();
        titleDraw.setFixedWidth(200);
        titleDraw.setFixedHeight(18);
        titleDraw.setBackgroundColor("#00000000");
        var titleTextPath = new cavalry.Path();
        titleTextPath.addText(libName, 13, 2, 5);
        titleDraw.addPath(titleTextPath.toObject(), {"color": "#c8c8c8"});
        var libMenuBtn = new ui.Button("≡");
        libMenuBtn.setFixedWidth(20);

        libMenuBtn.onClick = function() {
            showLibraryContextMenu(libName);
        };
        libMenuBtn.onMousePress = function(position, button) {
            if (isContextMenuOpen) {
                isContextMenuOpen = false;
                return;
            }
            if (button === "right") {
                showLibraryContextMenu(libName);
            }
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
        headerContainer.setFixedWidth(Math.max(280, ui.size().width - 40));
        headerContainer.setFixedHeight(22);
        applyLibStyle(headerContainer, false, false);

        presetsContainer.add(headerContainer);

        dragState.libraryItems.push({
            container: headerContainer,
            libName: libName,
            libIndex: libIndex
        });

        attachLibraryDragHandlers(headerContainer, libIndex, libName);
        attachLibraryChildDragHandlers(titleDraw, headerContainer, libIndex, 26, 2, libName);

        if (isCollapsed) {
            presetsContainer.addSpacing(10);
            return;
        }

        // ── Preset items ────────────────────────────────────────────────
        var flow = new ui.FlowLayout(4, 4);
        var libPresets = libraries[libName];
        var presetNames = Object.keys(libPresets);

        presetNames.forEach(function(pName, presetIndex) {
            var pData = libPresets[pName];
            var isSelected = isCurrentPreset(pData);
            var isTempHighlighted = (temporaryHighlightPreset && 
                                     temporaryHighlightPreset.libName === libName && 
                                     temporaryHighlightPreset.presetIndex === presetIndex);

            var itemContainer = new ui.Container();
            itemContainer.setFixedWidth(PRESET_TILE_WIDTH);
            itemContainer.setFixedHeight(PRESET_TILE_HEIGHT);
            itemContainer.setToolTip(pName);
            applyPresetStyle(itemContainer, isSelected, isTempHighlighted, false);
            itemContainer.useHoverEvents(true);

            var itemLayout = new ui.VLayout();
            itemLayout.setSpaceBetween(1);
            itemLayout.setMargins(2, 2, 2, 2);

            var miniGraph = new ui.Draw();
            miniGraph.setFixedWidth(PRESET_GRAPH_WIDTH);
            miniGraph.setFixedHeight(PRESET_GRAPH_HEIGHT);
            miniGraph.setBackgroundColor("#2a2a2a");
            drawPresetPreview(miniGraph, pData);

            var graphRow = new ui.HLayout();
            graphRow.setMargins(0, 0, 0, 0);
            graphRow.setSpaceBetween(0);
            graphRow.addStretch();
            graphRow.add(miniGraph);
            graphRow.addStretch();

            var pLabel = new ui.Label(pName);
            pLabel.setAlignment(1);
            pLabel.setFontSize(10);
            pLabel.setFixedWidth(PRESET_TILE_WIDTH - 4);
            pLabel.setTextColor(isSelected ? "#ffffff" : "#a0a0a0");
            pLabel.setToolTip(pName);

            var labelRow = new ui.HLayout();
            labelRow.setMargins(0, 0, 0, 0);
            labelRow.setSpaceBetween(0);
            labelRow.addStretch();
            labelRow.add(pLabel);
            labelRow.addStretch();

            itemLayout.add(graphRow);
            itemLayout.add(labelRow);
            itemContainer.setLayout(itemLayout);
            flow.add(itemContainer);

            dragState.presetItems.push({
                container: itemContainer,
                miniGraph: miniGraph,
                label: pLabel,
                libName: libName,
                libIndex: libIndex,
                presetIndex: presetIndex,
                isSelected: isSelected
            });

            // Shared drag logic for the card and all of its child widgets.
            function handlePresetPress(widget, position, button) {
                if (isContextMenuOpen) {
                    isContextMenuOpen = false;
                    return;
                }
                if (button === "right") {
                    resetDragState();
                    showPresetItemContextMenu(libName, pName, pData);
                    return;
                }
                if (button === "left") {
                    if (dragState.dragType && !dragState.didDrag) {
                        resetDragState();
                    }
                    startPresetDrag(libName, presetIndex, widget, position);
                }
            }
            function hoverPreset(widget, position) {
                if (dragState.dragType !== "preset") return;
                updateTargetFromPointer(widget, position);
            }
            function releasePreset(widget, position, button) {
                if (button === "right") {
                    resetDragState();
                    return;
                }
                if (button !== "left") return;
                if (dragState.dragType !== "preset") return;

                var isClick = !dragState.didDrag && !pointerMovedEnough(position);
                if (isClick) {
                    resetDragState();
                    triggerTemporaryHighlight(libName, presetIndex, 300);
                    handlePresetClick(libName, pName, pData);
                    return;
                }

                updateTargetFromPointer(widget, position);
                completeDrag();
            }

            function attachPresetChildDragHandlers(childWidget, parentContainer, defaultDx, defaultDy) {
                attachPresetDragHandlers(
                    childWidget,
                    function(w, pos, btn) {
                        var offset = getOffsetWrtHeader(childWidget, parentContainer, defaultDx, defaultDy);
                        var transPos = { x: pos.x + offset.dx, y: pos.y + offset.dy };
                        handlePresetPress(parentContainer, transPos, btn);
                    },
                    function(w, pos) {
                        var offset = getOffsetWrtHeader(childWidget, parentContainer, defaultDx, defaultDy);
                        var transPos = { x: pos.x + offset.dx, y: pos.y + offset.dy };
                        hoverPreset(parentContainer, transPos);
                    },
                    function(w, pos, btn) {
                        var offset = getOffsetWrtHeader(childWidget, parentContainer, defaultDx, defaultDy);
                        var transPos = { x: pos.x + offset.dx, y: pos.y + offset.dy };
                        releasePreset(parentContainer, transPos, btn);
                    }
                );
            }

            miniGraph.useHoverEvents(true);
            attachPresetChildDragHandlers(miniGraph, itemContainer, 4, 4);
            attachPresetChildDragHandlers(pLabel, itemContainer, 4, 4);
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
    emptySpaceContainer.onMousePress = function(position, button) {
        activePastePanel = "presets";
        if (isContextMenuOpen) {
            isContextMenuOpen = false;
            return;
        }
        if (button === "right") {
            showPresetsPageContextMenu();
        }
    };
    emptySpaceContainer.onMouseMove = function(position) {
        isContextMenuOpen = false;
    };
    presetsContainer.add(emptySpaceContainer);
    presetsContainer.addStretch();
}

var presetsTabLayout = new ui.VLayout();
presetsTabLayout.add(presetsScroll);

tabView.add("Editor", editorTabLayout);
tabView.add("Presets", presetsTabLayout);

mainLayout.add(tabView);
mainLayout.add(buttonRow);

ui.onKeyPress = function(key, event) {
    return handleKeyShortcut(key, event);
};
ui.onKeyDown = ui.onKeyPress;
attachPasteShortcutHandlers(graphContainer);
attachPasteShortcutHandlers(presetsScroll);

presetsScroll.onMouseMove = function(position) {
    isContextMenuOpen = false;
};

ui.add(mainLayout);
ui.setBackgroundColor(GRAPH_COLORS.canvas);

// Initialize display
updateTextInput();
redrawGraphs();
buildPresetsTab();

// Tab change handler
tabView.onTabChanged = function() {
    redrawGraphs();
    saveTabPreference();
    var currentTab = tabView.currentTab();
    activePastePanel = (currentTab === "Presets" || currentTab === 1) ? "presets" : "editor";
    if (currentTab === "Presets" || currentTab === 1) {
        buildPresetsTab();
    }
};

// Window size
ui.setMinimumWidth(320);
ui.setMinimumHeight(265);

// Resize handler
ui.onResize = function() {
    var newWidth = ui.size().width;
    var newHeight = ui.size().height;
    
    var controlsHeight = 115;
    var margin = 16;
    
    var newGraphWidth = Math.max(150, newWidth - margin);
    var newGraphHeight = Math.max(150, newHeight - controlsHeight);
    
    graphWidth = newGraphWidth;
    graphHeight = newGraphHeight;
    speedGraphWidth = newGraphWidth;
    speedGraphHeight = newGraphHeight;
    
    graphPadding = calculateDynamicPadding(graphWidth, graphHeight);
    speedGraphPadding = calculateDynamicPadding(speedGraphWidth, speedGraphHeight);
    
    graphCanvas.setSize(graphWidth, graphHeight);
    speedGraphCanvas.setSize(speedGraphWidth, speedGraphHeight);
    
    redrawGraphs();

    if (dragState && dragState.libraryItems) {
        dragState.libraryItems.forEach(function(entry) {
            if (entry.container && typeof entry.container.setFixedWidth === "function") {
                entry.container.setFixedWidth(Math.max(280, newWidth - 40));
            }
        });
    }
};

// Show window
ui.show();

// Restore last selected tab
isInitializingTab = true;
var savedTab = loadLastSelectedTab();
if (savedTab !== null) {
    tabView.setTab(savedTab);
}

// Reset init flag after delay
var initTimerCallback = {
    onTimeout: function() {
        isInitializingTab = false;
    }
};
var initTimer = new api.Timer(initTimerCallback);
initTimer.setInterval(100);
initTimer.setRepeating(false);
initTimer.start();
