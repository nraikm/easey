import { showContextMenu } from "./contextMenus.ts";
import { saveLibrariesToPreferences } from "./presetManager.ts";
export function isPresetEasingEqual(currentEasing, preset) {
  return (
    Math.abs(currentEasing.x1 - preset.x1) < 0.01 &&
    Math.abs(currentEasing.y1 - preset.y1) < 0.01 &&
    Math.abs(currentEasing.x2 - preset.x2) < 0.01 &&
    Math.abs(currentEasing.y2 - preset.y2) < 0.01
  );
}

export function parseEasingValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if (
      value.x1 !== undefined &&
      value.y1 !== undefined &&
      value.x2 !== undefined &&
      value.y2 !== undefined
    ) {
      var objectValues = [
        parseFloat(value.x1),
        parseFloat(value.y1),
        parseFloat(value.x2),
        parseFloat(value.y2),
      ];
      if (
        objectValues.every(function (v) {
          return !isNaN(v);
        })
      ) {
        return {
          x1: objectValues[0],
          y1: objectValues[1],
          x2: objectValues[2],
          y2: objectValues[3],
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
  var values = matches.map(function (part) {
    return parseFloat(part);
  });
  if (
    !values.every(function (v) {
      return !isNaN(v);
    })
  )
    return null;
  return { x1: values[0], y1: values[1], x2: values[2], y2: values[3] };
}

export function parsePastedEasingEntries(text) {
  var trimmed = (text || "").trim();
  if (!trimmed) return { type: "none", entries: [] };

  var looksLikeJson = trimmed.charAt(0) === "{" || trimmed.indexOf(":") !== -1;
  var rawCurve = looksLikeJson ? null : parseEasingValue(trimmed);
  if (rawCurve) {
    return {
      type: "numbers",
      entries: [{ name: null, data: rawCurve }],
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
        data: rootCurve,
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

export { createPresetGridPanel as createPresetsPanel } from "./presetGridPanel.ts";

export function createPresetActions(options) {
var state = options.state;
var widgets = options.widgets;
var actions = options.actions;

function showPresetSuggestions(filterText, showAllWithCompletions) {
  ui.clearContextMenu();

  var filter = (filterText || "").toLowerCase().trim();
  var libNames = Object.keys(state.libraries);

  function addAllLibrarySubmenus() {
    libNames.forEach(function (libName) {
      var libPresets = state.libraries[libName];
      var presetNames = Object.keys(libPresets);
      if (presetNames.length > 0) {
        var libMenu = new ui.Menu(libName);
        presetNames.forEach(function (presetName) {
          var pData = libPresets[presetName];
          libMenu.addMenuItem({
            name: presetName,
            onMouseRelease: function () {
              actions.applyPresetData(pData, true);
            },
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
    libNames.forEach(function (libName) {
      var libPresets = state.libraries[libName];
      for (var presetName in libPresets) {
        var nameLower = presetName.toLowerCase();
        if (
          nameLower.indexOf(filter) !== -1 ||
          libName.toLowerCase().indexOf(filter) !== -1
        ) {
          if (nameLower === filter) {
            continue;
          }
          matches.push({
            fullName: libName + ": " + presetName,
            libName: libName,
            presetName: presetName,
            data: libPresets[presetName],
          });
        }
      }
    });

    if (matches.length > 0) {
      matches.forEach(function (match) {
        ui.addMenuItem({
          name: match.fullName,
          onMouseRelease: function () {
            actions.applyPresetData(match.data, true);
          },
        });
      });
    } else if (!showAllWithCompletions) {
      ui.addMenuItem({
        name: "No matching presets",
        enabled: false,
      });
    }

    if (showAllWithCompletions) {
      addAllLibrarySubmenus();
    }
  }

  showContextMenu();
}

function applyPresetByNameOrFilter(text) {
  var filter = text.toLowerCase().trim();
  var libNames = Object.keys(state.libraries);
  var exactMatch = null;
  var matches = [];

  libNames.forEach(function (libName) {
    var libPresets = state.libraries[libName];
    for (var presetName in libPresets) {
      var nameLower = presetName.toLowerCase();
      if (nameLower === filter) {
        exactMatch = libPresets[presetName];
      }
      if (
        nameLower.indexOf(filter) !== -1 ||
        libName.toLowerCase().indexOf(filter) !== -1
      ) {
        matches.push({
          fullName: libName + ": " + presetName,
          libName: libName,
          presetName: presetName,
          data: libPresets[presetName],
        });
      }
    }
  });

  if (exactMatch) {
    actions.applyPresetData(exactMatch, true);
    return true;
  } else if (matches.length > 0) {
    showPresetSuggestions(text, false);
  }
  return false;
}

function getExactPresetByName(text) {
  var filter = (text || "").toLowerCase().trim();
  if (!filter) return null;

  var libNames = Object.keys(state.libraries);
  for (var i = 0; i < libNames.length; i++) {
    var libPresets = state.libraries[libNames[i]];
    for (var presetName in libPresets) {
      if (presetName.toLowerCase() === filter) {
        return libPresets[presetName];
      }
    }
  }
  return null;
}

function setCurrentEasingFromData(pData) {
  var prev = Object.assign({}, state.currentEasing);
  state.currentEasing.x1 = pData.x1;
  state.currentEasing.y1 = pData.y1;
  state.currentEasing.x2 = pData.x2;
  state.currentEasing.y2 = pData.y2;
  actions.updateLastEasingForAtomicChange(prev);
  actions.resetPresetDropdown();
  actions.updateTextInput();
  actions.redrawGraphs();
  actions.saveTabPreference();
}

function isCurrentPreset(preset) {
  return isPresetEasingEqual(state.currentEasing, preset);
}

/**
 * Find the library and index of the currently selected preset based on current easing values.
 * @returns {Object|null} An object with { libName, presetIndex } or null if not found.
 */
function getSelectedPresetLocation() {
  var libNames = Object.keys(state.libraries);
  for (var i = 0; i < libNames.length; i++) {
    var libName = libNames[i];
    var libPresets = state.libraries[libName];
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
  var existingNames = Object.keys(state.libraries);
  var snapshot: any = {};
  existingNames.forEach(function (name) {
    snapshot[name] = state.libraries[name];
  });
  existingNames.forEach(function (name) {
    delete state.libraries[name];
  });
  state.libraries.Unnamed = snapshot.Unnamed || {};
  existingNames.forEach(function (name) {
    if (name !== "Unnamed") {
      state.libraries[name] = snapshot[name];
    }
  });
}

function makeUniquePresetName(libName, presetName) {
  var baseName = (presetName || "Pasted Preset").trim();
  if (!baseName) baseName = "Pasted Preset";
  if (!state.libraries[libName] || !state.libraries[libName][baseName]) return baseName;

  var count = 2;
  var candidate = baseName + " " + count;
  while (state.libraries[libName][candidate]) {
    count++;
    candidate = baseName + " " + count;
  }
  return candidate;
}

function insertPresetIntoLibrary(libName, presetName, presetData, insertIndex) {
  if (!state.libraries[libName]) {
    state.libraries[libName] = {};
  }

  var uniqueName = makeUniquePresetName(libName, presetName);
  var names = Object.keys(state.libraries[libName]);
  var safeIndex = Math.max(0, Math.min(insertIndex, names.length));
  names.splice(safeIndex, 0, uniqueName);

  var reordered = {};
  names.forEach(function (name) {
    reordered[name] =
      name === uniqueName ? presetData : state.libraries[libName][name];
  });
  state.libraries[libName] = reordered;
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

function pasteEasingToPresets(targetOverride?) {
  var parsed = parsePastedEasingEntries(api.getClipboardText());
  if (parsed.entries.length === 0) {
    console.log("Paste: clipboard does not contain easing values.");
    return false;
  }

  var entries = parsed.entries;
  if (parsed.type === "numbers") {
    var modal = new ui.Modal();
    var presetName = modal.showStringInput(
      "New Preset",
      "Enter preset name (max 30 chars):",
      "Pasted Preset",
    );
    if (!presetName || presetName.trim() === "") return false;
    presetName = presetName.trim();
    if (presetName.length > 30) {
      console.log("Preset name too long. Please use 30 characters or less.");
      return false;
    }
    entries = [{ name: presetName, data: entries[0].data }];
  }

  var target = targetOverride || getPasteInsertTarget();
  entries.forEach(function (entry, index) {
    insertPresetIntoLibrary(
      target.libName,
      entry.name,
      entry.data,
      target.insertIndex + index,
    );
  });

  saveLibrariesToPreferences(state.libraries);
  actions.buildPresetsTab();
  return true;
}

function getPresetInsertTargetAfter(libName, presetName) {
  var names = Object.keys(state.libraries[libName] || {});
  var presetIndex = names.indexOf(presetName);
  return {
    libName: libName,
    insertIndex: presetIndex === -1 ? names.length : presetIndex + 1,
  };
}


return {
  showPresetSuggestions: showPresetSuggestions,
  applyPresetByNameOrFilter: applyPresetByNameOrFilter,
  getExactPresetByName: getExactPresetByName,
  setCurrentEasingFromData: setCurrentEasingFromData,
  isCurrentPreset: isCurrentPreset,
  getSelectedPresetLocation: getSelectedPresetLocation,
  pasteEasingToEditor: pasteEasingToEditor,
  pasteEasingToPresets: pasteEasingToPresets,
  getPresetInsertTargetAfter: getPresetInsertTargetAfter,
};
}
