/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// CheckStatusModal.js
import React, { useContext, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { BlurView } from "../common/AppBlurView";
import { useTranslation } from "react-i18next";
import SuccessGif from "../../assets/animations/Success.webp";
import FailGif from "../../assets/animations/Fail.webp";
import EmptyGif from "../../assets/animations/Empty.webp";
import PendingGifLight from "../../assets/animations/pendingLight.webp";
import PendingGifDark from "../../assets/animations/pendingDark.webp";
import { DarkModeContext } from "../../utils/DeviceContext";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
import Clipboard from "@react-native-clipboard/clipboard";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import AnimatedWebP from "../common/AnimatedWebP";
import { getSecureItem } from "../../utils/secureStorage";
import DataSkeleton from "../AssetsScreen/DataSkeleton";
import DevToast from "../common/DevToast";

const RollingDigit = ({ digit, fontSize, color, duration }) => {
  const digitHeight = Math.round(fontSize * 1.2);
  const digitTextStyle = {
    fontSize,
    lineHeight: digitHeight,
    color,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    height: digitHeight,
  };
  const translateY = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    const numeric = Number(digit);
    if (!Number.isFinite(numeric)) return;
    const toValue = -digitHeight * numeric;
    if (isFirstRender.current) {
      translateY.setValue(toValue);
      isFirstRender.current = false;
      return;
    }
    Animated.timing(translateY, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [digit, digitHeight, duration, translateY]);

  return (
    <View style={{ height: digitHeight, overflow: "hidden" }}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Text key={i} style={digitTextStyle}>
            {i}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
};

const RollingNumber = ({ value, fontSize, color, duration }) => {
  const digitHeight = Math.round(fontSize * 1.2);
  const digitTextStyle = {
    fontSize,
    lineHeight: digitHeight,
    color,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    height: digitHeight,
  };
  const str = String(value);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: digitHeight,
      }}
    >
      {str.split("").map((ch, index) => {
        if (/\d/.test(ch)) {
          return (
            <RollingDigit
              key={`digit-${index}`}
              digit={ch}
              fontSize={fontSize}
              color={color}
              duration={duration}
            />
          );
        }
        return (
          <Text key={`char-${index}`} style={digitTextStyle}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
};

const FirmwareUpdateSkeleton = ({ isDarkMode }) => {
  return (
    <View style={{ width: "100%", marginTop: 18, paddingHorizontal: 16 }}>
      <View style={{ alignItems: "center" }}>
        <DataSkeleton width={190} height={20} isDarkMode={isDarkMode} />
        <DataSkeleton
          width={248}
          height={18}
          isDarkMode={isDarkMode}
          style={{ marginTop: 12 }}
        />
      </View>
    </View>
  );
};

const noWalletStyles = StyleSheet.create({
  content: {
    width: "100%",
    alignItems: "center",
  },
  titleStage: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  finalTitle: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  emptyImage: {
    width: 220,
    height: 245,
    marginTop: 14,
  },
  authSlot: {
    width: "100%",
    height: 56,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  authCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  authImageWrap: {
    marginRight: 12,
  },
  authImage: {
    width: 48,
    height: 48,
    resizeMode: "contain",
  },
  authTitleWrap: {
    flexShrink: 1,
  },
});

const CheckStatusModal = ({
  visible,
  status: statusProp,
  missingChains = [],
  onClose,
  setVerificationStatus,
  onOtaStart,
  otaFiles = [],
  progress: externalProgress, // New
  txHash, // New: Optional transaction hash display and copy
  titleOverride,
  subtitleOverride,
  imageOverride,
  allowClose = false,
  versionRefreshKey,
}) => {
  const { isDarkMode, setIsDarkMode } = useContext(DarkModeContext);
  const styles = SecureDeviceScreenStylesRoot(isDarkMode);
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [hwVersion, setHwVersion] = useState(null);
  const [btVersion, setBtVersion] = useState(null);
  const appVersion =
    Constants?.expoConfig?.extra?.appVersion ||
    Constants?.manifest?.extra?.appVersion ||
    "-";
  const status = statusProp;
  let imageSource;
  let title;
  let subtitle;
  const isPatchFile = (input) => {
    const raw = String(input || "").trim();
    const base = raw.split(/[?#]/)[0].split("/").pop() || "";
    return /\.patch$/i.test(base);
  };

  const isProgressState =
    status === "waiting" ||
    status === "nftSaving" ||
    status === "otaSending" ||
    status === "otaInstalling";
  const isNoWalletStatus =
    status === "noWalletInHardware" ||
    status === "noWalletInHardwareAuthentic" ||
    status === "noWalletInHardwareUnknown";
  const isNoWalletAuthentic = status === "noWalletInHardwareAuthentic";
  const noWalletTransition = useRef(new Animated.Value(0)).current;
  const noWalletEmptyOpacity = useRef(new Animated.Value(0)).current;
  const noWalletIntroTitleOpacity = useRef(new Animated.Value(1)).current;
  const noWalletSubtitleShake = useRef(new Animated.Value(0)).current;

  // Progress - remaining time estimate (only for OTA sending phase)
  const [etaSec, setEtaSec] = useState(null);
  const speedRef = useRef({ t: 0, p: 0, v: 0 });
  const lastEtaRef = useRef(null);

  // Format seconds as mm:ss or hh:mm:ss
  const formatETA = (s) => {
    if (s == null || !Number.isFinite(Number(s)) || s < 0) return null;
    const total = Math.ceil(s);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(
        seconds,
      ).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const parseSemver = (str) => {
    const raw = String(str || "").trim();
    const m = raw.match(/(\d+)[._-](\d+)[._-](\d+)/);
    if (!m) return null;
    return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
  };

  const compareSemver = (a, b) => {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    for (let i = 0; i < 3; i++) {
      const ai = Number(a[i] || 0);
      const bi = Number(b[i] || 0);
      if (ai > bi) return 1;
      if (ai < bi) return -1;
    }
    return 0;
  };

  const getNextByType = (list) => {
    const items = Array.isArray(list) ? list : [];
    const currentHW = parseSemver(hwVersion);
    const currentBT = parseSemver(btVersion);
    const next = {
      hardware: null,
      bluetooth: null,
    };
    items.forEach((f) => {
      const versionRaw = typeof f === "object" ? f?.version : null;
      const versionStr = String(versionRaw || "").trim();
      const isHWFromMap = /^hw_/i.test(versionStr);
      const isBTFromMap = /^bl_/i.test(versionStr);
      if (!isHWFromMap && !isBTFromMap) return;
      const normalizedVersion = versionStr
        ? versionStr.replace(/^hw_+/i, "").replace(/^bl_+/i, "").trim()
        : "";
      const nextVer = normalizedVersion || null;
      const nextSemver = parseSemver(nextVer);
      if (isHWFromMap && nextVer) {
        if (compareSemver(nextSemver, currentHW) > 0) {
          next.hardware = { version: nextVer, item: f };
        }
      } else if (isBTFromMap && nextVer) {
        if (compareSemver(nextSemver, currentBT) > 0) {
          next.bluetooth = { version: nextVer, item: f };
        }
      }
    });
    return next;
  };

  const nextByType = getNextByType(otaFiles);

  const upgradeSummaryLines = [
    nextByType.hardware
      ? `${t("Hardware")}: ${hwVersion ?? "-"} -> ${nextByType.hardware.version}`
      : null,
    nextByType.bluetooth
      ? `${t("Bluetooth")}: ${btVersion ?? "-"} -> ${nextByType.bluetooth.version}`
      : null,
  ].filter(Boolean);

  useEffect(() => {
    if (typeof externalProgress === "number") {
      setProgress(externalProgress);
      return;
    }
    let intervalId;
    if (status === "waiting") {
      setProgress(0);
      intervalId = setInterval(() => {
        setProgress((prev) => {
          const next = prev + 0.16;
          if (next >= 0.8) {
            clearInterval(intervalId);
            return 0.8;
          }
          return next;
        });
      }, 1000);
    } else {
      setProgress(0);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, externalProgress]);

  // Estimate the remaining time of OTA based on external progress externalProgress (only the otaSending stage, and starts after the official contract is issued)
  useEffect(() => {
    const BASE = 0.2; // The first 20% is the App download stage
    const SPAN = 0.8; // The last 80% is the device transmission stage
    const EPS = 1e-4;
    // Smoothing parameters
    const ALPHA_SPEED = 0.12; // EMA coefficient for transfer speed (smaller = smoother)
    const ALPHA_ETA = 0.18; // EMA coefficient of ETA (smaller = smoother)
    const MIN_DT = 0.35; // Update speed at least 350ms interval to avoid jitter
    const MIN_DP = 0.002; // At least 0.2% progress increment before calculating speed
    const MIN_V = 1e-6; // minimum speed
    const MAX_RATIO_JUMP = 0.25; // Single ETA relative jump upper limit (±25%)

    if (typeof externalProgress !== "number" || status !== "otaSending") {
      setEtaSec(null);
      speedRef.current = { t: 0, p: 0, v: 0 };
      lastEtaRef.current = null;
      return;
    }

    const now = Date.now() / 1000;
    const pRaw = Math.max(0, Math.min(1, externalProgress));

    // Do not start ETA calculation before entering the official contract issuance (pRaw ≤ 0.2)
    if (pRaw <= BASE + EPS) {
      setEtaSec(null);
      speedRef.current = { t: 0, p: 0, v: 0 };
      lastEtaRef.current = null;
      return;
    }

    // Normalize progress to device transfer stage [0,1]
    const p = Math.max(0, Math.min(1, (pRaw - BASE) / SPAN));

    let { t: lt, p: lp, v: lv } = speedRef.current;

    if (lt > 0) {
      const dt = now - lt;
      const dp = p - lp;

      if (dt >= MIN_DT && dp >= MIN_DP) {
        // instant speed
        let inst = dp / dt;
        // Velocity EMA Smoothing
        let v = lv > 0 ? lv * (1 - ALPHA_SPEED) + inst * ALPHA_SPEED : inst;

        // Limit the proportion of a single speed jump to avoid extreme values causing ETA jitter
        if (lv > 0) {
          const minV = Math.max(lv * (1 - MAX_RATIO_JUMP), MIN_V);
          const maxV = lv * (1 + MAX_RATIO_JUMP);
          v = Math.max(Math.min(v, maxV), minV);
        }
        v = Math.max(v, MIN_V);

        // Update speed and sampling points
        speedRef.current = { t: now, p, v };

        // Calculate new ETA (normalized progress for transfer phase)
        let eta = p < 0.999 ? (1 - p) / v : 0;

        // Perform EMA smoothing on ETA + single jump ratio limit
        const last = lastEtaRef.current;
        if (last != null) {
          let smoothed = last * (1 - ALPHA_ETA) + eta * ALPHA_ETA;
          const minEta = Math.max(last * (1 - MAX_RATIO_JUMP), 0);
          const maxEta = last * (1 + MAX_RATIO_JUMP);
          smoothed = Math.max(Math.min(smoothed, maxEta), minEta);
          lastEtaRef.current = smoothed;
          setEtaSec(smoothed);
        } else {
          lastEtaRef.current = eta;
          setEtaSec(eta);
        }
        return;
      } else {
        // When the change is not obvious, the ETA of the previous frame is used to avoid jittering back and forth in the value.
        if (lastEtaRef.current != null) {
          setEtaSec(lastEtaRef.current);
        }
        return;
      }
    }

    // The first valid sampling point only records time and progress.
    speedRef.current = { t: now, p, v: lv || 0 };
  }, [externalProgress, status]);

  // Load device hardware/Bluetooth version number for firmware update related views
  useEffect(() => {
    let cancelled = false;
    const loadVersions = async () => {
      if (
        (status === "firmwareUpdateInfo" ||
          status === "updateAvailable" ||
          status === "otaLatest") &&
        visible
      ) {
        try {
          const [hw, bt] = await Promise.all([
            getSecureItem("hardwareVersion"),
            getSecureItem("bluetoothVersion"),
          ]);
          if (!cancelled) {
            setHwVersion(hw || null);
            setBtVersion(bt || null);
          }
        } catch (e) {
          if (!cancelled) {
            setHwVersion(null);
            setBtVersion(null);
          }
        }
      }
    };
    loadVersions();
    return () => {
      cancelled = true;
    };
  }, [status, visible, versionRefreshKey]);

  if (status === "success") {
    imageSource = SuccessGif;
    title = t("Verification successful!");
    subtitle = t("You can now safely use the device.");
  } else if (status === "walletDeleted") {
    imageSource = SuccessGif;
    title = t("Success!");
    subtitle = t("Deleted successfully.");
  } else if (status === "walletReady") {
    imageSource = SuccessGif;
    title = t("Wallet ready!");
    subtitle = t("The wallet has been fully set up and is ready to use.");
  } else if (status === "accountMismatch") {
    imageSource = FailGif;
    title = t("Account Mismatch");
    subtitle = t(
      "This operation does not belong to the current wallet. Please check the information and try again.",
    );
  } else if (status === "txFail") {
    imageSource = FailGif;
    title = t("Transaction failed!");
    subtitle = t("The transaction could not be completed. Please try again.");
  } else if (status === "fail") {
    imageSource = FailGif;
    title = t("Verification failed!");
    subtitle = t(
      "The verification code you entered is incorrect. Please try again.",
    );
  } else if (status === "syncTimeout") {
    imageSource = FailGif;
    title = t("Synchronization timed out");
    subtitle = t(
      "Bluetooth connection is unresponsive. Please keep the device nearby and try again.",
    );
  } else if (status === "txInit") {
    imageSource = isDarkMode ? PendingGifDark : PendingGifLight;
    title = t("Waiting for approval on your device...");
    subtitle = t("Waiting for approval on your device...");
  } else if (status === "waiting") {
    imageSource = isDarkMode ? PendingGifDark : PendingGifLight;
    title = t("Creating wallet...");
    subtitle = t(
      "Receiving all addresses from the device. Wallet is being created, please wait...",
    );
  } else if (status === "nftSaving") {
    imageSource = isDarkMode ? PendingGifDark : PendingGifLight;
    title = t("Saving NFT to device...");
    subtitle = t(
      "Transferring image and text to your LUKKEY hardware. Please wait...",
    );
  } else if (status === "nftSaved") {
    imageSource = SuccessGif;
    title = t("NFT saved to device!");
    subtitle = t(
      "The NFT image has been successfully transferred to your device.",
    );
  } else if (status === "nftFail") {
    imageSource = FailGif;
    title = t("NFT saving failed");
    subtitle = t("The device did not respond in time. Please try again.");
  } else if (status === "firmwareUpdateInfo") {
    imageSource = undefined;
    title = t("Firmware Update");
    subtitle = "";
  } else if (status === "checkingUpdate") {
    imageSource = isDarkMode ? PendingGifDark : PendingGifLight;
    title = t("Checking for updates…");
    subtitle = t("Comparing server firmware with your device.");
  } else if (status === "otaReady") {
    imageSource = isDarkMode ? PendingGifDark : PendingGifLight;
    title = t("Preparing for update…");
    subtitle = t("Fetching firmware list, please wait...");
  } else if (status === "updateAvailable") {
    imageSource = undefined;
    title = t("Firmware update available");
    subtitle = "";
  } else if (status === "otaSending") {
    imageSource = isDarkMode ? PendingGifDark : PendingGifLight;
    title = t("Transferring firmware...");
    subtitle = t(
      "Sending OTA data to your device. Please keep the app active.",
    );
  } else if (status === "otaInstalling") {
    imageSource = isDarkMode ? PendingGifDark : PendingGifLight;
    title = t("Installing firmware...");
    subtitle = t(
      "The device is installing the firmware. Do not turn off the device.",
    );
  } else if (status === "otaLatest") {
    imageSource = SuccessGif;
    title = t("Your device is up to date");
    subtitle = t("No newer firmware found on the server.");
  } else if (status === "otaSuccess") {
    imageSource = SuccessGif;
    title = t("Firmware update complete");
    subtitle = t(
      "Transfer complete. Please wait while your Lukkey device finishes the update.",
    );
  } else if (status === "noDevice") {
    imageSource = FailGif;
    title = t("No device paired");
    subtitle = t(
      "Please pair your LUKKEY device, or make sure the paired device is nearby and powered on.",
    );
  } else if (status === "otaFail") {
    imageSource = FailGif;
    title = t("Firmware update failed!");
    subtitle = t("The device failed to update the firmware. Please try again.");
  } else if (status === "nftCancel") {
    imageSource = FailGif;
    title = t("NFT sending canceled");
    subtitle = t("You canceled the NFT transfer.");
  } else if (isNoWalletStatus) {
    imageSource = FailGif;
    title = t("No asset account found in LUKKEY hardware");
    subtitle = t(
      "Please create or import an asset account in your LUKKEY hardware device.",
    );
  }

  const normalizedSubtitleOverride =
    subtitleOverride == null
      ? subtitleOverride
      : String(subtitleOverride).includes("This contract is not supported")
        ? t("This contract is not supported.")
        : String(subtitleOverride);

  if (titleOverride != null) {
    title = titleOverride;
  }

  if (subtitleOverride != null) {
    subtitle = normalizedSubtitleOverride;
  }

  if (imageOverride) {
    imageSource = imageOverride;
  }

  const shouldShowCloseButton =
    allowClose || (!isProgressState && status !== "updateAvailable");
  const hasSubtitle =
    subtitle != null && String(subtitle).trim().length > 0;
  const isFirmwareUpdateSummary =
    status === "firmwareUpdateInfo" || status === "updateAvailable";
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [copyToastMessage, setCopyToastMessage] = useState("");
  const [copyToastKey, setCopyToastKey] = useState(0);
  const [shouldRenderNoWalletEmpty, setShouldRenderNoWalletEmpty] =
    useState(false);
  const [noWalletLayout, setNoWalletLayout] = useState({
    authSlot: null,
    closeTop: null,
    title: null,
  });

  const updateNoWalletLayout = (key, value) => {
    setNoWalletLayout((prev) => {
      const current = prev[key];
      if (
        current &&
        Math.abs((current.y || 0) - (value.y || 0)) < 0.5 &&
        Math.abs((current.height || 0) - (value.height || 0)) < 0.5
      ) {
        return prev;
      }
      return { ...prev, [key]: value };
    });
  };

  useEffect(() => {
    noWalletTransition.stopAnimation();
    noWalletEmptyOpacity.stopAnimation();
    noWalletIntroTitleOpacity.stopAnimation();
    noWalletSubtitleShake.stopAnimation();
    if (visible && isNoWalletStatus) {
      noWalletTransition.setValue(0);
      noWalletEmptyOpacity.setValue(0);
      noWalletIntroTitleOpacity.setValue(1);
      noWalletSubtitleShake.setValue(0);
      setShouldRenderNoWalletEmpty(false);
      const animation = Animated.sequence([
        Animated.delay(1800),
        Animated.timing(noWalletIntroTitleOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(noWalletTransition, {
          toValue: 1,
          duration: 620,
          easing: Easing.bezier(0.2, 0, 0, 1),
          useNativeDriver: true,
        }),
        Animated.timing(noWalletEmptyOpacity, {
          toValue: 0.001,
          duration: 1,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(noWalletEmptyOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(noWalletSubtitleShake, {
            toValue: 1,
            duration: 55,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(noWalletSubtitleShake, {
            toValue: -1,
            duration: 70,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(noWalletSubtitleShake, {
            toValue: 0.6,
            duration: 60,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(noWalletSubtitleShake, {
            toValue: 0,
            duration: 70,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]);
      animation.start();
      const renderTimer = setTimeout(() => {
        setShouldRenderNoWalletEmpty(true);
      }, 1800 + 180 + 620);
      return () => {
        clearTimeout(renderTimer);
        animation.stop();
      };
    }
    noWalletTransition.setValue(0);
    noWalletEmptyOpacity.setValue(0);
    noWalletIntroTitleOpacity.setValue(1);
    noWalletSubtitleShake.setValue(0);
    setShouldRenderNoWalletEmpty(false);
    return undefined;
  }, [
    isNoWalletStatus,
    noWalletEmptyOpacity,
    noWalletIntroTitleOpacity,
    noWalletSubtitleShake,
    noWalletTransition,
    visible,
  ]);

  const noWalletAuthTitle = isNoWalletAuthentic
    ? t("Authentic device")
    : t("Unknown device");
  const noWalletAuthImageSource = isNoWalletAuthentic
    ? require("../../assets/branding/AuthenticShield.png")
    : require("../../assets/branding/UnknownShield.png");
  const noWalletAuthColor = isNoWalletAuthentic
    ? isDarkMode
      ? "#E4C98F"
      : "#B67B52"
    : "#FFFFFF";
  const noWalletInitialTranslateY = (() => {
    const title = noWalletLayout.title;
    const authSlot = noWalletLayout.authSlot;
    const closeTop = noWalletLayout.closeTop?.y;
    if (!title || !authSlot || typeof closeTop !== "number") return -74;
    const titleBottom = title.y + title.height;
    const authCenter = authSlot.y + authSlot.height / 2;
    const availableCenter = titleBottom + (closeTop - titleBottom) / 2;
    return availableCenter - authCenter - 12;
  })();
  const noWalletAuthTranslateY = noWalletTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [noWalletInitialTranslateY, 0],
  });
  const noWalletAuthTranslateX = noWalletTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [130, 0],
  });
  const noWalletAuthScale = noWalletTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [3.75, 1],
  });
  const noWalletContentTranslateY = noWalletTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const noWalletSubtitleTranslateX = noWalletSubtitleShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-7, 0, 7],
  });
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={() => {
        if (onClose) onClose();
      }}
    >
      <BlurView style={styles.centeredView}>
        <DevToast
          key={`check-status-toast-${copyToastKey}`}
          visible={copyToastVisible}
          isDarkMode={isDarkMode}
          message={copyToastMessage}
          variant="success"
          autoHideDurationMs={1800}
          showCountdown
          onHide={() => setCopyToastVisible(false)}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (
              (status === "updateAvailable" ||
                status === "noDevice" ||
                status === "otaFail") &&
              onClose
            )
              onClose();
          }}
        />
        <View
          style={[
            styles.secCodeModalViewSecureDevice,
            isProgressState && {
              justifyContent: "space-between",
            },
            {
              position: "relative",
              top: 0,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {isNoWalletStatus ? (
            <View style={noWalletStyles.content}>
              <View
                style={noWalletStyles.titleStage}
                onLayout={(event) =>
                  updateNoWalletLayout("title", event.nativeEvent.layout)
                }
              >
                <Animated.Text
                  style={[
                    styles.modalTitle,
                    {
                      color: noWalletAuthColor,
                      opacity: noWalletIntroTitleOpacity,
                      textAlign: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {noWalletAuthTitle}
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.modalTitle,
                    noWalletStyles.finalTitle,
                    {
                      opacity: noWalletEmptyOpacity,
                      textAlign: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {title}
                </Animated.Text>
              </View>
              <Animated.View
                style={[
                  {
                    opacity: noWalletEmptyOpacity,
                    transform: [{ translateY: noWalletContentTranslateY }],
                  },
                ]}
              >
                {shouldRenderNoWalletEmpty ? (
                  <AnimatedWebP
                    key={`empty-wallet-${status}`}
                    source={EmptyGif}
                    style={noWalletStyles.emptyImage}
                    contentFit="contain"
                  />
                ) : (
                  <View style={noWalletStyles.emptyImage} />
                )}
              </Animated.View>
              <View
                style={noWalletStyles.authSlot}
                onLayout={(event) =>
                  updateNoWalletLayout("authSlot", event.nativeEvent.layout)
                }
              >
                <View style={noWalletStyles.authCard}>
                  <Animated.View
                    style={[
                      noWalletStyles.authImageWrap,
                      {
                        transform: [
                          { translateX: noWalletAuthTranslateX },
                          { translateY: noWalletAuthTranslateY },
                          { scale: noWalletAuthScale },
                        ],
                      },
                    ]}
                  >
                    <Image
                      source={noWalletAuthImageSource}
                      style={noWalletStyles.authImage}
                    />
                  </Animated.View>
                  <Animated.Text
                    style={[
                      styles.modalTitle,
                      noWalletStyles.authTitleWrap,
                      {
                        color: noWalletAuthColor,
                        opacity: noWalletEmptyOpacity,
                        textAlign: "left",
                      },
                    ]}
                  >
                    {noWalletAuthTitle}
                  </Animated.Text>
                </View>
              </View>
              <Animated.View
                style={{
                  opacity: noWalletEmptyOpacity,
                  transform: [
                    { translateY: noWalletContentTranslateY },
                    { translateX: noWalletSubtitleTranslateX },
                  ],
                }}
              >
                {hasSubtitle ? (
                  <Text
                    style={[
                      styles.modalSubtitle,
                      { color: "#FF5252", marginTop: 16 },
                    ]}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </Animated.View>
            </View>
          ) : (
            <>
              {imageSource ? (
                <AnimatedWebP
                  key={status}
                  source={imageSource}
                  style={{ width: 120, height: 120 }}
                  contentFit="contain"
                />
              ) : null}
              <Text
                style={[
                  styles.modalTitle,
                  {
                    textAlign: "center",
                    width: "100%",
                    marginBottom: isFirmwareUpdateSummary ? 6 : 0,
                  },
                ]}
              >
                {title}
              </Text>
          {(status === "waiting" ||
            status === "nftSaving" ||
            status === "otaSending" ||
            status === "otaInstalling") && (
            <View
              style={{
                height: 10,
                width: "80%",
                backgroundColor: "#e0e0e0",
                borderRadius: 5,
                marginTop: 16,
                marginBottom: 8,
                overflow: "hidden",
                alignSelf: "center",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
                  backgroundColor: isDarkMode ? "#CCB68C" : "#CFAB95",
                  borderRadius: 5,
                }}
              />
            </View>
          )}
          {(status === "waiting" ||
            status === "nftSaving" ||
            status === "otaSending" ||
            status === "otaInstalling") &&
            typeof externalProgress === "number" && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 0,
                }}
              >
                <Text
                  style={{
                    color: "#888",
                    fontSize: 14,
                    lineHeight: Math.round(14 * 1.2),
                    includeFontPadding: false,
                    textAlignVertical: "center",
                    height: Math.round(14 * 1.2),
                  }}
                >
                  {t("Synchronized")}{" "}
                </Text>
                <RollingNumber
                  value={Math.round(progress * 100)}
                  fontSize={14}
                  color="#888"
                  duration={140}
                />
                <Text
                  style={{
                    color: "#888",
                    fontSize: 14,
                    lineHeight: Math.round(14 * 1.2),
                    includeFontPadding: false,
                    textAlignVertical: "center",
                    height: Math.round(14 * 1.2),
                  }}
                >
                  %
                </Text>
              </View>
            )}

          {status === "otaSending" && typeof externalProgress === "number" ? (
            <Text style={{ textAlign: "center", marginTop: 8, color: "#888" }}>
              {etaSec == null
                ? t("Estimating remaining time…")
                : t("Estimated remaining: {{time}}", {
                    time: formatETA(etaSec) || t("Less than 1s"),
                  })}
            </Text>
          ) : null}
          {(status === "otaSending" || status === "otaInstalling") &&
          upgradeSummaryLines.length > 0 ? (
            <View style={{ width: "100%", marginTop: 12, paddingHorizontal: 24 }}>
              {upgradeSummaryLines.map((line) => (
                <Text
                  key={line}
                  style={[
                    styles.modalSubtitle,
                    {
                      textAlign: "center",
                      color: isDarkMode ? "#b8b8b8" : "#777",
                      marginTop: 2,
                    },
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
          {hasSubtitle ? (
            <Text
              style={[
                styles.modalSubtitle,
                { marginTop: isProgressState ? 24 : 16 },
                isProgressState && { marginBottom: 16 },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}

          {/* New: Transaction hash display and copy (compatible with the function of replacing ActivityProgressModal) */}
          {txHash ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
                marginBottom: 8,
                width: "90%",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      fontSize: 12,
                      color: isDarkMode ? "#AFAFAF" : "#666",
                      textAlign: "left",
                    },
                  ]}
                >
                  {t("Transaction Hash")}:
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      fontSize: 12,
                      color: isDarkMode ? "#AFAFAF" : "#666",
                      textAlign: "left",
                      marginTop: 8,
                    },
                  ]}
                >
                  {txHash}
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await Clipboard.setString(txHash);
                    setCopyToastMessage(t("Transaction hash copied to clipboard"));
                    setCopyToastVisible(true);
                    setCopyToastKey((value) => value + 1);
                  } catch {}
                }}
                style={{ padding: 8 }}
              >
                <MaterialIcons
                  name="content-copy"
                  size={20}
                  color={isDarkMode ? "#AFAFAF" : "#666"}
                />
              </TouchableOpacity>
            </View>
          ) : null}

          {(status === "firmwareUpdateInfo" || status === "updateAvailable") && (
            <>
              <View
                style={{
                  width: "100%",
                  marginTop: isFirmwareUpdateSummary ? 6 : 8,
                  paddingHorizontal: 16,
                }}
              >
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      textAlign: "center",
                      color: isDarkMode ? "#d2d2d2" : "#666",
                      fontWeight: "600",
                    },
                  ]}
                >
                  {t("Current device")}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      textAlign: "center",
                      color: isDarkMode ? "#c8c8c8" : "#666",
                    },
                  ]}
                >
                  App: {appVersion}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      textAlign: "center",
                      color: isDarkMode ? "#c8c8c8" : "#666",
                    },
                  ]}
                >
                  {t("Hardware")}: {hwVersion ?? "-"}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      textAlign: "center",
                      color: isDarkMode ? "#c8c8c8" : "#666",
                    },
                  ]}
                >
                  {t("Bluetooth")}: {btVersion ?? "-"}
                </Text>
              </View>
              <View style={{ width: "100%", minHeight: 72 }}>
                {status === "firmwareUpdateInfo" ? (
                  <FirmwareUpdateSkeleton isDarkMode={isDarkMode} />
                ) : null}
                {status === "updateAvailable" ? (
                  <>
                    <View
                      style={{
                        overflow: "hidden",
                        alignSelf: "stretch",
                        width: "100%",
                      }}
                    >
                      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                        <Text
                          style={[
                            styles.modalSubtitle,
                            {
                              textAlign: "center",
                              color: isDarkMode ? "#aaa" : "#666",
                              fontWeight: "600",
                            },
                          ]}
                        >
                          {t("New firmware available")}
                        </Text>
                        {upgradeSummaryLines.map((line) => (
                          <View
                            key={line}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: "#FF5252",
                                marginRight: 8,
                              }}
                            />
                            <Text
                              style={[
                                styles.modalSubtitle,
                                {
                                  textAlign: "center",
                                  color: isDarkMode ? "#aaa" : "#666",
                                  fontWeight: "600",
                                },
                              ]}
                            >
                              {line}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View
                      style={{
                        marginTop: 24,
                        width: "100%",
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          if (setVerificationStatus) setVerificationStatus(null);
                          if (onClose) onClose();
                        }}
                        style={[
                          styles.cancelButton,
                          { flex: 1, marginRight: 10, borderRadius: 15 },
                        ]}
                      >
                        <Text style={styles.cancelButtonText}>{t("Later")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          try {
                            setVerificationStatus &&
                              setVerificationStatus("otaSending");
                          } catch {}
                          const nextByType = getNextByType(otaFiles);
                          let selected = null;
                          if (nextByType.bluetooth && !nextByType.hardware) {
                            selected = nextByType.bluetooth.item;
                          } else if (
                            nextByType.hardware &&
                            !nextByType.bluetooth
                          ) {
                            selected = nextByType.hardware.item;
                          } else {
                            selected =
                              Array.isArray(otaFiles) && otaFiles.length > 0
                                ? otaFiles[0]
                                : null;
                          }
                          const url =
                            selected && (selected.url ? selected.url : selected);
                          if (url && typeof onOtaStart === "function")
                            onOtaStart(url);
                        }}
                        style={[
                          styles.confirmButton,
                          { flex: 1, marginLeft: 10, borderRadius: 15 },
                        ]}
                      >
                        <Text style={styles.addrBtnText}>{t("Update Now")}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            </>
          )}

          {status === "otaLatest" && (
            <View
              style={{ width: "100%", marginTop: 8, paddingHorizontal: 16 }}
            >
              <Text
                style={[
                  styles.modalSubtitle,
                  {
                    textAlign: "center",
                    color: isDarkMode ? "#d2d2d2" : "#666",
                    fontWeight: "600",
                  },
                ]}
              >
                {t("Current device")}
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { textAlign: "center", color: isDarkMode ? "#c8c8c8" : "#666" },
                ]}
              >
                App: {appVersion}
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { textAlign: "center", color: isDarkMode ? "#c8c8c8" : "#666" },
                ]}
              >
                {t("Hardware")}: {hwVersion ?? "-"}
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { textAlign: "center", color: isDarkMode ? "#c8c8c8" : "#666" },
                ]}
              >
                {t("Bluetooth")}: {btVersion ?? "-"}
              </Text>
            </View>
          )}
            </>
          )}

          {shouldShowCloseButton ? (
            <TouchableOpacity
              style={[
                styles.statMdlCloBtn,
                {
                  backgroundColor: "transparent",
                  borderWidth: 1,
                  borderColor: isDarkMode ? "#CCB68C" : "#CFAB95",
                  marginTop: 24,
                },
              ]}
              onPress={() => {
                if (setVerificationStatus) setVerificationStatus(null);
                if (onClose) onClose();
              }}
              onLayout={(event) => {
                if (isNoWalletStatus) {
                  updateNoWalletLayout("closeTop", event.nativeEvent.layout);
                }
              }}
            >
              <Text style={styles.cancelButtonText}>{t("Close")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </BlurView>
    </Modal>
  );
};

export const SecurityWarningModal = ({
  visible,
  onClose,
  message,
  styles,
  title,
  icon,
}) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(visible);

  useEffect(() => {
    setShowModal(visible);
  }, [visible]);

  if (!showModal) return null;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={showModal}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      hardwareAccelerated
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <BlurView style={styles.centeredView}>
          <View
            style={[
              styles.secCodeModalViewSecureDevice,
              { position: "relative", top: 0 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <AnimatedWebP
              source={icon || require("../../assets/animations/Fail.webp")}
              style={{ width: 120, height: 120 }}
            />
            <Text style={styles.modalTitle}>
              {title || t("Security Warning")}
            </Text>
            <Text style={[styles.modalSubtitle, { marginBottom: 24 }]}>
              {message ||
                t(
                  "We detected a screenshot or screen recording. For your security, please avoid capturing sensitive information.",
                )}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t("Close")}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default CheckStatusModal;
