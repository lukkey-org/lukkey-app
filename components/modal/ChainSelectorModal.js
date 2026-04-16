/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// modal/ChainSelectorModal.js
import React, { useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { BlurView } from "../common/AppBlurView";
import { resolveChainIcon } from "../../utils/assetIconResolver";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const ChainSelectorModal = ({
  isVisible,
  onClose,
  selectedChain,
  handleSelectChain,
  cards = [],
  isDarkMode,
  t,
  mode = "assets",
}) => {
  const AnimatedTouchableWithScale = (props) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    };

    return (
      <AnimatedTouchable
        {...props}
        onPressIn={(e) => {
          onPressIn();
          if (props.onPressIn) props.onPressIn(e);
        }}
        onPressOut={(e) => {
          onPressOut();
          if (props.onPressOut) props.onPressOut(e);
        }}
        style={[props.style, { transform: [{ scale: scaleAnim }] }]}
      >
        {props.children}
      </AnimatedTouchable>
    );
  };

  const keyField = "queryChainShortName";
  const modalBg = isDarkMode ? "#4B4642" : "#FFFFFF";
  const list = Array.from(
    new Map(
      (Array.isArray(cards) ? cards : [])
        .filter((card) => card && card[keyField])
        .map((card) => [card[keyField], card])
    ).values()
  ).sort((a, b) =>
    String(a?.[keyField] || "").localeCompare(String(b?.[keyField] || ""))
  );

  const Button = mode === "assets" ? AnimatedTouchableWithScale : TouchableOpacity;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1 }}>
          <BlurView
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                margin: 20,
                height: 500,
                width: "90%",
                borderRadius: 36,
                padding: 20,
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: modalBg,
              }}
              onStartShouldSetResponder={() => true}
            >
              <ScrollView
                contentContainerStyle={{ alignItems: "center" }}
                style={{ maxHeight: 500, width: "100%", borderRadius: 16 }}
              >
                <Button
                  onPress={() => handleSelectChain("All")}
                  style={{
                    padding: 10,
                    width: "100%",
                    justifyContent: "center",
                    borderRadius: 16,
                    height: 60,
                    alignItems: "center",
                    marginBottom: 8,
                    backgroundColor:
                      selectedChain === "All"
                        ? isDarkMode
                          ? "#CCB68C"
                          : "#CFAB95"
                        : isDarkMode
                        ? "#21201E"
                        : "#e0e0e0",
                    flexDirection: "row",
                  }}
                >
                  <Image
                    source={require("../../assets/branding/AssetsScreenLogo.webp")}
                    style={{
                      width: 24,
                      height: 24,
                      marginRight: 8,
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      borderRadius: 12,
                    }}
                  />
                  <Text
                    style={{
                      color:
                        selectedChain === "All"
                          ? isDarkMode
                            ? "#FFFFFF"
                            : "#ffffff"
                          : isDarkMode
                          ? "#DDDDDD"
                          : "#000000",
                    }}
                  >
                    {t("All Chains")}
                  </Text>
                </Button>

                {list.map((card, index) => {
                  const key = card?.[keyField];
                  const label = card?.queryChainName
                    ? card.queryChainName.charAt(0).toUpperCase() +
                      card.queryChainName.slice(1)
                    : "";
                  const resolvedChainIcon = resolveChainIcon(
                    card?.queryChainName,
                  );
                  return (
                    <Button
                      key={`${key}-${index}`}
                      onPress={() => handleSelectChain(key)}
                      style={{
                        padding: 10,
                        width: "100%",
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 16,
                        height: 60,
                        flexDirection: "row",
                        marginBottom: 8,
                        backgroundColor:
                          selectedChain === key
                            ? isDarkMode
                              ? "#CCB68C"
                              : "#CFAB95"
                            : isDarkMode
                            ? "#21201E"
                            : "#e0e0e0",
                      }}
                    >
                      {resolvedChainIcon && (
                        <Image
                          source={resolvedChainIcon}
                          style={{
                            width: 24,
                            height: 24,
                            marginRight: 8,
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                            borderRadius: 12,
                          }}
                        />
                      )}
                      <Text
                        style={{
                          color:
                            selectedChain === key
                              ? isDarkMode
                                ? "#FFFFFF"
                                : "#ffffff"
                              : isDarkMode
                              ? "#DDDDDD"
                              : "#000000",
                        }}
                      >
                        {label ? `${label} ${t("Chain")}` : ""}
                      </Text>
                    </Button>
                  );
                })}
              </ScrollView>
            </View>
          </BlurView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ChainSelectorModal;
