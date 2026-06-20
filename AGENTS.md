# Easey Agent Notes

Easey is a Cavalry script for editing and applying cubic bezier easing curves.

## Cavalry References

- create-script template/bundler: https://github.com/scenery-io/create-script
- Scripting docs: https://docs.cavalry.scenegroup.co/tech-info/scripting/getting-started/
- API module docs: https://docs.cavalry.scenegroup.co/tech-info/scripting/api-module/
- Modifier key reference: https://docs.cavalry.scenegroup.co/tech-info/scripting/api-module/#isshiftheld

## Build Notes

- Source files live in `src/` and are TypeScript.
- Import PNG/JPG assets from TypeScript; `@scenery/bundler` copies them into `build/Easey_assets` and rewrites imports to `ui.scriptLocation` paths.
- Run `npm run typecheck` before handing off TypeScript changes.
- `npm run release` requires the Stallion bridge running in Cavalry because the bundler encrypts the release artifact.

## Runtime Notes

- Mouse event `modifiers` can be undefined in Cavalry. Use `api.isShiftHeld()`, `api.isControlHeld()`, and `api.isMetaHeld()` instead.
- `api.isControlHeld()` maps to Command on macOS and Control on Windows.
- `api.isMetaHeld()` maps to Control on macOS and Meta on Windows.
- Speed Graph behavior: Shift locks Y for X-only movement, and physical Control mirrors handles.
- `api.getSelectedKeyframes()` returns an object keyed by full attribute paths.
- `api.getAttributeFromKeyframeId()` returns the full path, for example `basicShape#1.position.x`.
- Match keyframe IDs to attributes by full path, not partial attribute names.
- Multi-attribute keyframe operations should group by full attribute path and process each group independently.
- Visual handle positions and click targets must use the same clamping logic so handles remain clickable outside the plotted 0-1 range.
- Default presets should not be merged into saved preferences on every reload; use the saved presets object as the source of truth.
- Axis-constrained dragging should calculate handle angles from cp1 origin `(0, 0)` and cp2 origin `(1, 1)`, snap to the grid boundary, and recalculate when Shift is re-pressed during a drag.

## User Workflow

- Select keyframes in the Graph Editor or Time Editor.
- Adjust the curve in the interactive editor.
- Hold Shift while dragging handles for axis-constrained movement.
- Use Apply to write easing to selected keyframes.
- Use Get to extract easing from selected keyframes.
- Click a preset to apply it, and use the settings menu for save/import actions.
- Context menu actions can copy keyframe duration, values, and easing info.
