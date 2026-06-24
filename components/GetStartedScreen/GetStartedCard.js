/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";

const GetStartedCard = ({
  isDarkMode,
  VaultScreenStyle,
  handleContinue,
  t,
  containerStyle,
  onCardLayout,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const imageSource = isDarkMode
    ? require("../../assets/videos/darkModeBg.webp")
    : require("../../assets/videos/LightModeBg.webp");

  const handlePressIn = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
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
    ]).start();
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
          autoplay
        />
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => {
            handleContinue?.();
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

export default GetStartedCard;
