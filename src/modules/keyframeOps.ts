// Keyframe operations module
// Functions for extracting and applying easing to keyframes

import {
  cubicBezierToCavalry,
  cavalryToCubicBezier,
  cubicBezierToVelocity,
  getCompositionFrameRate,
  framesToMilliseconds,
} from "./conversions.ts";

var DEFAULT_LEFT_SPEED = 0.0;
var DEFAULT_LEFT_INFLUENCE = 0.333;
var DEFAULT_RIGHT_SPEED = 1.0;
var DEFAULT_RIGHT_INFLUENCE = 0.333;
var IDENTICAL_VALUE_EPSILON = 0.001;

var _clampHoldsEnabled = true;

/**
 * Set whether identical-value clamping is active (called from Easey.js when preference changes).
 */
export function setClampHoldsEnabled(enabled) {
  _clampHoldsEnabled = enabled;
}

function valuesAreIdentical(a, b) {
  return Math.abs(a - b) < IDENTICAL_VALUE_EPSILON;
}

function normalizeTargetSections(targetSections) {
  if (!targetSections) {
    return null;
  }

  return {
    incoming: !!targetSections.incoming,
    middle: !!targetSections.middle,
    outgoing: !!targetSections.outgoing,
  };
}

function hasAnyTargetSection(targetSections) {
  return !!(
    targetSections &&
    (targetSections.incoming ||
      targetSections.middle ||
      targetSections.outgoing)
  );
}

function findPreviousFrame(frames, frame) {
  var previous = null;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i] < frame && (previous === null || frames[i] > previous)) {
      previous = frames[i];
    }
  }
  return previous;
}

function findNextFrame(frames, frame) {
  var next = null;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i] > frame && (next === null || frames[i] < next)) {
      next = frames[i];
    }
  }
  return next;
}

function getSortedKeyframeTimes(layerId, attrId) {
  try {
    var times = api.getKeyframeTimes(layerId, attrId);
    if (!times || !Array.isArray(times)) {
      return [];
    }
    return times.slice().sort(function (a, b) {
      return a - b;
    });
  } catch (e) {
    return [];
  }
}

function getValueAtFrame(layerId, attrId, frame, fallbackValue) {
  var savedFrame = api.getFrame();
  try {
    api.setFrame(frame);
    return api.get(layerId, attrId);
  } catch (e) {
    return fallbackValue;
  } finally {
    try {
      api.setFrame(savedFrame);
    } catch (restoreError) {}
  }
}

/**
 * Frame times on the sibling position axis (for motion path detection).
 * @param {string} layerId
 * @param {string} attrId
 * @returns {Set<number>|null} null if not position.x / position.y
 */
function getSiblingKeyframeTimesSet(layerId, attrId) {
  if (attrId !== "position.x" && attrId !== "position.y") {
    return null;
  }
  var siblingAttr = attrId === "position.x" ? "position.y" : "position.x";
  try {
    var times = api.getKeyframeTimes(layerId, siblingAttr);
    if (!times || !Array.isArray(times)) {
      return new Set();
    }
    return new Set(times);
  } catch (e) {
    return new Set();
  }
}

/**
 * True if both endpoints have keyframes on the sibling position channel (motion path segment).
 * @param {Set<number>|null} siblingTimesSet
 * @param {number} frameA
 * @param {number} frameB
 */
function isMotionPathPair(siblingTimesSet, frameA, frameB) {
  if (!siblingTimesSet || siblingTimesSet.size === 0) {
    return false;
  }
  return siblingTimesSet.has(frameA) && siblingTimesSet.has(frameB);
}

/**
 * Contiguous runs of keyframe indices where each consecutive pair is a motion path pair.
 * @param {{ frames: number[] }} group
 * @param {Set<number>} siblingTimesSet
 * @returns {{ start: number, end: number }[]}
 */
function findMotionPathRuns(group, siblingTimesSet) {
  var runs = [];
  var runStart = null;
  var n = group.frames.length;
  for (var k = 0; k < n - 1; k++) {
    var isPath = isMotionPathPair(
      siblingTimesSet,
      group.frames[k],
      group.frames[k + 1],
    );
    if (isPath) {
      if (runStart === null) {
        runStart = k;
      }
    } else {
      if (runStart !== null) {
        runs.push({ start: runStart, end: k });
        runStart = null;
      }
    }
  }
  if (runStart !== null) {
    runs.push({ start: runStart, end: n - 1 });
  }
  return runs;
}

/**
 * Unlock two keyframes for tangent editing (interpolation + handles + modifyKeyframeTangent).
 */
function unlockKeyframePair(
  keyframeIdA,
  keyframeIdB,
  frameA,
  frameB,
  attrId,
  layerId,
) {
  var unlocked = { angleLocked: false, weightLocked: false };
  var items = [
    { id: keyframeIdA, frame: frameA },
    { id: keyframeIdB, frame: frameB },
  ];
  for (var p = 0; p < items.length; p++) {
    var keyframeId = items[p].id;
    var frame = items[p].frame;
    try {
      var keyData: any = api.get(keyframeId, "data");
      if (keyData && keyData.interpolation !== 0) {
        try {
          api.modifyKeyframe(keyframeId, "interpolation", 0);
        } catch (e) {}
        keyData = api.get(keyframeId, "data");
      }
      if (keyData) {
        if (!keyData.leftBez) {
          try {
            api.modifyKeyframe(keyframeId, "leftBez.x", 0);
            api.modifyKeyframe(keyframeId, "leftBez.y", 0);
          } catch (e) {}
        }
        if (!keyData.rightBez) {
          try {
            api.modifyKeyframe(keyframeId, "rightBez.x", 0);
            api.modifyKeyframe(keyframeId, "rightBez.y", 0);
          } catch (e) {}
        }
      }
      try {
        var unlockObj = {};
        unlockObj[attrId] = {
          frame: frame,
          inHandle: true,
          outHandle: true,
          ...unlocked,
        };
        api.modifyKeyframeTangent(layerId, unlockObj);
      } catch (e) {}
    } catch (e) {}
  }
}

/**
 * Apply easing via setKeyframeVelocity for a contiguous motion-path run (both position.x and position.y).
 */
function applyVelocityToMotionPathGroup(
  layerId,
  keyframeIds,
  frames,
  currentEasing,
  targetSections,
) {
  var n = frames.length;
  if (n < 2 || keyframeIds.length !== n) {
    return;
  }
  var targets = normalizeTargetSections(targetSections);

  var valuesX = [];
  var valuesY = [];
  var savedFrame = api.getFrame();
  for (var vi = 0; vi < n; vi++) {
    api.setFrame(frames[vi]);
    valuesX.push(api.get(layerId, "position.x"));
    valuesY.push(api.get(layerId, "position.y"));
  }
  api.setFrame(savedFrame);

  var velocityByFrame = {};
  for (var i = 0; i < n; i++) {
    var f = frames[i];
    var kd = api.get(keyframeIds[i], "data");
    velocityByFrame[f] = {
      leftSpeed:
        kd && kd.leftSpeed !== undefined && kd.leftSpeed !== null
          ? kd.leftSpeed
          : DEFAULT_LEFT_SPEED,
      leftInfluence:
        kd && kd.leftInfluence !== undefined && kd.leftInfluence !== null
          ? kd.leftInfluence
          : DEFAULT_LEFT_INFLUENCE,
      rightSpeed:
        kd && kd.rightSpeed !== undefined && kd.rightSpeed !== null
          ? kd.rightSpeed
          : DEFAULT_RIGHT_SPEED,
      rightInfluence:
        kd && kd.rightInfluence !== undefined && kd.rightInfluence !== null
          ? kd.rightInfluence
          : DEFAULT_RIGHT_INFLUENCE,
    };
  }
  for (var j = 0; j < n - 1; j++) {
    var f0 = frames[j];
    var f1 = frames[j + 1];
    var isHold =
      _clampHoldsEnabled &&
      valuesAreIdentical(valuesX[j], valuesX[j + 1]) &&
      valuesAreIdentical(valuesY[j], valuesY[j + 1]);

    if (isHold) {
      if (!targets || targets.middle || targets.outgoing) {
        velocityByFrame[f0].rightSpeed = 0;
        velocityByFrame[f0].rightInfluence = DEFAULT_RIGHT_INFLUENCE;
      }
      if (!targets || targets.middle || targets.incoming) {
        velocityByFrame[f1].leftSpeed = 0;
        velocityByFrame[f1].leftInfluence = DEFAULT_LEFT_INFLUENCE;
      }
      flattenHandlesBetweenPair(layerId, "position.x", f0, f1, targets);
      flattenHandlesBetweenPair(layerId, "position.y", f0, f1, targets);
    } else {
      var v = cubicBezierToVelocity(
        currentEasing.x1,
        currentEasing.y1,
        currentEasing.x2,
        currentEasing.y2,
      );
      if (!targets || targets.middle || targets.outgoing) {
        velocityByFrame[f0].rightSpeed = v.rightSpeed;
        velocityByFrame[f0].rightInfluence = v.rightInfluence;
      }
      if (!targets || targets.middle || targets.incoming) {
        velocityByFrame[f1].leftSpeed = v.leftSpeed;
        velocityByFrame[f1].leftInfluence = v.leftInfluence;
      }
    }
  }
  for (var k = 0; k < n; k++) {
    var fr = frames[k];
    var vel = velocityByFrame[fr];
    try {
      api.setKeyframeVelocity(layerId, {
        "position.x": {
          frame: fr,
          leftSpeed: vel.leftSpeed,
          rightSpeed: vel.rightSpeed,
          leftInfluence: vel.leftInfluence,
          rightInfluence: vel.rightInfluence,
        },
        "position.y": {
          frame: fr,
          leftSpeed: vel.leftSpeed,
          rightSpeed: vel.rightSpeed,
          leftInfluence: vel.leftInfluence,
          rightInfluence: vel.rightInfluence,
        },
      });
    } catch (e) {
      console.log("Error setKeyframeVelocity at frame " + fr + ":", e.message);
    }
  }
}

function applyVelocityToSelectedMotionPathHandles(
  layerId,
  keyframeIds,
  frames,
  currentEasing,
  targetSections,
) {
  var targets = normalizeTargetSections(targetSections);
  if (!hasAnyTargetSection(targets)) {
    return;
  }

  var allTimes = getSortedKeyframeTimes(layerId, "position.x");
  var savedFrame = api.getFrame();
  var v = cubicBezierToVelocity(
    currentEasing.x1,
    currentEasing.y1,
    currentEasing.x2,
    currentEasing.y2,
  );

  for (var i = 0; i < frames.length; i++) {
    var frame = frames[i];
    var kd = api.get(keyframeIds[i], "data");
    var vel = {
      leftSpeed:
        kd && kd.leftSpeed !== undefined && kd.leftSpeed !== null
          ? kd.leftSpeed
          : DEFAULT_LEFT_SPEED,
      leftInfluence:
        kd && kd.leftInfluence !== undefined && kd.leftInfluence !== null
          ? kd.leftInfluence
          : DEFAULT_LEFT_INFLUENCE,
      rightSpeed:
        kd && kd.rightSpeed !== undefined && kd.rightSpeed !== null
          ? kd.rightSpeed
          : DEFAULT_RIGHT_SPEED,
      rightInfluence:
        kd && kd.rightInfluence !== undefined && kd.rightInfluence !== null
          ? kd.rightInfluence
          : DEFAULT_RIGHT_INFLUENCE,
    };

    if (targets.incoming) {
      var previousFrame = findPreviousFrame(allTimes, frame);
      var isIncomingHold = false;
      if (previousFrame !== null && _clampHoldsEnabled) {
        var prevX = getValueAtFrame(layerId, "position.x", previousFrame, null);
        var prevY = getValueAtFrame(layerId, "position.y", previousFrame, null);
        var curX = getValueAtFrame(layerId, "position.x", frame, null);
        var curY = getValueAtFrame(layerId, "position.y", frame, null);
        isIncomingHold =
          prevX !== null &&
          prevY !== null &&
          curX !== null &&
          curY !== null &&
          valuesAreIdentical(prevX, curX) &&
          valuesAreIdentical(prevY, curY);
      }
      vel.leftSpeed = isIncomingHold ? 0 : v.leftSpeed;
      vel.leftInfluence = isIncomingHold
        ? DEFAULT_LEFT_INFLUENCE
        : v.leftInfluence;
    }

    if (targets.outgoing) {
      var nextFrame = findNextFrame(allTimes, frame);
      var isOutgoingHold = false;
      if (nextFrame !== null && _clampHoldsEnabled) {
        var outCurX = getValueAtFrame(layerId, "position.x", frame, null);
        var outCurY = getValueAtFrame(layerId, "position.y", frame, null);
        var nextX = getValueAtFrame(layerId, "position.x", nextFrame, null);
        var nextY = getValueAtFrame(layerId, "position.y", nextFrame, null);
        isOutgoingHold =
          outCurX !== null &&
          outCurY !== null &&
          nextX !== null &&
          nextY !== null &&
          valuesAreIdentical(outCurX, nextX) &&
          valuesAreIdentical(outCurY, nextY);
      }
      vel.rightSpeed = isOutgoingHold ? 0 : v.rightSpeed;
      vel.rightInfluence = isOutgoingHold
        ? DEFAULT_RIGHT_INFLUENCE
        : v.rightInfluence;
    }

    try {
      api.setKeyframeVelocity(layerId, {
        "position.x": {
          frame: frame,
          leftSpeed: vel.leftSpeed,
          rightSpeed: vel.rightSpeed,
          leftInfluence: vel.leftInfluence,
          rightInfluence: vel.rightInfluence,
        },
        "position.y": {
          frame: frame,
          leftSpeed: vel.leftSpeed,
          rightSpeed: vel.rightSpeed,
          leftInfluence: vel.leftInfluence,
          rightInfluence: vel.rightInfluence,
        },
      });
    } catch (e) {
      console.log(
        "Error setKeyframeVelocity at frame " + frame + ":",
        e.message,
      );
    }
  }

  try {
    api.setFrame(savedFrame);
  } catch (restoreError) {}
}

function velocityRunKey(layerId, frame) {
  return layerId + "|" + frame;
}

/**
 * Ensure keyframes are set to bezier interpolation and unlock tangents
 */
function ensureBezierInterpolation(keyframeId, attrId, layerId, frame) {
  try {
    var keyData = api.get(keyframeId, "data");
    if (!keyData) {
      console.log("Could not get keyframe data for:", keyframeId);
      return false;
    }

    if (keyData.interpolation !== 0) {
      try {
        api.modifyKeyframe(keyframeId, "interpolation", 0);
      } catch (e) {}
    }

    try {
      api.set(keyframeId, "locked", false);
      api.set(keyframeId, "weightLocked", false);
    } catch (e) {}

    return true;
  } catch (error) {
    console.log("Error ensuring bezier interpolation:", error.message);
    return false;
  }
}

/**
 * Zero out the tangent handles between two keyframes (outgoing of first, incoming of second).
 * Uses angle=0, weight=0 to flatten without disturbing the other side's easing.
 */
function flattenHandlesBetweenPair(layerId, attrId, frameA, frameB, targets?) {
  var unlocked = { angleLocked: false, weightLocked: false };
  try {
    if (!targets || targets.middle || targets.outgoing) {
      var outObj = {};
      outObj[attrId] = {
        frame: frameA,
        outHandle: true,
        angle: 0,
        weight: 0,
        ...unlocked,
      };
      api.modifyKeyframeTangent(layerId, outObj);
    }
  } catch (e) {}
  try {
    if (!targets || targets.middle || targets.incoming) {
      var inObj = {};
      inObj[attrId] = {
        frame: frameB,
        inHandle: true,
        angle: 0,
        weight: 0,
        ...unlocked,
      };
      api.modifyKeyframeTangent(layerId, inObj);
    }
  } catch (e) {}
}

/**
 * Apply easing to a single pair of keyframes
 */
function applyEasingToKeyframePair(
  currentKeyId,
  nextKeyId,
  currentKeyData,
  nextKeyData,
  cavalryHandles,
  attrId,
  layerId,
  currentFrame,
  currentValue,
  nextFrame,
  nextValue,
  targets,
) {
  try {
    currentKeyData = api.get(currentKeyId, "data");
    nextKeyData = api.get(nextKeyId, "data");

    try {
      var unlocked = { angleLocked: false, weightLocked: false };

      if (currentKeyData && (!targets || targets.middle || targets.outgoing)) {
        var tangentObj1 = {};
        tangentObj1[attrId] = {
          frame: currentFrame,
          inHandle: false,
          outHandle: true,
          xValue: currentFrame + cavalryHandles.outHandleX,
          yValue: currentValue + cavalryHandles.outHandleY,
          ...unlocked,
        };
        api.modifyKeyframeTangent(layerId, tangentObj1);
      }

      if (nextKeyData && (!targets || targets.middle || targets.incoming)) {
        var tangentObj2 = {};
        tangentObj2[attrId] = {
          frame: nextFrame,
          inHandle: true,
          outHandle: false,
          xValue: nextFrame + cavalryHandles.inHandleX,
          yValue: nextValue + cavalryHandles.inHandleY,
          ...unlocked,
        };
        api.modifyKeyframeTangent(layerId, tangentObj2);
      }
    } catch (e) {
      try {
        if (
          currentKeyData &&
          currentKeyData.rightBez &&
          (!targets || targets.middle || targets.outgoing)
        ) {
          api.modifyKeyframe(
            currentKeyId,
            "rightBez.x",
            cavalryHandles.outHandleX,
          );
          api.modifyKeyframe(
            currentKeyId,
            "rightBez.y",
            cavalryHandles.outHandleY,
          );
        }

        if (
          nextKeyData &&
          nextKeyData.leftBez &&
          (!targets || targets.middle || targets.incoming)
        ) {
          api.modifyKeyframe(nextKeyId, "leftBez.x", cavalryHandles.inHandleX);
          api.modifyKeyframe(nextKeyId, "leftBez.y", cavalryHandles.inHandleY);
        }
      } catch (e2) {
        console.log("Error: Alternative approach also failed:", e2.message);
      }
    }

    return true;
  } catch (error) {
    console.log("Error applying easing to keyframe pair:", error.message);
    return false;
  }
}

/**
 * Apply easing to a single keyframe's both handles independently
 */
function applyEasingToSingleKeyframe(
  keyframeId,
  attrId,
  layerId,
  frame,
  value,
  currentEasing,
) {
  try {
    var defaultFrameDiff = 30;
    var defaultValueDiff = 100;

    var cavalryHandles = cubicBezierToCavalry(
      currentEasing.x1,
      currentEasing.y1,
      currentEasing.x2,
      currentEasing.y2,
      defaultFrameDiff,
      defaultValueDiff,
    );

    var keyData = api.get(keyframeId, "data");
    if (keyData && keyData.interpolation !== 0) {
      try {
        api.modifyKeyframe(keyframeId, "interpolation", 0);
      } catch (e) {}
      keyData = api.get(keyframeId, "data");
    }

    if (keyData) {
      if (!keyData.leftBez) {
        try {
          api.modifyKeyframe(keyframeId, "leftBez.x", 0);
          api.modifyKeyframe(keyframeId, "leftBez.y", 0);
        } catch (e) {}
      }
      if (!keyData.rightBez) {
        try {
          api.modifyKeyframe(keyframeId, "rightBez.x", 0);
          api.modifyKeyframe(keyframeId, "rightBez.y", 0);
        } catch (e) {}
      }
    }

    var unlocked = { angleLocked: false, weightLocked: false };

    var tangentObjOut = {};
    tangentObjOut[attrId] = {
      frame: frame,
      inHandle: false,
      outHandle: true,
      xValue: frame + cavalryHandles.outHandleX,
      yValue: value + cavalryHandles.outHandleY,
      ...unlocked,
    };
    api.modifyKeyframeTangent(layerId, tangentObjOut);

    var tangentObjIn = {};
    tangentObjIn[attrId] = {
      frame: frame,
      inHandle: true,
      outHandle: false,
      xValue: frame + cavalryHandles.inHandleX,
      yValue: value + cavalryHandles.inHandleY,
      ...unlocked,
    };
    api.modifyKeyframeTangent(layerId, tangentObjIn);

    return true;
  } catch (error) {
    console.log("Error applying easing to single keyframe:", error.message);
    return false;
  }
}

function applyEasingToKeyframeHandle(
  keyframeId,
  attrId,
  layerId,
  frame,
  currentEasing,
  handleSide,
) {
  try {
    var allTimes = getSortedKeyframeTimes(layerId, attrId);
    var value = getValueAtFrame(layerId, attrId, frame, 0);
    var referenceFrame =
      handleSide === "incoming"
        ? findPreviousFrame(allTimes, frame)
        : findNextFrame(allTimes, frame);
    var referenceValue =
      referenceFrame !== null
        ? getValueAtFrame(layerId, attrId, referenceFrame, value)
        : null;

    ensureBezierInterpolation(keyframeId, attrId, layerId, frame);

    var frameDiff = 30;
    var valueDiff = 100;
    if (referenceFrame !== null) {
      if (handleSide === "incoming") {
        frameDiff = frame - referenceFrame;
        valueDiff = value - referenceValue;
      } else {
        frameDiff = referenceFrame - frame;
        valueDiff = referenceValue - value;
      }
    }

    if (Math.abs(frameDiff) < 0.001) {
      frameDiff = 30;
    }

    var cavalryHandles = cubicBezierToCavalry(
      currentEasing.x1,
      currentEasing.y1,
      currentEasing.x2,
      currentEasing.y2,
      frameDiff,
      valueDiff,
    );

    var unlocked = { angleLocked: false, weightLocked: false };
    var tangentObj = {};

    if (handleSide === "incoming") {
      tangentObj[attrId] = {
        frame: frame,
        inHandle: true,
        outHandle: false,
        xValue: frame + cavalryHandles.inHandleX,
        yValue: value + cavalryHandles.inHandleY,
        ...unlocked,
      };
    } else {
      tangentObj[attrId] = {
        frame: frame,
        inHandle: false,
        outHandle: true,
        xValue: frame + cavalryHandles.outHandleX,
        yValue: value + cavalryHandles.outHandleY,
        ...unlocked,
      };
    }

    api.modifyKeyframeTangent(layerId, tangentObj);
    return true;
  } catch (error) {
    console.log(
      "Error applying easing to keyframe " + handleSide + " handle:",
      error.message,
    );
    return false;
  }
}

function applyEasingToFramePair(
  layerId,
  attrId,
  currentFrame,
  nextFrame,
  currentEasing,
  targetSections,
) {
  try {
    var targets = normalizeTargetSections(targetSections);
    var frameDiff = nextFrame - currentFrame;
    if (Math.abs(frameDiff) < 0.001) {
      return false;
    }

    var currentValue = getValueAtFrame(layerId, attrId, currentFrame, 0);
    var nextValue = getValueAtFrame(layerId, attrId, nextFrame, currentValue);
    var valueDiff = nextValue - currentValue;
    var cavalryHandles = cubicBezierToCavalry(
      currentEasing.x1,
      currentEasing.y1,
      currentEasing.x2,
      currentEasing.y2,
      frameDiff,
      valueDiff,
    );
    var unlocked = { angleLocked: false, weightLocked: false };
    var success = false;

    if (!targets || targets.middle || targets.outgoing) {
      var tangentObjOut = {};
      tangentObjOut[attrId] = {
        frame: currentFrame,
        inHandle: false,
        outHandle: true,
        xValue: currentFrame + cavalryHandles.outHandleX,
        yValue: currentValue + cavalryHandles.outHandleY,
        ...unlocked,
      };
      api.modifyKeyframeTangent(layerId, tangentObjOut);
      success = true;
    }

    if (!targets || targets.middle || targets.incoming) {
      var tangentObjIn = {};
      tangentObjIn[attrId] = {
        frame: nextFrame,
        inHandle: true,
        outHandle: false,
        xValue: nextFrame + cavalryHandles.inHandleX,
        yValue: nextValue + cavalryHandles.inHandleY,
        ...unlocked,
      };
      api.modifyKeyframeTangent(layerId, tangentObjIn);
      success = true;
    }

    return success;
  } catch (error) {
    console.log("Error applying easing to frame pair:", error.message);
    return false;
  }
}

function applyBoundaryTargetSections(group, currentEasing, targetSections) {
  var targets = normalizeTargetSections(targetSections);
  if (!targets || (!targets.incoming && !targets.outgoing)) {
    return 0;
  }

  var processed = 0;
  var frames = group.frames;
  if (!frames || frames.length < 1) {
    return processed;
  }

  var allTimes = getSortedKeyframeTimes(group.layerId, group.attrId);
  var firstSelectedFrame = frames[0];
  var lastSelectedFrame = frames[frames.length - 1];

  if (targets.incoming) {
    var previousFrame = findPreviousFrame(allTimes, firstSelectedFrame);
    if (previousFrame !== null) {
      if (
        applyEasingToFramePair(
          group.layerId,
          group.attrId,
          previousFrame,
          firstSelectedFrame,
          currentEasing,
          { incoming: true },
        )
      ) {
        processed++;
      }
    } else if (group.keyframeIds && group.keyframeIds.length > 0) {
      if (
        applyEasingToKeyframeHandle(
          group.keyframeIds[0],
          group.attrId,
          group.layerId,
          firstSelectedFrame,
          currentEasing,
          "incoming",
        )
      ) {
        processed++;
      }
    }
  }

  if (targets.outgoing) {
    var nextFrame = findNextFrame(allTimes, lastSelectedFrame);
    if (nextFrame !== null) {
      if (
        applyEasingToFramePair(
          group.layerId,
          group.attrId,
          lastSelectedFrame,
          nextFrame,
          currentEasing,
          { outgoing: true },
        )
      ) {
        processed++;
      }
    } else if (group.keyframeIds && group.keyframeIds.length > 0) {
      var lastKeyIndex = group.keyframeIds.length - 1;
      if (
        applyEasingToKeyframeHandle(
          group.keyframeIds[lastKeyIndex],
          group.attrId,
          group.layerId,
          lastSelectedFrame,
          currentEasing,
          "outgoing",
        )
      ) {
        processed++;
      }
    }
  }

  return processed;
}

/**
 * Get easing from selected keyframes
 * @param {Object} currentEasing - Current easing state to update
 * @returns {boolean} Success status
 */
/**
 * Retrieve the easing values from the currently selected keyframes and apply them to the current easing object.
 * @param {Object} currentEasing - The target object to receive the easing values.
 * @returns {boolean} True if values were successfully retrieved and applied, false otherwise.
 */
export function getEasingFromKeyframes(currentEasing) {
  try {
    var selectedKeyframes = api.getSelectedKeyframes();
    var keyframeIds = api.getSelectedKeyframeIds();

    if (keyframeIds.length < 1) {
      console.log("Error: Please select at least 1 keyframe");
      return false;
    }

    // If only 1 keyframe is selected, extract from its handles
    if (keyframeIds.length === 1) {
      var keyframeId = keyframeIds[0];
      var attrPath = api.getAttributeFromKeyframeId(keyframeId);

      var hashIndex = attrPath.indexOf("#");
      if (hashIndex === -1) {
        console.log("Error: Invalid layer ID format");
        return false;
      }

      var dotAfterHash = attrPath.indexOf(".", hashIndex);
      if (dotAfterHash === -1) {
        console.log("Error: Could not parse attribute");
        return false;
      }

      var layerId = attrPath.substring(0, dotAfterHash);
      var attrId = attrPath.substring(dotAfterHash + 1);

      var keyData: any = api.get(keyframeId, "data");
      if (!keyData) {
        console.log("Error: Could not get keyframe data");
        return false;
      }

      if (!keyData.rightBez) {
        console.log(
          "Single keyframe has no bezier handles - keeping current curve",
        );
        return true;
      }

      var defaultFrameDiff = 30;
      var defaultValueDiff = 100;

      var outHandleX = keyData.rightBez.x;
      var outHandleY = keyData.rightBez.y;
      var inHandleX = -outHandleX;
      var inHandleY = -outHandleY;

      var bezier = cavalryToCubicBezier(
        outHandleX,
        outHandleY,
        inHandleX,
        inHandleY,
        defaultFrameDiff,
        defaultValueDiff,
      );

      currentEasing.x1 = bezier.x1;
      currentEasing.y1 = bezier.y1;
      currentEasing.x2 = bezier.x2;
      currentEasing.y2 = bezier.y2;

      console.log("Extracted easing from single keyframe's handles");
      return true;
    }

    // Collect all attribute groups with 2+ keyframes
    var attributeGroups: any = {};

    for (let [fullAttributePath, frames] of Object.entries(selectedKeyframes)) {
      if (frames.length >= 2) {
        var hashIndex = fullAttributePath.indexOf("#");
        if (hashIndex === -1) continue;

        var dotAfterHash = fullAttributePath.indexOf(".", hashIndex);
        if (dotAfterHash === -1) continue;

        var layerId = fullAttributePath.substring(0, dotAfterHash);
        var attrId = fullAttributePath.substring(dotAfterHash + 1);

        var attributeKeyframeIds = [];
        for (var i = 0; i < keyframeIds.length; i++) {
          var keyframeAttrPath = api.getAttributeFromKeyframeId(keyframeIds[i]);
          if (keyframeAttrPath === fullAttributePath) {
            attributeKeyframeIds.push(keyframeIds[i]);
          }
        }

        if (attributeKeyframeIds.length >= 2) {
          attributeGroups[fullAttributePath] = {
            layerId: layerId,
            attrId: attrId,
            frames: frames.sort((a, b) => a - b),
            keyframeIds: attributeKeyframeIds,
          };
        }
      }
    }

    if (Object.keys(attributeGroups).length === 0) {
      console.log("Error: No valid attribute groups found with 2+ keyframes");
      return false;
    }

    var totalX1 = 0,
      totalY1 = 0,
      totalX2 = 0,
      totalY2 = 0;
    var pairCount = 0;
    var currentFrame = api.getFrame();

    for (let [attributePath, group] of Object.entries(attributeGroups) as any) {
      for (var i = 0; i < group.keyframeIds.length - 1; i++) {
        var currentKeyId = group.keyframeIds[i];
        var nextKeyId = group.keyframeIds[i + 1];

        var firstFrame = group.frames[i];
        var secondFrame = group.frames[i + 1];
        var frameDiff = secondFrame - firstFrame;

        if (frameDiff <= 0) continue;

        api.setFrame(firstFrame);
        var firstValue = api.get(group.layerId, group.attrId);
        api.setFrame(secondFrame);
        var secondValue = api.get(group.layerId, group.attrId);

        var valueDiff = secondValue - firstValue;

        var firstKeyData = api.get(currentKeyId, "data");
        var secondKeyData = api.get(nextKeyId, "data");

        var frameZeroData, frameEndData;
        if (Math.abs(firstKeyData.numValue - firstValue) < 0.1) {
          frameZeroData = firstKeyData;
          frameEndData = secondKeyData;
        } else {
          frameZeroData = secondKeyData;
          frameEndData = firstKeyData;
        }

        let outHandleX = null,
          outHandleY = null;
        let inHandleX = null,
          inHandleY = null;

        if (frameZeroData && frameZeroData.rightBez) {
          outHandleX = frameZeroData.rightBez.x;
          outHandleY = frameZeroData.rightBez.y;
        }

        if (frameEndData && frameEndData.leftBez) {
          inHandleX = frameEndData.leftBez.x;
          inHandleY = frameEndData.leftBez.y;
        }

        if (outHandleX !== null && inHandleX !== null) {
          var bezier = cavalryToCubicBezier(
            outHandleX,
            outHandleY,
            inHandleX,
            inHandleY,
            frameDiff,
            valueDiff,
          );
          totalX1 += bezier.x1;
          totalY1 += bezier.y1;
          totalX2 += bezier.x2;
          totalY2 += bezier.y2;
          pairCount++;
        } else {
          totalX1 += 0;
          totalY1 += 0;
          totalX2 += 1;
          totalY2 += 1;
          pairCount++;
        }
      }
    }

    api.setFrame(currentFrame);

    if (pairCount === 0) {
      console.log(
        "Error: Could not extract easing data from any keyframe pairs",
      );
      return false;
    }

    currentEasing.x1 = totalX1 / pairCount;
    currentEasing.y1 = totalY1 / pairCount;
    currentEasing.x2 = totalX2 / pairCount;
    currentEasing.y2 = totalY2 / pairCount;

    if (pairCount > 1) {
      console.log("Averaged easing from " + pairCount + " keyframe pairs");
    }

    return true;
  } catch (error) {
    console.log("Error: " + error.message);
    return false;
  }
}

/**
 * Apply easing to selected keyframes
 * @param {Object} currentEasing - Current easing values to apply
 * @param {Object|null} targetSections - Optional targeted sections { incoming, middle, outgoing }
 * @returns {boolean} Success status
 */
export function applyEasingToKeyframes(currentEasing, targetSections?) {
  try {
    var targets = normalizeTargetSections(targetSections);
    var selectedKeyframes = api.getSelectedKeyframes();
    var keyframeIds = api.getSelectedKeyframeIds();

    if (keyframeIds.length < 1) {
      console.log("Error: Please select at least 1 keyframe");
      return false;
    }

    // Single keyframe case
    if (keyframeIds.length === 1) {
      var keyframeId = keyframeIds[0];
      var attrPath = api.getAttributeFromKeyframeId(keyframeId);

      var hashIndex = attrPath.indexOf("#");
      if (hashIndex === -1) {
        console.log("Error: Invalid layer ID format");
        return false;
      }

      var dotAfterHash = attrPath.indexOf(".", hashIndex);
      if (dotAfterHash === -1) {
        console.log("Error: Could not parse attribute");
        return false;
      }

      var layerId = attrPath.substring(0, dotAfterHash);
      var attrId = attrPath.substring(dotAfterHash + 1);

      var keyframeFrame = null;
      for (let [path, frames] of Object.entries(selectedKeyframes)) {
        if (path === attrPath && frames.length === 1) {
          keyframeFrame = frames[0];
          break;
        }
      }

      if (keyframeFrame === null) {
        console.log("Error: Could not determine keyframe frame number");
        return false;
      }

      var currentFrame = api.getFrame();
      api.setFrame(keyframeFrame);
      var value = api.get(layerId, attrId);

      var success = false;
      if (!targets || targets.middle) {
        success = applyEasingToSingleKeyframe(
          keyframeId,
          attrId,
          layerId,
          keyframeFrame,
          value,
          currentEasing,
        );
      } else {
        if (targets.incoming) {
          success =
            applyEasingToKeyframeHandle(
              keyframeId,
              attrId,
              layerId,
              keyframeFrame,
              currentEasing,
              "incoming",
            ) || success;
        }
        if (targets.outgoing) {
          success =
            applyEasingToKeyframeHandle(
              keyframeId,
              attrId,
              layerId,
              keyframeFrame,
              currentEasing,
              "outgoing",
            ) || success;
        }
      }

      api.setFrame(currentFrame);

      if (success) {
        console.log(
          targets
            ? "Applied targeted easing to single keyframe"
            : "Applied easing to single keyframe's incoming and outgoing handles",
        );
      }

      return success;
    }

    // Group keyframes by attribute path
    var attributeGroups: any = {};

    for (let [fullAttributePath, frames] of Object.entries(selectedKeyframes)) {
      if (frames.length >= (targets && !targets.middle ? 1 : 2)) {
        var hashIndex = fullAttributePath.indexOf("#");
        if (hashIndex === -1) continue;

        var dotAfterHash = fullAttributePath.indexOf(".", hashIndex);
        if (dotAfterHash === -1) continue;

        var layerId = fullAttributePath.substring(0, dotAfterHash);
        var attrId = fullAttributePath.substring(dotAfterHash + 1);

        var attributeKeyframeIds = [];

        for (var i = 0; i < keyframeIds.length; i++) {
          var keyframeAttrPath = api.getAttributeFromKeyframeId(keyframeIds[i]);

          if (keyframeAttrPath === fullAttributePath) {
            attributeKeyframeIds.push(keyframeIds[i]);
          }
        }

        if (
          attributeKeyframeIds.length >= (targets && !targets.middle ? 1 : 2)
        ) {
          var sortedFrames = frames.slice().sort(function (a, b) {
            return a - b;
          });
          var sortedKeyframeIds = attributeKeyframeIds.slice();
          if (
            sortedKeyframeIds.length === sortedFrames.length &&
            frames.length === sortedFrames.length
          ) {
            var pairItems = [];
            for (
              var pairIndex = 0;
              pairIndex < sortedFrames.length;
              pairIndex++
            ) {
              pairItems.push({
                frame: frames[pairIndex],
                id: attributeKeyframeIds[pairIndex],
              });
            }
            pairItems.sort(function (a, b) {
              return a.frame - b.frame;
            });
            for (
              var sortedIndex = 0;
              sortedIndex < pairItems.length;
              sortedIndex++
            ) {
              sortedKeyframeIds[sortedIndex] = pairItems[sortedIndex].id;
            }
          }
          attributeGroups[fullAttributePath] = {
            layerId: layerId,
            attrId: attrId,
            frames: sortedFrames,
            keyframeIds: sortedKeyframeIds,
          };
        }
      }
    }

    if (Object.keys(attributeGroups).length === 0) {
      console.log("Error: No valid attribute groups found");
      return false;
    }

    var totalProcessed = 0;
    var currentFrameTime = api.getFrame();
    var velocityApplied = new Set();

    // Pass 1: motion path segments use setKeyframeVelocity (both axes); avoids modifyKeyframeTangent on paths
    for (let [attributePath, group] of Object.entries(attributeGroups) as any) {
      try {
        var isPositionAttr =
          group.attrId === "position.x" || group.attrId === "position.y";
        if (!isPositionAttr) {
          continue;
        }
        var siblingSetForVelocity = getSiblingKeyframeTimesSet(
          group.layerId,
          group.attrId,
        );
        if (!siblingSetForVelocity) {
          continue;
        }
        var motionRuns = findMotionPathRuns(group, siblingSetForVelocity);
        for (var r = 0; r < motionRuns.length; r++) {
          var runStart = motionRuns[r].start;
          var runEnd = motionRuns[r].end;
          var skipRun = true;
          for (var fi = runStart; fi <= runEnd; fi++) {
            if (
              !velocityApplied.has(
                velocityRunKey(group.layerId, group.frames[fi]),
              )
            ) {
              skipRun = false;
              break;
            }
          }
          if (skipRun) {
            continue;
          }
          var idsSlice = group.keyframeIds.slice(runStart, runEnd + 1);
          var framesSlice = group.frames.slice(runStart, runEnd + 1);
          applyVelocityToMotionPathGroup(
            group.layerId,
            idsSlice,
            framesSlice,
            currentEasing,
            targets,
          );
          for (var fj = runStart; fj <= runEnd; fj++) {
            velocityApplied.add(
              velocityRunKey(group.layerId, group.frames[fj]),
            );
          }
        }
      } catch (velocityGroupError) {
        console.log(
          "Error applying motion path velocity for " + attributePath + ":",
          velocityGroupError.message,
        );
      }
    }

    if (targets && (targets.incoming || targets.outgoing)) {
      for (let [targetedAttributePath, targetedGroup] of Object.entries(
        attributeGroups,
      ) as any) {
        try {
          totalProcessed += applyBoundaryTargetSections(
            targetedGroup,
            currentEasing,
            targets,
          );
        } catch (targetGroupError) {
          console.log(
            "Error processing targeted handles for " +
              targetedAttributePath +
              ":",
            targetGroupError.message,
          );
        }
      }
    }

    // Pass 2: standard tangent easing per pair (skip pairs that are motion path segments)
    for (let [attributePath, group] of Object.entries(attributeGroups) as any) {
      try {
        var siblingSetForTangent = getSiblingKeyframeTimesSet(
          group.layerId,
          group.attrId,
        );

        for (var i = 0; i < group.keyframeIds.length - 1; i++) {
          var currentKeyId = group.keyframeIds[i];
          var nextKeyId = group.keyframeIds[i + 1];

          var currentFrame: number = group.frames[i];
          var nextFrame = group.frames[i + 1];
          var frameDiff = nextFrame - currentFrame;

          if (
            siblingSetForTangent &&
            isMotionPathPair(siblingSetForTangent, currentFrame, nextFrame)
          ) {
            continue;
          }

          unlockKeyframePair(
            currentKeyId,
            nextKeyId,
            currentFrame,
            nextFrame,
            group.attrId,
            group.layerId,
          );

          api.setFrame(currentFrame);
          var currentValue = api.get(group.layerId, group.attrId);
          api.setFrame(nextFrame);
          var nextValue = api.get(group.layerId, group.attrId);

          if (
            _clampHoldsEnabled &&
            valuesAreIdentical(currentValue, nextValue)
          ) {
            flattenHandlesBetweenPair(
              group.layerId,
              group.attrId,
              currentFrame,
              nextFrame,
              targets,
            );
            totalProcessed++;
            continue;
          }

          var valueDiff = nextValue - currentValue;

          var cavalryHandles = cubicBezierToCavalry(
            currentEasing.x1,
            currentEasing.y1,
            currentEasing.x2,
            currentEasing.y2,
            frameDiff,
            valueDiff,
          );

          var currentKeyData = api.get(currentKeyId, "data");
          var nextKeyData = api.get(nextKeyId, "data");

          applyEasingToKeyframePair(
            currentKeyId,
            nextKeyId,
            currentKeyData,
            nextKeyData,
            cavalryHandles,
            group.attrId,
            group.layerId,
            currentFrame,
            currentValue,
            nextFrame,
            nextValue,
            targets,
          );

          totalProcessed++;
        }
      } catch (groupError) {
        console.log(
          "Error processing attribute " + attributePath + ":",
          groupError.message,
        );
      }
    }

    api.setFrame(currentFrameTime);
    return true;
  } catch (error) {
    console.log("Error applying easing to keyframes:", error.message);
    return false;
  }
}

/**
 * Standalone command: flatten motion path handles between consecutive keyframes with identical values.
 * Works on any selected keyframes regardless of the clamp preference setting.
 * @returns {boolean} Success status
 */
export function fixHoldPaths() {
  try {
    var selectedKeyframes = api.getSelectedKeyframes();
    var keyframeIds = api.getSelectedKeyframeIds();

    if (keyframeIds.length < 2) {
      console.log("Fix Holds: Select at least 2 keyframes");
      return false;
    }

    var attributeGroups: any = {};
    for (let [fullAttributePath, frames] of Object.entries(selectedKeyframes)) {
      if (frames.length < 2) continue;
      var hashIndex = fullAttributePath.indexOf("#");
      if (hashIndex === -1) continue;
      var dotAfterHash = fullAttributePath.indexOf(".", hashIndex);
      if (dotAfterHash === -1) continue;

      var layerId = fullAttributePath.substring(0, dotAfterHash);
      var attrId = fullAttributePath.substring(dotAfterHash + 1);

      var attributeKeyframeIds = [];
      for (var i = 0; i < keyframeIds.length; i++) {
        if (
          api.getAttributeFromKeyframeId(keyframeIds[i]) === fullAttributePath
        ) {
          attributeKeyframeIds.push(keyframeIds[i]);
        }
      }
      if (attributeKeyframeIds.length >= 2) {
        attributeGroups[fullAttributePath] = {
          layerId: layerId,
          attrId: attrId,
          frames: frames.sort(function (a, b) {
            return a - b;
          }),
          keyframeIds: attributeKeyframeIds,
        };
      }
    }

    var fixedCount = 0;
    var savedFrame = api.getFrame();
    var velocityFixed = new Set();

    for (let [attributePath, group] of Object.entries(attributeGroups) as any) {
      var siblingTimes = getSiblingKeyframeTimesSet(
        group.layerId,
        group.attrId,
      );

      for (var j = 0; j < group.frames.length - 1; j++) {
        var frameA = group.frames[j];
        var frameB = group.frames[j + 1];

        api.setFrame(frameA);
        var valA = api.get(group.layerId, group.attrId);
        api.setFrame(frameB);
        var valB = api.get(group.layerId, group.attrId);

        if (!valuesAreIdentical(valA, valB)) {
          continue;
        }

        var isPath =
          siblingTimes && isMotionPathPair(siblingTimes, frameA, frameB);

        if (isPath) {
          var siblingAttr =
            group.attrId === "position.x" ? "position.y" : "position.x";
          api.setFrame(frameA);
          var sibValA = api.get(group.layerId, siblingAttr);
          api.setFrame(frameB);
          var sibValB = api.get(group.layerId, siblingAttr);

          if (!valuesAreIdentical(sibValA, sibValB)) {
            continue;
          }

          var keyA = velocityRunKey(group.layerId, frameA);
          var keyB = velocityRunKey(group.layerId, frameB);
          if (!velocityFixed.has(keyA) || !velocityFixed.has(keyB)) {
            flattenHandlesBetweenPair(
              group.layerId,
              "position.x",
              frameA,
              frameB,
            );
            flattenHandlesBetweenPair(
              group.layerId,
              "position.y",
              frameA,
              frameB,
            );

            var kfIdA = group.keyframeIds[j];
            var kfIdB = group.keyframeIds[j + 1];
            var kdA = api.get(kfIdA, "data") || {};
            var kdB = api.get(kfIdB, "data") || {};

            try {
              api.setKeyframeVelocity(group.layerId, {
                "position.x": {
                  frame: frameA,
                  leftSpeed:
                    kdA.leftSpeed !== undefined
                      ? kdA.leftSpeed
                      : DEFAULT_LEFT_SPEED,
                  leftInfluence:
                    kdA.leftInfluence !== undefined
                      ? kdA.leftInfluence
                      : DEFAULT_LEFT_INFLUENCE,
                  rightSpeed: 0,
                  rightInfluence: DEFAULT_RIGHT_INFLUENCE,
                },
                "position.y": {
                  frame: frameA,
                  leftSpeed:
                    kdA.leftSpeed !== undefined
                      ? kdA.leftSpeed
                      : DEFAULT_LEFT_SPEED,
                  leftInfluence:
                    kdA.leftInfluence !== undefined
                      ? kdA.leftInfluence
                      : DEFAULT_LEFT_INFLUENCE,
                  rightSpeed: 0,
                  rightInfluence: DEFAULT_RIGHT_INFLUENCE,
                },
              });
            } catch (e) {}
            try {
              api.setKeyframeVelocity(group.layerId, {
                "position.x": {
                  frame: frameB,
                  leftSpeed: 0,
                  leftInfluence: DEFAULT_LEFT_INFLUENCE,
                  rightSpeed:
                    kdB.rightSpeed !== undefined
                      ? kdB.rightSpeed
                      : DEFAULT_RIGHT_SPEED,
                  rightInfluence:
                    kdB.rightInfluence !== undefined
                      ? kdB.rightInfluence
                      : DEFAULT_RIGHT_INFLUENCE,
                },
                "position.y": {
                  frame: frameB,
                  leftSpeed: 0,
                  leftInfluence: DEFAULT_LEFT_INFLUENCE,
                  rightSpeed:
                    kdB.rightSpeed !== undefined
                      ? kdB.rightSpeed
                      : DEFAULT_RIGHT_SPEED,
                  rightInfluence:
                    kdB.rightInfluence !== undefined
                      ? kdB.rightInfluence
                      : DEFAULT_RIGHT_INFLUENCE,
                },
              });
            } catch (e) {}
            velocityFixed.add(keyA);
            velocityFixed.add(keyB);
            fixedCount++;
          }
        } else {
          flattenHandlesBetweenPair(
            group.layerId,
            group.attrId,
            frameA,
            frameB,
          );
          fixedCount++;
        }
      }
    }

    api.setFrame(savedFrame);

    if (fixedCount > 0) {
      console.log("Fixed " + fixedCount + " hold segment(s)");
    } else {
      console.log("No identical-value pairs found to fix");
    }
    return true;
  } catch (error) {
    console.log("Fix holds error:", error.message);
    return false;
  }
}

/**
 * Get keyframe data and extract bezier information for 2 selected keyframes
 * @returns {Object|null} Keyframe info object or null on error
 */
export function getKeyframeInfo() {
  var selectedKeyframes = api.getSelectedKeyframes();
  var keyframeIds = api.getSelectedKeyframeIds();

  if (keyframeIds.length !== 2) {
    console.error("Error: Please select exactly 2 keyframes");
    return null;
  }

  try {
    var attrPath = api.getAttributeFromKeyframeId(keyframeIds[0]);
    var attrPath2 = api.getAttributeFromKeyframeId(keyframeIds[1]);

    if (attrPath !== attrPath2) {
      console.error("Error: Both keyframes must be on the same attribute");
      return null;
    }

    var layerId, attrId, selectedFrames;
    var fullAttributePath = null;

    for (let [key, frames] of Object.entries(selectedKeyframes)) {
      if (frames.length === 2) {
        fullAttributePath = key;
        selectedFrames = frames.sort((a, b) => a - b);
        break;
      }
    }

    if (!fullAttributePath) {
      console.error(
        "Error: Could not find attribute with 2 selected keyframes",
      );
      return null;
    }

    var hashIndex = fullAttributePath.indexOf("#");
    if (hashIndex === -1) {
      console.error("Error: Invalid layer ID format in: " + fullAttributePath);
      return null;
    }

    var dotAfterHash = fullAttributePath.indexOf(".", hashIndex);
    if (dotAfterHash === -1) {
      console.error(
        "Error: Could not parse attribute from: " + fullAttributePath,
      );
      return null;
    }

    layerId = fullAttributePath.substring(0, dotAfterHash);
    attrId = fullAttributePath.substring(dotAfterHash + 1);

    if (selectedFrames.length !== 2) {
      console.error("Error: Could not find 2 selected frames");
      return null;
    }

    var firstFrame = selectedFrames[0];
    var secondFrame = selectedFrames[1];

    var currentFrame = api.getFrame();

    var firstValue, secondValue;
    try {
      api.setFrame(firstFrame);
      firstValue = api.get(layerId, attrId);

      api.setFrame(secondFrame);
      secondValue = api.get(layerId, attrId);

      api.setFrame(currentFrame);
    } catch (e) {
      api.setFrame(currentFrame);
      console.error("Error getting keyframe values: " + e.message);
      return null;
    }

    var easingValues = null;

    try {
      var firstKeyData = api.get(keyframeIds[0], "data");
      var secondKeyData = api.get(keyframeIds[1], "data");

      var kf1Data: any = api.get(keyframeIds[0], "data");
      var kf2Data = api.get(keyframeIds[1], "data");

      var frameZeroData, frameEndData;

      if (Math.abs(kf1Data.numValue - firstValue) < 0.1) {
        frameZeroData = kf1Data;
        frameEndData = kf2Data;
      } else {
        frameZeroData = kf2Data;
        frameEndData = kf1Data;
      }

      var outHandleX = null,
        outHandleY = null;
      var inHandleX = null,
        inHandleY = null;

      if (frameZeroData && frameZeroData.rightBez) {
        outHandleX = frameZeroData.rightBez.x;
        outHandleY = frameZeroData.rightBez.y;
      }

      if (frameEndData && frameEndData.leftBez) {
        inHandleX = frameEndData.leftBez.x;
        inHandleY = frameEndData.leftBez.y;
      }

      if (outHandleX !== null && inHandleX !== null) {
        var frameDiff = secondFrame - firstFrame;
        var valueDiff = secondValue - firstValue;

        if (frameDiff > 0) {
          var x1 = outHandleX / frameDiff;
          var y1 = 0;
          if (Math.abs(valueDiff) > 0.001) {
            y1 = outHandleY / valueDiff;
          }

          var x2 = (frameDiff + inHandleX) / frameDiff;
          var y2 = 1;
          if (Math.abs(valueDiff) > 0.001) {
            y2 = 1 + inHandleY / valueDiff;
          }

          x1 = Math.max(0, Math.min(1, x1));
          x2 = Math.max(0, Math.min(1, x2));

          easingValues =
            x1.toFixed(3) +
            "," +
            y1.toFixed(3) +
            "," +
            x2.toFixed(3) +
            "," +
            y2.toFixed(3);
        }
      }

      if (!easingValues) {
        console.error("Could not extract bezier data from keyframes");
        return null;
      }
    } catch (e) {
      console.error("Error extracting bezier data:", e.message);
      return null;
    }

    var frameRate = getCompositionFrameRate();
    var frameDuration = secondFrame - firstFrame;
    var durationMs = framesToMilliseconds(frameDuration, frameRate);

    var propertyName = attrId;
    propertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
    propertyName = propertyName.replace(/([A-Z])/g, " $1").trim();

    function formatValue(value) {
      if (typeof value === "number") {
        return Math.round(value * 100) / 100;
      }
      return value;
    }

    var formattedStartValue = formatValue(firstValue);
    var formattedEndValue = formatValue(secondValue);

    return {
      easing: easingValues,
      duration: durationMs,
      frameDuration: frameDuration,
      propertyName: propertyName,
      startValue: formattedStartValue,
      endValue: formattedEndValue,
      layerId: layerId,
      attrId: attrId,
      firstFrame: firstFrame,
      secondFrame: secondFrame,
      frameRate: frameRate,
    };
  } catch (error) {
    console.error("Overall error:", error.message);
    return null;
  }
}

/**
 * Copy keyframe duration to clipboard
 */
export function copyKeyframeDuration() {
  try {
    var info = getKeyframeInfo();
    if (info) {
      var durationText =
        info.propertyName +
        ": " +
        info.duration +
        "ms (" +
        info.frameDuration +
        " frames @ " +
        getCompositionFrameRate() +
        "fps)";
      api.setClipboardText(durationText);
      console.log("Copied duration: " + durationText);
    }
  } catch (e) {
    console.error("Duration copy error:", e.message);
  }
}

/**
 * Copy keyframe values to clipboard
 */
export function copyKeyframeValues() {
  try {
    var info = getKeyframeInfo();
    if (info) {
      var valuesText =
        info.propertyName + " " + info.startValue + " > " + info.endValue;
      api.setClipboardText(valuesText);
      console.log("Copied values: " + valuesText);
    }
  } catch (e) {
    console.error("Values copy error:", e.message);
  }
}

/**
 * Copy all keyframe info to clipboard
 */
export function copyAllKeyframeInfo() {
  try {
    var info = getKeyframeInfo();
    if (info) {
      var allText =
        info.propertyName +
        "\n" +
        info.startValue +
        " > " +
        info.endValue +
        "\n" +
        "cubic-bezier(" +
        info.easing +
        ")" +
        "\n" +
        "Duration: " +
        info.duration +
        "ms (" +
        info.frameDuration +
        " frames @ " +
        getCompositionFrameRate() +
        "fps)";
      api.setClipboardText(allText);
      console.log("Copied all keyframe info to clipboard");
    }
  } catch (e) {
    console.error("All info copy error:", e.message);
  }
}
