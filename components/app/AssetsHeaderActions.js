/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import { TouchableOpacity, View, Text } from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

export default function AssetsHeaderActions({
  isModalVisible,
  isCardEditMode,
  selectedView,
  headerCardsLength,
  iconColor,
  headerEdgePadding = 16,
  t,
  onOpenSettings,
  onOpenActivityLog,
  onAddItem,
  onDone,
}) {
  const isGalleryView = selectedView === "gallery";
  const iconHitSlop = { top: 12, right: 12, bottom: 12, left: 12 };
  const headerIconButton = {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {isModalVisible ? (
        <TouchableOpacity
          hitSlop={iconHitSlop}
          activeOpacity={0.7}
          style={[headerIconButton, { marginRight: 2 }]}
          onPress={onOpenSettings}
        >
          <Icon name="settings" size={24} color={iconColor} />
        </TouchableOpacity>
      ) : isCardEditMode ? (
        <TouchableOpacity
          style={{ paddingRight: headerEdgePadding }}
          onPress={onDone}
          accessibilityLabel={t("Done")}
          accessibilityRole="button"
        >
          <Text style={{ color: iconColor, fontSize: 16, fontWeight: "600" }}>
            {t("Done")}
          </Text>
        </TouchableOpacity>
      ) : headerCardsLength > 0 ? (
        <>
          <TouchableOpacity
            onPress={onOpenActivityLog}
            hitSlop={iconHitSlop}
            activeOpacity={0.7}
            style={[
              headerIconButton,
              isGalleryView ? { marginRight: 2 } : { marginRight: 4 },
            ]}
          >
            <Icon name="access-time" size={24} color={iconColor} />
          </TouchableOpacity>
          {!isGalleryView ? (
            <TouchableOpacity
              onPress={onAddItem}
              hitSlop={iconHitSlop}
              activeOpacity={0.7}
              style={[headerIconButton, { marginRight: 2 }]}
            >
              <Icon name="add" size={24} color={iconColor} />
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
