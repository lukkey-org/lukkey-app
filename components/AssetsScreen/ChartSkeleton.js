/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useState } from "react";
import { View, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Chart skeleton screen component - used to replace the loading state of Chart
 * @param {object} props
 * @param {number} props.width - Chart width
 * @param {number} props.height - chart height
 * @param {boolean} props.isDarkMode - whether to use dark mode
 */
const ChartSkeleton = ({
  width = Dimensions.get("window").width,
  height = 220,
  isDarkMode = false,
}) => {
  const [shimmerTranslate] = useState(new Animated.Value(-200));
  const [blinkOpacity] = useState(new Animated.Value(1));

  useEffect(() => {
    // Start loop animation
    Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 200,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();

    // Start flash animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkOpacity, {
          toValue: 0.5,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(blinkOpacity, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Skeleton screen color configuration
  const skeletonColors = isDarkMode
    ? {
        background: "#3A3A3A",
        shimmer: ["#3A3A3A", "#4A4A4A", "#5A5A5A", "#4A4A4A", "#3A3A3A"],
        chartLine: "#4A4A4A",
      }
    : {
        background: "#F0F0F0",
        shimmer: ["#F0F0F0", "#E8E8E8", "#E0E0E0", "#E8E8E8", "#F0F0F0"],
        chartLine: "#E8E8E8",
      };

  // Generate simulated histogram data
  const generateBarData = () => {
    const bars = [];
    const numBars = 20; // Reduce the number of columns to make the display clearer
    const barWidth = (width - 64) / (numBars * 2); // Consider spacing
    const maxHeight = height * 0.7; // The maximum height is 70% of the container

    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth * 2); // Leave space between columns
      const h = maxHeight * (0.3 + Math.random() * 0.7); // random height
      const y = height - h; // Draw from bottom up
      bars.push({ x, y, height: h, width: barWidth });
    }
    return bars;
  };

  const barData = generateBarData();

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View
        style={{
          width,
          height,
          borderRadius: 10,
          overflow: "hidden",
          opacity: 1,
        }}
      >
        {/* Gradient transition effect layer */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateX: shimmerTranslate }],
          }}
        ></Animated.View>
        {/* Simulate histogram */}
        <Animated.View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: -10,
            overflow: "hidden",
            opacity: blinkOpacity,
          }}
        >
          <View
            style={{
              width: "100%",
              flexDirection: "row",
              alignItems: "flex-end",
              height: "100%",
              justifyContent: "space-between",
              paddingHorizontal: 16,
            }}
          >
            {barData.map((bar, index) => (
              <Animated.View
                key={index}
                style={{
                  width: bar.width,
                  height: bar.height,
                  backgroundColor: skeletonColors.chartLine,
                  borderRadius: 4,
                  opacity: blinkOpacity,
                }}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default ChartSkeleton;
