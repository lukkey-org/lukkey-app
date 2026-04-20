/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// utils/OnboardingScreen.js
import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import {
  AppState,
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Platform,
  PanResponder,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { languages } from "../config/languages";
import i18n from "../config/i18n";
import { BlurView } from "expo-blur";
import * as Notifications from "expo-notifications";
import { DeviceContext } from "./DeviceContext";
import checkAndReqPermission, {
  isAndroidBlePermissionGranted,
  isBlePermissionGrantedByState,
  requestIosBlePermission,
} from "./BluetoothPermissions";

let NavigationBarRef = null;
try {
  NavigationBarRef = require("expo-navigation-bar");
} catch (e) {
  NavigationBarRef = null;
}

const { width, height } = Dimensions.get("window");
const AUTO_ADVANCE_MS = 8000;
const PROGRESS_TRACK_WIDTH = 36;
const ENTRY_STAGGER_MS = 180;
const ENTRY_INITIAL_DELAY_MS = 320;
const SLIDE_IMAGE_WIDTH_RATIO = 0.8;
const SLIDE_IMAGE_MAX_WIDTH_PX = 420;
const SLIDE_23_WIDTH_MULTIPLIER = 1.5;
const IOS_BLE_PERMISSION_DECIDED_KEY = "iosBlePermissionDecided";

// Calculate the final display size based on the original image size and available area.
const fitSize = (srcW, srcH, maxW, maxH) => {
  if (!srcW || !srcH || !maxW || !maxH) {
    return {
      width: Math.min(maxW || 0, srcW || 0),
      height: Math.min(maxH || 0, srcH || 0),
    };
  }
  const ratio = Math.min(maxW / srcW, maxH / srcH);
  return { width: Math.round(srcW * ratio), height: Math.round(srcH * ratio) };
};

const OnboardingScreen = ({ onDone }) => {
  const { bleManagerRef } = useContext(DeviceContext);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentSlideKey, setCurrentSlideKey] = useState(0);
  const [renderedSlideIndex, setRenderedSlideIndex] = useState(0);
  const [hasSeenLastSlide, setHasSeenLastSlide] = useState(false);
  const [showPermissionStep, setShowPermissionStep] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [blePermGranted, setBlePermGranted] = useState(false);
  const [iosBleProbeEnabled, setIosBleProbeEnabled] = useState(false);
  const [iosBleProbeReady, setIosBleProbeReady] = useState(Platform.OS !== "ios");
  const iosNotifRequestAttemptedRef = useRef(false);
  const iosBleRequestAttemptedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const imageAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimeoutRef = useRef(null);
  const entryTimeoutRef = useRef(null);
  const [isSwitching, setIsSwitching] = useState(true);
  const [langBtnTopY, setLangBtnTopY] = useState(null);
  const [langTextTopOffset, setLangTextTopOffset] = useState(null);
  const [paginationTopY, setPaginationTopY] = useState(null);
  const window = useWindowDimensions();

  // Supports sliding left and right to switch guide pages
  const currentIndexRef = useRef(currentSlideKey);
  useEffect(() => {
    currentIndexRef.current = currentSlideKey;
  }, [currentSlideKey]);

  const SWIPE_THRESHOLD = 50;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10,
      onPanResponderRelease: (_, gestureState) => {
        const idx = currentIndexRef.current;
        if (gestureState.dx <= -SWIPE_THRESHOLD) {
          goToSlide(idx + 1);
        } else if (gestureState.dx >= SWIPE_THRESHOLD) {
          goToSlide(idx - 1);
        }
      },
    }),
  ).current;

  useEffect(() => {
    (async () => {
      try {
        const value = await AsyncStorage.getItem("language");
        if (value) {
          setSelectedLanguage(value);
          i18n.changeLanguage(value);
          return;
        }
        const legacyValue = await AsyncStorage.getItem("selectedLanguage");
        if (legacyValue) {
          setSelectedLanguage(legacyValue);
          i18n.changeLanguage(legacyValue);
          await AsyncStorage.setItem("language", legacyValue);
          await AsyncStorage.removeItem("selectedLanguage");
        }
      } catch (_e) {}
    })();
  }, []);

  const markIosBlePermissionDecided = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      await AsyncStorage.setItem(IOS_BLE_PERMISSION_DECIDED_KEY, "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    (async () => {
      try {
        const decided = await AsyncStorage.getItem(IOS_BLE_PERMISSION_DECIDED_KEY);
        if (mounted && decided === "1") {
          setIosBleProbeEnabled(true);
        }
      } catch {
      } finally {
        if (mounted) setIosBleProbeReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshNotifStatus = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      const granted = perm?.status === "granted" || perm?.granted === true;
      setNotifGranted(!!granted);
    } catch {
      setNotifGranted(false);
    }
  }, []);

  const refreshBlePermStatus = useCallback(async (options = {}) => {
    const forceIosProbe = options?.forceIosProbe === true;
    try {
      if (Platform.OS === "android") {
        const granted = await isAndroidBlePermissionGranted();
        setBlePermGranted(!!granted);
        return;
      }
      const shouldProbeIos = iosBleProbeEnabled || forceIosProbe;
      if (!shouldProbeIos) {
        setBlePermGranted(false);
        return;
      }
      const mgr = bleManagerRef?.current;
      if (mgr?.state) {
        const state = await mgr.state();
        setBlePermGranted(isBlePermissionGrantedByState(state));
        if (state !== "Unknown") {
          await markIosBlePermissionDecided();
        }
      } else {
        setBlePermGranted(false);
      }
    } catch {
      setBlePermGranted(false);
    }
  }, [bleManagerRef, iosBleProbeEnabled, markIosBlePermissionDecided]);

  useEffect(() => {
    if (!showPermissionStep) return;
    if (!iosBleProbeReady) return;
    refreshNotifStatus();
    refreshBlePermStatus();
  }, [iosBleProbeReady, refreshBlePermStatus, refreshNotifStatus, showPermissionStep]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!showPermissionStep) return;
    if (!iosBleProbeReady) return;

    let unsub = null;
    try {
      const mgr = bleManagerRef?.current;
      if (mgr?.onStateChange) {
        unsub = mgr.onStateChange(
          (state) => {
            const nextState = state || "Unknown";
            const granted = isBlePermissionGrantedByState(nextState);
            setBlePermGranted(granted);
            if (granted) {
              setIosBleProbeEnabled(true);
            }
            if (nextState !== "Unknown") {
              markIosBlePermissionDecided();
            }
          },
          true,
        );
      }
    } catch {}

    return () => {
      try {
        unsub?.remove?.();
      } catch {}
    };
  }, [
    bleManagerRef,
    iosBleProbeReady,
    markIosBlePermissionDecided,
    showPermissionStep,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (
        showPermissionStep &&
        iosBleProbeReady &&
        (prevState === "inactive" || prevState === "background") &&
        nextState === "active"
      ) {
        refreshNotifStatus();
        refreshBlePermStatus({ forceIosProbe: Platform.OS === "ios" });
      }
    });

    return () => {
      sub?.remove?.();
    };
  }, [iosBleProbeReady, refreshBlePermStatus, refreshNotifStatus, showPermissionStep]);

  // Android navigation bar background and button style settings to avoid white areas at the bottom
  useEffect(() => {
    if (Platform.OS === "android" && NavigationBarRef) {
      try {
        NavigationBarRef.setButtonStyleAsync?.("light");
      } catch (_e) {}
    }
  }, []);

  // Define slides based on the current language.
  const slides = [
    {
      key: "slide1",
      title: i18n.t("Welcome"),
      text: i18n.t("Your secure and intuitive companion app."),
      image: require("../assets/images/slider/slider1.webp"),
    },
    {
      key: "slide2",
      title: i18n.t("Manage Your Assets"),
      text: i18n.t("Easily manage multiple asset types."),
      image: require("../assets/images/slider/slider2.gif"),
    },
    {
      key: "slide3",
      title: i18n.t("Secure and Reliable"),
      text: i18n.t("Robust security designed for your information."),
      image: require("../assets/images/slider/slider3.gif"),
    },
  ];

  const handleLanguageChange = async (lang) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    await AsyncStorage.setItem("language", lang);
    setLanguageModalVisible(false);
  };

  const requestNotifPermission = async () => {
    let granted = false;
    try {
      const res = await Notifications.requestPermissionsAsync();
      granted = res?.status === "granted" || res?.granted === true;
    } catch {}
    const shouldOpenSettings =
      Platform.OS === "ios" ? iosNotifRequestAttemptedRef.current && !granted : !granted;
    iosNotifRequestAttemptedRef.current = true;
    if (shouldOpenSettings) {
      try {
        await Linking.openSettings?.();
      } catch {}
    }
    await refreshNotifStatus();
  };

  const requestBluetoothPermission = async () => {
    let granted = false;
    if (Platform.OS === "android") {
      try {
        granted = await checkAndReqPermission();
      } catch {}
    } else if (Platform.OS === "ios") {
      setIosBleProbeEnabled(true);
      await markIosBlePermissionDecided();
      granted = await requestIosBlePermission(bleManagerRef);
    } else {
      granted = true;
    }
    // Apply the request result to UI immediately, then verify in background.
    setBlePermGranted(!!granted);
    const shouldOpenSettings =
      Platform.OS === "ios" ? iosBleRequestAttemptedRef.current && !granted : !granted;
    iosBleRequestAttemptedRef.current = true;
    if (shouldOpenSettings) {
      try {
        await Linking.openSettings?.();
      } catch {}
    }
    refreshBlePermStatus({ forceIosProbe: Platform.OS === "ios" });
  };

  const startAnimation = () => {
    // First reset each sub-animation to 0 (use 0ms Animated.timing to avoid direct setValue causing frozen object errors)
    Animated.parallel([
      Animated.timing(imageAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(titleAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Show the container and then start the waterfall flow: the container is delayed until the first sub-animation starts to be visible to avoid flashing before the animation
      if (entryTimeoutRef.current) {
        clearTimeout(entryTimeoutRef.current);
      }
      entryTimeoutRef.current = setTimeout(() => {
        setIsSwitching(false);
      }, ENTRY_INITIAL_DELAY_MS);
      Animated.parallel([
        Animated.timing(imageAnim, {
          toValue: 1,
          duration: 520,
          delay: ENTRY_INITIAL_DELAY_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 420,
          delay: ENTRY_INITIAL_DELAY_MS + ENTRY_STAGGER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleAnim, {
          toValue: 1,
          duration: 420,
          delay: ENTRY_INITIAL_DELAY_MS + ENTRY_STAGGER_MS * 2,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const clampSlideIndex = (index) =>
    Math.max(0, Math.min(index, slides.length - 1));

  const restartAutoAdvanceTimer = () => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: AUTO_ADVANCE_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      const nextIndex =
        currentIndexRef.current >= slides.length - 1
          ? 0
          : currentIndexRef.current + 1;
      goToSlide(nextIndex);
    }, AUTO_ADVANCE_MS);
  };

  // Before switching, synchronize and reset each entry animation to 0 to avoid flashing content at the moment of switching.
  const goToSlide = (nextIndex) => {
    const targetIndex = clampSlideIndex(nextIndex);
    const prevIndex = currentIndexRef.current;
    if (targetIndex === prevIndex) {
      restartAutoAdvanceTimer();
      return;
    }

    try {
      imageAnim.stopAnimation && imageAnim.stopAnimation();
      titleAnim.stopAnimation && titleAnim.stopAnimation();
      subtitleAnim.stopAnimation && subtitleAnim.stopAnimation();
      progressAnim.stopAnimation && progressAnim.stopAnimation();
    } catch (_e) {}

    if (entryTimeoutRef.current) {
      clearTimeout(entryTimeoutRef.current);
      entryTimeoutRef.current = null;
    }

    // Reset values synchronously before rendering the next slide
    imageAnim.setValue(0);
    titleAnim.setValue(0);
    subtitleAnim.setValue(0);
    progressAnim.setValue(0);

    setIsSwitching(true);
    setRenderedSlideIndex(null);
    setCurrentSlideKey(targetIndex);
  };

  // Reset animation when the slide changes.
  useEffect(() => {
    setRenderedSlideIndex(currentSlideKey);
    startAnimation();
    restartAutoAdvanceTimer();
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      if (entryTimeoutRef.current) {
        clearTimeout(entryTimeoutRef.current);
      }
    };
  }, [currentSlideKey]);

  useEffect(() => {
    if (currentSlideKey >= slides.length - 1) {
      setHasSeenLastSlide(true);
    }
  }, [currentSlideKey, slides.length]);

  const renderItem = ({ item, index }) => {
    const availableHeight =
      langBtnTopY != null && paginationTopY != null
        ? Math.max(0, paginationTopY - langBtnTopY)
        : window.height;

    const shortest = Math.min(window.width, window.height);
    const isTablet = shortest >= 600;
    const isSmallPhone = shortest <= 360 || window.height <= 700;
    const isTallPhone =
      !isTablet && !isSmallPhone && window.height / window.width >= 2;

    const isSlideTwoOrThree = item?.key === "slide2" || item?.key === "slide3";
    const baseMaxW = Math.min(
      window.width * SLIDE_IMAGE_WIDTH_RATIO,
      SLIDE_IMAGE_MAX_WIDTH_PX,
    );
    const maxW = isSlideTwoOrThree
      ? baseMaxW * SLIDE_23_WIDTH_MULTIPLIER
      : baseMaxW;
    const maxHFactor = isSlideTwoOrThree
      ? 0.6
      : isTablet
        ? 0.58
        : isSmallPhone
          ? 0.42
          : isTallPhone
            ? 0.4
            : 0.48;
    const maxH = availableHeight * maxHFactor;
    const asset = Image.resolveAssetSource(item.image) || {};
    const { width: imgW, height: imgH } = fitSize(
      asset.width,
      asset.height,
      maxW,
      maxH,
    );
    const imageW = imgW || maxW;
    const imageH = imgH || maxH;
    const desiredTop = window.height * 0.4 - imageH / 2;
    const clampedTop = Math.max(
      0,
      Math.min(desiredTop, window.height - imageH),
    );
    const imageTop = Math.round(clampedTop);
    const imageLeft = Math.round((window.width - imageW) / 2);

    return (
      <LinearGradient colors={["#11100F", "#0B0A0A"]} style={styles.slide}>
        {/* by will: Optimize the color difference of the status bar on the boot page */}
        <StatusBar backgroundColor={"#0E0D0D"} barStyle="light-content" />
        <BlurView intensity={50} style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["#000000", "#332E23"]}
            //start={{ x: 0.5, y: 0 }}
            //  end={{ x: 0.5, y: 0.9 }}
            style={[StyleSheet.absoluteFillObject, { height: window.height }]}
          />
        </BlurView>
        {index !== currentSlideKey ? null : (
          <>
            <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
              <Animated.Image
                source={item.image}
                style={{
                  ...styles.image,
                  position: "absolute",
                  top: imageTop,
                  left: imageLeft,
                  width: imageW,
                  height: imageH,
                  transform: [
                    {
                      translateY: imageAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                  ],
                  opacity: imageAnim,
                }}
              />
            </View>
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.contentWrap,
                langBtnTopY != null && paginationTopY != null
                  ? {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: langBtnTopY,
                      height: paginationTopY - langBtnTopY,
                    }
                  : { flex: 1 },
                { opacity: isSwitching ? 0 : 1 },
              ]}
            >
              <View
                style={[
                  styles.textBlock,
                  { top: Math.round(availableHeight * 0.7) },
                ]}
              >
                <Animated.Text
                  style={[
                    styles.title,
                    {
                      opacity: titleAnim,
                      transform: [
                        {
                          translateY: titleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {item.title}
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.text,
                    {
                      opacity: subtitleAnim,
                      transform: [
                        {
                          translateY: subtitleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [12, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {item.text}
                </Animated.Text>
              </View>
            </Animated.View>
          </>
        )}
      </LinearGradient>
    );
  };

  const renderPagination = (activeIndex) => {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, PROGRESS_TRACK_WIDTH],
    });
    return (
      <>
        <View
          style={[
            styles.progressNav,
            {
              top:
                langBtnTopY != null && langTextTopOffset != null
                  ? langBtnTopY + langTextTopOffset + 4
                  : 70,
            },
          ]}
        >
          <View style={styles.dotsContainer}>
            {slides.map((_, i) => {
              const isActive = activeIndex === i;
              return (
                <View
                  key={i}
                  style={isActive ? styles.progressTrack : styles.dot}
                >
                  {isActive ? (
                    <Animated.View
                      style={[styles.progressFill, { width: progressWidth }]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View
          style={styles.paginationContainer}
          onLayout={(e) => setPaginationTopY(e.nativeEvent.layout.y)}
        >
          {hasSeenLastSlide ? (
            <TouchableOpacity
              style={[
                styles.nextButton,
                styles.fullWidthButton,
                { width: window.width * 0.9 },
              ]}
              onPress={() => setShowPermissionStep(true)}
            >
              <Text style={styles.buttonText}>{i18n.t("Continue")}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.leftBtn]}
                onPress={() => {
                  if (activeIndex <= 1) {
                    onDone();
                  } else {
                    goToSlide(activeIndex - 1);
                  }
                }}
              >
                <Text style={styles.buttonText}>
                  {activeIndex <= 1 ? i18n.t("Skip") : i18n.t("Back")}
                </Text>
              </TouchableOpacity>

              <View style={{ width: 16 }} />

              <TouchableOpacity
                style={[styles.nextButton, styles.rightBtn]}
                onPress={() => {
                  goToSlide(activeIndex + 1);
                }}
              >
                <Text style={styles.buttonText}>{i18n.t("Next")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0E0D0D" }}>
      <TouchableOpacity
        style={styles.languageButton}
        onPress={() => setLanguageModalVisible(true)}
        onLayout={(e) => {
          const { y } = e.nativeEvent.layout;
          setLangBtnTopY(y);
        }}
      >
        <Text
          style={styles.buttonText}
          onLayout={(e) => setLangTextTopOffset(e.nativeEvent.layout.y)}
        >
          {languages.find((lang) => lang.code === selectedLanguage).name}
        </Text>
      </TouchableOpacity>
      <Modal
        animationType="fade"
        transparent={true}
        visible={languageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <ScrollView style={{ width: "100%" }}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={styles.languageOption}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <Text style={styles.languageText}>{lang.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {showPermissionStep ? (
        <LinearGradient colors={["#11100F", "#0B0A0A"]} style={styles.slide}>
          <StatusBar backgroundColor={"#0E0D0D"} barStyle="light-content" />
          <BlurView intensity={50} style={StyleSheet.absoluteFillObject}>
            <LinearGradient
              colors={["#000000", "#332E23"]}
              style={[StyleSheet.absoluteFillObject, { height: window.height }]}
            />
          </BlurView>
          <View style={styles.permissionWrap}>
            <View style={styles.permissionIntroGroup}>
              <Text style={styles.permissionTitle}>{i18n.t("Permissions")}</Text>
              <Text style={styles.permissionSubtitle}>
                {i18n.t(
                  "Bluetooth connects your Lukkey device. Notifications keep you updated.",
                )}
              </Text>
            </View>

            <View style={styles.permissionMiddleZone}>
              <View style={styles.permissionCard}>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionLabel}>
                      {i18n.t("Bluetooth Permission")}
                    </Text>
                    <Text
                      style={[
                        styles.permissionStatus,
                        { color: blePermGranted ? "#3CDA84" : "#FF6B6B" },
                      ]}
                    >
                      {blePermGranted
                        ? i18n.t("Authorized")
                        : i18n.t("Not Authorized")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      blePermGranted
                        ? styles.permissionDoneBtn
                        : styles.permissionActionBtn,
                    ]}
                    onPress={requestBluetoothPermission}
                  >
                    <Text style={styles.permissionBtnText}>
                      {blePermGranted ? i18n.t("Granted") : i18n.t("Enable")}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.permissionDivider} />

                <View style={styles.permissionRow}>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionLabel}>
                      {i18n.t("Notification Permission")}
                    </Text>
                    <Text
                      style={[
                        styles.permissionStatus,
                        { color: notifGranted ? "#3CDA84" : "#FF6B6B" },
                      ]}
                    >
                      {notifGranted
                        ? i18n.t("Authorized")
                        : i18n.t("Not Authorized")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      notifGranted
                        ? styles.permissionDoneBtn
                        : styles.permissionActionBtn,
                    ]}
                    onPress={requestNotifPermission}
                  >
                    <Text style={styles.permissionBtnText}>
                      {notifGranted ? i18n.t("Granted") : i18n.t("Enable")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.permissionFooter}>
            <TouchableOpacity
              style={[
                styles.nextButton,
                styles.fullWidthButton,
                styles.permissionContinueBtn,
                { width: window.width * 0.9 },
              ]}
              onPress={onDone}
            >
              <Text style={styles.buttonText}>{i18n.t("Start Exploring")}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      ) : (
        <>
      <View style={{ flex: 1 }}>
        {renderedSlideIndex != null
          ? renderItem({
              item: slides[renderedSlideIndex],
              index: renderedSlideIndex,
            })
          : null}
        {renderPagination(currentSlideKey)}
      </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
  },
  contentWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: "#B8B8C5",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  image: {
    resizeMode: "contain",
    marginBottom: 32,
    alignSelf: "center",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    borderRadius: 15,
    marginTop: 20,
    padding: 10,
    borderColor: "#CCB68C",
    borderWidth: 1,
    marginBottom: 0,
  },
  nextButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    borderRadius: 15,
    marginTop: 20,
    padding: 10,
    backgroundColor: "#CCB68C",
  },
  doneButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    borderRadius: 15,
    marginTop: 20,
    padding: 10,
    backgroundColor: "#CCB68C",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  dot: {
    backgroundColor: "#8B8B96",
    height: 4,
    width: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  progressTrack: {
    backgroundColor: "#6C6C76",
    width: PROGRESS_TRACK_WIDTH,
    height: 4,
    borderRadius: 4,
    marginHorizontal: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#CCB68C",
    borderRadius: 4,
  },
  languageButton: {
    zIndex: 100,
    position: "absolute",
    top: 70,
    right: 20,
    padding: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    margin: 20,
    backgroundColor: "#4B4642",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    maxHeight: "60%",
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  languageOption: {
    padding: 10,
    alignItems: "center",
  },
  languageText: {
    fontSize: 18,
    color: "#FFF",
  },
  paginationContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
  },
  progressNav: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftBtn: {
    flex: 1,
  },
  rightBtn: {
    flex: 1,
  },
  fullWidthButton: {
    width: "90%",
    alignSelf: "center",
  },
  permissionWrap: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 120,
    paddingBottom: 132,
  },
  permissionIntroGroup: {
    width: "100%",
  },
  permissionMiddleZone: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
  },
  permissionTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  permissionSubtitle: {
    color: "#B8B8C5",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 18,
  },
  permissionCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(204,182,140,0.28)",
    borderRadius: 24,
    padding: 18,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  permissionCopy: {
    flex: 1,
    paddingRight: 12,
  },
  permissionLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  permissionStatus: {
    fontSize: 14,
  },
  permissionActionBtn: {
    minWidth: 92,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#CCB68C",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionDoneBtn: {
    minWidth: 92,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(60,218,132,0.18)",
    borderWidth: 1,
    borderColor: "rgba(60,218,132,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  permissionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 16,
  },
  permissionFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
  },
  permissionContinueBtn: {
    marginTop: 0,
  },
});

export default OnboardingScreen;
