/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useState, useEffect } from "react";
import {
  TouchableHighlight,
  Animated,
  ImageBackground,
  View,
  Image,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Easing,
  PanResponder,
} from "react-native";
import Reanimated, {
  Easing as ReanimatedEasing,
  LinearTransition,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { MaterialIcons as Icon, FontAwesome6 } from "@expo/vector-icons";
import DataSkeleton from "./DataSkeleton";
import CountUpText from "../common/CountUpText";
import CardImageColorExtractor from "./CardImageColorExtractor";
import { BlurView } from "../common/AppBlurView";
import styles from "./styles";
import { getRuntimeBalance } from "../../utils/assetRuntimeFields";
import { resolveCardImage } from "../../utils/cardImageResolver";
import {
  resolveAssetIcon,
  resolveChainIcon,
} from "../../utils/assetIconResolver";
import { displayChainName } from "../../utils/assetDisplayFormat";

/**
 * Card component, responsible for rendering a single asset card
 * @param {object} props
 * @param {object} props.card - current card data
 * @param {number} props.index - current card index
 * @param {boolean} props.modalVisible - whether to display the modal box
 * @param {boolean} props.hideOtherCards - whether to hide other cards
 * @param {number} props.selectedCardIndex - selected card index
 * @param {any} props.selectCardOffsetOpenAni - selected card animation
 * @param {any} props.selectCardOffsetCloseAni - unselected card animation
 * @param {object} props.VaultScreenStyle - style object
 * @param {boolean} props.isBlackText - whether the text is black
 * @param {object} props.cardRefs - card ref collection
 * @param {function} props.initCardPosition - initialize the card position
 * @param {function} props.onCardLayout - card layout callback
 * @param {function} props.handleCardPress - card click processing
 * @param {boolean} props.isCardExpanded - card information is visible
 * @param {number} props.orderIndex - the rendering order index used for hierarchy calculations
 * @param {function} props.formatBalance - Format balance
 * @param {string} props.currencyUnit - Currency unit
 * @param {string} props.textColor - rising and falling color
 * @param {string|number} props.percentageChange - increase or decrease
 * @param {function} props.getConvertedBalance - Get the fiat balance
 * @param {function} props.formatFiatBalance - Format fiat balance display
 * @param {function} props.handleQRCodePress - QR code click processing
 * @param {function} props.t - international translation function
 * @param {boolean} props.isDataLoading - whether data is loading
 * @param {boolean} props.isDarkMode - whether to use dark mode
 * @param {number|null} props.bringToFrontCardIndex - Temporarily increase the level of card index
 * @param {any} props.entryAnim - entry animation value
 * @param {number} props.entryOffset - entry offset
 * @param {function} props.onToggleCardHide - Toggles the hidden amount when the card is clicked in the expanded state
 * @param {object} props.scrollLock - sliding lock SharedValue
 * @param {object} props.scrollYOffset - scroll offset ref
 * @param {object} props.scrollContainerAbsYRef - absolute position ref at the top of the scroll container
 * @param {object} props.cardLayoutYRef - card layout Y position ref
 * @param {function} props.onDeletePress - Edit mode delete button click
 */
const CardItem = ({
  card,
  stableId = null,
  draggingStableId = null,
  latestSwapEvent = null,
  index,
  modalVisible,
  hideOtherCards,
  isClosing,
  elevateDuringReturn,
  selectedCardIndex,
  selectCardOffsetOpenAni,
  selectCardOffsetCloseAni,
  VaultScreenStyle,
  isBlackText,
  cardRefs,
  initCardPosition,
  onCardLayout,
  handleCardPress,
  isCardExpanded,
  orderIndex,
  formatBalance,
  formatFiatBalance,
  currencyUnit,
  textColor,
  percentageChange,
  getConvertedBalance,
  handleQRCodePress,
  onColorExtracted, // New: color value callback
  isDataLoading = false, // New: Data loading status
  isDarkMode = false, // New: Dark Mode
  hideNumbers = false, // New: Hide digital switch
  onToggleCardHide,
  scrollLock,
  scrollYOffset,
  scrollContainerAbsYRef,
  cardLayoutYRef,
  onDeletePress,
  isDeleteSelected = false,
  showGasFeeIcon = false,
  bringToFrontCardIndex = null,
  freezeNumbers = false, // New: Freeze numbers during closing/homing phase to avoid jitter
  entryAnim,
  entryOffset = 0,
  isJiggleMode = false,
  onCardLongPress,
  onCardDragReady,
  onCardDragMove,
  onCardDragEnd,
  t,
}) => {
  const getDisplayName = (name) => {
    if (name === "Bridged USDC") return "USDC.e";
    if (name === "USD Coin (Bridged from Ethereum)") return "USDC.e";
    if (
      name === "USD Coin" &&
      String(card?.queryChainName || "").toLowerCase() === "binance" &&
      String(card?.shortName || "").toUpperCase() === "USDC"
    ) {
      return "USDC";
    }
    if (name === "Optimistic Ethereum") return "Ethereum";
    return name;
  };

  // Typical colors are received and processed by the parent, and the current component does not require local storage.
  // Value snapshot for display during freeze phase (during closing/homing animation)
  const [isActiveDrag, setIsActiveDrag] = useState(false);
  const [isSwapLayerLocked, setIsSwapLayerLocked] = useState(false);
  const [isSwapDetouring, setIsSwapDetouring] = useState(false);
  const [isSwapPostSwitchBoost, setIsSwapPostSwitchBoost] = useState(false);
  const [swapForcedOrderIndex, setSwapForcedOrderIndex] = useState(null);
  const lastFormattedRef = React.useRef("0.00");
  const lastFiatRef = React.useRef("0.00");
  const pressLockRef = React.useRef(false);
  const jiggleAnim = React.useRef(new Animated.Value(0)).current;
  const jiggleLoopRef = React.useRef(null);
  const jiggleDelayTimerRef = React.useRef(null);
  const jiggleSeedRef = React.useRef(Math.random());
  const dragTranslateY = React.useRef(new Animated.Value(0)).current;
  const dragReadyRef = React.useRef(false);
  const hasDraggedRef = React.useRef(false);
  const skipNextJiggleTapToggleRef = React.useRef(false);
  const dragMoveLogTsRef = React.useRef(0);
  const dragMoveCallLogTsRef = React.useRef(0);
  const dragStartScrollYRef = React.useRef(0);
  const dragTouchOffsetRef = React.useRef(0);
  const dragTopBoundaryYRef = React.useRef(null);
  const dragBaseLayoutYRef = React.useRef(null);
  const dragAnchorTopYRef = React.useRef(null);
  const lastDragCardTopYRef = React.useRef(null);
  const swapDetourOffsetY = React.useRef(new Animated.Value(0)).current;
  const handledSwapSeqRef = React.useRef(0);
  const swapLayerUnlockTimerRef = React.useRef(null);
  const swapPostSwitchClearTimerRef = React.useRef(null);
  const pendingSwapExpectedOrderRef = React.useRef(null);
  const TEMP_EDIT_Y_LOG_INTERVAL_MS = 120;
  const TEMP_EDIT_Y_JUMP_THRESHOLD = 28;
  const SWAP_DETOUR_OUT_MS = 70;
  const SWAP_DETOUR_RETURN_MS = 70;
  const SWAP_POST_SWITCH_HOLD_MS = 220;

  // Unified management of card levels:
  // - Basics: The larger the order index (visually lower card), the larger the zIndex
  // - Opening phase: The selected card is temporarily raised
  // - Return phase: The first 100ms after starting homing (elevateDuringReturn=true) remains elevated, and then the basic sequence is restored.
  const zOrderIndex = Number.isFinite(orderIndex) ? orderIndex : index;
  const effectiveZOrderIndex = Number.isFinite(swapForcedOrderIndex)
    ? swapForcedOrderIndex
    : zOrderIndex;
  const baseZ = 1000 + effectiveZOrderIndex;
  const shouldTemporarilyElevate = bringToFrontCardIndex === index;
  const isSelectedDuringModal =
    selectedCardIndex === index &&
    ((modalVisible && !isClosing) || (isClosing && elevateDuringReturn));
  const baseCardZIndex = shouldTemporarilyElevate
    ? baseZ + 3000
    : isSelectedDuringModal
      ? baseZ + 1000
      : baseZ;
  const cardZIndex = baseCardZIndex;
  const containerZIndex = cardZIndex;

  const shouldHideOtherCards =
    hideOtherCards && selectedCardIndex != null && selectedCardIndex !== index;
  const entryTranslateY = entryAnim
    ? entryAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [entryOffset, 0],
      })
    : 0;
  const baseTranslateY =
    selectedCardIndex === index
      ? selectCardOffsetOpenAni
      : selectCardOffsetCloseAni;
  const cardTranslateY = Animated.add(baseTranslateY, entryTranslateY);
  const entryOpacity = entryAnim || 1;
  const cardOpacity = shouldHideOtherCards ? 0 : entryOpacity;
  const allowToggleMask =
    typeof onToggleCardHide === "function" &&
    modalVisible &&
    !isClosing &&
    isCardExpanded &&
    selectedCardIndex === index;
  const shouldJiggle = isJiggleMode && !modalVisible && !isClosing;

  // Number masking: Card only supports "***" or "*****"
  const maskAmountStr = (val) => {
    try {
      const digits = String(val ?? "").replace(/[^0-9]/g, "");
      const n = digits.length >= 5 ? 5 : 3;
      return "*".repeat(n);
    } catch {
      return "***";
    }
  };

  const handleColorsChange = React.useCallback(
    (main, secondary) => {
      onColorExtracted?.(main, secondary, card, index);
    },
    [card, index, onColorExtracted],
  );

  const safeFormatFiatBalance =
    typeof formatFiatBalance === "function"
      ? formatFiatBalance
      : (value) => {
          const num = Number(value);
          return Number.isFinite(num) ? num.toFixed(2) : "0.00";
        };
  const runtimeBalance = getRuntimeBalance(card?.balance);
  const resolvedCardImage = React.useMemo(() => resolveCardImage(card), [card]);
  const resolvedAssetIcon = React.useMemo(() => resolveAssetIcon(card), [card]);
  const resolvedChainIcon = React.useMemo(
    () => resolveChainIcon(card?.queryChainName),
    [card],
  );

  // Numerical calculation cache: Reduce repeated formatting/conversion and avoid lag caused by frequent recalculation during animation
  const formattedBalanceMemo = React.useMemo(() => {
    try {
      return formatBalance(runtimeBalance, {
        symbol: card.shortName,
        context: "CardItem.renderBalance",
        compactLarge: true,
      });
    } catch {
      return "0.00";
    }
  }, [runtimeBalance, card.shortName, formatBalance]);

  const fiatBalanceDisplayMemo = React.useMemo(() => {
    try {
      const raw = getConvertedBalance(
        runtimeBalance,
        card.shortName,
        "CardItem.renderFiat",
      );
      const num = Number(raw);
      if (!Number.isFinite(num)) return "0.00";
      return safeFormatFiatBalance(num, { compactLarge: true });
    } catch {
      return "0.00";
    }
  }, [
    runtimeBalance,
    card.shortName,
    getConvertedBalance,
    safeFormatFiatBalance,
  ]);

  // When not frozen, update the snapshot; when frozen, keep the last value to avoid jitter during animation
  useEffect(() => {
    if (!freezeNumbers) {
      lastFormattedRef.current = formattedBalanceMemo;
      lastFiatRef.current = fiatBalanceDisplayMemo;
    }
  }, [freezeNumbers, formattedBalanceMemo, fiatBalanceDisplayMemo]);
  const isCardDisabled = (modalVisible && !allowToggleMask) || isClosing;
  if (__DEV__ && typeof modalVisible !== "boolean") {
    throw new Error("disabled must be boolean");
  }
  const lockScroll = () => {
    if (scrollLock) {
      scrollLock.value = true;
    }
    pressLockRef.current = true;
  };
  const releaseScroll = () => {
    if (!pressLockRef.current) return;
    pressLockRef.current = false;
    if (scrollLock) {
      scrollLock.value = false;
    }
  };
  const handlePress = () => {
    if (shouldJiggle) {
      return;
    }
    if (allowToggleMask) {
      onToggleCardHide?.(card);
      return;
    }
    if (!modalVisible) {
      if (scrollLock) {
        scrollLock.value = true;
      }
      const opened = handleCardPress(card.name, card.queryChainName, index);
      if (scrollLock && opened === false) {
        scrollLock.value = false;
      }
      pressLockRef.current = false;
    }
  };

  const markDragReady = React.useCallback(() => {
    if (!shouldJiggle || dragReadyRef.current) return;
    dragReadyRef.current = true;
    hasDraggedRef.current = false;
    onCardDragReady?.(card, index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [card, index, onCardDragReady, shouldJiggle]);

  const getTopCardBoundaryY = React.useCallback(() => {
    const layoutList = cardLayoutYRef?.current;
    if (!Array.isArray(layoutList) || layoutList.length === 0) return null;
    let minLayoutY = Infinity;
    for (let i = 0; i < layoutList.length; i += 1) {
      const y = Number(layoutList[i]);
      if (!Number.isFinite(y) || y < 0) continue;
      if (y < minLayoutY) minLayoutY = y;
    }
    if (!Number.isFinite(minLayoutY)) return null;
    const containerTop = Number(scrollContainerAbsYRef?.current ?? 0);
    const currentScrollY = Number(scrollYOffset?.current ?? 0);
    return containerTop + minLayoutY - currentScrollY;
  }, [cardLayoutYRef, scrollContainerAbsYRef, scrollYOffset]);

  const resetDragState = React.useCallback(() => {
    dragReadyRef.current = false;
    hasDraggedRef.current = false;
    dragTopBoundaryYRef.current = null;
    dragBaseLayoutYRef.current = null;
    dragAnchorTopYRef.current = null;
    lastDragCardTopYRef.current = null;
  }, []);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => shouldJiggle,
        onStartShouldSetPanResponderCapture: () => shouldJiggle,
        onMoveShouldSetPanResponder: () => shouldJiggle,
        onMoveShouldSetPanResponderCapture: () => shouldJiggle,
        onPanResponderGrant: (_evt, gestureState) => {
          setIsActiveDrag(true);
          markDragReady();
          if (scrollLock) {
            scrollLock.value = true;
          }
          dragTranslateY.setValue(0);
          const currentScrollY = Number(scrollYOffset?.current ?? 0);
          dragStartScrollYRef.current = currentScrollY;
          const containerTop = Number(scrollContainerAbsYRef?.current ?? 0);
          const layoutY = Number(cardLayoutYRef?.current?.[index]);
          const topBoundaryY = getTopCardBoundaryY();
          dragTopBoundaryYRef.current = Number.isFinite(topBoundaryY)
            ? topBoundaryY
            : null;
          dragBaseLayoutYRef.current = Number.isFinite(layoutY)
            ? layoutY
            : null;
          if (Number.isFinite(layoutY)) {
            const cardTopOnScreen = containerTop + layoutY - currentScrollY;
            dragTouchOffsetRef.current =
              Number(gestureState?.y0 ?? 0) - cardTopOnScreen;
            console.log("[TEMP][EDIT_CARD_Y][GRANT]", {
              name: card?.name || card?.shortName,
              index,
              touchY: Number(gestureState?.y0 ?? 0),
              layoutY,
              cardTopOnScreen,
              scrollY: currentScrollY,
              containerTop,
              touchOffset: dragTouchOffsetRef.current,
              topBoundaryY: dragTopBoundaryYRef.current,
            });
          } else {
            dragTouchOffsetRef.current = 0;
            console.log("[TEMP][EDIT_CARD_Y][GRANT][NO_LAYOUT]", {
              name: card?.name || card?.shortName,
              index,
              touchY: Number(gestureState?.y0 ?? 0),
              layoutY,
              scrollY: currentScrollY,
              containerTop,
              topBoundaryY: dragTopBoundaryYRef.current,
            });
          }
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (shouldJiggle && !dragReadyRef.current) {
            return;
          }
          const containerTop = Number(scrollContainerAbsYRef?.current ?? 0);
          const currentScrollY = Number(scrollYOffset?.current ?? 0);
          const layoutY = Number(cardLayoutYRef?.current?.[index]);
          const activeBaseLayoutY = Number.isFinite(dragBaseLayoutYRef.current)
            ? dragBaseLayoutYRef.current
            : Number.isFinite(layoutY)
              ? layoutY
              : null;
          const cardTopOnScreen = Number.isFinite(activeBaseLayoutY)
            ? containerTop + activeBaseLayoutY - currentScrollY
            : 0;
          const desiredCardTop =
            Number(gestureState.moveY ?? 0) - dragTouchOffsetRef.current;
          const topCardBoundaryY = Number.isFinite(dragTopBoundaryYRef.current)
            ? dragTopBoundaryYRef.current
            : getTopCardBoundaryY();
          const clampedCardTop = Number.isFinite(topCardBoundaryY)
            ? Math.max(desiredCardTop, topCardBoundaryY)
            : desiredCardTop;
          const adjustedDy = clampedCardTop - cardTopOnScreen;
          const cardTopYAfterAdjust = cardTopOnScreen + adjustedDy;
          const prevCardTopY = lastDragCardTopYRef.current;
          const deltaFromLast = Number.isFinite(prevCardTopY)
            ? cardTopYAfterAdjust - prevCardTopY
            : 0;
          const isJump = Number.isFinite(prevCardTopY)
            ? Math.abs(deltaFromLast) >= TEMP_EDIT_Y_JUMP_THRESHOLD
            : false;
          dragAnchorTopYRef.current = clampedCardTop;
          const now = Date.now();
          if (
            isJump ||
            now - dragMoveLogTsRef.current >= TEMP_EDIT_Y_LOG_INTERVAL_MS
          ) {
            dragMoveLogTsRef.current = now;
            console.log("[TEMP][EDIT_CARD_Y][MOVE]", {
              name: card?.name || card?.shortName,
              index,
              touchY: Number(gestureState.moveY ?? 0),
              layoutY,
              baseLayoutY: activeBaseLayoutY,
              scrollY: currentScrollY,
              containerTop,
              cardTopOnScreen,
              desiredCardTop,
              clampedCardTop,
              topBoundaryY: topCardBoundaryY,
              adjustedDy,
              cardTopYAfterAdjust,
              prevCardTopY,
              deltaFromLast,
              isJump,
            });
          }
          lastDragCardTopYRef.current = cardTopYAfterAdjust;
          const crossedDragThreshold =
            Math.abs(adjustedDy) > 3 || Math.abs(gestureState.dx) > 3;
          if (crossedDragThreshold) hasDraggedRef.current = true;
          dragTranslateY.setValue(adjustedDy);
          if (!crossedDragThreshold) return;
          const swapBaseDelta = Number(
            onCardDragMove?.({
              card,
              index,
              dy: adjustedDy,
              moveY: gestureState.moveY,
            }) ?? 0,
          );
          if (Number.isFinite(swapBaseDelta) && Math.abs(swapBaseDelta) > 0.5) {
            if (Number.isFinite(activeBaseLayoutY)) {
              dragBaseLayoutYRef.current = activeBaseLayoutY + swapBaseDelta;
            }
          }
        },
        onPanResponderRelease: (_evt, gestureState) => {
          setIsActiveDrag(false);
          const wasDragged = hasDraggedRef.current;
          if (wasDragged && dragReadyRef.current) {
            const containerTop = Number(scrollContainerAbsYRef?.current ?? 0);
            const currentScrollY = Number(scrollYOffset?.current ?? 0);
            const layoutY = Number(cardLayoutYRef?.current?.[index]);
            const activeBaseLayoutY = Number.isFinite(
              dragBaseLayoutYRef.current,
            )
              ? dragBaseLayoutYRef.current
              : Number.isFinite(layoutY)
                ? layoutY
                : null;
            const cardTopOnScreen = Number.isFinite(activeBaseLayoutY)
              ? containerTop + activeBaseLayoutY - currentScrollY
              : 0;
            const desiredCardTop =
              Number(gestureState.moveY ?? 0) - dragTouchOffsetRef.current;
            const topCardBoundaryY = Number.isFinite(
              dragTopBoundaryYRef.current,
            )
              ? dragTopBoundaryYRef.current
              : getTopCardBoundaryY();
            const clampedCardTop = Number.isFinite(topCardBoundaryY)
              ? Math.max(desiredCardTop, topCardBoundaryY)
              : desiredCardTop;
            const adjustedDy = clampedCardTop - cardTopOnScreen;
            console.log("[TEMP][EDIT_CARD_Y][RELEASE]", {
              name: card?.name || card?.shortName,
              index,
              touchY: Number(gestureState.moveY ?? 0),
              layoutY,
              baseLayoutY: activeBaseLayoutY,
              scrollY: currentScrollY,
              containerTop,
              cardTopOnScreen,
              desiredCardTop,
              clampedCardTop,
              topBoundaryY: topCardBoundaryY,
              adjustedDy,
            });
            onCardDragEnd?.({
              card,
              index,
              dy: adjustedDy,
              moveY: gestureState.moveY,
            });
          } else if (shouldJiggle) {
            if (skipNextJiggleTapToggleRef.current) {
              skipNextJiggleTapToggleRef.current = false;
            } else {
              console.log("[BATCH_DELETE][CARD] card touchEnd toggle", {
                name: card?.name || card?.shortName,
                index,
              });
              onDeletePress?.(card);
            }
          }
          resetDragState();
          if (scrollLock) {
            scrollLock.value = false;
          }
          Animated.timing(dragTranslateY, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          setIsActiveDrag(false);
          if (hasDraggedRef.current) {
            onCardDragEnd?.({ card, index, dy: 0, moveY: 0, terminated: true });
          }
          resetDragState();
          if (scrollLock) {
            scrollLock.value = false;
          }
          Animated.timing(dragTranslateY, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }).start();
        },
      }),
    [
      card,
      dragTranslateY,
      index,
      markDragReady,
      onDeletePress,
      onCardDragEnd,
      onCardDragMove,
      getTopCardBoundaryY,
      resetDragState,
      scrollLock,
      shouldJiggle,
    ],
  );

  React.useEffect(() => {
    if (!shouldJiggle) {
      if (jiggleDelayTimerRef.current) {
        clearTimeout(jiggleDelayTimerRef.current);
        jiggleDelayTimerRef.current = null;
      }
      if (jiggleLoopRef.current) {
        jiggleLoopRef.current.stop();
        jiggleLoopRef.current = null;
      }
      setIsActiveDrag(false);
      setIsSwapLayerLocked(false);
      setIsSwapDetouring(false);
      setIsSwapPostSwitchBoost(false);
      setSwapForcedOrderIndex(null);
      pendingSwapExpectedOrderRef.current = null;
      if (swapLayerUnlockTimerRef.current) {
        clearTimeout(swapLayerUnlockTimerRef.current);
        swapLayerUnlockTimerRef.current = null;
      }
      if (swapPostSwitchClearTimerRef.current) {
        clearTimeout(swapPostSwitchClearTimerRef.current);
        swapPostSwitchClearTimerRef.current = null;
      }
      swapDetourOffsetY.stopAnimation();
      swapDetourOffsetY.setValue(0);
      jiggleAnim.stopAnimation();
      jiggleAnim.setValue(0);
      return;
    }
    jiggleAnim.setValue(0);
    const seed = jiggleSeedRef.current;
    const baseDelay = Math.round(seed * 180);
    const duration = 72 + Math.round(seed * 16); // 72~88ms
    const ease = Easing.linear;
    const startValue = seed * 2 - 1; // -1~1
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(jiggleAnim, {
          toValue: startValue,
          duration,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(jiggleAnim, {
          toValue: 1,
          duration,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(jiggleAnim, {
          toValue: -1,
          duration,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(jiggleAnim, {
          toValue: 0,
          duration,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
    );
    jiggleLoopRef.current = loop;
    jiggleDelayTimerRef.current = setTimeout(() => {
      jiggleDelayTimerRef.current = null;
      jiggleAnim.setValue(startValue);
      loop.start();
    }, baseDelay);
    return () => {
      if (jiggleDelayTimerRef.current) {
        clearTimeout(jiggleDelayTimerRef.current);
        jiggleDelayTimerRef.current = null;
      }
      if (jiggleLoopRef.current) {
        jiggleLoopRef.current.stop();
        jiggleLoopRef.current = null;
      }
    };
  }, [jiggleAnim, shouldJiggle, swapDetourOffsetY]);

  React.useEffect(
    () => () => {
      if (swapLayerUnlockTimerRef.current) {
        clearTimeout(swapLayerUnlockTimerRef.current);
        swapLayerUnlockTimerRef.current = null;
      }
      if (swapPostSwitchClearTimerRef.current) {
        clearTimeout(swapPostSwitchClearTimerRef.current);
        swapPostSwitchClearTimerRef.current = null;
      }
    },
    [],
  );

  React.useEffect(() => {
    const swapSeq = Number(latestSwapEvent?.seq);
    if (!Number.isFinite(swapSeq) || swapSeq <= 0) return;
    if (handledSwapSeqRef.current === swapSeq) return;
    if (!stableId) return;
    if (
      draggingStableId &&
      latestSwapEvent?.movingId &&
      latestSwapEvent.movingId !== draggingStableId
    ) {
      return;
    }
    handledSwapSeqRef.current = swapSeq;
    const isMovingCard = latestSwapEvent?.movingId === stableId;
    const isTargetCard = latestSwapEvent?.targetId === stableId;
    if (!isMovingCard && !isTargetCard) return;
    const currentSwapSeq = swapSeq;
    const direction = latestSwapEvent?.direction;
    const movingLayoutY = Number(latestSwapEvent?.movingLayoutY);
    const targetLayoutY = Number(latestSwapEvent?.targetLayoutY);
    const movingOrderAfter = Number(latestSwapEvent?.movingOrderAfter);
    const targetOrderAfter = Number(latestSwapEvent?.targetOrderAfter);
    const layoutGap =
      Number.isFinite(movingLayoutY) && Number.isFinite(targetLayoutY)
        ? Math.abs(movingLayoutY - targetLayoutY)
        : 72;
    // Keep detour very subtle and short; avoid a spring-like tail near settle.
    const detourDistance = Math.max(8, Math.min(28, layoutGap * 0.22));
    // Target card should detour toward its final slot direction to avoid
    // "drop then return" at the end of a swap.
    const targetDeltaY =
      Number.isFinite(movingLayoutY) && Number.isFinite(targetLayoutY)
        ? movingLayoutY - targetLayoutY
        : direction === "down"
          ? -1
          : 1;
    const detourDirection = targetDeltaY === 0 ? 0 : targetDeltaY > 0 ? 1 : -1;

    if (isMovingCard) {
      setIsSwapDetouring(false);
      swapDetourOffsetY.stopAnimation();
      swapDetourOffsetY.setValue(0);
      pendingSwapExpectedOrderRef.current = Number.isFinite(movingOrderAfter)
        ? movingOrderAfter
        : null;
      if (swapPostSwitchClearTimerRef.current) {
        clearTimeout(swapPostSwitchClearTimerRef.current);
        swapPostSwitchClearTimerRef.current = null;
      }
      setSwapForcedOrderIndex(
        Number.isFinite(targetOrderAfter) ? targetOrderAfter : null,
      );
      setIsSwapPostSwitchBoost(false);
      setIsSwapLayerLocked(true);
      if (swapLayerUnlockTimerRef.current) {
        clearTimeout(swapLayerUnlockTimerRef.current);
      }
      swapLayerUnlockTimerRef.current = setTimeout(() => {
        if (handledSwapSeqRef.current !== currentSwapSeq) return;
        setIsSwapLayerLocked(false);
        setSwapForcedOrderIndex(
          Number.isFinite(movingOrderAfter) ? movingOrderAfter : null,
        );
        setIsSwapPostSwitchBoost(true);
        swapPostSwitchClearTimerRef.current = setTimeout(() => {
          if (handledSwapSeqRef.current !== currentSwapSeq) return;
          setIsSwapPostSwitchBoost(false);
          setSwapForcedOrderIndex(null);
          pendingSwapExpectedOrderRef.current = null;
          swapPostSwitchClearTimerRef.current = null;
        }, SWAP_POST_SWITCH_HOLD_MS);
        swapLayerUnlockTimerRef.current = null;
      }, SWAP_DETOUR_OUT_MS);
      return;
    }

    if (swapLayerUnlockTimerRef.current) {
      clearTimeout(swapLayerUnlockTimerRef.current);
      swapLayerUnlockTimerRef.current = null;
    }
    if (swapPostSwitchClearTimerRef.current) {
      clearTimeout(swapPostSwitchClearTimerRef.current);
      swapPostSwitchClearTimerRef.current = null;
    }
    pendingSwapExpectedOrderRef.current = null;
    setIsSwapLayerLocked(false);
    setIsSwapPostSwitchBoost(false);
    setSwapForcedOrderIndex(null);
    swapDetourOffsetY.stopAnimation();
    swapDetourOffsetY.setValue(0);
    setIsSwapDetouring(true);
    Animated.timing(swapDetourOffsetY, {
      toValue: detourDistance * detourDirection,
      duration: SWAP_DETOUR_OUT_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (handledSwapSeqRef.current !== currentSwapSeq) return;
      if (!finished) {
        setIsSwapDetouring(false);
        return;
      }
      Animated.timing(swapDetourOffsetY, {
        toValue: 0,
        duration: SWAP_DETOUR_RETURN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished: settleFinished }) => {
        if (handledSwapSeqRef.current !== currentSwapSeq) return;
        setIsSwapDetouring(false);
        if (settleFinished) {
          swapDetourOffsetY.setValue(0);
        }
      });
    });
  }, [
    draggingStableId,
    latestSwapEvent,
    stableId,
    swapDetourOffsetY,
    SWAP_DETOUR_OUT_MS,
    SWAP_DETOUR_RETURN_MS,
    SWAP_POST_SWITCH_HOLD_MS,
  ]);

  React.useEffect(() => {
    if (!isSwapPostSwitchBoost) return;
    const expectedOrder = Number(pendingSwapExpectedOrderRef.current);
    if (!Number.isFinite(expectedOrder)) return;
    if (zOrderIndex !== expectedOrder) return;
    setIsSwapPostSwitchBoost(false);
    setSwapForcedOrderIndex(null);
    pendingSwapExpectedOrderRef.current = null;
    if (swapPostSwitchClearTimerRef.current) {
      clearTimeout(swapPostSwitchClearTimerRef.current);
      swapPostSwitchClearTimerRef.current = null;
    }
  }, [isSwapPostSwitchBoost, zOrderIndex]);

  const combinedTranslateY = Animated.add(cardTranslateY, dragTranslateY);
  const jiggleParity = index % 2 === 0 ? 1 : -1;
  const jiggleDrive = Animated.multiply(jiggleAnim, jiggleParity);
  const jiggleRotate = jiggleDrive.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-0.45deg", "0deg", "0.45deg"],
  });
  const jiggleTranslateX = jiggleDrive.interpolate({
    inputRange: [-1, 1],
    outputRange: [-0.45, 0.45],
  });
  const jiggleTranslateY = jiggleDrive.interpolate({
    inputRange: [-1, 1],
    outputRange: [-0.15, 0.15],
  });
  const jiggleScale = jiggleDrive.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.9995, 1, 1.0005],
  });
  const swapLayoutTransition = React.useMemo(
    () => LinearTransition.easing(ReanimatedEasing.linear).duration(180),
    [],
  );

  return (
    <>
      <CardImageColorExtractor
        cardImage={resolvedCardImage}
        index={index}
        selectedCardIndex={selectedCardIndex}
        onColorsChange={handleColorsChange}
      />
      <Reanimated.View
        layout={
          isJiggleMode && !isActiveDrag ? swapLayoutTransition : undefined
        }
        style={[
          VaultScreenStyle.cardContainer,
          {
            zIndex: containerZIndex,
            elevation: Platform.OS === "android" ? containerZIndex : undefined,
            position: "relative",
          },
        ]}
        onLayout={(event) => {
          const layoutY = Number(event?.nativeEvent?.layout?.y);
          if (
            shouldJiggle &&
            isActiveDrag &&
            Number.isFinite(layoutY) &&
            Number.isFinite(dragAnchorTopYRef.current)
          ) {
            const containerTop = Number(scrollContainerAbsYRef?.current ?? 0);
            const currentScrollY = Number(scrollYOffset?.current ?? 0);
            const cardTopOnScreen = containerTop + layoutY - currentScrollY;
            const anchoredDy = dragAnchorTopYRef.current - cardTopOnScreen;
            dragTranslateY.setValue(anchoredDy);
            dragBaseLayoutYRef.current = layoutY;
            lastDragCardTopYRef.current = dragAnchorTopYRef.current;
          }
          if (
            shouldJiggle &&
            isActiveDrag &&
            Number.isFinite(layoutY) &&
            Date.now() - dragMoveCallLogTsRef.current >= 120
          ) {
            dragMoveCallLogTsRef.current = Date.now();
            console.log("[TEMP][EDIT_CARD_Y][LAYOUT]", {
              name: card?.name || card?.shortName,
              index,
              layoutY,
            });
          }
          onCardLayout?.(index, layoutY);
        }}
        ref={(el) => {
          cardRefs.current[index] = el;
          initCardPosition(el, index);
        }}
      >
        <TouchableHighlight
          underlayColor={"transparent"}
          activeOpacity={1}
          key={`${card.shortName}_${index}`}
          pointerEvents={shouldJiggle ? "box-none" : "auto"}
          onPress={handlePress}
          onPressIn={() => {
            if (!modalVisible && !shouldJiggle) {
              lockScroll();
            }
          }}
          onLongPress={() => {
            if (!modalVisible && !shouldJiggle) {
              onCardLongPress?.(card, index);
            }
          }}
          delayLongPress={350}
          onPressOut={() => {
            if (!modalVisible) releaseScroll();
          }}
          disabled={!!isCardDisabled}
        >
          <Animated.View
            style={[
              {
                transform: [
                  { translateY: combinedTranslateY },
                  { translateY: swapDetourOffsetY },
                  { rotate: jiggleRotate },
                  { translateX: jiggleTranslateX },
                  { translateY: jiggleTranslateY },
                  { scale: jiggleScale },
                ],
              },
              {
                zIndex: cardZIndex,
                elevation: Platform.OS === "android" ? cardZIndex : undefined,
                position: "relative",
              },
              { opacity: cardOpacity },
            ]}
          >
            {shouldJiggle && (
              <TouchableOpacity
                onPressIn={() => {
                  skipNextJiggleTapToggleRef.current = true;
                  console.log("[BATCH_DELETE][CARD] icon pressIn", {
                    name: card?.name || card?.shortName,
                    index,
                  });
                }}
                onPress={() => {
                  console.log("[BATCH_DELETE][CARD] icon press", {
                    name: card?.name || card?.shortName,
                    index,
                  });
                  onDeletePress?.(card);
                }}
                activeOpacity={0.8}
                style={{
                  position: "absolute",
                  top: -8,
                  left: -8,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: isDeleteSelected
                    ? "#E53935"
                    : isDarkMode
                      ? "#B3B3B7"
                      : "#E5E5EA",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: cardZIndex + 10,
                  elevation:
                    Platform.OS === "android" ? cardZIndex + 10 : undefined,
                }}
              >
                <Icon
                  name={isDeleteSelected ? "check" : "remove"}
                  size={16}
                  color={isDeleteSelected ? "#FFFFFF" : "#111111"}
                />
              </TouchableOpacity>
            )}
            <View
              {...(shouldJiggle ? panResponder.panHandlers : {})}
              style={[
                VaultScreenStyle.assetPageCard,
                index === 0
                  ? VaultScreenStyle.cardFirst
                  : VaultScreenStyle.cardOthers,
                { position: "relative" },
              ]}
            >
              <ImageBackground
                source={resolvedCardImage}
                style={{ width: "100%", height: "100%" }}
                imageStyle={{ borderRadius: 26 }}
              >
                <View style={styles.cardHeaderGroup}>
                  <View style={styles.cardIconGroup}>
                    {["carIcnCtr", "carChnIcnWra"].map((styleKey, i) => (
                      <View
                        key={i}
                        style={[
                          VaultScreenStyle[styleKey],
                          i === 0
                            ? styles.cardIconPrimary
                            : styles.cardIconChain,
                        ]}
                      >
                        {i === 1 ? (
                          <BlurView
                            style={[
                              StyleSheet.absoluteFillObject,
                              { opacity: 0.1 },
                            ]}
                            intensity={12}
                            overlayColor={null}
                            androidFallbackColor="transparent"
                          />
                        ) : null}
                        <Image
                          source={
                            i === 0 ? resolvedAssetIcon : resolvedChainIcon
                          }
                          style={
                            i === 0
                              ? VaultScreenStyle.cardIcon
                              : VaultScreenStyle.chainIcon
                          }
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.cardTitleGroup}>
                    <View style={styles.cardTitleStack}>
                      {["cardName", "chainText"].map((textStyle, i) =>
                        i === 0 ? (
                          <View key={i} style={styles.cardTitleRow}>
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              adjustsFontSizeToFit
                              minimumFontScale={0.72}
                              style={[
                                VaultScreenStyle[textStyle],
                                styles.cardTitleText,
                                {
                                  color: isBlackText ? "#333" : "#eee",
                                  marginRight: 4,
                                },
                              ]}
                            >
                              {getDisplayName(card.name)}
                            </Text>
                            {showGasFeeIcon ? (
                              <FontAwesome6
                                name="gas-pump"
                                size={12}
                                color="#F3F4F6"
                                style={{ marginLeft: 2, flexShrink: 0 }}
                              />
                            ) : null}
                          </View>
                        ) : (
                          <View
                            key={i}
                            style={[
                              VaultScreenStyle.chainContainer,
                              styles.cardChainPill,
                            ]}
                          >
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={[
                                VaultScreenStyle.chainCardText,
                                styles.cardChainText,
                                { color: isBlackText ? "#333" : "#eee" },
                              ]}
                            >
                              {card.queryChainName
                                ? displayChainName(card.queryChainName)
                                : ""}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>

                    <Image
                      source={require("../../assets/CardBg/Logo.webp")}
                      style={{
                        left: 50,
                        top: -60,
                        opacity: 0.2,
                        width: 280,
                        height: 280,
                        transform: [{ rotate: "-10deg" }],
                      }}
                    />
                    <Text
                      style={[
                        VaultScreenStyle.cardShortName,
                        isBlackText && { color: "#121518" },
                      ]}
                    >
                      {card.shortName}
                    </Text>
                  </View>
                </View>
                {!modalVisible
                  ? (() => {
                      const formattedBalance = freezeNumbers
                        ? lastFormattedRef.current
                        : formattedBalanceMemo;
                      const fiatBalanceDisplay = freezeNumbers
                        ? lastFiatRef.current
                        : fiatBalanceDisplayMemo;

                      return (
                        <View style={styles.cardBalanceGroup}>
                          {/* Balance display - supports skeleton screen */}
                          {isDataLoading ? (
                            <View
                              style={[
                                VaultScreenStyle.cardBalance,
                                styles.cardBalanceInline,
                              ]}
                            >
                              <DataSkeleton
                                width={52}
                                height={20}
                                isDarkMode={isDarkMode}
                                style={{ opacity: 0.2 }}
                              />
                            </View>
                          ) : (
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}
                              style={[
                                VaultScreenStyle.cardBalance,
                                styles.cardBalanceInline,
                                isBlackText && { color: "#121518" },
                              ]}
                            >
                              {hideNumbers
                                ? `${maskAmountStr(formattedBalance)}  ${
                                    card.shortName
                                  }`
                                : `${formattedBalance}  ${card.shortName}`}
                            </Text>
                          )}

                          {/* Price change view - supports skeleton screen */}
                          <View
                            style={[
                              VaultScreenStyle.priceChangeView,
                              styles.priceChangeInline,
                            ]}
                          >
                            {isDataLoading ? (
                              <>
                                <DataSkeleton
                                  width={52}
                                  height={18}
                                  isDarkMode={isDarkMode}
                                  style={{ opacity: 0.2 }}
                                />
                                <DataSkeleton
                                  width={66}
                                  height={18}
                                  isDarkMode={isDarkMode}
                                  style={{ opacity: 0.2 }}
                                />
                              </>
                            ) : (
                              <>
                                <Text
                                  style={{
                                    color: textColor,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {`${
                                    percentageChange > 0 ? "+" : ""
                                  }${percentageChange}%`}
                                </Text>
                                <Text
                                  style={[
                                    VaultScreenStyle.balShortNameCtr,
                                    isBlackText && { color: "#121518" },
                                  ]}
                                >
                                  {hideNumbers
                                    ? `${maskAmountStr(
                                        fiatBalanceDisplay,
                                      )} ${currencyUnit}`
                                    : `${fiatBalanceDisplay} ${currencyUnit}`}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })()
                  : isCardExpanded && (
                      <View style={VaultScreenStyle.cardModalContent}>
                        {["carBalCen", "balShortNameCtr"].map((styleKey, i) => {
                          if (isDataLoading) {
                            const skeletonWidth = 160;
                            const skeletonHeight = i === 0 ? 28 : 22;
                            return (
                              <View
                                key={i}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "baseline",
                                  justifyContent: "center",
                                  marginBottom:
                                    StyleSheet.flatten(
                                      VaultScreenStyle[styleKey],
                                    )?.marginBottom || 0,
                                }}
                              >
                                <DataSkeleton
                                  width={skeletonWidth}
                                  height={skeletonHeight}
                                  isDarkMode={isDarkMode}
                                  style={{ opacity: 0.2 }}
                                />
                              </View>
                            );
                          }
                          const rawValue =
                            i === 0
                              ? formatBalance(runtimeBalance, {
                                  symbol: card.shortName,
                                  context: "CardItem.modalBalance",
                                  compactLarge: false,
                                })
                              : getConvertedBalance(
                                  runtimeBalance,
                                  card.shortName,
                                  "CardItem.modalFiat",
                                );
                          const numericValue = Number(rawValue);
                          const displayValue = Number.isFinite(numericValue)
                            ? typeof rawValue === "string"
                              ? rawValue
                              : numericValue.toFixed(2)
                            : (() => {
                                console.log(
                                  `[Vault][CardItem] modal display value is non-finite, using 0.00 -- card=${card.shortName}, index=${i}, raw=${rawValue}, balance=${runtimeBalance}`,
                                );
                                return "0.00";
                              })();
                          const decimals = (() => {
                            const fractional =
                              String(displayValue).split(".")[1];
                            return fractional ? fractional.length : 0;
                          })();
                          const unitLabel =
                            i === 0 ? card.shortName : currencyUnit;
                          const flattenedStyle = StyleSheet.flatten([
                            VaultScreenStyle[styleKey],
                            isBlackText && { color: "#121518" },
                          ]);
                          const { marginBottom, ...textStyle } =
                            flattenedStyle || {};
                          const showMask = hideNumbers;
                          return (
                            <View
                              key={i}
                              style={{
                                flexDirection: "row",
                                alignItems: "baseline",
                                justifyContent: "center",
                                marginBottom: marginBottom || 0,
                              }}
                            >
                              {showMask ? (
                                <Text style={[textStyle, { marginBottom: 0 }]}>
                                  {`${maskAmountStr(displayValue)} ${unitLabel}`}
                                </Text>
                              ) : (
                                <>
                                  <CountUpText
                                    value={
                                      Number.isFinite(numericValue)
                                        ? numericValue
                                        : 0
                                    }
                                    decimals={decimals}
                                    style={textStyle}
                                  />
                                  <Text style={[textStyle, { marginLeft: 4 }]}>
                                    {unitLabel}
                                  </Text>
                                </>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
              </ImageBackground>
            </View>
          </Animated.View>
        </TouchableHighlight>
      </Reanimated.View>
    </>
  );
};

export default React.memo(CardItem, (prev, next) => {
  // Only compare key fields that will affect rendering, ignore function/AnimatedValue reference changes, and reduce unnecessary re-rendering
  return (
    prev.index === next.index &&
    prev.modalVisible === next.modalVisible &&
    prev.hideOtherCards === next.hideOtherCards &&
    prev.isClosing === next.isClosing &&
    prev.isCardExpanded === next.isCardExpanded &&
    prev.selectedCardIndex === next.selectedCardIndex &&
    prev.elevateDuringReturn === next.elevateDuringReturn &&
    prev.card?.balance === next.card?.balance &&
    prev.card?.address === next.card?.address &&
    prev.card?.name === next.card?.name &&
    prev.card?.shortName === next.card?.shortName &&
    prev.card?.queryChainName === next.card?.queryChainName &&
    prev.card?.queryChainShortName === next.card?.queryChainShortName &&
    prev.card?.cardImage === next.card?.cardImage &&
    prev.currencyUnit === next.currencyUnit &&
    prev.textColor === next.textColor &&
    prev.percentageChange === next.percentageChange &&
    prev.isBlackText === next.isBlackText &&
    prev.hideNumbers === next.hideNumbers &&
    prev.isDataLoading === next.isDataLoading &&
    prev.bringToFrontCardIndex === next.bringToFrontCardIndex &&
    prev.freezeNumbers === next.freezeNumbers &&
    prev.isJiggleMode === next.isJiggleMode &&
    prev.stableId === next.stableId &&
    prev.draggingStableId === next.draggingStableId &&
    prev.latestSwapEvent?.seq === next.latestSwapEvent?.seq &&
    prev.latestSwapEvent?.movingId === next.latestSwapEvent?.movingId &&
    prev.latestSwapEvent?.targetId === next.latestSwapEvent?.targetId &&
    prev.latestSwapEvent?.direction === next.latestSwapEvent?.direction &&
    prev.isDeleteSelected === next.isDeleteSelected &&
    prev.showGasFeeIcon === next.showGasFeeIcon &&
    prev.orderIndex === next.orderIndex
  );
});
