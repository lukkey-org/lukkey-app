/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useMemo } from "react";
import { TextInput, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const toFixedSafe = (value, decimals) => {
  "worklet";
  const d = Number.isFinite(decimals) ? Math.max(0, decimals) : 0;
  if (!Number.isFinite(value)) return d > 0 ? (0).toFixed(d) : "0";
  return d > 0 ? value.toFixed(d) : `${Math.round(value)}`;
};

const CountUpText = ({
  value,
  decimals = 2,
  duration = 700,
  startFrom = 0,
  style,
  pointerEvents = "none",
}) => {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const start = Number.isFinite(Number(startFrom)) ? Number(startFrom) : 0;
  const shared = useSharedValue(start);

  const animatedProps = useAnimatedProps(() => ({
    text: toFixedSafe(shared.value, decimals),
  }));

  useEffect(() => {
    shared.value = withTiming(target, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [duration, shared, target]);

  const defaultText = useMemo(
    () => toFixedSafe(start, decimals),
    [decimals, start]
  );

  return (
    <AnimatedTextInput
      editable={false}
      focusable={false}
      caretHidden
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      defaultValue={defaultText}
      pointerEvents={pointerEvents}
      style={[styles.text, style]}
      animatedProps={animatedProps}
    />
  );
};

const styles = StyleSheet.create({
  text: {
    padding: 0,
    margin: 0,
  },
});

export default CountUpText;
