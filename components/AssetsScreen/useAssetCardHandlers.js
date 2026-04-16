/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import { Animated, Easing, Platform, StatusBar } from "react-native";

const useAssetCardHandlers = ({
  selectedCardIndex,
  setIsClosing,
  setHideOtherCards,
  totalBalanceFreezeRef,
  totalBalanceMemo,
  setFreezeNumbers,
  balanceAnim,
  navigation,
  setIsCardExpanded,
  setTabReady,
  setElevateDuringReturn,
  modalAnim,
  backgroundAnim,
  tabOpacity,
  selectCardOffsetOpenAni,
  selectCardOffsetCloseAni,
  setModalVisible,
  setSelectedCardIndex,
  isClosingRef,
  scrollViewRef,
  setIsOpening,
  cardLayoutYRef,
  scrollYOffset,
  scrollCardToTop,
  pendingScrollIndexRef,
  cryptoCards,
  openStateCommittedRef,
  setSelectedCardChainShortName,
  setSelectedAddress,
  setSelectedCardName,
  setSelectedCardChain,
  setSelectedCrypto,
  cardStartPositions,
  selectCardTargetOffsetRef,
  tabRevealListenerIdRef,
  headerHeight,
  scrollContainerAbsYRef,
}) => {
  const closeModal = React.useCallback(() => {
    // ============ Close asset card details (event chain) ============
    // Trigger source A: TabView "Close/Return" -> Call closeModal()
    // Trigger source B: external setModalVisible(false) is intercepted by useEffect, and the unified walking animation is turned off
    // [Step 1] Mark closing phase isClosingRef/setIsClosing(true)
    // [Step 2] balanceAnim=1 displays total assets; synchronization routing isModalVisible=false
    // [Step 3] isCardExpanded=false; elevateDuringReturn=false
    // [Step 4] Parallel animation fade out: modalAnim/backgroundAnim/tabOpacity → 0
    // [Step 5] Card return selectCardOffsetOpenAni (slight overshoot → return to 0)
    // [Step 6] Reset the animation end callback: reset the animation value to zero, setModalVisible(false), clear selectedCardIndex, and reset the mark
    // ================================================
    // Record the current index to avoid homing failure caused by index changes during the animation process
    const currentIndex = selectedCardIndex;

    // Mark the entry into the closing stage (to avoid the bottom-up effect and preemptive reset leading to "hard cuts")
    isClosingRef.current = true; // [Step 1] Mark the shutdown stage to prevent the bottom-up effect from preemptively resetting
    setIsClosing(true);
    setHideOtherCards(false);
    // Freezes the digital display during the shutdown homing phase to avoid numerical fluctuations during the homing process.
    try {
      totalBalanceFreezeRef.current = totalBalanceMemo;
    } catch {}
    setFreezeNumbers(true);

    // Phase 0: Immediately restore the top information and routing status, but do not move the card yet
    try {
      balanceAnim.stopAnimation();
      balanceAnim.setValue(1); // [Step 2] Immediately display "Total Value" etc. (restore total assets at the top)
    } catch {}
    try {
      navigation.setParams({ isModalVisible: false }); // [Step 2] Sync Routing: Tag Details Off
    } catch {}

    // Hide card information layer
    setIsCardExpanded(false); // [Step 3] Hide card information layer
    setTabReady(false);

    // Immediately restore the correct hierarchical order at the beginning of the return process, first adjust and then perform the return animation
    try {
      setElevateDuringReturn(false); // [Step 3] Restore the level during the homing phase (no more temporary elevation)
    } catch {}

    // Start fading the background/Tab, but keep modalVisible=true until card reset is complete
    try {
      // [Step 4] Parallel animation fade out: modalAnim/backgroundAnim/tabOpacity → 0
      Animated.parallel([
        Animated.spring(modalAnim, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(tabOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } catch {}

    // Animation (card) required for homing
    const overshootPx = 6; // [Step 5] Slight overshoot before return to enhance the natural feeling
    const cardSpring = Animated.sequence([
      Animated.timing(selectCardOffsetOpenAni, {
        toValue: overshootPx,
        duration: 160,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(selectCardOffsetOpenAni, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const launchReturnAnimation = () =>
      cardSpring.start(() => {
        // [Step 6] Callback: Home completion -> Reset animation value, close Tab container, clear selected index and close flag
        // Double insurance: Force the displacement to be restored to 0 to avoid residual offset in edge cases
        try {
          selectCardOffsetOpenAni.setValue(0);
          selectCardOffsetCloseAni.setValue(0);
        } catch {}

        // Close the Tab container after the card is returned.
        setModalVisible(false);
        try {
          scrollViewRef?.current?.releaseScrollFreeze?.();
        } catch {}

        // Clear the selected index to avoid position abnormalities caused by switching transform sources during animation.
        setSelectedCardIndex(null);
        setHideOtherCards(false);
        // The homing animation is completed and the digital freeze is released.
        setFreezeNumbers(false);

        // Finally reset the shutdown flag
        isClosingRef.current = false;
        setIsClosing(false);
        setElevateDuringReturn(false);
      });

    const scheduleReturnAnimation =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 0);

    scheduleReturnAnimation(launchReturnAnimation);
  }, [
    selectedCardIndex,
    setIsClosing,
    setHideOtherCards,
    totalBalanceFreezeRef,
    totalBalanceMemo,
    setFreezeNumbers,
    balanceAnim,
    navigation,
    setIsCardExpanded,
    setTabReady,
    setElevateDuringReturn,
    modalAnim,
    backgroundAnim,
    tabOpacity,
    selectCardOffsetOpenAni,
    selectCardOffsetCloseAni,
    setModalVisible,
    setSelectedCardIndex,
    isClosingRef,
    scrollViewRef,
  ]);

  const handleCardPress = React.useCallback(
    (cryptoName, cryptoChain, index) => {
      if (isClosingRef?.current) {
        return false;
      }
      // ============ Asset card expansion (event chain) ============
      // [Step 1] CardItem onPress -> handleCardPress(name, chain, index)
      // [Step 2] Verify whether the card layout is completed
      // [Step 3] Find selected card data
      // [Step 4] Write the selected status (selectedCardName/selectedCardChain/selectedCrypto/...)
      // [Step 5] Immediately set selectedCardIndex, modalVisible and other statuses to delay submission
      // [Step 6] Record initial Y coordinates to cardStartPositions
      // [Step 7] isCardExpanded=true displays modal information layer
      // [Step 8] Start selectCardOffsetOpenAni elastic displacement (lift up)
      // [Step 9] Parallel animation: modalAnim/balanceAnim/backgroundAnim (fade in details/fade out total/display mask)
      // ==============================================
      const layoutY = cardLayoutYRef.current[index];
      if (!Number.isFinite(layoutY)) {
        console.log("Card layout is not measured and completed prematurely and needs to be dealt with");
        return false;
      }
      const currentScrollY = Number(scrollYOffset?.current) || 0;
      setTabReady(false);
      setIsOpening(true);
      // No longer automatically scrolls to the top of the card when expanded to avoid rebound after moving up
      pendingScrollIndexRef.current = null;

      // Find the data of this card
      const crypto = cryptoCards.find(
        (card) =>
          card.name === cryptoName && card.queryChainName === cryptoChain,
      );
      if (!crypto) {
        console.log("Card data not found, cancel expansion");
        return false;
      }

      // Do not reset in advance, let stopAnimation get the real starting point

      // Delay the submission of re-state to avoid triggering re-rendering in the same frame as the displacement animation
      const commitSelection = () => {
        if (openStateCommittedRef.current) return;
        openStateCommittedRef.current = true;
        setSelectedCardChainShortName(crypto.queryChainShortName || "");
        setSelectedAddress(String(crypto?.address || "").trim());
        setSelectedCardName(cryptoName);
        setSelectedCardChain(cryptoChain);
        setSelectedCrypto(crypto);
        setModalVisible(true);
      };
      openStateCommittedRef.current = false;

      // First mark the currently selected card index to ensure that the displacement animation has a target
      setSelectedCardIndex(index);
      setHideOtherCards(true);

      // Record initial position (corrected by current scroll offset)
      cardStartPositions.current[index] = layoutY - currentScrollY;

      // Make sure this card is on top
      setIsCardExpanded(true);

      // Expansion starts: Hide Tab first, the background reaches 0.6 first, and then display Tab after the displacement is completed.
      try {
        tabOpacity.setValue(0);
      } catch {}
      try {
        backgroundAnim.setValue(0.6);
      } catch {}

      // ===== Clean up old monitors to avoid overlapping triggers of multiple monitors =====
      if (tabRevealListenerIdRef.current != null) {
        try {
          selectCardOffsetOpenAni.removeListener(
            tabRevealListenerIdRef.current,
          );
        } catch {}
        tabRevealListenerIdRef.current = null;
      }

      const scheduleNextFrame =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (cb) => setTimeout(cb, 0);
      // Wait for Total Value to enter the absolute layout before calculating the displacement to avoid offset caused by layout race conditions.
      const waitForLayoutShift = () => {
        const latestLayoutY = cardLayoutYRef.current[index];
        const layoutShifted =
          Number.isFinite(latestLayoutY) &&
          Math.abs(latestLayoutY - layoutY) > 1;
        if (layoutShifted) {
          startCardTranslate();
          return;
        }
        scheduleNextFrame(waitForLayoutShift);
      };

      const startCardTranslate = () => {
        selectCardOffsetOpenAni.stopAnimation((currentValue) => {
          const startValue = Number.isFinite(currentValue) ? currentValue : 0;
          const latestLayoutY = Number.isFinite(cardLayoutYRef.current[index])
            ? cardLayoutYRef.current[index]
            : layoutY;
          const latestScrollY = Number(scrollYOffset?.current) || 0;
          const latestContainerAbsY =
            Number(scrollContainerAbsYRef?.current) || 0;
          const latestHeaderBottomY = Number(headerHeight) || 0;
          const cardTopToHeaderBottom =
            latestLayoutY -
            latestScrollY +
            latestContainerAbsY -
            latestHeaderBottomY;
          console.log(
            "🟧 Pre-shift distance: header bottom to card top Y",
            cardTopToHeaderBottom,
          );

          // ===== Expand animation target position (based on the distance from the bottom of the header to the top of the card) =====
          // Target: After expansion, the distance from the bottom of the header to the top of the card is -40px
          const statusBarOffset =
            Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;
          const targetOffset =
            Platform.OS === "android"
              ? -statusBarOffset - cardTopToHeaderBottom
              : -cardTopToHeaderBottom;
          selectCardTargetOffsetRef.current = targetOffset;

          if (!Number.isFinite(currentValue)) {
            selectCardOffsetOpenAni.setValue(startValue);
          }
          Animated.timing(selectCardOffsetOpenAni, {
            toValue: targetOffset,
            duration: Math.abs(targetOffset) > 500 ? 420 : 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            selectCardOffsetOpenAni.setValue(targetOffset);
            try {
              scrollViewRef?.current?.freezeScrollPosition?.();
            } catch {}
            try {
              const currentScrollY = Number(scrollYOffset?.current) || 0;
              const layoutY = cardLayoutYRef.current[index];
              const containerAbsY =
                Number(scrollContainerAbsYRef?.current) || 0;
              const headerBottomY = Number(headerHeight) || 0;
              if (Number.isFinite(layoutY)) {
                const endHeaderGap =
                  layoutY -
                  currentScrollY +
                  containerAbsY -
                  headerBottomY +
                  targetOffset;
                console.log(
                  "✅ After expand animation: header bottom to card top Y",
                  endHeaderGap,
                );
              }
            } catch {}
            commitSelection();
            setTabReady(true);
            Animated.parallel([
              Animated.timing(tabOpacity, {
                toValue: 1,
                useNativeDriver: true,
                duration: 160,
              }),
              Animated.timing(backgroundAnim, {
                toValue: 1,
                useNativeDriver: true,
                duration: 180,
              }),
            ]).start();
          });
        });
      };

      // First fade out the total assets at the top, and then start the card position animation
      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: 1,
          useNativeDriver: true,
          duration: 120,
        }),
        Animated.timing(balanceAnim, {
          toValue: 0,
          useNativeDriver: true,
          duration: 120,
        }),
      ]).start(() => {
        waitForLayoutShift();
      });
      return true;
    },
    [
      setTabReady,
      setIsOpening,
      cardLayoutYRef,
      scrollYOffset,
      scrollCardToTop,
      pendingScrollIndexRef,
      cryptoCards,
      selectCardOffsetOpenAni,
      openStateCommittedRef,
      setSelectedCardChainShortName,
      setSelectedAddress,
      setSelectedCardName,
      setSelectedCardChain,
      setSelectedCrypto,
      setModalVisible,
      setSelectedCardIndex,
      setHideOtherCards,
      cardStartPositions,
      setIsCardExpanded,
      tabOpacity,
      backgroundAnim,
      selectCardTargetOffsetRef,
      tabRevealListenerIdRef,
      modalAnim,
      balanceAnim,
      scrollViewRef,
      headerHeight,
      scrollContainerAbsYRef,
    ],
  );

  return { closeModal, handleCardPress };
};

export default useAssetCardHandlers;
