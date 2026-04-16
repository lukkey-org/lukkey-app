/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, PanResponder, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

const GRID_SIZE = 3;

const getRowCol = (index) => ({
  row: Math.floor(index / GRID_SIZE),
  col: index % GRID_SIZE,
});

const getMiddleIndex = (fromIndex, toIndex) => {
  const from = getRowCol(fromIndex);
  const to = getRowCol(toIndex);
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;

  if (Math.abs(rowDiff) === 2 && colDiff === 0) {
    return (from.row + rowDiff / 2) * GRID_SIZE + from.col;
  }
  if (Math.abs(colDiff) === 2 && rowDiff === 0) {
    return from.row * GRID_SIZE + (from.col + colDiff / 2);
  }
  if (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
    return (from.row + rowDiff / 2) * GRID_SIZE + (from.col + colDiff / 2);
  }
  return null;
};

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const PatternLockGrid = ({
  onComplete,
  isDarkMode,
  resetKey,
  errorFlashKey,
  disabled,
  style,
}) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [errorActive, setErrorActive] = useState(false);
  const pointsRef = useRef([]);
  const layoutRef = useRef({ width: 0, height: 0, pageX: 0, pageY: 0 });
  const containerRef = useRef(null);
  const selectedRef = useRef([]);
  const lastMoveRef = useRef(null);
  const rippleRefs = useRef(new Map());
  const errorOpacity = useRef(new Animated.Value(1)).current;
  const lineShakeAnim = useRef(new Animated.Value(0)).current;
  const shakeSegmentRef = useRef(null);
  const [shakeOffset, setShakeOffset] = useState(0);

  useEffect(() => {
    setSelectedNodes([]);
    setCurrentPoint(null);
  }, [resetKey]);

  useEffect(() => {
    selectedRef.current = selectedNodes;
  }, [selectedNodes]);

  const accentColor = isDarkMode ? "#CCB68C" : "#CFAB95";
  const baseColor = isDarkMode ? "#3F3B38" : "#F6F6F5";
  const ringColor = isDarkMode ? "#CCB68C" : "#CFAB95";
  const errorColor = "#FF5252";

  useEffect(() => {
    if (!errorFlashKey) return;
    setErrorActive(true);
    errorOpacity.stopAnimation();
    errorOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(160),
      Animated.timing(errorOpacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setErrorActive(false);
      errorOpacity.setValue(1);
    });
  }, [errorFlashKey, errorOpacity]);

  useEffect(() => {
    const id = lineShakeAnim.addListener(({ value }) => {
      setShakeOffset(value);
    });
    return () => {
      lineShakeAnim.removeListener(id);
    };
  }, [lineShakeAnim]);

  const { points, pointMap, size, nodeRadius, hitRadius } = useMemo(() => {
    const sizeValue = Math.min(layout.width, layout.height);
    if (!sizeValue) {
      return {
        points: [],
        pointMap: new Map(),
        size: 0,
        nodeRadius: 0,
        hitRadius: 0,
      };
    }
    const padding = Math.max(20, Math.round(sizeValue * 0.12));
    const step = (sizeValue - 2 * padding) / 2;
    const radius = Math.max(10, Math.round(sizeValue * 0.055));
    const hit = radius + Math.max(18, Math.round(sizeValue * 0.08));

    const pointsList = [];
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const index = row * GRID_SIZE + col;
        pointsList.push({
          index,
          x: padding + col * step,
          y: padding + row * step,
        });
      }
    }
    const map = new Map(pointsList.map((point) => [point.index, point]));
    return {
      points: pointsList,
      pointMap: map,
      size: sizeValue,
      nodeRadius: radius,
      hitRadius: hit,
    };
  }, [layout]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const getHitIndex = (x, y) => {
    for (const point of pointsRef.current) {
      const dx = x - point.x;
      const dy = y - point.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return point.index;
      }
    }
    return null;
  };

  const getRippleValue = (index) => {
    if (!rippleRefs.current.has(index)) {
      rippleRefs.current.set(index, new Animated.Value(0));
    }
    return rippleRefs.current.get(index);
  };

  const triggerRipple = useCallback((index) => {
    const ripple = getRippleValue(index);
    ripple.stopAnimation();
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const triggerLineShake = useCallback(
    (fromIndex, toIndex) => {
      shakeSegmentRef.current = { fromIndex, toIndex };
      lineShakeAnim.stopAnimation();
      lineShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(lineShakeAnim, {
          toValue: 6,
          duration: 50,
          useNativeDriver: false,
        }),
        Animated.timing(lineShakeAnim, {
          toValue: -6,
          duration: 50,
          useNativeDriver: false,
        }),
        Animated.timing(lineShakeAnim, {
          toValue: 4,
          duration: 50,
          useNativeDriver: false,
        }),
        Animated.timing(lineShakeAnim, {
          toValue: -3,
          duration: 50,
          useNativeDriver: false,
        }),
        Animated.timing(lineShakeAnim, {
          toValue: 0,
          duration: 50,
          useNativeDriver: false,
        }),
      ]).start(() => {
        shakeSegmentRef.current = null;
        lineShakeAnim.setValue(0);
      });
    },
    [lineShakeAnim]
  );

  const appendNode = useCallback(
    (index) => {
      setSelectedNodes((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === index) return prev;
        let next = [...prev];
        let lastFrom = prev[prev.length - 1];
        if (prev.length > 0) {
          const middle = getMiddleIndex(prev[prev.length - 1], index);
          if (middle !== null && middle !== next[next.length - 1]) {
            next.push(middle);
            triggerRipple(middle);
            lastFrom = middle;
          }
        }
        next.push(index);
        triggerRipple(index);
        if (lastFrom !== undefined && lastFrom !== null) {
          triggerLineShake(lastFrom, index);
        }
        return next;
      });
    },
    [triggerRipple, triggerLineShake]
  );

  const handleMove = useCallback(
    (event, gestureState) => {
      if (!pointsRef.current.length) return;
      const { locationX, locationY, pageX, pageY } = event.nativeEvent;
      const { width, height } = layoutRef.current;
      if (width <= 0 || height <= 0) return;
      const moveX = gestureState?.moveX;
      const moveY = gestureState?.moveY;
      const hasGlobal = Number.isFinite(moveX) && Number.isFinite(moveY);
      const hasPage = Number.isFinite(pageX) && Number.isFinite(pageY);
      const rawBaseX = hasGlobal ? moveX - locationX : pageX - locationX;
      const rawBaseY = hasGlobal ? moveY - locationY : pageY - locationY;

      if (
        Number.isFinite(locationX) &&
        Number.isFinite(locationY) &&
        locationX >= 0 &&
        locationX <= width &&
        locationY >= 0 &&
        locationY <= height &&
        Number.isFinite(rawBaseX) &&
        Number.isFinite(rawBaseY)
      ) {
        layoutRef.current.pageX = rawBaseX;
        layoutRef.current.pageY = rawBaseY;
      }

      const { pageX: baseX, pageY: baseY } = layoutRef.current;
      const rawX = hasGlobal
        ? moveX - baseX
        : hasPage
        ? pageX - baseX
        : locationX;
      const rawY = hasGlobal
        ? moveY - baseY
        : hasPage
        ? pageY - baseY
        : locationY;
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
      const lastMove = lastMoveRef.current;
      if (
        lastMove &&
        Math.abs(lastMove.x - rawX) < 1 &&
        Math.abs(lastMove.y - rawY) < 1
      ) {
        return;
      }
      const clampedX = Math.min(Math.max(rawX, 0), width);
      const clampedY = Math.min(Math.max(rawY, 0), height);
      lastMoveRef.current = { x: rawX, y: rawY };
      setCurrentPoint({ x: clampedX, y: clampedY });
      const hitIndex = getHitIndex(clampedX, clampedY);
      if (hitIndex !== null) {
        appendNode(hitIndex);
      }
    },
    [appendNode, hitRadius]
  );

  const handleRelease = useCallback(() => {
    setCurrentPoint(null);
    lastMoveRef.current = null;
    if (selectedRef.current.length > 0 && typeof onComplete === "function") {
      onComplete(selectedRef.current);
    }
  }, [onComplete]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: handleMove,
        onPanResponderMove: handleMove,
        onPanResponderRelease: handleRelease,
        onPanResponderTerminate: handleRelease,
      }),
    [disabled, handleMove, handleRelease]
  );

  const makeQuadraticPath = (from, to, offset) => {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const cx = mx + nx * offset;
    const cy = my + ny * offset;
    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  };

  return (
    <View
      ref={containerRef}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== layout.width || height !== layout.height) {
          setLayout({ width, height });
        }
        if (containerRef.current && containerRef.current.measureInWindow) {
          containerRef.current.measureInWindow((x, y) => {
            layoutRef.current = { width, height, pageX: x, pageY: y };
          });
        } else {
          layoutRef.current = { width, height, pageX: 0, pageY: 0 };
        }
      }}
      style={[{ width: "100%", aspectRatio: 1, alignSelf: "center" }, style]}
      {...panResponder.panHandlers}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute" }}
        pointerEvents="none"
      >
        {selectedNodes.map((index, idx) => {
          if (idx === 0) return null;
          const from = pointMap.get(selectedNodes[idx - 1]);
          const to = pointMap.get(index);
          if (!from || !to) return null;
          const isShakeSegment =
            shakeSegmentRef.current &&
            shakeSegmentRef.current.fromIndex === from.index &&
            shakeSegmentRef.current.toIndex === to.index;
          return (
            isShakeSegment ? (
              <AnimatedPath
                key={`line-${from.index}-${to.index}-${idx}`}
                d={makeQuadraticPath(from, to, shakeOffset)}
                stroke={errorActive ? errorColor : accentColor}
                strokeOpacity={errorActive ? errorOpacity : 1}
                strokeWidth={4}
                fill="none"
              />
            ) : (
              <AnimatedLine
                key={`line-${from.index}-${to.index}-${idx}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={errorActive ? errorColor : accentColor}
                strokeOpacity={errorActive ? errorOpacity : 1}
                strokeWidth={4}
              />
            )
          );
        })}
        {currentPoint &&
          selectedNodes.length > 0 &&
          points.length > 0 &&
          (() => {
            const lastIndex = selectedNodes[selectedNodes.length - 1];
            const lastPoint = pointMap.get(lastIndex);
            if (!lastPoint) return null;
            const dx = currentPoint.x - lastPoint.x;
            const dy = currentPoint.y - lastPoint.y;
            const dist = Math.hypot(dx, dy);
            const sag = Math.min(40, Math.max(18, dist * 0.28));
            const mx = (lastPoint.x + currentPoint.x) / 2;
            const my = (lastPoint.y + currentPoint.y) / 2 + sag;
            return (
              <AnimatedPath
                d={`M ${lastPoint.x} ${lastPoint.y} Q ${mx} ${my} ${currentPoint.x} ${currentPoint.y}`}
                stroke={errorActive ? errorColor : accentColor}
                strokeOpacity={errorActive ? errorOpacity : 1}
                strokeWidth={2}
                fill="none"
              />
            );
          })()}
      </Svg>
      {points.map((point) => {
        const isSelected = selectedNodes.includes(point.index);
        const rippleValue = getRippleValue(point.index);
        const rippleSize = nodeRadius * 3.0;
        return (
          <View key={`node-${point.index}`} pointerEvents="none">
            <Animated.View
              style={{
                position: "absolute",
                width: rippleSize,
                height: rippleSize,
                borderRadius: rippleSize / 2,
                left: point.x - rippleSize / 2,
                top: point.y - rippleSize / 2,
                borderWidth: 2,
                borderColor: accentColor,
                opacity: rippleValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: rippleValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 1.7],
                    }),
                  },
                ],
              }}
            />
            <View
              style={{
                position: "absolute",
                width: nodeRadius * 2,
                height: nodeRadius * 2,
                borderRadius: nodeRadius,
                left: point.x - nodeRadius,
                top: point.y - nodeRadius,
                backgroundColor: baseColor,
                borderWidth: 2,
                borderColor: ringColor,
              }}
            />
            {isSelected ? (
              <Animated.View
                style={{
                  position: "absolute",
                  width: nodeRadius * 2,
                  height: nodeRadius * 2,
                  borderRadius: nodeRadius,
                  left: point.x - nodeRadius,
                  top: point.y - nodeRadius,
                  opacity: errorActive ? errorOpacity : 1,
                  backgroundColor: errorActive ? errorColor : accentColor,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

export default PatternLockGrid;
