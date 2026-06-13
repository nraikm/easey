const fs = require('fs');

const easeyPath = './src/Easey.js';
let easey = fs.readFileSync(easeyPath, 'utf8');

// 1. Replace imports
easey = easey.replace(/import \{ DEFAULT_PRESETS.*\} from '\.\/modules\/constants\.js';/, "import { DEFAULT_LIBRARIES, DEFAULT_EASING, GRAPH_CONFIG, DEFAULT_SPEED_EASING } from './modules/constants.js';");
easey = easey.replace(/import \{[\s\S]*populatePresetDropdown, copyCubicBezierToClipboard\n\} from '\.\/modules\/presetManager\.js';/, `import { 
    savePresetToLibrary, savePresetToNewLibrary, loadLibrariesFromPreferences, saveLibrariesToPreferences,
    saveApplyOnDragSetting, loadApplyOnDragSetting,
    saveClampIdenticalSetting, loadClampIdenticalSetting,
    saveLastSelectedTab, loadLastSelectedTab,
    copyCubicBezierToClipboard
} from './modules/presetManager.js';`);

// 2. Replace state
easey = easey.replace(/var presets = Object\.assign\(\{\}, DEFAULT_PRESETS\);/, `var libraries = {};
var showingSpeed = false;
var magicEasingEnabled = false;`);
easey = easey.replace(/var isUpdatingFromPreset = false;\n/, '');

// 3. UI Elements
easey = easey.replace(/var mainContextButton = new ui\.Button\("⋯"\);\nmainContextButton\.setSize\(18, 18\);/, `var mainContextButton = new ui.Button("≡");
mainContextButton.setFixedWidth(20);

var magicEasingCb = new ui.Checkbox();
magicEasingCb.setText("Magic Easing");
magicEasingCb.onValueChanged = function() {
    magicEasingEnabled = !magicEasingEnabled;
};`);

// Replace bezierInput and preset stuff
easey = easey.replace(/var bezierInput = new ui\.LineEdit\(\);\nbezierInput\.setText\("0\.25, 0\.1, 0\.25, 1\.0"\);\n\n\/\/ Preset dropdown\nvar presetList = new ui\.DropDown\(\);\n\n\/\/ Context menu button for preset actions\nvar presetContextButton = new ui\.ImageButton\(getAssetPath\("icon-settings"\)\);\npresetContextButton\.setDrawStroke\(false\);\npresetContextButton\.setToolTip\("Settings"\);\npresetContextButton\.setImageSize\(16,16\);\npresetContextButton\.setSize\(18, 18\);/, `var x1Input = new ui.LineEdit(); x1Input.setFixedWidth(45);
var y1Input = new ui.LineEdit(); y1Input.setFixedWidth(45);
var x2Input = new ui.LineEdit(); x2Input.setFixedWidth(45);
var y2Input = new ui.LineEdit(); y2Input.setFixedWidth(45);
var graphModeBtn = new ui.Button("~"); graphModeBtn.setFixedWidth(20);
graphModeBtn.setToolTip("Toggle Speed/Value Graph");`);

// 4. Update TextInput functions
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

// 5. Context Menu
easey = easey.replace(/function showPresetContextMenu\(\) \{[\s\S]*?\}\n\n\/\//, `function showPresetContextMenu() {
    ui.clearContextMenu();

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

    ui.addMenuItem({ name: "" });
    
    ui.addMenuItem({
        name: "Set to Linear",
        onMouseRelease: function() {
            currentEasing.x1 = 0; currentEasing.y1 = 0;
            currentEasing.x2 = 1; currentEasing.y2 = 1;
            updateTextInput(); redrawGraphs();
        }
    });
    
    ui.addMenuItem({
        name: "Reset",
        onMouseRelease: function() {
            currentEasing.x1 = 0.25; currentEasing.y1 = 0.1;
            currentEasing.x2 = 0.25; currentEasing.y2 = 1.0;
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
        name: "Automatically clamp paths" + (clampHoldsEnabled ? " ✓" : ""),
        onMouseRelease: function() {
            clampHoldsEnabled = !clampHoldsEnabled;
            setClampHoldsEnabled(clampHoldsEnabled);
            saveClampIdenticalSetting(clampHoldsEnabled);
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

//`);

// Remove presetList refs in mousehandlers
easey = easey.replace(/presetList\.setText\("Select a preset\.\.\."\);\n/g, '');

// 6. Update handlers
easey = easey.replace(/bezierInput\.onValueChanged = function\(\) \{[\s\S]*?\};\n\npresetList\.onValueChanged = function\(\) \{[\s\S]*?\};\n\n\/\//, `x1Input.onValueChanged = function() {
    if (isUpdatingTextInput) return;
    var text = x1Input.getText();
    if (text.indexOf(',') !== -1) {
        var values = text.split(',').map(function(v) { return parseFloat(v.trim()); });
        if (values.length === 4 && values.every(function(v) { return !isNaN(v); })) {
            currentEasing.x1 = values[0];
            currentEasing.y1 = values[1];
            currentEasing.x2 = values[2];
            currentEasing.y2 = values[3];
            updateTextInput();
            redrawGraphs();
            return;
        }
    }
    updateFromTextInput();
};
y1Input.onValueChanged = updateFromTextInput;
x2Input.onValueChanged = updateFromTextInput;
y2Input.onValueChanged = updateFromTextInput;

//`);

// Remove old initialization of presets
easey = easey.replace(/loadPresetsFromPreferences\(presets\);\n\n\/\/ Load apply/g, 'loadLibrariesFromPreferences(libraries, DEFAULT_LIBRARIES);\n\n// Load apply');
easey = easey.replace(/\/\/ Populate preset dropdown\npopulatePresetDropdown\(presetList, presets\);\n/g, '');

// 7. Layout Replacement
easey = easey.replace(/\/\/ Create main layout\nvar mainLayout[\s\S]*ui\.add\(mainLayout\);/, `// Create main layout
var mainLayout = new ui.VLayout();
mainLayout.setSpaceBetween(0);
mainLayout.setMargins(3, 3, 3, 3);

// Button row
var buttonRow = new ui.HLayout();
buttonRow.add(getButton);
buttonRow.add(applyButton);
buttonRow.addStretch();
buttonRow.add(magicEasingCb);
buttonRow.setSpaceBetween(4);
buttonRow.setMargins(0, 4, 0, 0);

var tabView = new ui.TabView();

// EDITOR TAB
var editorTabLayout = new ui.VLayout();
editorTabLayout.setSpaceBetween(0);
editorTabLayout.setMargins(0, 0, 0, 0);

var editorControlsLayout = new ui.HLayout();
editorControlsLayout.setSpaceBetween(2);
editorControlsLayout.add(graphModeBtn);
editorControlsLayout.add(new ui.Label("X1"));
editorControlsLayout.add(x1Input);
editorControlsLayout.add(new ui.Label("Y1"));
editorControlsLayout.add(y1Input);
editorControlsLayout.add(new ui.Label("X2"));
editorControlsLayout.add(x2Input);
editorControlsLayout.add(new ui.Label("Y2"));
editorControlsLayout.add(y2Input);
editorControlsLayout.addStretch();
editorControlsLayout.add(mainContextButton);

editorTabLayout.add(editorControlsLayout);

var graphContainer = new ui.Container();
graphContainer.setLayout(new ui.VLayout());
graphContainer.layout().add(graphCanvas); // default

graphModeBtn.onClick = function() {
    showingSpeed = !showingSpeed;
    if (showingSpeed) {
        graphContainer.setLayout(new ui.VLayout());
        graphContainer.layout().add(speedGraphCanvas);
        graphModeBtn.setText("S");
    } else {
        graphContainer.setLayout(new ui.VLayout());
        graphContainer.layout().add(graphCanvas);
        graphModeBtn.setText("~");
    }
    redrawGraphs();
};

editorTabLayout.add(graphContainer);
editorTabLayout.addStretch();

// PRESETS TAB
var presetsScroll = new ui.ScrollView();
var presetsContainer = new ui.VLayout();
presetsScroll.setLayout(presetsContainer);

function buildPresetsTab() {
    presetsContainer.clear();
    var libNames = Object.keys(libraries);
    libNames.forEach(function(libName) {
        var headerLayout = new ui.HLayout();
        var title = new ui.Label(libName);
        var libMenuBtn = new ui.Button("≡");
        libMenuBtn.setFixedWidth(20);
        
        libMenuBtn.onClick = function() {
            ui.clearContextMenu();
            ui.addMenuItem({
                name: "Delete Library",
                onMouseRelease: function() {
                    delete libraries[libName];
                    saveLibrariesToPreferences(libraries);
                    buildPresetsTab();
                }
            });
            ui.showContextMenu();
        };

        headerLayout.add(title);
        headerLayout.addStretch();
        headerLayout.add(libMenuBtn);
        
        presetsContainer.add(headerLayout);
        
        var flow = new ui.FlowLayout(4, 4);
        var libPresets = libraries[libName];
        for (var presetName in libPresets) {
            (function(pName, pData) {
                var itemContainer = new ui.Container();
                itemContainer.setSize(46, 60);
                
                var itemLayout = new ui.VLayout();
                itemLayout.setSpaceBetween(2);
                itemLayout.setMargins(2,2,2,2);
                
                var miniGraph = new ui.Draw();
                miniGraph.setSize(40, 40);
                miniGraph.onDraw = function(ctx) {
                    var w = 40, h = 40, p = 4;
                    ctx.fillStyle = "#2a2a2a";
                    ctx.fillRect(0,0,w,h);
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p, h-p);
                    ctx.bezierCurveTo(
                        p + pData.x1 * (w-2*p), h-p - pData.y1 * (h-2*p),
                        p + pData.x2 * (w-2*p), h-p - pData.y2 * (h-2*p),
                        w-p, p
                    );
                    ctx.stroke();
                };
                miniGraph.onMouseRelease = function() {
                    currentEasing.x1 = pData.x1;
                    currentEasing.y1 = pData.y1;
                    currentEasing.x2 = pData.x2;
                    currentEasing.y2 = pData.y2;
                    updateTextInput(); redrawGraphs();
                    saveTabPreference();
                    if (applyOnDragEnabled) applyEasingToKeyframes(currentEasing);
                };
                
                var pLabel = new ui.Label(pName);
                
                itemLayout.add(miniGraph);
                itemLayout.add(pLabel);
                
                itemContainer.setLayout(itemLayout);
                flow.add(itemContainer);
            })(presetName, libPresets[presetName]);
        }
        presetsContainer.add(flow);
        
        var spacer = new ui.VLayout(); spacer.setSize(10, 10);
        presetsContainer.add(spacer);
    });
}
buildPresetsTab();

var presetsTabLayout = new ui.VLayout();
presetsTabLayout.add(presetsScroll);

tabView.add("Editor", editorTabLayout);
tabView.add("Presets", presetsTabLayout);

mainLayout.add(tabView);
mainLayout.add(buttonRow);

ui.add(mainLayout);`);

// 8. Fix window size logic
easey = easey.replace(/ui\.setMinimumHeight\(graphHeight \+ 60\);/, 'ui.setMinimumHeight(graphHeight + 100);');

fs.writeFileSync(easeyPath, easey, 'utf8');
