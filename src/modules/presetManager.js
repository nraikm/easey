// Preset management module
// Functions for saving, loading, and managing easing preset libraries.

function savePreference(key, value, errorMessage) {
  try {
    api.setPreferenceObject(key, value);
  } catch (e) {
    console.log(errorMessage + ":", e.message);
  }
}

function loadPreference(key, fallback, errorMessage) {
  try {
    if (api.hasPreferenceObject(key)) {
      var saved = api.getPreferenceObject(key);
      if (saved !== null && saved !== undefined) {
        return saved;
      }
    }
  } catch (e) {
    console.log(errorMessage + ":", e.message);
  }
  return fallback;
}

export function savePresetToLibrary(
  libraries,
  libraryName,
  currentEasing,
  onSave,
) {
  try {
    var modal = new ui.Modal();
    var presetName = modal.showStringInput(
      "Save Preset",
      "Enter preset name (max 30 chars):",
      "My Preset",
    );

    if (presetName && presetName.trim() !== "") {
      if (presetName.length > 30) {
        console.log("Preset name too long. Please use 30 characters or less.");
        return;
      }
      if (!libraries[libraryName]) libraries[libraryName] = {};
      libraries[libraryName][presetName] = {
        x1: currentEasing.x1,
        y1: currentEasing.y1,
        x2: currentEasing.x2,
        y2: currentEasing.y2,
      };
      if (onSave) onSave();
    }
  } catch (e) {
    console.log("Error saving preset:", e.message);
  }
}

export function savePresetToNewLibrary(libraries, currentEasing, onSave) {
  try {
    var modal = new ui.Modal();
    var libraryName = modal.showStringInput(
      "New Library",
      "Enter new library name:",
      "My Library",
    );
    if (libraryName && libraryName.trim() !== "") {
      if (!libraries[libraryName]) {
        libraries[libraryName] = {};
      }
      savePresetToLibrary(libraries, libraryName, currentEasing, onSave);
    }
  } catch (e) {
    console.log("Error creating library:", e.message);
  }
}

export function loadLibrariesFromPreferences(libraries, defaultLibraries) {
  try {
    // Clear current
    for (var key in libraries) {
      delete libraries[key];
    }

    // Migrate old presets if they exist and no libraries exist
    if (
      api.hasPreferenceObject("easey_presets") &&
      !api.hasPreferenceObject("easey_libraries")
    ) {
      var oldPresets = api.getPreferenceObject("easey_presets");
      if (oldPresets) {
        libraries["Imported Presets"] = oldPresets;
        api.setPreferenceObject("easey_libraries", libraries);
      }
    }

    if (api.hasPreferenceObject("easey_libraries")) {
      var saved = api.getPreferenceObject("easey_libraries");
      if (saved !== null && saved !== undefined) {
        for (var key in saved) {
          libraries[key] = saved[key];
        }
      }
    } else {
      // Load defaults
      for (var key in defaultLibraries) {
        libraries[key] = Object.assign({}, defaultLibraries[key]);
      }
    }
  } catch (e) {
    console.log("Could not load libraries:", e.message);
  }
}

export function saveLibrariesToPreferences(libraries) {
  savePreference("easey_libraries", libraries, "Could not save libraries");
}

export function reorderPresetInLibrary(
  libraries,
  libraryName,
  fromIndex,
  toIndex,
) {
  var libPresets = libraries[libraryName];
  if (!libPresets) return false;
  var names = Object.keys(libPresets);
  if (
    fromIndex < 0 ||
    fromIndex >= names.length ||
    toIndex < 0 ||
    toIndex > names.length
  )
    return false;
  if (toIndex === fromIndex || toIndex === fromIndex + 1) return false;
  var movedName = names[fromIndex];
  names.splice(fromIndex, 1);
  var insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
  insertAt = Math.max(0, Math.min(insertAt, names.length));
  names.splice(insertAt, 0, movedName);
  var reordered = {};
  names.forEach(function (name) {
    reordered[name] = libPresets[name];
  });
  libraries[libraryName] = reordered;
  return true;
}

export function movePresetBetweenLibraries(
  libraries,
  fromLibName,
  fromIndex,
  toLibName,
  toIndex,
) {
  var fromLib = libraries[fromLibName];
  var toLib = libraries[toLibName];
  if (!fromLib || !toLib) return false;
  var fromNames = Object.keys(fromLib);
  if (fromIndex < 0 || fromIndex >= fromNames.length) return false;
  var presetName = fromNames[fromIndex];
  var presetData = fromLib[presetName];
  var newFromLib = {};
  fromNames.forEach(function (n, i) {
    if (i !== fromIndex) newFromLib[n] = fromLib[n];
  });
  libraries[fromLibName] = newFromLib;
  var toNames = Object.keys(toLib);
  var insertAt = Math.min(toIndex, toNames.length);
  toNames.splice(insertAt, 0, presetName);
  var newToLib = {};
  toNames.forEach(function (n) {
    newToLib[n] = n === presetName ? presetData : toLib[n];
  });
  libraries[toLibName] = newToLib;
  return true;
}

export function reorderLibrary(libraries, fromIndex, toIndex) {
  var names = Object.keys(libraries);
  if (
    fromIndex < 0 ||
    fromIndex >= names.length ||
    toIndex < 0 ||
    toIndex > names.length
  )
    return false;
  if (toIndex === fromIndex || toIndex === fromIndex + 1) return false;
  var moved = names.splice(fromIndex, 1)[0];
  var insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
  insertAt = Math.max(0, Math.min(insertAt, names.length));
  names.splice(insertAt, 0, moved);
  var snapshot = {};
  names.forEach(function (n) {
    snapshot[n] = libraries[n];
  });
  Object.keys(libraries).forEach(function (k) {
    delete libraries[k];
  });
  names.forEach(function (n) {
    libraries[n] = snapshot[n];
  });
  return true;
}

export function saveApplyOnDragSetting(enabled) {
  savePreference(
    "easey_applyOnDrag",
    enabled,
    "Could not save apply on drag setting",
  );
}

export function loadApplyOnDragSetting() {
  return loadPreference(
    "easey_applyOnDrag",
    false,
    "Could not load apply on drag setting",
  );
}

export function saveLivePresetsApplySetting(enabled) {
  savePreference(
    "easey_livePresetsApply",
    enabled,
    "Could not save live presets apply setting",
  );
}

export function loadLivePresetsApplySetting() {
  try {
    if (api.hasPreferenceObject("easey_livePresetsApply")) {
      var saved = api.getPreferenceObject("easey_livePresetsApply");
      if (saved !== null && saved !== undefined) {
        return saved;
      }
    }
  } catch (e) {
    console.log("Could not load live presets apply setting:", e.message);
  }
  return loadPreference(
    "easey_liveEditorApply",
    false,
    "Could not load live editor apply setting",
  );
}

export function saveConfirmActionsSetting(enabled) {
  savePreference(
    "easey_confirmActions",
    enabled,
    "Could not save confirmation setting",
  );
}

export function loadConfirmActionsSetting() {
  return loadPreference(
    "easey_confirmActions",
    true,
    "Could not load confirmation setting",
  );
}

export function saveClampIdenticalSetting(enabled) {
  savePreference(
    "easey_clampIdenticalValues",
    enabled,
    "Could not save clamp identical setting",
  );
}

export function loadClampIdenticalSetting() {
  return loadPreference(
    "easey_clampIdenticalValues",
    true,
    "Could not load clamp identical setting",
  );
}

export function saveLastCurveBehaviorSetting(behavior) {
  savePreference(
    "easey_lastCurveBehavior",
    behavior,
    "Could not save last curve behavior setting",
  );
}

export function loadLastCurveBehaviorSetting() {
  return loadPreference(
    "easey_lastCurveBehavior",
    0,
    "Could not load last curve behavior setting",
  );
}

export function saveLastSelectedTab(tabIndex) {
  savePreference(
    "easey_lastSelectedTab",
    tabIndex,
    "Could not save last selected tab",
  );
}

export function loadLastSelectedTab() {
  return loadPreference(
    "easey_lastSelectedTab",
    null,
    "Could not load last selected tab",
  );
}

export function savePresetsViewModeSetting(mode) {
  savePreference(
    "easey_presetsViewMode",
    mode,
    "Could not save presets view mode",
  );
}

export function loadPresetsViewModeSetting() {
  return loadPreference(
    "easey_presetsViewMode",
    "tab",
    "Could not load presets view mode",
  );
}

export function saveSplitGraphWidthSetting(width) {
  savePreference(
    "easey_splitGraphWidth",
    width,
    "Could not save split graph width",
  );
}

export function loadSplitGraphWidthSetting() {
  return loadPreference(
    "easey_splitGraphWidth",
    250,
    "Could not load split graph width",
  );
}

export function saveSplitGraphHeightSetting(height) {
  savePreference(
    "easey_splitGraphHeight",
    height,
    "Could not save split graph height",
  );
}

export function loadSplitGraphHeightSetting() {
  return loadPreference(
    "easey_splitGraphHeight",
    180,
    "Could not load split graph height",
  );
}

export function savePresetsOrientationLeftTopSetting(enabled) {
  savePreference(
    "easey_presetsOrientationLeftTop",
    enabled,
    "Could not save presets orientation Left/Top setting",
  );
}

export function loadPresetsOrientationLeftTopSetting() {
  return loadPreference(
    "easey_presetsOrientationLeftTop",
    false,
    "Could not load presets orientation Left/Top setting",
  );
}

export function saveDisableScrollbarSetting(enabled) {
  savePreference(
    "easey_disableScrollbar",
    enabled,
    "Could not save disable scrollbar setting",
  );
}

export function loadDisableScrollbarSetting() {
  return loadPreference(
    "easey_disableScrollbar",
    false,
    "Could not load disable scrollbar setting",
  );
}

export function copyCubicBezierToClipboard(currentEasing) {
  var text =
    "cubic-bezier(" +
    currentEasing.x1.toFixed(3) +
    ", " +
    currentEasing.y1.toFixed(3) +
    ", " +
    currentEasing.x2.toFixed(3) +
    ", " +
    currentEasing.y2.toFixed(3) +
    ")";
  api.setClipboardText(text);
  console.log("Copied " + text + " to clipboard");
}

function formatCompactNumber(value) {
  var rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded) < 0.0005) {
    rounded = 0;
  }
  return String(rounded);
}

export function getEasingNumberString(currentEasing) {
  return (
    formatCompactNumber(currentEasing.x1) +
    "," +
    formatCompactNumber(currentEasing.y1) +
    "," +
    formatCompactNumber(currentEasing.x2) +
    "," +
    formatCompactNumber(currentEasing.y2)
  );
}

export function copyEasingNumbersToClipboard(currentEasing) {
  var text = getEasingNumberString(currentEasing);
  api.setClipboardText(text);
  console.log("Copied " + text + " to clipboard");
}

function formatFlowValue(value) {
  return value.toFixed(2);
}

export function libraryToFlowFormat(libPresets) {
  var flow = {};
  for (var presetName in libPresets) {
    var preset = libPresets[presetName];
    flow[presetName] =
      formatFlowValue(preset.x1) +
      "," +
      formatFlowValue(preset.y1) +
      "," +
      formatFlowValue(preset.x2) +
      "," +
      formatFlowValue(preset.y2);
  }
  return flow;
}

export function flowFormatToLibrary(flowData) {
  var library = {};
  for (var presetName in flowData) {
    var value = flowData[presetName];
    if (typeof value !== "string") {
      console.log(
        "Skipping preset '" + presetName + "': expected comma-separated string",
      );
      continue;
    }
    var parts = value.split(",");
    if (parts.length !== 4) {
      console.log("Skipping preset '" + presetName + "': expected 4 values");
      continue;
    }
    var x1 = parseFloat(parts[0].trim());
    var y1 = parseFloat(parts[1].trim());
    var x2 = parseFloat(parts[2].trim());
    var y2 = parseFloat(parts[3].trim());
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
      console.log(
        "Skipping preset '" + presetName + "': invalid numeric values",
      );
      continue;
    }
    library[presetName] = { x1: x1, y1: y1, x2: x2, y2: y2 };
  }
  return library;
}

function getDialogStartPath() {
  var startPath = api.getProjectPath();
  if (!startPath) {
    startPath = api.getSceneFilePath();
  }
  return startPath || "";
}

function getFileNameWithoutExtension(filePath) {
  var name = filePath;
  var slashIndex = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  if (slashIndex !== -1) {
    name = name.substring(slashIndex + 1);
  }
  var dotIndex = name.lastIndexOf(".");
  if (dotIndex > 0) {
    name = name.substring(0, dotIndex);
  }
  return name;
}

function getSafeJsonFileName(name) {
  var safeName = name.replace(/[\/\\:*?"<>|]/g, "-").trim();
  return (safeName || "easey-curve") + ".json";
}

export function exportLibraryToFlowFile(libraryName, libraries) {
  try {
    var libPresets = libraries[libraryName];
    if (!libPresets || Object.keys(libPresets).length === 0) {
      console.log("Library is empty, nothing to export.");
      return;
    }

    var flowData = libraryToFlowFormat(libPresets);
    var defaultFileName = libraryName + ".flow";
    var filePath = api.presentSaveFile(
      getDialogStartPath(),
      "Export Library",
      "Flow Library (*.flow)",
      defaultFileName,
    );

    if (!filePath) {
      return;
    }

    if (filePath.lastIndexOf(".flow") !== filePath.length - 5) {
      filePath += ".flow";
    }

    var content = JSON.stringify(flowData, null, 4);
    if (api.writeToFile(filePath, content, true)) {
      console.log("Exported library '" + libraryName + "' to " + filePath);
    } else {
      console.log("Failed to export library to " + filePath);
    }
  } catch (e) {
    console.log("Error exporting library:", e.message);
  }
}

export function importLibraryFromFlowFile(
  libraries,
  onImport,
  confirmImportIntoNonEmpty,
) {
  try {
    var filePath = api.presentOpenFile(
      getDialogStartPath(),
      "Import Library",
      "Flow Library (*.flow)",
    );

    if (!filePath) {
      return;
    }

    var content = api.readFromFile(filePath);
    var flowData = JSON.parse(content);
    var importedLibrary = flowFormatToLibrary(flowData);

    if (Object.keys(importedLibrary).length === 0) {
      console.log("No valid presets found in file.");
      return;
    }

    var defaultName = getFileNameWithoutExtension(filePath);
    var modal = new ui.Modal();
    var libraryName = modal.showStringInput(
      "Import Library",
      "Enter library name:",
      defaultName,
    );

    if (!libraryName || libraryName.trim() === "") {
      return;
    }

    libraryName = libraryName.trim();
    if (
      libraries[libraryName] &&
      Object.keys(libraries[libraryName]).length > 0 &&
      confirmImportIntoNonEmpty &&
      !confirmImportIntoNonEmpty(
        libraryName,
        Object.keys(importedLibrary).length,
      )
    ) {
      return;
    }

    if (!libraries[libraryName]) {
      libraries[libraryName] = {};
    }

    for (var presetName in importedLibrary) {
      libraries[libraryName][presetName] = importedLibrary[presetName];
    }

    if (onImport) {
      onImport(libraryName);
    }

    console.log(
      "Imported " +
        Object.keys(importedLibrary).length +
        " preset(s) into library '" +
        libraryName +
        "'",
    );
  } catch (e) {
    console.log("Error importing library:", e.message);
  }
}

export function mergeImportIntoLibrary(
  libraries,
  libraryName,
  onImport,
  confirmMerge,
) {
  try {
    var filePath = api.presentOpenFile(
      getDialogStartPath(),
      "Merge Import Collection",
      "Flow Library (*.flow)",
    );

    if (!filePath) {
      return;
    }

    var content = api.readFromFile(filePath);
    var flowData = JSON.parse(content);
    var importedLibrary = flowFormatToLibrary(flowData);

    var importCount = Object.keys(importedLibrary).length;
    if (importCount === 0) {
      console.log("No valid presets found in file.");
      return;
    }

    if (confirmMerge && !confirmMerge(libraryName, importCount)) {
      return;
    }

    if (!libraries[libraryName]) {
      libraries[libraryName] = {};
    }

    for (var presetName in importedLibrary) {
      libraries[libraryName][presetName] = importedLibrary[presetName];
    }

    if (onImport) {
      onImport(libraryName);
    }

    console.log(
      "Merged " + importCount + " preset(s) into library '" + libraryName + "'",
    );
  } catch (e) {
    console.log("Error merge importing library:", e.message);
  }
}

export function savePresetAsJson(presetName, presetData) {
  try {
    var defaultFileName = presetName + ".json";
    var filePath = api.presentSaveFile(
      getDialogStartPath(),
      "Save Preset",
      "JSON Easing (*.json)",
      defaultFileName,
    );

    if (!filePath) {
      return;
    }

    if (filePath.lastIndexOf(".json") !== filePath.length - 5) {
      filePath += ".json";
    }

    var exportData = {};
    exportData[presetName] =
      formatFlowValue(presetData.x1) +
      "," +
      formatFlowValue(presetData.y1) +
      "," +
      formatFlowValue(presetData.x2) +
      "," +
      formatFlowValue(presetData.y2);
    var content = JSON.stringify(exportData, null, 4);

    if (api.writeToFile(filePath, content, true)) {
      console.log("Saved preset '" + presetName + "' to " + filePath);
    } else {
      console.log("Failed to save preset to " + filePath);
    }
  } catch (e) {
    console.log("Error saving preset to JSON:", e.message);
  }
}

export function exportCurrentCurveToJson(currentEasing) {
  try {
    var modal = new ui.Modal();
    var curveName = modal.showStringInput(
      "Export Current Curve",
      "Enter curve name:",
      "bezier-name",
    );

    if (!curveName || curveName.trim() === "") {
      return;
    }

    curveName = curveName.trim();

    var filePath = api.presentSaveFile(
      getDialogStartPath(),
      "Export Current Curve",
      "JSON Easing (*.json)",
      getSafeJsonFileName(curveName),
    );

    if (!filePath) {
      return;
    }

    if (filePath.lastIndexOf(".json") !== filePath.length - 5) {
      filePath += ".json";
    }

    var exportData = {};
    exportData[curveName] = getEasingNumberString(currentEasing);
    var content = JSON.stringify(exportData);

    if (api.writeToFile(filePath, content, true)) {
      console.log("Exported current curve to " + filePath);
    } else {
      console.log("Failed to export current curve to " + filePath);
    }
  } catch (e) {
    console.log("Error exporting current curve:", e.message);
  }
}

export function renamePresetInLibrary(
  libraries,
  libraryName,
  oldPresetName,
  onRename,
) {
  try {
    var modal = new ui.Modal();
    var newName = modal.showStringInput(
      "Rename Preset",
      "Enter new name (max 30 chars):",
      oldPresetName,
    );
    if (newName && newName.trim() !== "" && newName !== oldPresetName) {
      newName = newName.trim();
      if (newName.length > 30) {
        console.log("Preset name too long. Please use 30 characters or less.");
        return;
      }
      var lib = libraries[libraryName];
      if (lib) {
        if (lib[newName]) {
          console.log(
            "A preset named '" + newName + "' already exists in this library.",
          );
          return;
        }

        var reordered = {};
        for (var name in lib) {
          if (name === oldPresetName) {
            reordered[newName] = lib[oldPresetName];
          } else {
            reordered[name] = lib[name];
          }
        }
        libraries[libraryName] = reordered;
        if (onRename) onRename();
      }
    }
  } catch (e) {
    console.log("Error renaming preset:", e.message);
  }
}

export function deletePresetFromLibrary(
  libraries,
  libraryName,
  presetName,
  onDelete,
) {
  try {
    var lib = libraries[libraryName];
    if (lib && lib[presetName]) {
      delete lib[presetName];
      if (onDelete) onDelete();
    }
  } catch (e) {
    console.log("Error deleting preset:", e.message);
  }
}

export function renameLibrary(libraries, oldLibraryName, onRename) {
  try {
    var modal = new ui.Modal();
    var newName = modal.showStringInput(
      "Rename Library",
      "Enter new name (max 30 chars):",
      oldLibraryName,
    );
    if (newName && newName.trim() !== "" && newName !== oldLibraryName) {
      newName = newName.trim();
      if (newName.length > 30) {
        console.log("Library name too long. Please use 30 characters or less.");
        return;
      }
      if (libraries[newName]) {
        console.log("A library named '" + newName + "' already exists.");
        return;
      }
      var newLibraries = {};
      for (var name in libraries) {
        if (name === oldLibraryName) {
          newLibraries[newName] = libraries[oldLibraryName];
        } else {
          newLibraries[name] = libraries[name];
        }
      }
      // Clear libraries keys and restore them to maintain order
      for (var key in libraries) {
        delete libraries[key];
      }
      for (var key in newLibraries) {
        libraries[key] = newLibraries[key];
      }
      if (onRename) onRename(newName);
    }
  } catch (e) {
    console.log("Error renaming library:", e.message);
  }
}

export function saveGraphResolutionSetting(resolution) {
  savePreference(
    "easey_graphResolution",
    resolution,
    "Could not save graph resolution setting",
  );
}

export function loadGraphResolutionSetting() {
  return loadPreference(
    "easey_graphResolution",
    0.1,
    "Could not load graph resolution setting",
  );
}

