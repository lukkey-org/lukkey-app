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

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {isModalVisible ? (
        <TouchableOpacity style={{ paddingRight: 16 }} onPress={onOpenSettings}>
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
            style={isGalleryView ? { paddingRight: 16 } : { marginRight: 12 }}
          >
            <Icon name="access-time" size={24} color={iconColor} />
          </TouchableOpacity>
          {!isGalleryView ? (
            <TouchableOpacity onPress={onAddItem} style={{ paddingRight: 16 }}>
              <Icon name="add" size={24} color={iconColor} />
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
