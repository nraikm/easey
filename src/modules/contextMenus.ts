export function showContextMenu() {
  ui.showContextMenu();
}

export function confirmMenuAction(enabled, title, message) {
  if (!enabled) return true;

  try {
    var modal = new ui.Modal();
    return modal.showQuestion(title, message);
  } catch (e) {
    console.log("Could not show confirmation:", e.message);
    return false;
  }
}

import { CURRENT_VERSION } from "./constants.ts";
import { setGridDivisions } from "./graphGeometry.ts";
import { applyEasingToKeyframes, fixHoldPaths, setClampHoldsEnabled, copyKeyframeDuration, copyKeyframeValues, copyAllKeyframeInfo } from "./keyframeOps.ts";
import { savePresetToLibrary, savePresetToNewLibrary, saveLibrariesToPreferences, copyCubicBezierToClipboard, copyEasingNumbersToClipboard, exportCurrentCurveToJson, exportLibraryToFlowFile, importLibraryFromFlowFile, mergeImportIntoLibrary, savePresetAsJson, renamePresetInLibrary, deletePresetFromLibrary, renameLibrary, saveApplyOnDragSetting, saveLivePresetsApplySetting, saveConfirmActionsSetting, saveClampIdenticalSetting, saveDisableScrollbarSetting, saveLastCurveBehaviorSetting, savePresetsViewModeSetting, savePresetsOrientationLeftTopSetting, saveGraphResolutionSetting, reorderLibrary } from "./presetManager.ts";

export function createContextMenus(options) {
var state = options.state;
var actions = options.actions;

// CONTEXT MENUS
// ============================================================================

function showPresetItemContextMenu(libName, presetName, presetData) {
  ui.clearContextMenu();

  ui.addMenuItem({
    name: "Paste Preset After This",
    onMouseRelease: function () {
      actions.pasteEasingToPresets(actions.getPresetInsertTargetAfter(libName, presetName));
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Save As...",
    onMouseRelease: function () {
      savePresetAsJson(presetName, presetData);
    },
  });

  ui.addMenuItem({
    name: "Rename...",
    onMouseRelease: function () {
      renamePresetInLibrary(state.libraries, libName, presetName, function () {
        saveLibrariesToPreferences(state.libraries);
        actions.buildPresetsTab();
      });
    },
  });

  ui.addMenuItem({
    name: "Delete",
    onMouseRelease: function () {
      if (
        !actions.confirmPresetAction(
          "Delete Preset",
          "Delete preset '" + presetName + "' from '" + libName + "'?",
        )
      ) {
        return;
      }
      deletePresetFromLibrary(state.libraries, libName, presetName, function () {
        saveLibrariesToPreferences(state.libraries);
        actions.buildPresetsTab();
      });
    },
  });

  showContextMenu();
}

function addSaveCurrentCurveMenuItems() {
  ui.addMenuItem({
    name: "Save to New Library...",
    onMouseRelease: function () {
      savePresetToNewLibrary(state.libraries, state.currentEasing, function () {
        saveLibrariesToPreferences(state.libraries);
        actions.buildPresetsTab();
      });
    },
  });

  var saveMenu = new ui.Menu("Save to Library");
  var libNames = Object.keys(state.libraries);
  libNames.forEach(function (libName) {
    saveMenu.addMenuItem({
      name: libName,
      onMouseRelease: function () {
        savePresetToLibrary(state.libraries, libName, state.currentEasing, function () {
          saveLibrariesToPreferences(state.libraries);
          actions.buildPresetsTab();
        });
      },
    });
  });
  ui.addSubMenu(saveMenu);
}

function invertEasingCurve() {
  var prev = Object.assign({}, state.currentEasing);
  var inverted = {
    x1: 1 - state.currentEasing.x2,
    y1: 1 - state.currentEasing.y2,
    x2: 1 - state.currentEasing.x1,
    y2: 1 - state.currentEasing.y1,
  };
  state.currentEasing.x1 = inverted.x1;
  state.currentEasing.y1 = inverted.y1;
  state.currentEasing.x2 = inverted.x2;
  state.currentEasing.y2 = inverted.y2;
  actions.updateLastEasingForAtomicChange(prev);
  actions.resetPresetDropdown();
  actions.updateTextInput();
  actions.redrawGraphs();
  actions.saveTabPreference();
  if (state.applyOnDragEnabled) {
    actions.applyEasingToSelectionIfAvailable();
  }
}

function showEditorContextMenu() {
  ui.clearContextMenu();

  ui.addMenuItem({
    name: "Paste Coordinates",
    onMouseRelease: function () {
      actions.pasteEasingToEditor();
    },
  });

  ui.addMenuItem({
    name: "Copy Numbers",
    onMouseRelease: function () {
      copyEasingNumbersToClipboard(state.currentEasing);
    },
  });

  ui.addMenuItem({
    name: "Invert Value",
    onMouseRelease: function () {
      invertEasingCurve();
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Export Current Curve to JSON...",
    onMouseRelease: function () {
      exportCurrentCurveToJson(state.currentEasing);
    },
  });

  addSaveCurrentCurveMenuItems();

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Apply Changes",
    onMouseRelease: function () {
      applyEasingToKeyframes(state.currentEasing);
      actions.saveTabPreference();
    },
  });

  showContextMenu();
}

/**
 * Display the main preset context menu for importing state.libraries, resetting, copying, and settings.
 */
function showPresetContextMenu() {
  ui.clearContextMenu();

  addSaveCurrentCurveMenuItems();

  ui.addMenuItem({
    name: "Import Library...",
    onMouseRelease: function () {
      importLibraryFromFlowFile(
        state.libraries,
        function () {
          saveLibrariesToPreferences(state.libraries);
          actions.buildPresetsTab();
        },
        function (libraryName, importCount) {
          return actions.confirmPresetAction(
            "Import Library",
            "Import " +
              importCount +
              " preset(s) into existing library '" +
              libraryName +
              "'? Existing presets will be kept and matching names may be replaced.",
          );
        },
      );
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Set to Linear",
    onMouseRelease: function () {
      var prev = Object.assign({}, state.currentEasing);
      state.currentEasing.x1 = 0;
      state.currentEasing.y1 = 0;
      state.currentEasing.x2 = 1;
      state.currentEasing.y2 = 1;
      actions.updateLastEasingForAtomicChange(prev);
      actions.updateTextInput();
      actions.redrawGraphs();
    },
  });

  ui.addMenuItem({
    name: "Reset",
    onMouseRelease: function () {
      var prev = Object.assign({}, state.currentEasing);
      state.currentEasing.x1 = 0.25;
      state.currentEasing.y1 = 0.1;
      state.currentEasing.x2 = 0.25;
      state.currentEasing.y2 = 1.0;
      actions.updateLastEasingForAtomicChange(prev);
      actions.updateTextInput();
      actions.redrawGraphs();
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Copy Current Curve to Clipboard",
    onMouseRelease: function () {
      copyCubicBezierToClipboard(state.currentEasing);
    },
  });

  ui.addMenuItem({
    name: "Copy Keyframe Duration in ms",
    onMouseRelease: function () {
      copyKeyframeDuration();
    },
  });

  ui.addMenuItem({
    name: "Copy Keyframe Values",
    onMouseRelease: function () {
      copyKeyframeValues();
    },
  });

  ui.addMenuItem({
    name: "Copy All Keyframe Info",
    onMouseRelease: function () {
      copyAllKeyframeInfo();
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Apply when dragging handles" + (state.applyOnDragEnabled ? " ✓" : ""),
    onMouseRelease: function () {
      state.applyOnDragEnabled = !state.applyOnDragEnabled;
      saveApplyOnDragSetting(state.applyOnDragEnabled);
    },
  });

  ui.addMenuItem({
    name: "Apply presets live" + (state.livePresetsApplyEnabled ? " ✓" : ""),
    onMouseRelease: function () {
      state.livePresetsApplyEnabled = !state.livePresetsApplyEnabled;
      saveLivePresetsApplySetting(state.livePresetsApplyEnabled);
    },
  });

  ui.addMenuItem({
    name:
      "Confirm destructive preset actions" +
      (state.confirmActionsEnabled ? " ✓" : ""),
    onMouseRelease: function () {
      state.confirmActionsEnabled = !state.confirmActionsEnabled;
      saveConfirmActionsSetting(state.confirmActionsEnabled);
    },
  });

  ui.addMenuItem({
    name: "Automatically clamp paths" + (state.clampHoldsEnabled ? " ✓" : ""),
    onMouseRelease: function () {
      state.clampHoldsEnabled = !state.clampHoldsEnabled;
      setClampHoldsEnabled(state.clampHoldsEnabled);
      saveClampIdenticalSetting(state.clampHoldsEnabled);
    },
  });

  ui.addMenuItem({
    name: "Disable Scrollbar" + (state.disableScrollbarEnabled ? " ✓" : ""),
    onMouseRelease: function () {
      state.disableScrollbarEnabled = !state.disableScrollbarEnabled;
      saveDisableScrollbarSetting(state.disableScrollbarEnabled);
      actions.applyScrollbarPreference();
      actions.handleResize();
    },
  });

  var lastCurveText = "Last Curve: Off";
  if (state.lastCurveBehavior === 1) {
    lastCurveText = "Last Curve: Before Edit";
  } else if (state.lastCurveBehavior === 2) {
    lastCurveText = "Last Curve: After Edit";
  }

  ui.addMenuItem({
    name: lastCurveText,
    onMouseRelease: function () {
      state.lastCurveBehavior = (state.lastCurveBehavior + 1) % 3;
      saveLastCurveBehaviorSetting(state.lastCurveBehavior);
      if (state.lastCurveBehavior === 0) {
        state.lastEasing = null;
      } else {
        state.lastEasing = Object.assign({}, state.currentEasing);
      }
      actions.redrawGraphs();
    },
  });

  var presetsViewText = "Presets View: Tab";
  if (state.presetsViewMode === "right") {
    presetsViewText = state.presetsOrientationLeftTop
      ? "Presets View: Left"
      : "Presets View: Right";
  } else if (state.presetsViewMode === "bottom") {
    presetsViewText = state.presetsOrientationLeftTop
      ? "Presets View: Top"
      : "Presets View: Bottom";
  }

  ui.addMenuItem({
    name: presetsViewText,
    onMouseRelease: function () {
      if (state.presetsViewMode === "tab") {
        state.presetsViewMode = "right";
      } else if (state.presetsViewMode === "right") {
        state.presetsViewMode = "bottom";
      } else {
        state.presetsViewMode = "tab";
      }
      savePresetsViewModeSetting(state.presetsViewMode);
      actions.applyLayoutMode();
    },
  });

  var presetsOrientationText = state.presetsOrientationLeftTop
    ? "Presets Orientation: Left/Top"
    : "Presets Orientation: Right/Bottom";

  ui.addMenuItem({
    name: presetsOrientationText,
    onMouseRelease: function () {
      state.presetsOrientationLeftTop = !state.presetsOrientationLeftTop;
      savePresetsOrientationLeftTopSetting(state.presetsOrientationLeftTop);
      actions.applyLayoutMode();
    },
  });

  var resolutionText = "Graph Resolution: 0.1";
  if (state.graphResolution === 0.05) {
    resolutionText = "Graph Resolution: 0.05";
  } else if (state.graphResolution === 0.01) {
    resolutionText = "Graph Resolution: 0.01";
  }

  ui.addMenuItem({
    name: resolutionText,
    onMouseRelease: function () {
      if (state.graphResolution === 0.1) {
        state.graphResolution = 0.05;
      } else if (state.graphResolution === 0.05) {
        state.graphResolution = 0.01;
      } else {
        state.graphResolution = 0.1;
      }
      saveGraphResolutionSetting(state.graphResolution);
      setGridDivisions(Math.round(1 / state.graphResolution));
      actions.redrawGraphs();
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Clamp motion paths between holds",
    onMouseRelease: function () {
      fixHoldPaths();
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Easey Version " + CURRENT_VERSION,
    enabled: false,
  });
  ui.addMenuItem({
    name: "By Canva Creative Team",
    enabled: false,
  });
  ui.addMenuItem({
    name: "Get updates and more plugins...",
    enabled: true,
    onMouseRelease: function () {
      api.openURL("https://canvacreative.team/motion");
    },
  });

  showContextMenu();
}

function showPresetsPageContextMenu() {
  ui.clearContextMenu();

  ui.addMenuItem({
    name: "Import Library...",
    onMouseRelease: function () {
      importLibraryFromFlowFile(
        state.libraries,
        function () {
          saveLibrariesToPreferences(state.libraries);
          actions.buildPresetsTab();
        },
        function (libraryName, importCount) {
          return actions.confirmPresetAction(
            "Import Library",
            "Import " +
              importCount +
              " preset(s) into existing library '" +
              libraryName +
              "'? Existing presets will be kept and matching names may be replaced.",
          );
        },
      );
    },
  });

  showContextMenu();
}

function showLibraryContextMenu(libName) {
  actions.resetDragState();
  ui.clearContextMenu();

  ui.addMenuItem({
    name: "Paste Preset Here",
    onMouseRelease: function () {
      actions.pasteEasingToPresets({
        libName: libName,
        insertIndex: 0,
      });
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Merge Import Collection...",
    onMouseRelease: function () {
      mergeImportIntoLibrary(
        state.libraries,
        libName,
        function () {
          saveLibrariesToPreferences(state.libraries);
          actions.buildPresetsTab();
        },
        function (libraryName, importCount) {
          return actions.confirmPresetAction(
            "Merge Import Collection",
            "Merge " +
              importCount +
              " preset(s) into existing library '" +
              libraryName +
              "'? Existing presets will be kept and matching names may be replaced.",
          );
        },
      );
    },
  });

  ui.addMenuItem({
    name: "Import Library Above...",
    onMouseRelease: function () {
      importLibraryFromFlowFile(
        state.libraries,
        function (importedLibName) {
          var names = Object.keys(state.libraries);
          var currentIdx = names.indexOf(libName);
          var importedIdx = names.indexOf(importedLibName);
          if (
            currentIdx !== -1 &&
            importedIdx !== -1 &&
            currentIdx !== importedIdx
          ) {
            reorderLibrary(state.libraries, importedIdx, currentIdx);
          }
          saveLibrariesToPreferences(state.libraries);
          actions.buildPresetsTab();
        },
        function (libraryName, importCount) {
          return actions.confirmPresetAction(
            "Import Library",
            "Import " +
              importCount +
              " preset(s) into existing library '" +
              libraryName +
              "'? Existing presets will be kept and matching names may be replaced.",
          );
        },
      );
    },
  });

  ui.addMenuItem({
    name: "Export Library...",
    onMouseRelease: function () {
      exportLibraryToFlowFile(libName, state.libraries);
    },
  });

  ui.addMenuItem({ name: "" });

  ui.addMenuItem({
    name: "Clear Library",
    onMouseRelease: function () {
      var presetCount = Object.keys(state.libraries[libName] || {}).length;
      if (presetCount === 0) return;
      if (
        !actions.confirmPresetAction(
          "Clear Library",
          "Delete all " +
            presetCount +
            " preset(s) from library '" +
            libName +
            "'?",
        )
      ) {
        return;
      }
      state.libraries[libName] = {};
      saveLibrariesToPreferences(state.libraries);
      actions.buildPresetsTab();
    },
  });

  ui.addMenuItem({
    name: "Rename Library...",
    onMouseRelease: function () {
      renameLibrary(state.libraries, libName, function (newName) {
        if (state.collapsedLibraries[libName] !== undefined) {
          state.collapsedLibraries[newName] = state.collapsedLibraries[libName];
          delete state.collapsedLibraries[libName];
        }
        saveLibrariesToPreferences(state.libraries);
        actions.buildPresetsTab();
      });
    },
  });

  ui.addMenuItem({
    name: "Delete Library",
    onMouseRelease: function () {
      var presetCount = Object.keys(state.libraries[libName] || {}).length;
      if (
        !actions.confirmPresetAction(
          "Delete Library",
          "Delete library '" +
            libName +
            "' and its " +
            presetCount +
            " preset(s)?",
        )
      ) {
        return;
      }
      delete state.libraries[libName];
      delete state.collapsedLibraries[libName];
      saveLibrariesToPreferences(state.libraries);
      actions.buildPresetsTab();
    },
  });

  showContextMenu();
}


return {
  showPresetItemContextMenu: showPresetItemContextMenu,
  showEditorContextMenu: showEditorContextMenu,
  showPresetContextMenu: showPresetContextMenu,
  showPresetsPageContextMenu: showPresetsPageContextMenu,
  showLibraryContextMenu: showLibraryContextMenu,
};
}
