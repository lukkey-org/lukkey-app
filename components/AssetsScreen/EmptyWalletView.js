/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { RUNTIME_DEV } from "../../utils/runtimeFlags";

const EmptyWalletView = ({
  isDarkMode,
  VaultScreenStyle,
  handleContinue,
  handleWalletTest,
  t,
  containerStyle,
  onCardLayout,
}) => {
  // animation value
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const imageSource = isDarkMode
    ? require("../../assets/videos/darkModeBg.webp")
    : require("../../assets/videos/LightModeBg.webp");

  // Click animation: 0.9 -> 1.1 -> 1
  const handlePressIn = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97, // Reduce the size smaller
        duration: 100, // Slow down
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = (onDone) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.03,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDone && onDone(); // Execute after animation ends
    });
  };

  return (
    <View style={[VaultScreenStyle.centeredContent, containerStyle]}>
      <Animated.View
        onLayout={onCardLayout}
        style={[
          VaultScreenStyle.addWalletImage,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={imageSource}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.06 }] }]}
          contentFit="cover"
          contentPosition="center"
          autoplay={true}
        />
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPressOut={() => handlePressOut()}
          onPress={() => {
            if (RUNTIME_DEV) {
              handleWalletTest && handleWalletTest();
            } else {
              handleContinue && handleContinue();
            }
          }}
          style={VaultScreenStyle.addWalletButton}
          activeOpacity={0.8}
        >
          <Text style={VaultScreenStyle.addWltBtnTxt}>
            {t("Get Started")}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default EmptyWalletView;
