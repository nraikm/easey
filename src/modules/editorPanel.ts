import { createBezierGraphComponent } from "./bezierGraphComponent.ts";

function formatCoordinateValue(val) {
  var rounded = Math.round(val * 100) / 100;
  var str = rounded.toString();
  if (str.indexOf(".") === -1) {
    return str + ".0";
  }
  return str;
}

function createCoordinateInputWidgetImpl(options) {
  var initialValue = options.initialValue;
  var index = options.index;
  var width = options.width;
  var setUpdatingTextInput = options.setUpdatingTextInput;

  if (typeof ui.NumericField !== "undefined") {
    try {
      var numericInput = new ui.NumericField(initialValue);
      numericInput.setType(1); // double
      numericInput.setStep(0.01);
      if (index === 0 || index === 2) {
        numericInput.setMin(0.0);
        numericInput.setMax(1.0);
      } else {
        numericInput.setMin(-1000.0);
        numericInput.setMax(1000.0);
      }
      numericInput.setFixedHeight(20);
      numericInput.setFixedWidth(width);
      numericInput.setBackgroundColor("#1c1c1c");
      return numericInput;
    } catch (e) {}
  }

  var textInput = new ui.LineEdit();
  textInput.setText(formatCoordinateValue(initialValue));
  textInput.setFixedHeight(20);
  textInput.setFixedWidth(width);
  textInput.getValue = function () {
    return parseFloat(textInput.getText());
  };
  textInput.setValue = function (value) {
    setUpdatingTextInput(true);
    textInput.setText(formatCoordinateValue(value));
    setUpdatingTextInput(false);
  };
  return textInput;
}


export function createEditorPanel(options) {
  var graphConfig = options.graphConfig;
  var icons = options.icons;
  var setUpdatingTextInput = options.setUpdatingTextInput;

  var graphComponent = createBezierGraphComponent({
    graphConfig: graphConfig,
  });

  var applyButton = new ui.Button("Apply");
  applyButton.setToolTip("Apply easing");
  applyButton.setFixedWidth(45);
  applyButton.setFixedHeight(22);

  var getButton = new ui.ImageButton(icons.get);
  getButton.setToolTip("Get easing from keyframes");
  getButton.setImageSize(16, 16);
  getButton.setSize(24, 24);

  var mainContextButton = new ui.ImageButton(icons.settings);
  mainContextButton.setToolTip("Settings");
  mainContextButton.setImageSize(16, 16);
  mainContextButton.setSize(20, 20);

  var coordinateMetrics: any = {
    COORDINATE_LABEL_WIDTH: 12,
    COORDINATE_VALUE_WIDTH:
      typeof ui.NumericField !== "undefined" ? 36 : 30,
    COORDINATE_BORDER_WIDTH: 1,
  };
  coordinateMetrics.COORDINATE_CONTAINER_WIDTH =
    coordinateMetrics.COORDINATE_LABEL_WIDTH +
    coordinateMetrics.COORDINATE_VALUE_WIDTH +
    2;

  function createCoordinateInput(initialValue, index) {
    return createCoordinateInputWidgetImpl({
      initialValue: initialValue,
      index: index,
      width: coordinateMetrics.COORDINATE_VALUE_WIDTH,
      setUpdatingTextInput: setUpdatingTextInput,
    });
  }

  var x1Input = createCoordinateInput(0.25, 0);
  var y1Input = createCoordinateInput(0.1, 1);
  var x2Input = createCoordinateInput(0.25, 2);
  var y2Input = createCoordinateInput(1.0, 3);

  var graphModeBtn = new ui.Button("S");
  graphModeBtn.setFixedWidth(20);
  graphModeBtn.setToolTip("Toggle Speed/Value Graph");

  return {
    graphCanvas: graphComponent.graphCanvas,
    speedGraphCanvas: graphComponent.speedGraphCanvas,
    graphComponent: graphComponent,
    applyButton: applyButton,
    getButton: getButton,
    mainContextButton: mainContextButton,
    x1Input: x1Input,
    y1Input: y1Input,
    x2Input: x2Input,
    y2Input: y2Input,
    coordinateInputs: [x1Input, y1Input, x2Input, y2Input],
    coordinateKeys: ["x1", "y1", "x2", "y2"],
    graphModeBtn: graphModeBtn,
    metrics: coordinateMetrics,
    setupGraphHandlers: graphComponent.setupHandlers,
  };
}
