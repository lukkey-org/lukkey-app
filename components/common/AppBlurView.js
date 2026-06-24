/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView as ExpoBlurView } from "expo-blur";

/**
 * Unified BlurView encapsulation:
 * - Android cannot reliably display blur, instead using a translucent black background
 * - iOS still uses BlurView
 * - intensity defaults to 20 (can be overridden externally)
 * - Overlay a black mask with 5% transparency over the blurred area
 *
 * Usage:
 *   import { BlurView } from "../common/AppBlurView";
 *   <BlurView style={...}>...</BlurView>
 */
export const BlurView = ({
  style,
  children,
  intensity = 20,
  overlayColor = "rgba(0,0,0,0.05)",
  androidFallbackColor = "rgba(0,0,0,0.3)",
  ...rest
}) => {
  if (Platform.OS === "android") {
    return (
      <View style={[style, { backgroundColor: androidFallbackColor }]}>
        {children}
      </View>
    );
  }
  return (
    <ExpoBlurView {...rest} style={style} intensity={intensity}>
      {/* Overlay a 5% black mask below the content and above the blur layer */}
      {overlayColor ? (
        <View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: overlayColor }]}
        />
      ) : null}
      {children}
    </ExpoBlurView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
});

export default BlurView;
