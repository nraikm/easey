// Preset management module
<<<<<<< HEAD
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

export function savePresetToLibrary(libraries, libraryName, currentEasing, onSave) {
=======
// Functions for saving, loading, and managing easing presets

/**
 * Save a new preset
 * @param {Object} presets - Presets object to modify
 * @param {Object} currentEasing - Current easing values to save
 * @param {Function} onSave - Callback after saving (for updating UI)
 */
export function savePreset(presets, currentEasing, onSave) {
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
    try {
        var modal = new ui.Modal();
        var presetName = modal.showStringInput("Save Preset", "Enter preset name (max 30 chars):", "My Preset");
        
        if (presetName && presetName.trim() !== "") {
            if (presetName.length > 30) {
                console.log("Preset name too long. Please use 30 characters or less.");
                return;
            }
<<<<<<< HEAD
            if (!libraries[libraryName]) libraries[libraryName] = {};
            libraries[libraryName][presetName] = {
=======
            
            presets[presetName] = {
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
                x1: currentEasing.x1,
                y1: currentEasing.y1,
                x2: currentEasing.x2,
                y2: currentEasing.y2
            };
<<<<<<< HEAD
=======
            
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
            if (onSave) onSave();
        }
    } catch (e) {
        console.log("Error saving preset:", e.message);
    }
}

<<<<<<< HEAD
export function savePresetToNewLibrary(libraries, currentEasing, onSave) {
    try {
        var modal = new ui.Modal();
        var libraryName = modal.showStringInput("New Library", "Enter new library name:", "My Library");
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
        if (api.hasPreferenceObject("easey_presets") && !api.hasPreferenceObject("easey_libraries")) {
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

export function reorderPresetInLibrary(libraries, libraryName, fromIndex, toIndex) {
    var libPresets = libraries[libraryName];
    if (!libPresets) return false;
    var names = Object.keys(libPresets);
    if (fromIndex < 0 || fromIndex >= names.length || toIndex < 0 || toIndex > names.length) return false;
    if (toIndex === fromIndex || toIndex === fromIndex + 1) return false;
    var movedName = names[fromIndex];
    names.splice(fromIndex, 1);
    var insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
    insertAt = Math.max(0, Math.min(insertAt, names.length));
    names.splice(insertAt, 0, movedName);
    var reordered = {};
    names.forEach(function(name) { reordered[name] = libPresets[name]; });
    libraries[libraryName] = reordered;
    return true;
}

export function movePresetBetweenLibraries(libraries, fromLibName, fromIndex, toLibName, toIndex) {
    var fromLib = libraries[fromLibName];
    var toLib = libraries[toLibName];
    if (!fromLib || !toLib) return false;
    var fromNames = Object.keys(fromLib);
    if (fromIndex < 0 || fromIndex >= fromNames.length) return false;
    var presetName = fromNames[fromIndex];
    var presetData = fromLib[presetName];
    var newFromLib = {};
    fromNames.forEach(function(n, i) { if (i !== fromIndex) newFromLib[n] = fromLib[n]; });
    libraries[fromLibName] = newFromLib;
    var toNames = Object.keys(toLib);
    var insertAt = Math.min(toIndex, toNames.length);
    toNames.splice(insertAt, 0, presetName);
    var newToLib = {};
    toNames.forEach(function(n) { newToLib[n] = (n === presetName) ? presetData : toLib[n]; });
    libraries[toLibName] = newToLib;
    return true;
}

export function reorderLibrary(libraries, fromIndex, toIndex) {
    var names = Object.keys(libraries);
    if (fromIndex < 0 || fromIndex >= names.length || toIndex < 0 || toIndex > names.length) return false;
    if (toIndex === fromIndex || toIndex === fromIndex + 1) return false;
    var moved = names.splice(fromIndex, 1)[0];
    var insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
    insertAt = Math.max(0, Math.min(insertAt, names.length));
    names.splice(insertAt, 0, moved);
    var snapshot = {};
    names.forEach(function(n) { snapshot[n] = libraries[n]; });
    Object.keys(libraries).forEach(function(k) { delete libraries[k]; });
    names.forEach(function(n) { libraries[n] = snapshot[n]; });
    return true;
}

export function saveApplyOnDragSetting(enabled) {
    savePreference("easey_applyOnDrag", enabled, "Could not save apply on drag setting");
}

export function loadApplyOnDragSetting() {
    return loadPreference("easey_applyOnDrag", false, "Could not load apply on drag setting");
}

export function saveClampIdenticalSetting(enabled) {
    savePreference("easey_clampIdenticalValues", enabled, "Could not save clamp identical setting");
}

export function loadClampIdenticalSetting() {
    return loadPreference("easey_clampIdenticalValues", true, "Could not load clamp identical setting");
}

export function saveLastSelectedTab(tabIndex) {
    savePreference("easey_lastSelectedTab", tabIndex, "Could not save last selected tab");
}

export function loadLastSelectedTab() {
    return loadPreference("easey_lastSelectedTab", null, "Could not load last selected tab");
}

export function copyCubicBezierToClipboard(currentEasing) {
    var text = "cubic-bezier(" + currentEasing.x1.toFixed(3) + ", " + 
               currentEasing.y1.toFixed(3) + ", " + 
               currentEasing.x2.toFixed(3) + ", " + 
               currentEasing.y2.toFixed(3) + ")";
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
        flow[presetName] = formatFlowValue(preset.x1) + "," +
            formatFlowValue(preset.y1) + "," +
            formatFlowValue(preset.x2) + "," +
            formatFlowValue(preset.y2);
    }
    return flow;
}

export function flowFormatToLibrary(flowData) {
    var library = {};
    for (var presetName in flowData) {
        var value = flowData[presetName];
        if (typeof value !== "string") {
            console.log("Skipping preset '" + presetName + "': expected comma-separated string");
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
            console.log("Skipping preset '" + presetName + "': invalid numeric values");
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
            defaultFileName
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

export function importLibraryFromFlowFile(libraries, onImport) {
    try {
        var filePath = api.presentOpenFile(
            getDialogStartPath(),
            "Import Library",
            "Flow Library (*.flow)"
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
            defaultName
        );

        if (!libraryName || libraryName.trim() === "") {
            return;
        }

        libraryName = libraryName.trim();
        if (!libraries[libraryName]) {
            libraries[libraryName] = {};
        }

        for (var presetName in importedLibrary) {
            libraries[libraryName][presetName] = importedLibrary[presetName];
        }

        if (onImport) {
            onImport(libraryName);
        }

        console.log("Imported " + Object.keys(importedLibrary).length +
            " preset(s) into library '" + libraryName + "'");
    } catch (e) {
        console.log("Error importing library:", e.message);
    }
}
=======
/**
 * Rename an existing preset
 * @param {Object} presets - Presets object to modify
 * @param {string} selectedPreset - Name of preset to rename
 * @param {Function} onRename - Callback after renaming (for updating UI)
 * @returns {string|null} New preset name or null if cancelled
 */
export function renamePreset(presets, selectedPreset, onRename) {
    if (!selectedPreset || selectedPreset === "Select a preset..." || selectedPreset === "---") {
        console.log("Please select a preset to rename");
        return null;
    }
    
    try {
        var modal = new ui.Modal();
        var newName = modal.showStringInput("Rename Preset", "Enter new name (max 30 chars):", selectedPreset);
        
        if (newName && newName.trim() !== "" && newName !== selectedPreset) {
            if (newName.length > 30) {
                console.log("Preset name too long. Please use 30 characters or less.");
                return null;
            }
            
            if (presets[newName]) {
                console.log("A preset with that name already exists");
                return null;
            }
            
            presets[newName] = presets[selectedPreset];
            delete presets[selectedPreset];
            
            if (onRename) onRename();
            
            return newName;
        }
    } catch (e) {
        console.log("Error renaming preset:", e.message);
    }
    
    return null;
}

/**
 * Delete a preset
 * @param {Object} presets - Presets object to modify
 * @param {string} selectedPreset - Name of preset to delete
 * @param {Function} onDelete - Callback after deleting (for updating UI)
 */
export function deletePreset(presets, selectedPreset, onDelete) {
    if (!selectedPreset || selectedPreset === "Select a preset..." || selectedPreset === "---") {
        console.log("Please select a preset to delete");
        return;
    }
    
    try {
        delete presets[selectedPreset];
        if (onDelete) onDelete();
    } catch (e) {
        console.log("Error deleting preset:", e.message);
    }
}

/**
 * Delete all presets
 * @param {Object} presets - Presets object to clear
 * @param {Function} onDelete - Callback after deleting (for updating UI)
 */
export function deleteAllPresets(presets, onDelete) {
    try {
        var allPresetNames = Object.keys(presets);
        
        if (allPresetNames.length === 0) {
            console.log("No presets to delete");
            return;
        }
        
        var modal = new ui.Modal();
        var confirmText = "Are you sure you want to delete ALL " + allPresetNames.length + " presets?\n\nThis action cannot be undone.";
        var result = modal.showConfirmation("Delete All Presets", confirmText);
        
        if (result) {
            for (var presetName in presets) {
                delete presets[presetName];
            }
            
            if (onDelete) onDelete();
            console.log("Deleted all " + allPresetNames.length + " presets");
        }
        
    } catch (e) {
        console.log("Error deleting all presets:", e.message);
    }
}

/**
 * Export presets to clipboard as JSON
 * @param {Object} presets - Presets object to export
 */
export function exportPresets(presets) {
    try {
        var presetsJson = JSON.stringify(presets, null, 2);
        api.setClipboardText(presetsJson);
    } catch (e) {
        console.log("Error exporting presets:", e.message);
    }
}

/**
 * Import presets from clipboard JSON
 * @param {Object} presets - Presets object to modify
 * @param {Function} onImport - Callback after importing (for updating UI)
 */
export function importPresets(presets, onImport) {
    try {
        var clipboardContent = api.getClipboardText();
        if (!clipboardContent) {
            console.log("No content in clipboard");
            return;
        }
        
        var importedPresets;
        try {
            importedPresets = JSON.parse(clipboardContent);
        } catch (e) {
            console.log("Clipboard content is not valid JSON");
            return;
        }
        
        if (typeof importedPresets !== 'object' || importedPresets === null) {
            console.log("Clipboard content is not a valid presets object");
            return;
        }
        
        // Merge presets
        for (var name in importedPresets) {
            presets[name] = importedPresets[name];
        }
        
        if (onImport) onImport();
        
    } catch (e) {
        console.log("Error importing presets:", e.message);
    }
}

/**
 * Save presets to preferences
 * @param {Object} presets - Presets object to save
 */
export function savePresetsToPreferences(presets) {
    try {
        api.setPreferenceObject("easey_presets", presets);
    } catch (e) {
        console.log("Could not save presets to preferences:", e.message);
    }
}

/**
 * Load presets from preferences
 * @param {Object} presets - Presets object to populate
 */
export function loadPresetsFromPreferences(presets) {
    try {
        if (api.hasPreferenceObject("easey_presets")) {
            var savedPresets = api.getPreferenceObject("easey_presets");
            if (savedPresets !== null && savedPresets !== undefined) {
                // Clear existing and copy saved
                for (var key in presets) {
                    delete presets[key];
                }
                for (var key in savedPresets) {
                    presets[key] = savedPresets[key];
                }
            }
        }
    } catch (e) {
        console.log("Could not load presets from preferences:", e.message);
    }
}

/**
 * Save apply on drag setting
 * @param {boolean} enabled - Whether apply on drag is enabled
 */
export function saveApplyOnDragSetting(enabled) {
    try {
        api.setPreferenceObject("easey_applyOnDrag", enabled);
    } catch (e) {
        console.log("Could not save apply on drag setting:", e.message);
    }
}

/**
 * Load apply on drag setting
 * @returns {boolean} Whether apply on drag is enabled
 */
export function loadApplyOnDragSetting() {
    try {
        if (api.hasPreferenceObject("easey_applyOnDrag")) {
            var saved = api.getPreferenceObject("easey_applyOnDrag");
            if (saved !== null && saved !== undefined) {
                return saved;
            }
        }
    } catch (e) {
        console.log("Could not load apply on drag setting:", e.message);
    }
    return false;
}

/**
 * Save clamp identical values setting
 * @param {boolean} enabled - Whether clamping is enabled
 */
export function saveClampIdenticalSetting(enabled) {
    try {
        api.setPreferenceObject("easey_clampIdenticalValues", enabled);
    } catch (e) {
        console.log("Could not save clamp identical setting:", e.message);
    }
}

/**
 * Load clamp identical values setting
 * @returns {boolean} Whether clamping is enabled (default: true)
 */
export function loadClampIdenticalSetting() {
    try {
        if (api.hasPreferenceObject("easey_clampIdenticalValues")) {
            var saved = api.getPreferenceObject("easey_clampIdenticalValues");
            if (saved !== null && saved !== undefined) {
                return saved;
            }
        }
    } catch (e) {
        console.log("Could not load clamp identical setting:", e.message);
    }
    return true;
}

/**
 * Save last selected tab to preferences
 * @param {number} tabIndex - Index of the selected tab
 */
export function saveLastSelectedTab(tabIndex) {
    try {
        api.setPreferenceObject("easey_lastSelectedTab", tabIndex);
    } catch (e) {
        console.log("Could not save last selected tab:", e.message);
    }
}

/**
 * Load last selected tab from preferences
 * @returns {number|null} Tab index or null if not saved
 */
export function loadLastSelectedTab() {
    try {
        if (api.hasPreferenceObject("easey_lastSelectedTab")) {
            var saved = api.getPreferenceObject("easey_lastSelectedTab");
            if (saved !== null && saved !== undefined) {
                return saved;
            }
        }
    } catch (e) {
        console.log("Could not load last selected tab:", e.message);
    }
    return null;
}

/**
 * Populate preset dropdown with presets
 * @param {Object} dropdown - The ui.DropDown element
 * @param {Object} presets - Presets object
 */
export function populatePresetDropdown(dropdown, presets) {
    dropdown.clear();
    
    dropdown.addEntry("Select a preset...");
    dropdown.insertSeparator(1);
    
    var presetNames = Object.keys(presets);
    presetNames.sort(function(a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    
    for (var i = 0; i < presetNames.length; i++) {
        dropdown.addEntry(presetNames[i]);
    }
}

/**
 * Copy current curve to clipboard in cubic-bezier format
 * @param {Object} currentEasing - Current easing values
 */
export function copyCubicBezierToClipboard(currentEasing) {
    var text = "cubic-bezier(" + currentEasing.x1.toFixed(2) + ", " + 
               currentEasing.y1.toFixed(2) + ", " + 
               currentEasing.x2.toFixed(2) + ", " + 
               currentEasing.y2.toFixed(2) + ")";
    api.setClipboardText(text);
    console.log("Copied " + text + " to clipboard");
}
>>>>>>> 05a5c47a8feb0c13810bc081a16c656827824326
