/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useCallback, useContext, useMemo, useState } from "react";
import { Text, View, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VaultScreenStylesRoot } from "../styles/styles";
import GetStartedCard from "./GetStartedScreen/GetStartedCard";
import { DarkModeContext } from "../utils/DeviceContext";
import { RUNTIME_GATEWAY } from "../env/runtimeGateway";

const GetStartedScreen = ({ onGetStarted, onOpenGeneral, onScreenFocus }) => {
  const { isDarkMode } = useContext(DarkModeContext);
  const VaultScreenStyle = VaultScreenStylesRoot(isDarkMode);
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [screenHeight, setScreenHeight] = useState(0);
  const [cardContainerTop, setCardContainerTop] = useState(0);
  const [cardLayout, setCardLayout] = useState({ y: 0, height: 0 });
  const [bottomActionsTop, setBottomActionsTop] = useState(0);
  const bottomActionButtonSize = 70;
  const bottomActionBottom = Math.max(insets.bottom + 18, 34);
  const topContentPadding = Math.max(insets.top + 48, 92);
  const floatingIconColor = isDarkMode ? "#FFFFFF" : "#676776";
  const floatingButtonSurface = isDarkMode ? "#4B4642" : "#FFFFFF";
  const floatingButtonBorder = isDarkMode
    ? "rgba(255,255,255,0.14)"
    : "rgba(0,0,0,0.08)";

  const handleContinue = useCallback(() => {
    if (typeof onGetStarted === "function") {
      onGetStarted();
    }
  }, [onGetStarted]);

  const handlePurchasePress = useCallback(() => {
    Linking.openURL(`${RUNTIME_GATEWAY.siteOrigin}/lukkey`).catch(() => {});
  }, []);

  const handleGeneralPress = useCallback(() => {
    if (typeof onOpenGeneral === "function") {
      onOpenGeneral();
      return;
    }
    navigation.navigate("StandaloneGeneral");
  }, [navigation, onOpenGeneral]);

  useFocusEffect(
    useCallback(() => {
      onScreenFocus?.();
    }, [onScreenFocus]),
  );

  const hintAreaStyle = useMemo(() => {
    if (!screenHeight || !cardLayout.height) return { flex: 1 };
    const measuredBottomActionTop = bottomActionsTop || 0;
    const fallbackBottomActionTop =
      screenHeight - bottomActionBottom - bottomActionButtonSize;
    const bottomActionTop =
      measuredBottomActionTop > 0
        ? measuredBottomActionTop
        : fallbackBottomActionTop;
    const cardBottom = cardContainerTop + cardLayout.y + cardLayout.height;
    const remaining = Math.max(0, bottomActionTop - cardBottom);
    return {
      flex: 0,
      height: remaining,
      justifyContent: "center",
      alignItems: "center",
    };
  }, [
    bottomActionsTop,
    bottomActionBottom,
    bottomActionButtonSize,
    cardContainerTop,
    cardLayout,
    screenHeight,
  ]);

  return (
    <LinearGradient
      colors={isDarkMode ? ["#21201E", "#0E0D0D"] : ["#FFFFFF", "#EDEBEF"]}
      style={[
        VaultScreenStyle.linearGradient,
        { alignItems: "stretch", justifyContent: "flex-start" },
      ]}
      onLayout={(e) => {
        setScreenHeight(e.nativeEvent.layout.height);
      }}
    >
      <View
        style={[
          VaultScreenStyle.emptyWalletPage,
          { height: "100%", paddingTop: topContentPadding },
        ]}
      >
        <View
          style={VaultScreenStyle.emptyWltCont}
          onLayout={(e) => {
            setCardContainerTop(e.nativeEvent.layout.y);
          }}
        >
          <GetStartedCard
            isDarkMode={isDarkMode}
            VaultScreenStyle={VaultScreenStyle}
            handleContinue={handleContinue}
            t={t}
            containerStyle={{ flex: 0 }}
            onCardLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              setCardLayout((prev) =>
                prev.y === y && prev.height === height
                  ? prev
                  : { y, height },
              );
            }}
          />
        </View>
        <View style={[VaultScreenStyle.getStartedHintArea, hintAreaStyle]}>
          <Text style={VaultScreenStyle.getStartedHintText}>
            {`${t("Set up your device")}\n${t(
              "Tap the {{getStarted}} card above to connect via Bluetooth",
              { getStarted: t("Get Started") },
            )}`}
          </Text>
        </View>
        <View
          pointerEvents="box-none"
          style={[styles.bottomActions, { bottom: bottomActionBottom }]}
          onLayout={(e) => {
            setBottomActionsTop(e.nativeEvent.layout.y);
          }}
        >
          <TouchableOpacity
            onPress={handlePurchasePress}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t("Purchase Now")}
            style={[
              styles.floatingActionButton,
              {
                backgroundColor: floatingButtonSurface,
                borderColor: floatingButtonBorder,
              },
            ]}
          >
            <Icon name="shopping-outline" size={28} color={floatingIconColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleGeneralPress}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t("General")}
            style={[
              styles.floatingActionButton,
              {
                backgroundColor: floatingButtonSurface,
                borderColor: floatingButtonBorder,
              },
            ]}
          >
            <Icon name="cog-outline" size={30} color={floatingIconColor} />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  bottomActions: {
    position: "absolute",
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floatingActionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 6,
  },
});

export default GetStartedScreen;
