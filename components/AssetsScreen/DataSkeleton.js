/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useState } from "react";
import { View, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Data skeleton screen component - used to replace the loading state of text data
 * @param {object} props
 * @param {number} props.width - skeleton screen width
 * @param {number} props.height - skeleton screen height
 * @param {boolean} props.isDarkMode - whether to use dark mode
 * @param {object} props.style - additional styles
 * @param {object} props.colors - optional custom skeleton colors
 */
const DataSkeleton = ({
  width = 80,
  height = 16,
  isDarkMode = false,
  style = {},
  colors,
}) => {
  const [shimmerTranslate] = useState(new Animated.Value(-200));

  useEffect(() => {
    // Start loop animation
    Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 200,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Skeleton screen color configuration
  const defaultSkeletonColors = isDarkMode
    ? {
        background: "#3A3A3A",
        shimmer: ["#3A3A3A", "#4A4A4A", "#5A5A5A", "#4A4A4A", "#3A3A3A"],
      }
    : {
        background: "#F0F0F0",
        shimmer: ["#F0F0F0", "#E8E8E8", "#E0E0E0", "#E8E8E8", "#F0F0F0"],
      };
  const skeletonColors = colors || defaultSkeletonColors;

  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: skeletonColors.background,
          borderRadius: height / 4,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {/* glitter effect layer */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: shimmerTranslate }],
        }}
      >
        <LinearGradient
          colors={skeletonColors.shimmer}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: "200%",
            height: "100%",
          }}
        />
      </Animated.View>
    </View>
  );
};

export default DataSkeleton;
