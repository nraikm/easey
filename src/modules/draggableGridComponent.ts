/**
 * Reusable grouped grid component for Cavalry UI scripts.
 *
 * The component owns grid item/group visual states, widget geometry hit-testing,
 * and drag/drop insertion behavior. Callers provide data-specific rendering and
 * persistence callbacks.
 */
export function createDraggableGridComponent(options) {
  var config = options.config || {};
  var getGroupItemCount = options.getGroupItemCount;
  var onGroupMoved = options.onGroupMoved;
  var onItemMoved = options.onItemMoved;
  var onRebuild = options.onRebuild;
  var onPointerFocus = options.onPointerFocus;
  var onGroupContextMenu = options.onGroupContextMenu;
  var onItemContextMenu = options.onItemContextMenu;

  var itemWidth = config.itemWidth || 68;
  var itemHeight = config.itemHeight || 74;
  var itemPadding = config.itemPadding !== undefined ? config.itemPadding : 2;
  var itemGapX = config.itemGapX !== undefined ? config.itemGapX : 2;
  var itemGapY = config.itemGapY !== undefined ? config.itemGapY : 2;
  var showItemTitles = config.showItemTitles !== false;
  var itemTitleHeight = config.itemTitleHeight || 12;
  var itemTitleFontSize = config.itemTitleFontSize || 10;
  var surfaceColor = config.surfaceColor || "#202020";
  var selectedColor = config.selectedColor || "#3a3a3a";
  var targetColor = config.targetColor || "#4a4a4a";
  var groupTargetColor = config.groupTargetColor || "#333333";
  var selectedTextColor = config.selectedTextColor || "#ffffff";
  var idleTextColor = config.idleTextColor || "#a0a0a0";

  var dragState = {
    dragType: null, // null | "group" | "item"
    didDrag: false,
    startWidget: null,
    startPosition: null,
    startGeometry: null,
    lastPosition: null,
    fromGroupId: null,
    fromItemIndex: -1,
    hoverGroupId: null,
    hoverItemIndex: -1,
    hoverGroupIndex: -1,
    toGroupId: null,
    toItemIndex: -1,
    fromGroupIndex: -1,
    toGroupIndex: -1,
    highlightedGroupId: null,
    highlightedItemIndex: -1,
    itemEntries: [],
    groupEntries: [],
    hitGroupEntries: [],
    hitItemEntries: [],
  };

  var temporaryHighlightTimer = null;

  function getAccentColor() {
    return config.accentColor || ui.getThemeColor("Accent1");
  }

  function setContainerVisualState(
    container,
    stateKey,
    backgroundColor,
    borderColor,
    borderWidth,
  ) {
    if (!container) return;
    if (container._draggableGridVisualState === stateKey) return;

    try {
      container.setBackgroundColor(backgroundColor);
      container.setBorder(borderColor, borderWidth);
      container._draggableGridVisualState = stateKey;
    } catch (e) {
      console.log("Could not update grid style:", e.message);
    }
  }

  function applyItemStyle(entry, isSelected, isSource, isTarget, isHighlighted) {
    var accentColor = getAccentColor();
    if (isSource || isSelected || isHighlighted) {
      setContainerVisualState(
        entry.container,
        "item-active",
        selectedColor,
        accentColor,
        1,
      );
    } else if (isTarget) {
      setContainerVisualState(
        entry.container,
        "item-target",
        targetColor,
        accentColor,
        1,
      );
    } else {
      setContainerVisualState(
        entry.container,
        "item-idle",
        surfaceColor,
        surfaceColor,
        0,
      );
    }

    if (entry.label) {
      entry.label.setTextColor(isSelected ? selectedTextColor : idleTextColor);
    }
  }

  function applyGroupStyle(entry, isSource, isTarget) {
    var accentColor = getAccentColor();
    if (isSource) {
      setContainerVisualState(
        entry.container,
        "group-source",
        selectedColor,
        accentColor,
        1,
      );
    } else if (isTarget) {
      setContainerVisualState(
        entry.container,
        "group-target",
        groupTargetColor,
        accentColor,
        1,
      );
    } else {
      setContainerVisualState(
        entry.container,
        "group-idle",
        surfaceColor,
        surfaceColor,
        0,
      );
    }
  }

  function isItemHighlighted(entry) {
    return (
      dragState.highlightedGroupId === entry.groupId &&
      dragState.highlightedItemIndex === entry.itemIndex
    );
  }

  function updateItemVisuals() {
    dragState.itemEntries.forEach(function (entry) {
      var isSource =
        dragState.dragType === "item" &&
        entry.groupId === dragState.fromGroupId &&
        entry.itemIndex === dragState.fromItemIndex;
      var isTarget =
        dragState.dragType === "item" &&
        dragState.didDrag &&
        entry.groupId === dragState.hoverGroupId &&
        entry.itemIndex === dragState.hoverItemIndex;
      applyItemStyle(
        entry,
        !!entry.isSelected,
        isSource,
        isTarget,
        isItemHighlighted(entry),
      );
    });
  }

  function updateGroupVisuals() {
    dragState.groupEntries.forEach(function (entry) {
      var isSource =
        dragState.dragType === "group" &&
        entry.groupIndex === dragState.fromGroupIndex;
      var isGroupTarget =
        dragState.dragType === "group" &&
        dragState.didDrag &&
        entry.groupIndex === dragState.hoverGroupIndex;
      var isItemDropTarget =
        dragState.dragType === "item" &&
        dragState.didDrag &&
        entry.groupId === dragState.toGroupId &&
        dragState.hoverItemIndex === -1;
      applyGroupStyle(entry, isSource, isGroupTarget || isItemDropTarget);
    });
  }

  function updateVisuals() {
    updateItemVisuals();
    updateGroupVisuals();
  }

  function resetDragState() {
    dragState.dragType = null;
    dragState.didDrag = false;
    dragState.startWidget = null;
    dragState.startPosition = null;
    dragState.startGeometry = null;
    dragState.lastPosition = null;
    dragState.fromGroupId = null;
    dragState.fromItemIndex = -1;
    dragState.hoverGroupId = null;
    dragState.hoverItemIndex = -1;
    dragState.hoverGroupIndex = -1;
    dragState.toGroupId = null;
    dragState.toItemIndex = -1;
    dragState.fromGroupIndex = -1;
    dragState.toGroupIndex = -1;
    dragState.itemEntries = [];
    dragState.groupEntries = [];
    dragState.hitGroupEntries = [];
    dragState.hitItemEntries = [];
  }

  function registerGroup(entry) {
    dragState.groupEntries.push(entry);
    applyGroupStyle(entry, false, false);
  }

  function registerItem(entry) {
    dragState.itemEntries.push(entry);
    applyItemStyle(entry, !!entry.isSelected, false, false, false);
  }

  function setItemSelected(groupId, itemIndex, isSelected) {
    dragState.itemEntries.forEach(function (entry) {
      if (entry.groupId === groupId && entry.itemIndex === itemIndex) {
        entry.isSelected = isSelected;
        applyItemStyle(entry, !!isSelected, false, false, isItemHighlighted(entry));
      }
    });
  }

  function highlightItem(groupId, itemIndex, duration) {
    if (temporaryHighlightTimer) {
      try {
        temporaryHighlightTimer.stop();
      } catch (e) {}
      temporaryHighlightTimer = null;
    }

    dragState.highlightedGroupId = groupId;
    dragState.highlightedItemIndex = itemIndex;
    updateItemVisuals();

    var callback = {
      onTimeout: function () {
        dragState.highlightedGroupId = null;
        dragState.highlightedItemIndex = -1;
        updateItemVisuals();
        temporaryHighlightTimer = null;
      },
    };
    temporaryHighlightTimer = new api.Timer(callback);
    temporaryHighlightTimer.setInterval(duration || 300);
    temporaryHighlightTimer.setRepeating(false);
    temporaryHighlightTimer.start();
  }

  function createGridLayout(horizontalGap, verticalGap) {
    return new ui.FlowLayout(
      horizontalGap !== undefined ? horizontalGap : itemGapX,
      verticalGap !== undefined ? verticalGap : itemGapY,
    );
  }

  function createGridItem(itemOptions) {
    var title = itemOptions.title || "";
    var tooltip = itemOptions.tooltip || title;
    var width = itemOptions.width || itemWidth;
    var height = itemOptions.height || itemHeight;
    var contentWidget = itemOptions.contentWidget;
    var showTitle =
      itemOptions.showTitle !== undefined ? itemOptions.showTitle : showItemTitles;

    var container = new ui.Container();
    container.setFixedWidth(width);
    container.setFixedHeight(height);
    if (tooltip) container.setToolTip(tooltip);
    container.useHoverEvents(true);

    var layout = new ui.VLayout();
    layout.setSpaceBetween(1);
    layout.setMargins(itemPadding, itemPadding, itemPadding, itemPadding);

    if (contentWidget) {
      var contentRow = new ui.HLayout();
      contentRow.setMargins(0, 0, 0, 0);
      contentRow.setSpaceBetween(0);
      contentRow.addStretch();
      contentRow.add(contentWidget);
      contentRow.addStretch();
      layout.add(contentRow);
    }

    var label = null;
    if (showTitle) {
      label = new ui.Label(title);
      label.setAlignment(1);
      label.setFontSize(itemTitleFontSize);
      label.setFixedWidth(width - itemPadding * 2);
      label.setFixedHeight(itemTitleHeight);
      label.setTextColor(itemOptions.isSelected ? selectedTextColor : idleTextColor);
      if (tooltip) label.setToolTip(tooltip);

      var labelRow = new ui.HLayout();
      labelRow.setMargins(0, 0, 0, 0);
      labelRow.setSpaceBetween(0);
      labelRow.addStretch();
      labelRow.add(label);
      labelRow.addStretch();
      layout.add(labelRow);
    }

    container.setLayout(layout);
    return {
      container: container,
      contentWidget: contentWidget,
      label: label,
    };
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
    dragState.hitGroupEntries = [];
    dragState.hitItemEntries = [];

    var groups = [];
    dragState.groupEntries.forEach(function (entry) {
      var geo = getWidgetGeometry(entry.container);
      if (geo) {
        groups.push({
          geo: geo,
          groupId: entry.groupId,
          groupIndex: entry.groupIndex,
        });
      }
    });
    groups.sort(function (a, b) {
      var topA = a.geo.top !== undefined ? a.geo.top : a.geo.y;
      var topB = b.geo.top !== undefined ? b.geo.top : b.geo.y;
      return topA - topB;
    });

    for (var i = 0; i < groups.length; i++) {
      var current = groups[i];
      var curTop =
        current.geo.top !== undefined ? current.geo.top : current.geo.y;
      var curHeight = current.geo.height;
      var nextTop = null;
      if (i < groups.length - 1) {
        var next = groups[i + 1];
        nextTop = next.geo.top !== undefined ? next.geo.top : next.geo.y;
      }
      var newHeight =
        nextTop !== null
          ? Math.max(curHeight, Math.abs(nextTop - curTop))
          : Math.max(curHeight, 1000);

      var newGeo = {
        left: current.geo.left,
        right: current.geo.right,
        top: current.geo.top,
        bottom: current.geo.bottom,
        x: current.geo.x,
        y: current.geo.y,
        width: current.geo.width,
        height: newHeight,
      };
      if (newGeo.bottom !== undefined && newGeo.top !== undefined) {
        newGeo.bottom = newGeo.top + newHeight;
      }
      dragState.hitGroupEntries.push({
        geo: newGeo,
        groupId: current.groupId,
        groupIndex: current.groupIndex,
      });
    }

    dragState.itemEntries.forEach(function (entry) {
      dragState.hitItemEntries.push({
        geo: getWidgetGeometry(entry.container),
        groupId: entry.groupId,
        itemIndex: entry.itemIndex,
      });
    });
  }

  function pointFromLocalPosition(widget, position) {
    var geo =
      widget === dragState.startWidget && dragState.startGeometry
        ? dragState.startGeometry
        : getWidgetGeometry(widget);
    if (!geo || !position) return [];
    var left = geo.left !== undefined ? geo.left : geo.x;
    var top = geo.top !== undefined ? geo.top : geo.y;
    var bottom = geo.bottom !== undefined ? geo.bottom : top + geo.height;
    return [{ x: left + position.x, y: bottom - position.y }];
  }

  function geometryContainsPoint(geo, point) {
    if (!geo || !point) return false;
    var left = geo.left !== undefined ? geo.left : geo.x;
    var right = geo.right !== undefined ? geo.right : left + geo.width;
    var top = geo.top !== undefined ? geo.top : geo.y;
    var bottom = geo.bottom !== undefined ? geo.bottom : top + geo.height;
    var minX = Math.min(left, right);
    var maxX = Math.max(left, right);
    var minY = Math.min(top, bottom);
    var maxY = Math.max(top, bottom);
    return (
      point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
    );
  }

  function verticalInsertIndexFromPoint(geo, point, itemIndex, position) {
    if (itemIndex > dragState.fromGroupIndex) return itemIndex + 1;
    if (itemIndex < dragState.fromGroupIndex) return itemIndex;
    var top = geo.top !== undefined ? geo.top : geo.y;
    var bottom = geo.bottom !== undefined ? geo.bottom : top + geo.height;
    var height = Math.max(1, Math.abs(bottom - top));
    var topDistance = Math.abs(point.y - top);
    var bottomDistance = Math.abs(point.y - bottom);
    var edgeInset = Math.max(3, height * 0.12);
    if (topDistance <= edgeInset) return itemIndex;
    if (bottomDistance <= edgeInset) return itemIndex + 1;
    if (
      dragState.lastPosition &&
      Math.abs(point.y - dragState.lastPosition.y) > 0.5
    ) {
      return point.y < dragState.lastPosition.y ? itemIndex + 1 : itemIndex;
    }
    if (
      dragState.startPosition &&
      position &&
      Math.abs(position.y - dragState.startPosition.y) > 2
    ) {
      return position.y < dragState.startPosition.y ? itemIndex + 1 : itemIndex;
    }
    return topDistance <= bottomDistance ? itemIndex : itemIndex + 1;
  }

  function horizontalInsertIndexFromPoint(geo, point, itemIndex) {
    var left = geo.left !== undefined ? geo.left : geo.x;
    var right = geo.right !== undefined ? geo.right : left + geo.width;
    var centerX = (left + right) / 2;
    return point.x < centerX ? itemIndex : itemIndex + 1;
  }

  function getItemInsertIndex(groupEntry, point) {
    var groupItems = [];
    var maxBottom = -Infinity;

    for (var i = 0; i < dragState.hitItemEntries.length; i++) {
      var item = dragState.hitItemEntries[i];
      if (item.groupId === groupEntry.groupId) {
        var geo = item.geo;
        if (geo) {
          var top = geo.top !== undefined ? geo.top : geo.y;
          var bottom =
            geo.bottom !== undefined ? geo.bottom : geo.y + geo.height;
          var left = geo.left !== undefined ? geo.left : geo.x;
          var right = geo.right !== undefined ? geo.right : geo.x + geo.width;

          groupItems.push({
            item: item,
            top: top,
            bottom: bottom,
            left: left,
            right: right,
            centerX: (left + right) / 2,
          });

          if (bottom > maxBottom) maxBottom = bottom;
        }
      }
    }

    if (groupItems.length === 0) return 0;
    if (point.y > maxBottom - 5) return groupItems.length;

    var bestItem = null;
    var minDistance = Infinity;
    for (var j = 0; j < groupItems.length; j++) {
      var c = groupItems[j];
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
        bestItem = c;
      }
    }

    if (bestItem) {
      return point.x < bestItem.centerX
        ? bestItem.item.itemIndex
        : bestItem.item.itemIndex + 1;
    }

    return groupItems.length;
  }

  function pointerMovedEnough(position) {
    if (!dragState.startPosition || !position) return false;
    var dx = position.x - dragState.startPosition.x;
    var dy = position.y - dragState.startPosition.y;
    return dx * dx + dy * dy > 16;
  }

  function hoverGroupDragTarget(groupIndex) {
    if (dragState.dragType !== "group") return;
    if (dragState.toGroupIndex !== groupIndex) {
      dragState.didDrag = true;
      dragState.toGroupIndex = groupIndex;
      updateVisuals();
    }
  }

  function hoverItemDragTarget(groupId, itemIndex) {
    if (dragState.dragType !== "item") return;
    if (dragState.toGroupId !== groupId || dragState.toItemIndex !== itemIndex) {
      dragState.didDrag = true;
      dragState.toGroupId = groupId;
      dragState.toItemIndex = itemIndex;
      updateVisuals();
    }
  }

  function updateTargetFromPointer(widget, position) {
    if (!dragState.dragType || !widget || !position) return false;
    if (!pointerMovedEnough(position)) return false;
    dragState.didDrag = true;
    if (dragState.dragType === "group" && dragState.hoverGroupIndex === -1) {
      dragState.hoverGroupIndex = dragState.fromGroupIndex;
      updateVisuals();
    }
    var points = pointFromLocalPosition(widget, position);
    for (var p = 0; p < points.length; p++) {
      var point = points[p];
      if (dragState.dragType === "group") {
        for (var g = 0; g < dragState.hitGroupEntries.length; g++) {
          var groupEntry = dragState.hitGroupEntries[g];
          if (geometryContainsPoint(groupEntry.geo, point)) {
            dragState.hoverGroupIndex = groupEntry.groupIndex;
            var groupInsertIndex = verticalInsertIndexFromPoint(
              groupEntry.geo,
              point,
              groupEntry.groupIndex,
              position,
            );
            if (groupInsertIndex !== null) {
              hoverGroupDragTarget(groupInsertIndex);
            }
            dragState.lastPosition = point;
            updateVisuals();
            return true;
          }
        }
      } else if (dragState.dragType === "item") {
        for (var i = 0; i < dragState.hitItemEntries.length; i++) {
          var itemEntry = dragState.hitItemEntries[i];
          if (geometryContainsPoint(itemEntry.geo, point)) {
            dragState.hoverGroupId = itemEntry.groupId;
            dragState.hoverItemIndex = itemEntry.itemIndex;
            var itemInsertIndex = horizontalInsertIndexFromPoint(
              itemEntry.geo,
              point,
              itemEntry.itemIndex,
            );
            if (itemInsertIndex !== null) {
              hoverItemDragTarget(itemEntry.groupId, itemInsertIndex);
            }
            dragState.lastPosition = point;
            updateVisuals();
            return true;
          }
        }
        for (var h = 0; h < dragState.hitGroupEntries.length; h++) {
          var targetGroup = dragState.hitGroupEntries[h];
          if (geometryContainsPoint(targetGroup.geo, point)) {
            var itemCount = getGroupItemCount(targetGroup.groupId);
            var insertIndex = getItemInsertIndex(targetGroup, point);

            dragState.didDrag = true;
            dragState.toGroupId = targetGroup.groupId;
            dragState.toItemIndex = insertIndex;
            dragState.hoverGroupId = targetGroup.groupId;
            if (itemCount > 0) {
              dragState.hoverItemIndex =
                insertIndex >= itemCount ? itemCount - 1 : insertIndex;
            } else {
              dragState.hoverGroupId = null;
              dragState.hoverItemIndex = -1;
            }

            dragState.lastPosition = point;
            updateVisuals();
            return true;
          }
        }
      }
    }
    return false;
  }

  function startGroupDrag(groupIndex, widget, position) {
    if (dragState.dragType) return;
    dragState.dragType = "group";
    dragState.didDrag = false;
    dragState.startWidget = widget || null;
    dragState.startPosition = position || null;
    dragState.startGeometry = getWidgetGeometry(widget);
    dragState.lastPosition = null;
    dragState.fromGroupIndex = groupIndex;
    dragState.toGroupIndex = groupIndex;
    captureDragHitGeometry();
    updateVisuals();
  }

  function startItemDrag(groupId, itemIndex, widget, position) {
    if (dragState.dragType) return;
    dragState.dragType = "item";
    dragState.didDrag = false;
    dragState.startWidget = widget || null;
    dragState.startPosition = position || null;
    dragState.startGeometry = getWidgetGeometry(widget);
    dragState.lastPosition = null;
    dragState.fromGroupId = groupId;
    dragState.fromItemIndex = itemIndex;
    dragState.toGroupId = groupId;
    dragState.toItemIndex = itemIndex;
    captureDragHitGeometry();
    updateVisuals();
  }

  function completeDrag() {
    if (!dragState.dragType) return;
    var type = dragState.dragType;
    var didDrag = dragState.didDrag;
    var fromGroupId = dragState.fromGroupId;
    var fromItemIndex = dragState.fromItemIndex;
    var toGroupId = dragState.toGroupId;
    var toItemIndex = dragState.toItemIndex;
    var fromGroupIndex = dragState.fromGroupIndex;
    var toGroupIndex = dragState.toGroupIndex;
    resetDragState();
    if (!didDrag) {
      if (onRebuild) onRebuild();
      return false;
    }
    if (type === "item" && onItemMoved) {
      return onItemMoved(fromGroupId, fromItemIndex, toGroupId, toItemIndex);
    }
    if (type === "group" && onGroupMoved) {
      return onGroupMoved(fromGroupIndex, toGroupIndex);
    }
    if (onRebuild) onRebuild();
    return false;
  }

  function getOffsetBetweenWidgets(widget, parentWidget, defaultDx, defaultDy) {
    var widgetGeo = getWidgetGeometry(widget);
    var parentGeo = getWidgetGeometry(parentWidget);
    if (widgetGeo && parentGeo) {
      var widgetLeft =
        widgetGeo.left !== undefined ? widgetGeo.left : widgetGeo.x;
      var parentLeft =
        parentGeo.left !== undefined ? parentGeo.left : parentGeo.x;
      var widgetBottom =
        widgetGeo.bottom !== undefined
          ? widgetGeo.bottom
          : widgetGeo.y + widgetGeo.height;
      var parentBottom =
        parentGeo.bottom !== undefined
          ? parentGeo.bottom
          : parentGeo.y + parentGeo.height;
      return {
        dx: widgetLeft - parentLeft,
        dy: parentBottom - widgetBottom,
      };
    }
    return { dx: defaultDx, dy: defaultDy };
  }

  function translateChildPosition(childWidget, parentWidget, position, dx, dy) {
    var offset = getOffsetBetweenWidgets(childWidget, parentWidget, dx, dy);
    return {
      x: position.x + offset.dx,
      y: position.y + offset.dy,
    };
  }

  function focusPointer() {
    if (onPointerFocus) onPointerFocus();
  }

  function getItemEntry(groupId, itemIndex) {
    for (var i = 0; i < dragState.itemEntries.length; i++) {
      var entry = dragState.itemEntries[i];
      if (entry.groupId === groupId && entry.itemIndex === itemIndex) {
        return entry;
      }
    }
    return null;
  }

  function attachGroupDragHandlers(widget, groupIndex, groupId) {
    widget.onMousePress = function (position, button) {
      focusPointer();
      if (button !== "left") return;
      startGroupDrag(groupIndex, widget, position);
    };
    widget.onMouseMove = function (position) {
      updateTargetFromPointer(widget, position);
    };
    widget.onMouseEnter = function () {};
    widget.onMouseRelease = function (position, button) {
      if (button === "right") {
        if (onGroupContextMenu) onGroupContextMenu(groupId);
        return;
      }
      if (button !== "left") return;
      updateTargetFromPointer(widget, position);
      if (dragState.dragType) completeDrag();
    };
  }

  function attachGroupChildDragHandlers(
    childWidget,
    parentWidget,
    groupIndex,
    groupId,
    defaultDx,
    defaultDy,
  ) {
    childWidget.onMousePress = function (position, button) {
      focusPointer();
      if (button !== "left") return;
      startGroupDrag(
        groupIndex,
        parentWidget,
        translateChildPosition(childWidget, parentWidget, position, defaultDx, defaultDy),
      );
    };
    childWidget.onMouseMove = function (position) {
      updateTargetFromPointer(
        parentWidget,
        translateChildPosition(childWidget, parentWidget, position, defaultDx, defaultDy),
      );
    };
    childWidget.onMouseEnter = function () {};
    childWidget.onMouseRelease = function (position, button) {
      if (button === "right") {
        if (onGroupContextMenu) onGroupContextMenu(groupId);
        return;
      }
      if (button !== "left") return;
      updateTargetFromPointer(
        parentWidget,
        translateChildPosition(childWidget, parentWidget, position, defaultDx, defaultDy),
      );
      if (dragState.dragType) completeDrag();
    };
  }

  function attachItemDragHandlers(widget, groupId, itemIndex, callbacks) {
    callbacks = callbacks || {};
    widget.onMousePress = function (position, button) {
      focusPointer();
      if (button !== "left") return;
      if (callbacks.onPress) callbacks.onPress(widget, position, button);
      if (dragState.dragType && !dragState.didDrag) {
        resetDragState();
      }
      startItemDrag(groupId, itemIndex, widget, position);
    };
    widget.onMouseMove = function (position) {
      if (dragState.dragType !== "item") return;
      updateTargetFromPointer(widget, position);
    };
    widget.onMouseEnter = function () {};
    widget.onMouseRelease = function (position, button) {
      if (button === "right") {
        resetDragState();
        if (onItemContextMenu) {
          onItemContextMenu(groupId, itemIndex, getItemEntry(groupId, itemIndex));
        }
        return;
      }
      if (button !== "left") return;
      if (dragState.dragType !== "item") return;

      var isClick = !dragState.didDrag && !pointerMovedEnough(position);
      if (isClick) {
        resetDragState();
        if (callbacks.onClick) callbacks.onClick(widget, position);
        return;
      }

      updateTargetFromPointer(widget, position);
      completeDrag();
    };
  }

  function attachItemChildDragHandlers(
    childWidget,
    parentWidget,
    groupId,
    itemIndex,
    defaultDx,
    defaultDy,
    callbacks,
  ) {
    callbacks = callbacks || {};
    attachItemDragHandlers(childWidget, groupId, itemIndex, {
      onPress: function () {
        if (callbacks.onPress) callbacks.onPress(parentWidget);
      },
      onClick: function () {
        if (callbacks.onClick) callbacks.onClick(parentWidget);
      },
    });

    childWidget.onMousePress = function (position, button) {
      focusPointer();
      if (button !== "left") return;
      if (callbacks.onPress) callbacks.onPress(parentWidget);
      if (dragState.dragType && !dragState.didDrag) {
        resetDragState();
      }
      startItemDrag(
        groupId,
        itemIndex,
        parentWidget,
        translateChildPosition(childWidget, parentWidget, position, defaultDx, defaultDy),
      );
    };
    childWidget.onMouseMove = function (position) {
      if (dragState.dragType !== "item") return;
      updateTargetFromPointer(
        parentWidget,
        translateChildPosition(childWidget, parentWidget, position, defaultDx, defaultDy),
      );
    };
    childWidget.onMouseRelease = function (position, button) {
      var translatedPosition = translateChildPosition(
        childWidget,
        parentWidget,
        position,
        defaultDx,
        defaultDy,
      );
      if (button === "right") {
        resetDragState();
        if (onItemContextMenu) {
          onItemContextMenu(groupId, itemIndex, getItemEntry(groupId, itemIndex));
        }
        return;
      }
      if (button !== "left") return;
      if (dragState.dragType !== "item") return;

      var isClick = !dragState.didDrag && !pointerMovedEnough(translatedPosition);
      if (isClick) {
        resetDragState();
        if (callbacks.onClick) callbacks.onClick(parentWidget);
        return;
      }

      updateTargetFromPointer(parentWidget, translatedPosition);
      completeDrag();
    };
  }

  return {
    dragState: dragState,
    resetDragState: resetDragState,
    registerGroup: registerGroup,
    registerItem: registerItem,
    createGridLayout: createGridLayout,
    createGridItem: createGridItem,
    setItemSelected: setItemSelected,
    highlightItem: highlightItem,
    updateVisuals: updateVisuals,
    applyItemStyle: applyItemStyle,
    applyGroupStyle: applyGroupStyle,
    getWidgetGeometry: getWidgetGeometry,
    pointFromLocalPosition: pointFromLocalPosition,
    pointerMovedEnough: pointerMovedEnough,
    startGroupDrag: startGroupDrag,
    startItemDrag: startItemDrag,
    updateTargetFromPointer: updateTargetFromPointer,
    completeDrag: completeDrag,
    getOffsetBetweenWidgets: getOffsetBetweenWidgets,
    translateChildPosition: translateChildPosition,
    attachGroupDragHandlers: attachGroupDragHandlers,
    attachGroupChildDragHandlers: attachGroupChildDragHandlers,
    attachItemDragHandlers: attachItemDragHandlers,
    attachItemChildDragHandlers: attachItemChildDragHandlers,
  };
}
