/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// VaultHeaderToggle.js
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

const VaultHeaderToggle = ({ selectedView, onSelect, isDarkMode, t }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 20,
    }}
  >
    <TouchableOpacity
      style={{
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor:
          selectedView === "wallet"
            ? isDarkMode
              ? "#555"
              : "#F7f7f7"
            : "transparent",

        alignItems: "center",
        justifyContent: "center",
      }}
      onPress={() => onSelect("wallet")}
    >
      <Text
        style={{
          fontWeight: "bold",
          color:
            selectedView === "wallet" ? (isDarkMode ? "#fff" : "#000") : "#888",
        }}
      >
        {t("Assets")}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={{
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor:
          selectedView === "gallery"
            ? isDarkMode
              ? "#555"
              : "#F7f7f7"
            : "transparent",

        alignItems: "center",
        justifyContent: "center",
      }}
      onPress={() => onSelect("gallery")}
    >
      <Text
        style={{
          fontWeight: "bold",
          color:
            selectedView === "gallery"
              ? isDarkMode
                ? "#fff"
                : "#000"
              : "#888",
        }}
      >
        {t("Gallery")}
      </Text>
    </TouchableOpacity>
  </View>
);

export default VaultHeaderToggle;
