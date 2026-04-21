/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useCallback, useContext, useMemo, useState } from "react";
import { Text, View, TouchableOpacity, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { VaultScreenStylesRoot, makeSharedPrimitives } from "../styles/styles";
import EmptyWalletView from "./AssetsScreen/EmptyWalletView";
import { DarkModeContext } from "../utils/DeviceContext";

const GetStartedScreen = ({ onScreenFocus }) => {
  const { isDarkMode } = useContext(DarkModeContext);
  const VaultScreenStyle = VaultScreenStylesRoot(isDarkMode);
  const themePrimitives = makeSharedPrimitives(isDarkMode);
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [screenHeight, setScreenHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [cardTop, setCardTop] = useState(0);
  const tabBarHeight = 100;

  const handleWalletTest = useCallback(() => {
    navigation.navigate("AddItem");
  }, [navigation]);

  const handleContinue = useCallback(() => {
    navigation.navigate("AddItem");
  }, [navigation]);

  const handlePurchasePress = useCallback(() => {
    Linking.openURL("https://lukkey.com/lukkey").catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      onScreenFocus?.();
    }, [onScreenFocus]),
  );

  const hintAreaStyle = useMemo(() => {
    if (!screenHeight || !cardHeight) return { flex: 1 };
    const remaining = Math.max(
      0,
      screenHeight - tabBarHeight - (cardTop + cardHeight),
    );
    return { height: remaining };
  }, [cardHeight, cardTop, screenHeight, tabBarHeight]);

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
      <View style={[VaultScreenStyle.emptyWalletPage, { height: "100%" }]}>
        <View
          style={VaultScreenStyle.emptyWltCont}
          onLayout={(e) => {
            setCardTop(e.nativeEvent.layout.y);
          }}
        >
          <EmptyWalletView
            isDarkMode={isDarkMode}
            VaultScreenStyle={VaultScreenStyle}
            handleContinue={handleContinue}
            handleWalletTest={handleWalletTest}
            t={t}
            containerStyle={{ flex: 0 }}
            onCardLayout={(e) => {
              setCardHeight(e.nativeEvent.layout.height);
            }}
          />
        </View>
        <View style={[VaultScreenStyle.getStartedHintArea, hintAreaStyle]}>
          <Text style={VaultScreenStyle.getStartedHintText}>
            {`${t("Set up your device")}\n${t(
              "Connect via Bluetooth to get started",
            )}`}
          </Text>
          <View
            style={{
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                lineHeight: 20,
                textAlign: "center",
                color: isDarkMode ? "#A1A1AA" : "#9A9AA6",
              }}
              numberOfLines={1}
            >
              {`${t("If you don't have a Lukkey,")} `}
            </Text>
            <TouchableOpacity
              onPress={handlePurchasePress}
              activeOpacity={0.8}
              style={{ marginLeft: 6 }}
            >
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  fontWeight: "700",
                  color: themePrimitives.brandPrimary,
                }}
                numberOfLines={1}
              >
                {t("Purchase Now")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

export default GetStartedScreen;
