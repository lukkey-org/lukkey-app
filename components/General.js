/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useState, useEffect, useRef, useContext } from "react";
import {
  Vibration,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  Switch,
  TextInput,
  Linking,
  Button,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import i18n from "../config/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceContext, DarkModeContext } from "../utils/DeviceContext";
import { SecureDeviceScreenStylesRoot } from "../styles/styles";
import ConfirmActionModal from "./modal/ConfirmActionModal";
import SecurityCodeModal from "./modal/SecurityCodeModal";
import BluetoothModal from "./modal/BluetoothModal";
import CheckStatusModal from "./modal/CheckStatusModal";
import LockCodeFlowModal from "./modal/LockCodeFlowModal";
import ModuleSecureView from "./GeneralScreen/ModuleSecureView";
import getSettingsOptions from "./GeneralScreen/settingsOptions";
import handleFirmwareUpdate, { queryDeviceVersion } from "./GeneralScreen/FirmwareUpdate";
import { confirmDeleteWallet } from "../utils/confirmDeleteWallet";
import { languages } from "../config/languages";
import base64 from "base64-js";
import { Buffer } from "buffer";
import { getRequiredAddressSyncKeys, prefixToShortName } from "../config/chainPrefixes";
import { createHandlePinSubmit } from "../utils/handlePinSubmit";
import { parseDeviceCode } from "../utils/parseDeviceCode";
import { bluetoothConfig } from "../env/bluetoothConfig";
import { createHandleDevicePress } from "../utils/handleDevicePress";
import { scanDevices } from "../utils/scanDevices";
import { handleBluetoothPairing as handleBluetoothPairingUtil } from "../utils/handleBluetoothPairing";
import createMonitorVerificationCode from "../utils/monitorVerificationCode";
import { createStopMonitoringVerificationCode } from "../utils/stopMonitoringVerificationCode";
import { bleCmd, frameBle, buildAuthVerifyText } from "../utils/bleProtocol";
import { clearWalletOnPinTimeout } from "../utils/clearWalletOnPinTimeout";
const FILE_NAME = "General.js";
const serviceUUID = bluetoothConfig.serviceUUID;
const writeCharacteristicUUID = bluetoothConfig.writeCharacteristicUUID;
const notifyCharacteristicUUID = bluetoothConfig.notifyCharacteristicUUID;

let PermissionsAndroid;
if (Platform.OS === "android") {
  PermissionsAndroid = require("react-native").PermissionsAndroid;
}

let NavigationBarRef = null;
try {
  NavigationBarRef = require("expo-navigation-bar");
} catch (e) {
  NavigationBarRef = null;
}

function SecureDeviceScreen({ onDarkModeChange }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const {
    updateCryptoAddress,
    refreshBtcAddressData,
    currencies,
    currencyUnit,
    setCurrencyUnit,
    setIsVerificationSuccessful,
    verifiedDevices,
    setVerifiedDevices,
    isScreenLockEnabled,
    screenLockPassword,
    screenLockType,
    toggleScreenLock,
    toggleSelfDestruct,
    changeScreenLockPassword,
    setScreenLockCredential,
    setSelfDestructCredential,
    setCryptoCards,
    setInitialAdditionalCryptos,
    additionalCryptos,
    setAdditionalCryptos,
    addedCryptos,
    setAddedCryptos,
    cryptoCards,
    clearNotifications,
    accountName,
    accountId,
    setAccountName,
    setAccountId,
    versionHasUpdate,
    syncFirmwareUpdateInfo,
  } = useContext(DeviceContext);
  const { isDarkMode, setIsDarkMode } = useContext(DarkModeContext);
  const SecureDeviceScreenStyle = SecureDeviceScreenStylesRoot(isDarkMode);
  const [versionRefreshKey, setVersionRefreshKey] = useState(0);
  const [LockCodeModalVisible, setLockCodeModalVisible] = useState(false);
  const [lockCodeModalMode, setLockCodeModalMode] = useState(null);
  const [enterLockCodeModalVisible, setEnterLockCodeModalVisible] =
    useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [bleVisible, setBleVisible] = useState(false);
  const [bleModalMode, setBleModalMode] = useState("default");
  const [blueToothStatus, setBlueToothStatus] = useState(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [devices, setDevices] = useState([]);
  const isScanningRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);
  const [SecurityCodeModalVisible, setSecurityCodeModalVisible] =
    useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pinCode, setPinCode] = useState("");
  const [pinErrorMessage, setPinErrorMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isCurrentPasswordHidden, setIsCurrentPasswordHidden] = useState(true);
  const [enterLockPasswordError, setEnterLockPasswordError] = useState("");
  const restoreIdentifier = Constants.installationId;
  const toggleColor = isDarkMode ? "#CCB68C" : "#CFAB95";
  const iconColor = isDarkMode ? "#ffffff" : "#676776";
  const darkColors = ["#21201E", "#0E0D0D"];
  const lightColors = ["#F2F2F7", "#EDEBEF"];
  const [receivedVerificationCode, setReceivedVerificationCode] = useState("");
  const [newLockCodeModalVisible, setNewLockCodeModalVisible] = useState(false);
  const [changeLockPasswordError, setChangeLockPasswordError] = useState("");
  const [isSupportExpanded, setIsSupportExpanded] = useState(false);
  const [verificationSuccessModalVisible, setVerificationSuccessModalVisible] =
    useState(false);
  const [verificationFailModalVisible, setVerificationFailModalVisible] =
    useState(false);
  const [searchLanguage, setSearchLanguage] = useState("");
  const [changeLockCodeModalVisible, setChangeLockCodeModalVisible] =
    useState(false);
  const [patternLockModalVisible, setPatternLockModalVisible] = useState(false);
  const [patternLockMode, setPatternLockMode] = useState("create");
  const [patternLockFlow, setPatternLockFlow] = useState("enable");
  const [isCurrentPasswordValid, setIsCurrentPasswordValid] = useState(false);
  const filteredLanguages = languages.filter((language) =>
    language.name.toLowerCase().includes(searchLanguage.toLowerCase())
  );

  useEffect(() => {
    if (Platform.OS !== "android" || !NavigationBarRef) return;

    const applyNavBar = () => {
      try {
        NavigationBarRef.setButtonStyleAsync?.(isDarkMode ? "light" : "dark");
      } catch (_e) {}
    };

    applyNavBar();

    const unsubFocus = navigation.addListener("focus", applyNavBar);
    return () => {
      try {
        unsubFocus && unsubFocus();
      } catch {}
    };
  }, [navigation, isDarkMode]);
  const [confirmLockCodeModalVisible, setConfirmLockCodeModalVisible] =
    useState(false);
  const [storedPassword, setStoredPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmDisconnectModalVisible, setConfirmDisconnectModalVisible] =
    useState(false);
  const [deviceToDisconnect, setDeviceToDisconnect] = useState(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successStatus, setSuccessStatus] = useState("success");
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  useEffect(() => {
    if (verificationStatus === "noDevice" && bleVisible) {
      setBleVisible(false);
    }
  }, [verificationStatus, bleVisible]);
  const [modalMessage, setModalMessage] = useState("");
  const [CheckStatusModalVisible, setCheckStatusModalVisible] = useState(false);
  const [missingChainsForModal, setMissingChainsForModal] = useState([]);
  const [otaFiles, setOtaFiles] = useState([]);
  const [checkStatusProgress, setCheckStatusProgress] = useState(0);
  const otaCheckSessionRef = useRef(0);
  const otaCheckCancelledRef = useRef(false);
  useEffect(() => {
    if (CheckStatusModalVisible && bleVisible) {
      setBleVisible(false);
    }
  }, [CheckStatusModalVisible, bleVisible]);
  useEffect(() => {
    if (!bleVisible) {
      setBleModalMode("default");
    }
  }, [bleVisible]);

  const closeAllModals = React.useCallback(() => {
    setBleVisible(false);
    setLanguageModalVisible(false);
    setSecurityCodeModalVisible(false);
    setCheckStatusModalVisible(false);
    setConfirmDisconnectModalVisible(false);
    setSuccessModalVisible(false);
    setErrorModalVisible(false);
    setDeleteWalletModalVisible(false);
    setLockCodeModalVisible(false);
    setPatternLockModalVisible(false);
    setEnterLockCodeModalVisible(false);
    setChangeLockCodeModalVisible(false);
    setNewLockCodeModalVisible(false);
  }, []);

  const openExclusiveModal = React.useCallback(
    (openAction) => {
      closeAllModals();
      if (typeof openAction === "function") {
        openAction();
      }
    },
    [closeAllModals]
  );
  const showWorkflowBluetoothModal = React.useCallback(() => {
    setBleModalMode("workflow");
    openExclusiveModal(() => setBleVisible(true));
  }, [openExclusiveModal]);
  const setManageBluetoothModalVisible = React.useCallback((next = true) => {
    if (next) {
      setBleModalMode("manage");
      openExclusiveModal(() => setBleVisible(true));
      return;
    }
    setBleVisible(false);
    setBleModalMode("default");
  }, [openExclusiveModal]);
  const hideBluetoothModal = React.useCallback(() => {
    setBleVisible(false);
    setBleModalMode("default");
  }, []);
  const setSuccessModalVisibleExclusive = React.useCallback(
    (next = true) => {
      if (next) {
        openExclusiveModal(() => setSuccessModalVisible(true));
        return;
      }
      setSuccessModalVisible(false);
    },
    [openExclusiveModal],
  );
  const setErrorModalVisibleExclusive = React.useCallback(
    (next = true) => {
      if (next) {
        openExclusiveModal(() => setErrorModalVisible(true));
        return;
      }
      setErrorModalVisible(false);
    },
    [openExclusiveModal],
  );

  const openSuccessModal = (message) => {
    if (typeof setSuccessStatus === "function") {
      setSuccessStatus("walletDeleted");
    }
    setModalMessage(message);
    openExclusiveModal(() => setSuccessModalVisible(true));
  };

  useEffect(() => {
    if (verificationStatus === "otaReady") {
      if (!firmwareAPI.enabled) {
        console.log("[OTA] skipped: firmware API is not configured");
        try {
          setOtaFiles([]);
          setVerificationStatus && setVerificationStatus("otaFail");
        } catch {}
        return;
      }
      try {
        setCheckStatusProgress && setCheckStatusProgress(0);
      } catch {}
      (async () => {
        try {
          const base = firmwareAPI.lvglBase;
          console.log("OTA lvgl base:", base);

          try {
            const listUrl = firmwareAPI.lvglList;
            const lj = await fetch(listUrl, {
              headers: { Accept: "application/json" },
            });
            if (lj.ok) {
              const j = await lj.json();
              console.log("OTA lvgl list API result:", j);
              if (Array.isArray(j.files) && j.files.length > 0) {
                const versionsMap =
                  j && typeof j.versions === "object" ? j.versions : {};
                const finalFiles = j.files.map((name) => {
                  const url = base + encodeURI(name);
                  return { name, url, version: versionsMap[name] };
                });
                console.log("OTA lvgl final files (from API):", finalFiles);
                console.log(
                  "OTA lvgl file names (from API):",
                  finalFiles.map((f) => f.name)
                );
                setOtaFiles(finalFiles);
                return;
              }
            }
          } catch (e) {
            console.log("OTA lvgl list API failed:", e);
          }

          const res = await fetch(base);
          const html = await res.text();

          let hrefs = (() => {
            const out = [];
            const regs = [
              /href="([^"]+)"/gi,
              /href='([^']+)'/gi,
              /href=([^>\s]+)/gi,
            ];
            for (const re of regs) {
              let m;
              while ((m = re.exec(html))) out.push(m[1]);
            }
            return out;
          })();
          if (!hrefs.length) {
            try {
              const keys = Array.from(
                (html || "").matchAll(/<Key>([^<]+)<\/Key>/gi)
              ).map((m) => m[1]);
              hrefs = keys
                .filter((k) => k && (k.startsWith("lvgl/") || !k.includes("/")))
                .map((k) => k.split("/").pop());
            } catch {}
          }
          console.log("OTA lvgl raw hrefs:", hrefs);

          const files = hrefs
            .filter((href) => {
              if (!href) return false;
              if (href.startsWith("?") || href.startsWith("#")) return false;
              if (href === "/" || href === "../") return false;
              if (href.endsWith("/")) return false;
              return true;
            })
            .map((href) => {
              const rawUrl = href.startsWith("http") ? href : base + href;
              const url = encodeURI(rawUrl);
              const name = decodeURIComponent((rawUrl || "").split("/").pop());
              return { name, url };
            });

          const unique = [];
          const seen = new Set();
          for (const f of files) {
            const key = f.url;
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(f);
            }
          }

          console.log("OTA lvgl files:", unique);
          console.log(
            "OTA lvgl file names:",
            unique.map((f) => f.name)
          );

          setOtaFiles(unique);
        } catch (e) {
          console.log("OTA lvgl list fetch failed:", e);
          setOtaFiles([]);
        }
      })();
    }
  }, [verificationStatus]);

  const handleDisconnectPress = (device) => {
    setDeviceToDisconnect(device);
    openExclusiveModal(() => setConfirmDisconnectModalVisible(true));
  };

  const confirmDisconnect = async () => {
    if (deviceToDisconnect) {
      await handleDisconnectDevice(deviceToDisconnect);
      setConfirmDisconnectModalVisible(false);
      setDeviceToDisconnect(null);
      scanDevices({ isScanning, setIsScanning, bleManagerRef, setDevices });
    }
  };

  const cancelDisconnect = () => {
    openExclusiveModal(() => setBleVisible(true));
  };

  const closeEnterLockCodeModal = () => {
    setEnterLockCodeModalVisible(false);
    setCurrentPassword("");
    setIsCurrentPasswordHidden(true);
    setEnterLockPasswordError("");
  };

  const openLockCodeModal = (mode = null) => {
    setPassword("");
    setConfirmPassword("");
    setIsPasswordHidden(true);
    setIsConfirmPasswordHidden(true);
    setPasswordError("");
    setLockCodeModalMode(mode);
    openExclusiveModal(() => setLockCodeModalVisible(true));
  };

  const openPatternLockModal = (flow = "enable") => {
    setPatternLockFlow(flow);
    setPatternLockMode(flow === "enable" ? "create" : "verify");
    openExclusiveModal(() => setPatternLockModalVisible(true));
  };

  const closePatternLockModal = () => {
    setPatternLockModalVisible(false);
    setPendingSwitchType(null);
  };

  const openEnterLockCodeModal = () => {
    setCurrentPassword("");
    setIsCurrentPasswordHidden(true);
    setEnterLockPasswordError("");
    openExclusiveModal(() => setEnterLockCodeModalVisible(true));
  };

  const openChangeLockCodeModal = () => {
    setCurrentPassword("");
    setIsCurrentPasswordHidden(true);
    setChangeLockPasswordError("");
    openExclusiveModal(() => setChangeLockCodeModalVisible(true));
  };

  const openChangePatternLockModal = () => {
    setPatternLockFlow("change");
    setPatternLockMode("verify");
    openExclusiveModal(() => setPatternLockModalVisible(true));
  };

  const openNewLockCodeModal = () => {
    setPasswordError("");
    setPassword("");
    setConfirmPassword("");
    setIsPasswordHidden(true);
    setIsConfirmPasswordHidden(true);
    openExclusiveModal(() => setNewLockCodeModalVisible(true));
  };

  useEffect(() => {
    const onLangChange = (lng) => setSelectedLanguage(lng);
    i18n.on("languageChanged", onLangChange);
    return () => {
      i18n.off("languageChanged", onLangChange);
    };
  }, []);

  useEffect(() => {
    if (!SecurityCodeModalVisible) {
      stopMonitoringVerificationCode();
    }
  }, [SecurityCodeModalVisible]);

  const handleScreenLockToggle = async (value) => {
    if (value) {
      openLockCodeModal();
    } else {
      if (screenLockType === "pattern") {
        openPatternLockModal("disable");
      } else {
        openEnterLockCodeModal();
      }
    }
  };

  const handleChangePassword = async () => {
    if (password === confirmPassword) {
      if (!password || String(password).trim() === "") {
        setPasswordError(t("Password cannot be empty"));
        return;
      }
      if (password === screenLockPassword) {
        setPasswordError(t("New password must be different from current"));
        return;
      }
      try {
        await setScreenLockCredential(password, "password");
        setNewLockCodeModalVisible(false);
        openSuccessModal(t("Password changed successfully"));
      } catch (error) {
        console.log("Failed to change password", error);
      }
    } else {
      setPasswordError(t("Passwords do not match"));
    }
  };

  const handleNextForChangePassword = (currentPassword) => {
    if (currentPassword === screenLockPassword) {
      setIsCurrentPasswordValid(true);
      setChangeLockCodeModalVisible(false);
      openNewLockCodeModal();
      setCurrentPassword("");
      setChangeLockPasswordError("");
    } else {
      setChangeLockPasswordError(t("Incorrect current password"));
    }
  };

  const handleSetPassword = async () => {
    if (password.length < 4) {
      setPasswordError(t("Password must be at least 4 characters long"));
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(t("Passwords do not match"));
      return;
    }

    try {
      await setScreenLockCredential(password, "password");
      await AsyncStorage.setItem(
        "screenLockEnabled",
        JSON.stringify(true)
      );
      toggleScreenLock(true);
      setLockCodeModalVisible(false);
      setPasswordError("");
      openSuccessModal(t("Screen lock enabled successfully"));
      if (pendingSwitchType) {
        await toggleSelfDestruct(false);
        await setSelfDestructCredential("", pendingSwitchType);
        setPendingSwitchType(null);
      }
    } catch (error) {
      console.error("❌ Failed to enable lock:", error);
      setPasswordError(t("An error occurred while saving password"));
    }
  };

  const closeLockCodeModal = () => {
    setLockCodeModalVisible(false);
    setLockCodeModalMode(null);
    setPendingSwitchType(null);
    setPassword("");
    setConfirmPassword("");
    setIsPasswordHidden(true);
    setIsConfirmPasswordHidden(true);
  };

  const handlePatternLockComplete = async (pattern) => {
    if (patternLockMode === "verify") {
      if (patternLockFlow === "change") {
        setPatternLockMode("create");
        setPatternLockFlow("change-create");
        return;
      }
      if (patternLockFlow === "disable") {
        try {
          await AsyncStorage.setItem(
            "screenLockEnabled",
            JSON.stringify(false)
          );
          toggleScreenLock(false);
          setPatternLockModalVisible(false);
          openSuccessModal(t("Screen lock disabled successfully"));
        } catch (err) {
          console.error("❌ Failed to disable screen lock:", err);
          setModalMessage(t("An error occurred"));
          openExclusiveModal(() => setErrorModalVisible(true));
        }
        return;
      }
      return;
    }

    try {
      await setScreenLockCredential(pattern, "pattern");
      await AsyncStorage.setItem(
        "screenLockEnabled",
        JSON.stringify(true)
      );
      toggleScreenLock(true);
      setPatternLockModalVisible(false);
      if (patternLockFlow === "change-create") {
        openSuccessModal(t("Pattern changed successfully"));
      } else {
        openSuccessModal(t("Screen lock enabled successfully"));
      }
      if (pendingSwitchType) {
        await toggleSelfDestruct(false);
        await setSelfDestructCredential("", pendingSwitchType);
        setPendingSwitchType(null);
      }
    } catch (error) {
      console.error("❌ Failed to enable pattern lock:", error);
      setModalMessage(t("An error occurred while saving password"));
      openExclusiveModal(() => setErrorModalVisible(true));
    }
  };

  const openPatternLockSettings = () => {
    closeLockCodeModal();
    openPatternLockModal("enable");
  };

  const handleConfirmPassword = async () => {
    if (currentPassword === screenLockPassword) {
      try {
        await AsyncStorage.setItem(
          "screenLockEnabled",
          JSON.stringify(false)
        );
        toggleScreenLock(false);
        setEnterLockCodeModalVisible(false);
        openSuccessModal(t("Screen lock disabled successfully"));
        setEnterLockPasswordError("");
      } catch (err) {
        console.error("❌ Failed to disable screen lock:", err);
        setModalMessage(t("An error occurred"));
        openExclusiveModal(() => setErrorModalVisible(true));
      }
    } else {
      setEnterLockPasswordError(t("Incorrect password"));
    }
  };

  const { bleManagerRef } = useContext(DeviceContext);

  useEffect(() => {
    let mounted = true;
    let subscription = null;

    const syncBluetoothState = async () => {
      try {
        const state = await bleManagerRef.current?.state?.();
        if (mounted) {
          setBlueToothStatus(state ?? null);
        }
      } catch {}
    };

    syncBluetoothState();

    try {
      subscription = bleManagerRef.current?.onStateChange?.((state) => {
        if (mounted) {
          setBlueToothStatus(state ?? null);
        }
      }, true);
    } catch {}

    return () => {
      mounted = false;
      try {
        subscription?.remove?.();
      } catch {}
    };
  }, [bleManagerRef]);

  const handleBluetoothPairing = () =>
    handleBluetoothPairingUtil({
      t,
      scanDevices,
      isScanning,
      setIsScanning,
      bleManagerRef,
      setDevices,
      setBleVisible: setManageBluetoothModalVisible,
      openExclusiveModal,
    });

  const handleLanguageChange = async (language) => {
    console.log("Selected language:", language.name);
    setSelectedLanguage(language.code);
    i18n.changeLanguage(language.code);
    await AsyncStorage.setItem("language", language.code);
    setLanguageModalVisible(false);
  };

  const handleDarkModeChange = async (value) => {
    setIsDarkMode(value);
    if (typeof onDarkModeChange === "function") {
      onDarkModeChange();
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerTitle: t("General"),
    });
  }, [t, navigation]);

  const [receivedAddresses, setReceivedAddresses] = useState({});
  const [receivedPubKeys, setReceivedPubKeys] = useState({});

  const monitorSubscription = useRef(null);
  const otaStarterRef = useRef(null);

  const monitorVerificationCode = createMonitorVerificationCode({
    serviceUUID,
    notifyCharacteristicUUID,
    prefixToShortName,
    updateCryptoAddress,
    setReceivedAddresses,
    setVerificationStatus,
    setAccountName,
    setAccountId,
    setVerifiedDevices,
    setIsVerificationSuccessful,
    parseDeviceCode,
    setReceivedVerificationCode,
    setReceivedPubKeys,
    onBtcPubkeySynced: refreshBtcAddressData,
    Buffer,
    writeCharacteristicUUID,
    bleManagerRef,
    replaceVerifiedDevices: true,
    onSyncTimeoutReset: async () => {
      await clearWalletOnPinTimeout({
        setCryptoCards,
        setAddedCryptos,
        setInitialAdditionalCryptos,
        setAdditionalCryptos,
        setVerifiedDevices,
        setIsVerificationSuccessful,
        setVerificationStatus,
        keepVerificationStatus: true,
        initialAdditionalCryptos,
      });
    },
    onPwdCancel: () => {
      setSecurityCodeModalVisible(false);
      setPinCode("");
      setPinErrorMessage("");
    },
  });

  const stopMonitoringVerificationCode =
    createStopMonitoringVerificationCode(monitorSubscription);

  const handleCancel = () => {
    console.log("[BluetoothModal] handleCancel (General.js)");
    try {
      bleManagerRef?.current?.stopDeviceScan?.();
    } catch {}
    setIsScanning(false);
    hideBluetoothModal();
  };
  const handleRecoveredWorkflowDevice = React.useCallback(() => {
    try {
      bleManagerRef?.current?.stopDeviceScan?.();
    } catch {}
    setIsScanning(false);
    hideBluetoothModal();
    setSelectedDevice(null);
    if (typeof global.__SHOW_APP_TOAST__ === "function") {
      global.__SHOW_APP_TOAST__({
        message: t("Device reconnected. Please continue."),
        variant: "success",
        durationMs: 2200,
        showCountdown: true,
      });
    }
  }, [bleManagerRef, hideBluetoothModal, t]);

  const handleDevicePress = createHandleDevicePress({
    setReceivedAddresses,
    setReceivedPubKeys,
    setVerificationStatus,
    setSelectedDevice,
    setBleVisible,
    monitorVerificationCode,
    setSecurityCodeModalVisible,
    serviceUUID,
    writeCharacteristicUUID,
    Buffer,
    setReceivedVerificationCode,
    setPinCode,
    setPinErrorMessage,
    bleManagerRef,
    openExclusiveModal,
  });

  const handlePinSubmit = React.useMemo(
    () =>
      createHandlePinSubmit({
        setSecurityCodeModalVisible,
        setCheckStatusModalVisible,
        setVerificationStatus,
        setVerifiedDevices,
        setIsVerificationSuccessful,
        setPinCode,
        setPinErrorMessage,
        setReceivedAddresses,
        prefixToShortName,
        monitorVerificationCode,
        serviceUUID,
        writeCharacteristicUUID,
        verifiedDevices,
        devices,
        bleManagerRef,
        attemptDisconnectCurrentDevice: true,
        openExclusiveModal,
        debugSource: "SecureDevice",
      }),
    [
      setSecurityCodeModalVisible,
      setCheckStatusModalVisible,
      setVerificationStatus,
      setVerifiedDevices,
      setIsVerificationSuccessful,
      setPinCode,
      setPinErrorMessage,
      setReceivedAddresses,
      prefixToShortName,
      monitorVerificationCode,
      serviceUUID,
      writeCharacteristicUUID,
      verifiedDevices,
      devices,
      bleManagerRef,
      openExclusiveModal,
    ]
  );

  const handlePinSubmitProxy = React.useCallback(() => {
    handlePinSubmit({
      receivedVerificationCode,
      pinCode,
      selectedDevice,
      receivedAddresses,
    });
  }, [
    handlePinSubmit,
    receivedVerificationCode,
    pinCode,
    selectedDevice,
    receivedAddresses,
  ]);

  const sendPinFailOnCancel = React.useCallback(
    async (device) => {
      let target = device || selectedDevice;
      if (!target) return;
      try {
        console.log("[PIN_FAIL] send start", target?.id || "unknown");
        if (!target || typeof target.connect !== "function") {
          const manager = bleManagerRef?.current;
          if (manager && target?.id) {
            const list = await manager.devices([target.id]);
            if (Array.isArray(list) && list[0]) target = list[0];
          }
        }
        const isConnected = await target?.isConnected?.();
        console.log("[PIN_FAIL] isConnected:", isConnected);
        if (!isConnected && target?.connect) {
          console.log("[PIN_FAIL] connect...");
          await target.connect();
          console.log("[PIN_FAIL] discover services...");
          await target.discoverAllServicesAndCharacteristics();
        }
        const failMessage = bleCmd.pinFail() + "\r\n";
        const base64Fail = Buffer.from(failMessage, "utf-8").toString("base64");
        await target.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64Fail
        );
        console.log("[PIN_FAIL] sent on cancel");
      } catch (error) {
        console.log("[PIN_FAIL] send failed on cancel:", error);
      }
    },
    [selectedDevice, bleManagerRef, serviceUUID, writeCharacteristicUUID]
  );

  const pinTimeoutRef = useRef(null);
  useEffect(() => {
    if (!SecurityCodeModalVisible || receivedVerificationCode) {
      if (pinTimeoutRef.current) {
        clearTimeout(pinTimeoutRef.current);
        pinTimeoutRef.current = null;
      }
      return;
    }
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
    }
    pinTimeoutRef.current = setTimeout(async () => {
      if (!SecurityCodeModalVisible || receivedVerificationCode) return;
      try {
        setPinErrorMessage(`pin_timeout:${Date.now()}`);
      } catch {}
      try {
        setPinCode("");
      } catch {}
      console.log("[PIN_TIMEOUT] SecureDevice -> clearWalletOnPinTimeout");
      await clearWalletOnPinTimeout({
        setCryptoCards,
        setInitialAdditionalCryptos,
        setVerifiedDevices,
        setIsVerificationSuccessful,
        setVerificationStatus,
        initialAdditionalCryptos,
      });
      try {
        monitorVerificationCode?.cancel?.();
      } catch {}
      try {
        stopMonitoringVerificationCode();
      } catch {}
      try {
        const target = selectedDevice;
        const isConnected = await target?.isConnected?.();
        if (isConnected) {
          await target.cancelConnection();
        }
      } catch (error) {
        console.log("PIN timeout cancel connection failed:", error);
      }
    }, 10000);
    return () => {
      if (pinTimeoutRef.current) {
        clearTimeout(pinTimeoutRef.current);
        pinTimeoutRef.current = null;
      }
    };
  }, [
    SecurityCodeModalVisible,
    receivedVerificationCode,
    selectedDevice,
    setPinErrorMessage,
    setPinCode,
    monitorVerificationCode,
    stopMonitoringVerificationCode,
  ]);

  const resendPairingRequest = React.useCallback(
    async (device) => {
      let target = device || selectedDevice;
      if (!target) return;
      console.log("[PAIRING][retry] start", target?.id || "unknown");
      try {
        if (!target || typeof target.connect !== "function") {
          const manager = bleManagerRef?.current;
          if (manager && target?.id) {
            const list = await manager.devices([target.id]);
            if (Array.isArray(list) && list[0]) target = list[0];
          }
          if (manager && target?.id) {
            const conns = await manager.connectedDevices([serviceUUID]);
            const found = (conns || []).find((d) => d.id === target.id);
            if (found) target = found;
          }
        }
      } catch {}
      console.log(
        "[PAIRING][retry] device resolved",
        target?.id || "unknown",
        "hasConnect",
        typeof target?.connect === "function"
      );
      try {
        setReceivedVerificationCode("");
      } catch {}
      try {
        const isConnected = await target.isConnected?.();
        console.log("[PAIRING][retry] isConnected:", isConnected);
        if (!isConnected) {
          console.log("[PAIRING][retry] connect...");
          await target.connect();
          console.log("[PAIRING][retry] discover services...");
          await target.discoverAllServicesAndCharacteristics();
        }
        const sendparseDeviceCodeedValue = async (parseDeviceCodeedValue) => {
          try {
            const message = buildAuthVerifyText(parseDeviceCodeedValue);
            const base64Message = Buffer.from(message, "utf-8").toString(
              "base64"
            );
            await target.writeCharacteristicWithResponseForService(
              serviceUUID,
              writeCharacteristicUUID,
              base64Message
            );
            console.log(`Sent parseDeviceCodeed value: ${message}`);
          } catch (error) {
            console.log("Error sending parseDeviceCodeed value:", error);
          }
        };
        console.log("[PAIRING][retry] monitorVerificationCode start");
        monitorVerificationCode(target, sendparseDeviceCodeedValue);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const requestString = bleCmd.authRequest() + "\r\n";
        const base64requestString = Buffer.from(
          requestString,
          "utf-8"
        ).toString("base64");
        await target.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64requestString
        );
        console.log("[PAIRING] resent 'request'");
      } catch (error) {
        console.log("[PAIRING] resend request failed:", error);
      }
    },
    [
      selectedDevice,
      serviceUUID,
      writeCharacteristicUUID,
      setReceivedVerificationCode,
      monitorVerificationCode,
      bleManagerRef,
    ]
  );
  const handleDisconnectDevice = async (device) => {
    try {
      try {
        monitorVerificationCode?.cancel?.();
      } catch {}
      try {
        stopMonitoringVerificationCode();
      } catch {}

      const isConnected = await device.isConnected();
      if (!isConnected) {
        console.log(`Device ${device.id} already disconnected`);
      } else {
        await device.cancelConnection();
        console.log(`Device ${device.id} disconnected`);
      }
      const updatedVerifiedDevices = verifiedDevices.filter(
        (id) => id !== device.id
      );
      setVerifiedDevices(updatedVerifiedDevices);
      console.log(`Device ${device.id} removed from verified devices`);
      setIsVerificationSuccessful(false);
      console.log("Verification status updated to false");
    } catch (error) {
      if (error.errorCode === "OperationCancelled") {
        console.log(`Disconnection cancelled for device ${device.id}`);
      } else {
        console.log("Error disconnecting device:", error);
      }
    }
  };

  const XMODEM_BLOCK_SIZE = 100;
  const [isDeleteWalletVisible, setIsDeleteWalletVisible] = useState(false);
  const [pendingSwitchType, setPendingSwitchType] = useState(null);
  const toggleDeleteWalletVisibility = () => {
    setIsDeleteWalletVisible((prevState) => !prevState);
  };

  const [deleteWalletModalVisible, setDeleteWalletModalVisible] =
    useState(false);
  const handleDeleteWallet = () => {
    Vibration.vibrate();
    openExclusiveModal(() => setDeleteWalletModalVisible(true));
  };

  const settingsOptions = getSettingsOptions({
    t,
    navigation,
    selectedCurrency: currencyUnit,
    setLanguageModalVisible,
    languages,
    selectedLanguage,
    isDarkMode,
    toggleColor,
    handleDarkModeChange,
    handleScreenLockToggle,
    openLockCodeModal,
    openPatternLockModal,
    isScreenLockEnabled,
    screenLockType,
    openChangeLockCodeModal,
    openChangePatternLockModal,
    setPendingSwitchType,
    setPendingSwitchType,
    accountName,
    accountId,
    handleFirmwareUpdate,
    isDeleteWalletVisible,
    toggleDeleteWalletVisibility,
    handleDeleteWallet,
    cryptoCards,
    device: devices.find((d) => d.id === verifiedDevices[0]),
    setModalMessage,
    setErrorModalVisible: setErrorModalVisibleExclusive,
    setSuccessModalVisible: setSuccessModalVisibleExclusive,
    serviceUUID,
    writeCharacteristicUUID,
    verifiedDevices,
    devices,
    bleManagerRef,
    setBleVisible: showWorkflowBluetoothModal,
    setVerificationStatus,
    setCheckStatusModalVisible,
    setCheckStatusProgress,
    setOtaFiles,
    registerOtaStart: (fn) => {
      otaStarterRef.current = fn;
    },
    beginOtaCheck: () => {
      otaCheckSessionRef.current += 1;
      otaCheckCancelledRef.current = false;
      return otaCheckSessionRef.current;
    },
    isOtaCheckActive: (sessionId) =>
      otaCheckSessionRef.current === sessionId && !otaCheckCancelledRef.current,
    openExclusiveModal,

    queryDeviceVersion: () =>
      queryDeviceVersion({
        device: devices.find((d) => d.id === verifiedDevices[0]),
        devices,
        verifiedDevices,
        bleManagerRef,
        setBleVisible,
        openExclusiveModal,
        serviceUUID,
        writeCharacteristicUUID,
      }),
    // 分组中的"Manage Paired Devices"使用
    handleBluetoothPairing,
    versionHasUpdate,
    syncFirmwareUpdateInfo,
    appVersion:
      Constants?.expoConfig?.extra?.appVersion ||
      Constants?.manifest?.extra?.appVersion ||
      "-",
    setVersionRefreshKey,
  });

  const cancelDeleteWallet = () => {
    setDeleteWalletModalVisible(false);
  };

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [isConfirmPasswordHidden, setIsConfirmPasswordHidden] = useState(true);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] =
    useState(false);
  const requiredAddressKeysForModal = React.useMemo(
    () => getRequiredAddressSyncKeys(prefixToShortName),
    [],
  );
  const expectedPubkeyKeysForModal = React.useMemo(
    () => ["cosmos", "ripple", "celestia", "osmosis", "aptos"],
    [],
  );
  const syncAddressDoneForModal = requiredAddressKeysForModal.filter((key) => {
    const value = receivedAddresses?.[key];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  const syncPubkeyDoneForModal = expectedPubkeyKeysForModal.filter((key) => {
    const value = receivedPubKeys?.[key];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  const syncProgressTotalForModal =
    requiredAddressKeysForModal.length + expectedPubkeyKeysForModal.length;
  const waitingProgressForModal =
    syncProgressTotalForModal > 0
      ? Math.min(
          1,
          (syncAddressDoneForModal + syncPubkeyDoneForModal) /
            syncProgressTotalForModal,
        )
      : 0;

  return (
    <LinearGradient
      colors={isDarkMode ? darkColors : lightColors}
      style={SecureDeviceScreenStyle.container}
    >
      <ModuleSecureView
        styles={SecureDeviceScreenStyle}
        settingsOptions={settingsOptions}
        isDeleteWalletVisible={isDeleteWalletVisible}
        setIsDeleteWalletVisible={setIsDeleteWalletVisible}
        isSupportExpanded={isSupportExpanded}
        setIsSupportExpanded={setIsSupportExpanded}
        handleDeleteWallet={handleDeleteWallet}
        handleBluetoothPairing={handleBluetoothPairing}
        iconColor={iconColor}
        cryptoCards={cryptoCards}
        t={t}
        isDarkMode={isDarkMode}
      />

      <ConfirmActionModal
        visible={deleteWalletModalVisible}
        onRequestClose={cancelDeleteWallet}
        onCancel={cancelDeleteWallet}
        onConfirm={() =>
          confirmDeleteWallet({
            setVerifiedDevices,
            setDeleteWalletModalVisible,
            cryptoCards,
            setCryptoCards,
            setAddedCryptos:
              typeof setAddedCryptos !== "undefined"
                ? setAddedCryptos
                : undefined,
            setInitialAdditionalCryptos:
              typeof setInitialAdditionalCryptos !== "undefined"
                ? setInitialAdditionalCryptos
                : undefined,
            navigation,
            t,
            AsyncStorage,
            devices,
            bleManagerRef,
            verifiedDevices,
            setModalMessage,
            setSuccessModalVisible: setSuccessModalVisibleExclusive,
            setSuccessStatus,
            setErrorModalVisible: setErrorModalVisibleExclusive,
            setAccountId,
            setAccountName,
            clearNotifications,
            setIsVerificationSuccessful,
            toggleScreenLock,
            toggleSelfDestruct,
          })
        }
        styles={SecureDeviceScreenStyle}
        title={t("Warning")}
        message={t("deleteDeviceConfirmMessage")}
        cancelText={t("Cancel")}
        confirmText={t("Delete")}
        containerStyle={SecureDeviceScreenStyle.modalView}
        subtitleStyle={{ marginBottom: 20 }}
        cancelButtonStyle={[
          SecureDeviceScreenStyle.cancelButton,
          { flex: 1, marginRight: 4, borderRadius: 15 },
        ]}
        confirmButtonStyle={[
          SecureDeviceScreenStyle.submitButton,
          { flex: 1, marginLeft: 4, borderRadius: 15, marginBottom: 0 },
        ]}
        cancelTextStyle={SecureDeviceScreenStyle.cancelButtonText}
        confirmTextStyle={SecureDeviceScreenStyle.buttonTextWhite}
      />

      <LockCodeFlowModal
        visible={LockCodeModalVisible}
        mode={lockCodeModalMode ? "set" : "select"}
        onClose={closeLockCodeModal}
        onSubmit={handleSetPassword}
        onSelectPassword={() => setLockCodeModalMode("password")}
        onSelectPattern={openPatternLockSettings}
        isDarkMode={isDarkMode}
        styles={SecureDeviceScreenStyle}
        t={t}
        password={password}
        setPassword={setPassword}
        passwordError={passwordError}
        setPasswordError={setPasswordError}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        isPasswordHidden={isPasswordHidden}
        setIsPasswordHidden={setIsPasswordHidden}
        isConfirmPasswordHidden={isConfirmPasswordHidden}
        setIsConfirmPasswordHidden={setIsConfirmPasswordHidden}
      />

      <LockCodeFlowModal
        visible={patternLockModalVisible}
        mode="pattern"
        onClose={closePatternLockModal}
        onPatternComplete={handlePatternLockComplete}
        expectedPattern={screenLockPassword}
        forbiddenPattern={
          patternLockFlow === "change-create" ? screenLockPassword : null
        }
        titleText={
          patternLockFlow === "change" ? t("Verify Current Pattern") : null
        }
        subtitleText={
          patternLockFlow === "change"
            ? t("Draw your current pattern to continue")
            : null
        }
        patternMode={patternLockMode}
        styles={SecureDeviceScreenStyle}
        isDarkMode={isDarkMode}
        t={t}
      />

      <LockCodeFlowModal
        visible={enterLockCodeModalVisible}
        mode="enter"
        onClose={closeEnterLockCodeModal}
        onSubmit={handleConfirmPassword}
        isDarkMode={isDarkMode}
        styles={SecureDeviceScreenStyle}
        t={t}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        isCurrentPasswordHidden={isCurrentPasswordHidden}
        setIsCurrentPasswordHidden={setIsCurrentPasswordHidden}
        passwordError={enterLockPasswordError}
        setPasswordError={setEnterLockPasswordError}
      />

      <LockCodeFlowModal
        visible={changeLockCodeModalVisible}
        mode="change"
        onClose={() => {
          setChangeLockCodeModalVisible(false);
          setChangeLockPasswordError("");
          setCurrentPassword("");
          setIsCurrentPasswordHidden(true);
        }}
        onSubmit={handleNextForChangePassword}
        styles={SecureDeviceScreenStyle}
        isDarkMode={isDarkMode}
        t={t}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        isCurrentPasswordHidden={isCurrentPasswordHidden}
        setIsCurrentPasswordHidden={setIsCurrentPasswordHidden}
        passwordError={changeLockPasswordError}
        setPasswordError={setChangeLockPasswordError}
      />

      <LockCodeFlowModal
        visible={newLockCodeModalVisible}
        mode="set"
        setViewStyle="set"
        titleText={t("Set New Password")}
        onClose={() => setNewLockCodeModalVisible(false)}
        onSubmit={handleChangePassword}
        password={password}
        setPassword={setPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        passwordError={passwordError}
        setPasswordError={setPasswordError}
        isPasswordHidden={isPasswordHidden}
        setIsPasswordHidden={setIsPasswordHidden}
        isConfirmPasswordHidden={isConfirmPasswordHidden}
        setIsConfirmPasswordHidden={setIsConfirmPasswordHidden}
        t={t}
        isDarkMode={isDarkMode}
        styles={SecureDeviceScreenStyle}
      />

      <BluetoothModal
        visible={bleVisible}
        devices={devices}
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        onDisconnectPress={handleDisconnectPress}
        handleDevicePress={handleDevicePress}
        onCancel={handleCancel}
        verifiedDevices={verifiedDevices}
        SecureDeviceScreenStyle={SecureDeviceScreenStyle}
        blueToothStatus={blueToothStatus}
        workflowRecoveryMode={bleModalMode === "workflow"}
        onRecoveredVerifiedDevice={handleRecoveredWorkflowDevice}
        onRefreshPress={() => {
          if (isScanning) {
            bleManagerRef.current.stopDeviceScan();
            setIsScanning(false);
          }
          setTimeout(() => {
            scanDevices({
              isScanning: false,
              setIsScanning,
              bleManagerRef,
              setDevices,
            });
          }, 100);
        }}
      />

      <SecurityCodeModal
        visible={SecurityCodeModalVisible}
        pinCode={pinCode}
        setPinCode={setPinCode}
        pinErrorMessage={pinErrorMessage}
        setPinErrorMessage={setPinErrorMessage}
        onSubmit={handlePinSubmitProxy}
        onCancel={() => {
          (async () => {
            console.log("[PIN_MODAL] onCancel (SecureDevice)");
            try {
              stopMonitoringVerificationCode();
            } catch {}
            setSecurityCodeModalVisible(false);
            setPinErrorMessage("");
            setPinCode("");
            try {
              const target = selectedDevice;
              const isConnected = await target?.isConnected?.();
              if (isConnected) {
                await new Promise((r) => setTimeout(r, 80));
                await target.cancelConnection();
              }
            } catch (error) {
              console.log(
                "Cancel connection failed on pin modal cancel:",
                error
              );
            }
          })();
        }}
        onSendPinFail={sendPinFailOnCancel}
        styles={SecureDeviceScreenStyle}
        isDarkMode={isDarkMode}
        status={verificationStatus}
        selectedDevice={selectedDevice}
        onCancelConnection={async (device) => {
          try {
            try {
              monitorVerificationCode?.cancel?.();
            } catch {}
            try {
              stopMonitoringVerificationCode();
            } catch {}

            const isConnected = await device.isConnected();
            if (isConnected) {
              await device.cancelConnection();
              console.log(`Device ${device.id} connection canceled`);
            }
          } catch (error) {
            console.log("Error while canceling device connection:", error);
            throw error;
          }
        }}
        onRetryPairing={resendPairingRequest}
      />

      <CheckStatusModal
        visible={CheckStatusModalVisible && verificationStatus !== null}
        status={verificationStatus}
        versionRefreshKey={versionRefreshKey}
        missingChains={missingChainsForModal}
        onClose={() => {
          if (verificationStatus === "checkingUpdate") {
            otaCheckCancelledRef.current = true;
          }
          setCheckStatusModalVisible(false);
        }}
        otaFiles={otaFiles}
        onOtaStart={(url) => {
          if (otaStarterRef.current) {
            const start = otaStarterRef.current;
            otaStarterRef.current = null;
            start(url);
          }
        }}
        progress={
          verificationStatus === "waiting"
            ? waitingProgressForModal
            : verificationStatus === "otaSending" ||
              verificationStatus === "otaInstalling"
            ? checkStatusProgress
            : undefined
        }
      />
      <ConfirmActionModal
        visible={confirmDisconnectModalVisible}
        onConfirm={confirmDisconnect}
        onCancel={cancelDisconnect}
        styles={SecureDeviceScreenStyle}
        title={t("Confirm Disconnect")}
        message={t("Are you sure you want to disconnect this device?")}
        cancelText={t("Back")}
        confirmText={t("Confirm")}
        containerStyle={SecureDeviceScreenStyle.discMdlView}
        subtitleStyle={SecureDeviceScreenStyle.discSub}
        cancelButtonStyle={[
          SecureDeviceScreenStyle.cancelButton,
          { flex: 1, marginRight: 10, borderRadius: 15 },
        ]}
        confirmButtonStyle={[
          SecureDeviceScreenStyle.confirmButton,
          { flex: 1, marginLeft: 10, borderRadius: 15 },
        ]}
        cancelTextStyle={SecureDeviceScreenStyle.cancelButtonText}
        confirmTextStyle={SecureDeviceScreenStyle.buttonTextWhite}
        disableBackdropClose
      />

      <CheckStatusModal
        visible={successModalVisible}
        status={successStatus}
        onClose={() => {
          setSuccessModalVisible(false);
          setSuccessStatus("success");
        }}
        titleOverride={t("Success!")}
        subtitleOverride={modalMessage}
      />

      <CheckStatusModal
        visible={errorModalVisible}
        status="fail"
        onClose={() => setErrorModalVisible(false)}
        titleOverride={t("Error!")}
        subtitleOverride={modalMessage}
      />

    </LinearGradient>
  );
}

export default SecureDeviceScreen;
