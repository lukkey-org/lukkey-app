/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, PanResponder } from "react-native";
import Constants from "expo-constants";
import Svg, { Circle } from "react-native-svg";

const DevToast = ({
  visible = true,
  isDarkMode = false,
  message = "",
  gifSource,
  variant = "info",
  autoHideDurationMs = 0,
  showCountdown = false,
  onHide,
}) => {
  const [isVisible, setIsVisible] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const dismissingRef = useRef(false);
  const timerRef = useRef(null);
  const activeAnimationRef = useRef(null);
  const translateYRef = useRef(0);
  const opacityRef = useRef(1);

  const clearDismissTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopActiveAnimation = () => {
    if (activeAnimationRef.current) {
      activeAnimationRef.current.stop();
      activeAnimationRef.current = null;
    }
  };

  const startActiveAnimation = (animation, callback) => {
    stopActiveAnimation();
    activeAnimationRef.current = animation;
    animation.start((result) => {
      if (activeAnimationRef.current === animation) {
        activeAnimationRef.current = null;
      }
      callback?.(result);
    });
  };

  const pauseToastAnimations = () => {
    clearDismissTimer();
    stopActiveAnimation();
    translateY.stopAnimation();
    opacity.stopAnimation();
    progress.stopAnimation();
  };

  const finishHide = () => {
    clearDismissTimer();
    stopActiveAnimation();
    setIsVisible(false);
    onHide && onHide();
  };

  const requestDismiss = ({ currentY, currentOpacity } = {}) => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    clearDismissTimer();
    stopActiveAnimation();
    const nextY =
      typeof currentY === "number" ? currentY : translateYRef.current;
    const nextOpacity =
      typeof currentOpacity === "number" ? currentOpacity : opacityRef.current;
    translateY.setValue(nextY);
    opacity.setValue(nextOpacity);
    translateYRef.current = nextY;
    opacityRef.current = nextOpacity;
    startActiveAnimation(
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: Math.min(nextY - 56, -56),
          duration: 135,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 135,
          useNativeDriver: true,
        }),
      ]),
      ({ finished }) => {
        if (!finished) return;
        finishHide();
      },
    );
  };

  const scheduleDismiss = () => {
    clearDismissTimer();
    if (!autoHideDurationMs) return;
    timerRef.current = setTimeout(() => {
      requestDismiss();
    }, autoHideDurationMs);
  };

  useEffect(() => {
    setIsVisible(visible);
    if (visible) {
      dismissingRef.current = false;
      clearDismissTimer();
      translateY.setValue(-18);
      opacity.setValue(0);
      translateYRef.current = -18;
      opacityRef.current = 0;
      startActiveAnimation(
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            speed: 20,
            bounciness: 4,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      );
    }
  }, [visible]);

  useEffect(() => {
    if (!isVisible) return undefined;
    if (!autoHideDurationMs) return undefined;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: autoHideDurationMs,
      useNativeDriver: false,
    }).start();
    scheduleDismiss();
    return () => clearDismissTimer();
  }, [isVisible, autoHideDurationMs, progress]);

  const variants = {
    info: {
      dark: { bg: "#4B4642", border: "#CCB68C", text: "#FFFFFF" },
      light: { bg: "#FFFFFF", border: "#CFAB95", text: "#21201E" },
    },
    success: {
      dark: { bg: "#4B4642", border: "#22C55E", text: "#FFFFFF" },
      light: { bg: "#FFFFFF", border: "#22C55E", text: "#21201E" },
    },
    cancel: {
      dark: { bg: "#4B4642", border: "#FF5252", text: "#FFFFFF" },
      light: { bg: "#FFFFFF", border: "#FF5252", text: "#21201E" },
    },
  };

  const palette = variants[variant] || variants.info;
  const colors = isDarkMode ? palette.dark : palette.light;
  const ringColor = colors.border;
  const ringSize = 28;
  const ringStroke = 3;
  const radius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference],
  });
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 1,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 1,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        if (dismissingRef.current) return;
        pauseToastAnimations();
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (dismissingRef.current) return;
        if (gestureState.dy >= 0) return;
        translateY.setValue(gestureState.dy);
        translateYRef.current = gestureState.dy;
        const nextOpacity = 1 - Math.min(Math.abs(gestureState.dy) / 72, 0.6);
        opacity.setValue(nextOpacity);
        opacityRef.current = nextOpacity;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (dismissingRef.current) return;
        if (gestureState.dy < -6 || gestureState.vy < -0.12) {
          requestDismiss({
            currentY: gestureState.dy,
            currentOpacity:
              1 - Math.min(Math.abs(gestureState.dy) / 72, 0.6),
          });
          return;
        }
        startActiveAnimation(
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 28,
              bounciness: 4,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 110,
              useNativeDriver: true,
            }),
          ]),
          () => {
            translateYRef.current = 0;
            opacityRef.current = 1;
            scheduleDismiss();
          },
        );
      },
      onPanResponderTerminate: () => {
        if (dismissingRef.current) return;
        startActiveAnimation(
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 28,
              bounciness: 4,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 110,
              useNativeDriver: true,
            }),
          ]),
          () => {
            translateYRef.current = 0;
            opacityRef.current = 1;
            scheduleDismiss();
          },
        );
      },
    }),
  ).current;

  if (!isVisible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: Constants.statusBarHeight + 8 }]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.toast,
          {
            backgroundColor: colors.bg,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {showCountdown ? (
          <View style={styles.ringWrap}>
            <Svg width={ringSize} height={ringSize} style={styles.ring}>
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke={ringColor}
                strokeOpacity={0.2}
                strokeWidth={ringStroke}
                fill="none"
              />
              <AnimatedCircle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke={ringColor}
                strokeWidth={ringStroke}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </Svg>
          </View>
        ) : null}
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 1000,
    alignItems: "stretch",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 1001,
  },
  ringWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  ring: {
    transform: [{ rotate: "-90deg" }],
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
});

export default DevToast;
