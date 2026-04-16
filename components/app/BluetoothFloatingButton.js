/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useRef } from "react";
import {
  Animated,
  TouchableWithoutFeedback,
  Vibration,
  View,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { Path, Svg } from "react-native-svg";

export default function BluetoothFloatingButton({
  visible,
  bottomBackgroundColor,
  buttonColor,
  onPress,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Vibration.vibrate();
      onPress?.();
    });
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 70,
        left: "50%",
        transform: [{ translateX: -35 }],
        zIndex: 10,
      }}
    >
      <Svg
        width={156}
        height={45}
        viewBox="0 0 156 44.5"
        preserveAspectRatio="none"
        style={{
          left: "50%",
          transform: [{ translateX: -78 }],
          position: "absolute",
          bottom: -15,
        }}
      >
        <Path
          d="M155.999998,0 C155.960048,5.2271426e-05 155.920029,0 155.879998,0 C138.607292,0 123.607522,9.73159464 116.064456,24.011016 L116.072109,24.0008284 C108.100611,36.6193737 94.0290043,45 77.9999979,45 C61.9756639,45 47.9075891,36.6242589 39.9348591,24.0118622 C32.3924733,9.73159464 17.3927034,0 0.119997873,0 L0,0.001 L155.999998,0 Z"
          fill={bottomBackgroundColor}
        />
      </Svg>
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: buttonColor,
            justifyContent: "center",
            alignItems: "center",
            transform: [{ scale }],
          }}
        >
          <Icon name="bluetooth" size={24} color="#fff" />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}
