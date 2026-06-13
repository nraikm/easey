const fs = require('fs');

const easeyPath = './src/Easey.js';
let easey = fs.readFileSync(easeyPath, 'utf8');

// Replace imports
easey = easey.replace(/import \{ DEFAULT_PRESETS.*\} from '\.\/modules\/constants\.js';/, "import { DEFAULT_LIBRARIES, DEFAULT_EASING, GRAPH_CONFIG, DEFAULT_SPEED_EASING } from './modules/constants.js';");
easey = easey.replace(/import \{[\s\S]*populatePresetDropdown, copyCubicBezierToClipboard\n\} from '\.\/modules\/presetManager\.js';/, `import { 
    savePresetToLibrary, savePresetToNewLibrary, loadLibrariesFromPreferences, saveLibrariesToPreferences,
    saveApplyOnDragSetting, loadApplyOnDragSetting,
    saveClampIdenticalSetting, loadClampIdenticalSetting,
    saveLastSelectedTab, loadLastSelectedTab,
    copyCubicBezierToClipboard
} from './modules/presetManager.js';`);

// Replace state
easey = easey.replace(/var presets = Object\.assign\(\{\}, DEFAULT_PRESETS\);/, "var libraries = {};\nvar showingSpeed = false;");

// Fix presetContextButton
easey = easey.replace(/var presetContextButton = new ui\.ImageButton\(getAssetPath\("icon-settings"\)\);\npresetContextButton\.setDrawStroke\(false\);\npresetContextButton\.setToolTip\("Settings"\);\npresetContextButton\.setImageSize\(16,16\);\npresetContextButton\.setSize\(18, 18\);/, '');

// Replace bezierInput
easey = easey.replace(/var bezierInput = new ui\.LineEdit\(\);\nbezierInput\.setText\("0\.25, 0\.1, 0\.25, 1\.0"\);/, `var x1Input = new ui.LineEdit(); x1Input.setFixedWidth(40);
var y1Input = new ui.LineEdit(); y1Input.setFixedWidth(40);
var x2Input = new ui.LineEdit(); x2Input.setFixedWidth(40);
var y2Input = new ui.LineEdit(); y2Input.setFixedWidth(40);
var graphModeBtn = new ui.Button("~"); graphModeBtn.setFixedWidth(20);`);

// Replace presetList dropdown
easey = easey.replace(/var presetList = new ui\.DropDown\(\);/, '');

// Replace updateTextInput
easey = easey.replace(/function updateTextInput\(\) \{[\s\S]*?isUpdatingTextInput = false;\n\}/, `function updateTextInput() {
    var x1 = (currentEasing.x1 !== undefined) ? currentEasing.x1 : 0.25;
    var y1 = (currentEasing.y1 !== undefined) ? currentEasing.y1 : 0.1;
    var x2 = (currentEasing.x2 !== undefined) ? currentEasing.x2 : 0.25;
    var y2 = (currentEasing.y2 !== undefined) ? currentEasing.y2 : 1.0;
    
    isUpdatingTextInput = true;
    x1Input.setText(x1.toFixed(3));
    y1Input.setText(y1.toFixed(3));
    x2Input.setText(x2.toFixed(3));
    y2Input.setText(y2.toFixed(3));
    isUpdatingTextInput = false;
}`);

// Replace updateFromTextInput
easey = easey.replace(/function updateFromTextInput\(\) \{[\s\S]*?\} catch \(e\) \{[\s\S]*?\}\n\}/, `function updateFromTextInput() {
    var vX1 = parseFloat(x1Input.getText());
    var vY1 = parseFloat(y1Input.getText());
    var vX2 = parseFloat(x2Input.getText());
    var vY2 = parseFloat(y2Input.getText());
    if (!isNaN(vX1)) currentEasing.x1 = vX1;
    if (!isNaN(vY1)) currentEasing.y1 = vY1;
    if (!isNaN(vX2)) currentEasing.x2 = vX2;
    if (!isNaN(vY2)) currentEasing.y2 = vY2;
    redrawGraphs();
}`);

fs.writeFileSync(easeyPath, easey, 'utf8');
