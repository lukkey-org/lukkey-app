/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

export default function GeneralHeaderActions({
  navigation,
  iconColor,
  hasUnread,
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingRight: 16,
      }}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate("ActivityLog")}
        style={{ marginRight: 12 }}
      >
        <Icon name="access-time" size={24} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
        <View style={{ position: "relative" }}>
          <Icon name="notifications-none" size={24} color={iconColor} />
          {hasUnread ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#ef4444",
              }}
            />
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}
