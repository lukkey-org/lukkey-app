/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// App.js
// Unified management of runtime debugging switches (concentrated in utils/runtimeFlags)
import { RUNTIME_DEV } from "./utils/runtimeFlags";
import { TextEncoder, TextDecoder } from "text-encoding";
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
import "intl-pluralrules";
import "./bootstrap";
import React, { useContext, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import Constants from "expo-constants";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BlurView } from "./components/common/AppBlurView";
import { useTranslation } from "react-i18next";
import {
  darkTheme,
  lightTheme,
  SecureDeviceScreenStylesRoot,
} from "./styles/styles";
import VaultScreen from "./components/Assets";
import GetStartedScreen from "./components/GetStartedScreen";
import ActivityLogScreen from "./components/ActivityLogScreen";
import SecureDeviceScreen from "./components/General";
import { parseDeviceCode } from "./utils/parseDeviceCode";
import { createHandlePinSubmit } from "./utils/handlePinSubmit";
import SupportPage from "./components/GeneralScreen/SupportPage";
import LanguageScreen from "./components/GeneralScreen/LanguageScreen";
import CurrencyScreen from "./components/GeneralScreen/CurrencyScreen";
import NotificationsScreen from "./components/GeneralScreen/NotificationsScreen";
import NotificationDetailScreen from "./components/GeneralScreen/NotificationDetailScreen";
import PrivacyScreen from "./components/GeneralScreen/PrivacyScreen";
import PasswordScreen from "./components/GeneralScreen/PasswordScreen";
import AddressBookScreen from "./components/GeneralScreen/AddressBookScreen";
import AddAssetScreen from "./components/AddAssetScreen";
import LogDetailScreen from "./components/LogDetailScreen";
import NFTDetailScreen from "./components/NFTDetailScreen";
import ConfirmActionModal from "./components/modal/ConfirmActionModal";
import SecurityCodeModal from "./components/modal/SecurityCodeModal";
import BluetoothModal from "./components/modal/BluetoothModal";
import CheckStatusModal, {
  SecurityWarningModal,
} from "./components/modal/CheckStatusModal";
import AppInner, { AppBootSplash } from "./components/app/AppShell";
import AssetsHeaderActions from "./components/app/AssetsHeaderActions";
import BluetoothFloatingButton from "./components/app/BluetoothFloatingButton";
import GeneralHeaderActions from "./components/app/GeneralHeaderActions";
import {
  CryptoProvider,
  DeviceContext,
  DarkModeContext,
} from "./utils/DeviceContext";
import { prefixToShortName } from "./config/chainPrefixes";
import { bluetoothConfig } from "./env/bluetoothConfig";
import { Buffer } from "buffer";
import DevToast from "./components/common/DevToast";
import FloatingDev from "./utils/dev";
// Optional dependency: only used when the native module exists to avoid errors if it is not rebuilt.
let NavigationBarRef = null;
try {
  NavigationBarRef = require("expo-navigation-bar");
} catch (e) {
  NavigationBarRef = null;
}

import { hexStringToUint32Array, uint32ArrayToHexString } from "./env/hexUtils";
import { createHandleDevicePress } from "./utils/handleDevicePress";
import { scanDevices } from "./utils/scanDevices";
import { handleBluetoothPairing as handleBluetoothPairingUtil } from "./utils/handleBluetoothPairing";
import createMonitorVerificationCode from "./utils/monitorVerificationCode";
import { clearWalletOnPinTimeout } from "./utils/clearWalletOnPinTimeout";
import { createStopMonitoringVerificationCode } from "./utils/stopMonitoringVerificationCode";
import { bleCmd, frameBle, buildAuthVerifyText } from "./utils/bleProtocol";
const serviceUUID = bluetoothConfig.serviceUUID;
const writeCharacteristicUUID = bluetoothConfig.writeCharacteristicUUID;
const notifyCharacteristicUUID = bluetoothConfig.notifyCharacteristicUUID;

const MainStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainStackNavigator() {
  const { t } = useTranslation();
  const [headerDropdownVisible, setHeaderDropdownVisible] = useState(false);
  const [selectedCardName, setSelectedCardName] = useState("");
  const { isDarkMode } = useContext(DarkModeContext);

  return (
    <MainStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: isDarkMode ? "#21201E" : "#FFFFFF",
        },
        headerTitleStyle: {
          color: isDarkMode ? "#FFFFFF" : "#333333",
          fontWeight: "bold",
        },
        headerTintColor: isDarkMode ? "#FFFFFF" : "#333333",
        headerBackTitleVisible: false,
      }}
    >
      <MainStack.Screen name="Back" options={{ headerShown: false }}>
        {(props) => (
          <AppContent
            {...props}
            t={t}
            headerDropdownVisible={headerDropdownVisible}
            setHeaderDropdownVisible={setHeaderDropdownVisible}
            selectedCardName={selectedCardName}
            setSelectedCardName={setSelectedCardName}
          />
        )}
      </MainStack.Screen>
      <MainStack.Screen
        name="Support"
        component={SupportPage}
        options={{
          title: t("Help & Support"),
          headerShadowVisible: false,
        }}
      />
      <MainStack.Screen
        name="Language"
        component={LanguageScreen}
        options={{
          title: t("Language"),
          headerShadowVisible: false,
        }}
      />
      <MainStack.Screen
        name="Currency"
        component={CurrencyScreen}
        options={{
          title: t("Default Currency"),
          headerShadowVisible: false,
        }}
      />
      <MainStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: t("Notifications"),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTitleStyle: { color: "#333333", fontWeight: "bold" },
          headerTintColor: "#333333",
          headerBackTitleVisible: false,
        }}
      />
      <MainStack.Screen
        name="AddItem"
        component={AddAssetScreen}
        options={{
          title: t("Search Asset"),
          headerShadowVisible: false,
        }}
      />
      <MainStack.Screen
        name="ActivityLog"
        component={ActivityLogScreen}
        options={{
          title: t("Activity Log"),
          headerShadowVisible: false,
        }}
      />
      <MainStack.Screen
        name="LogDetail"
        component={LogDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <MainStack.Screen
        name="NFTDetail"
        component={NFTDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <MainStack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{
          title: t("Notification"),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTitleStyle: { color: "#333333", fontWeight: "bold" },
          headerTintColor: "#333333",
          headerBackTitleVisible: false,
        }}
      />
      <MainStack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{
          title: t("Privacy"),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTitleStyle: { color: "#333333", fontWeight: "bold" },
          headerTintColor: "#333333",
          headerBackTitleVisible: false,
        }}
      />
      <MainStack.Screen
        name="Password"
        component={PasswordScreen}
        options={{
          title: t("Password"),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTitleStyle: { color: "#333333", fontWeight: "bold" },
          headerTintColor: "#333333",
          headerBackTitleVisible: false,
        }}
      />
      <MainStack.Screen
        name="AddressBook"
        component={AddressBookScreen}
        options={{
          title: t("Address Book"),
          headerShadowVisible: false,
        }}
      />
    </MainStack.Navigator>
  );
}

/**
 * AppContent holds the main application content including the bottom Tab Navigator.
 * It includes a refreshDarkMode callback for compatibility when theme changes.
 */
function AppContent({
  t,
  headerDropdownVisible,
  setHeaderDropdownVisible,
  selectedCardName,
  setSelectedCardName,
}) {
  const headerEdgePadding = Math.round(Dimensions.get("window").width * 0.05);
  const [isScanning, setIsScanning] = useState(false);
  const { bleManagerRef } = useContext(DeviceContext);
  const { isDarkMode, setIsDarkMode } = useContext(DarkModeContext);
  const restoreIdentifier = Constants.installationId;
  const [devices, setDevices] = useState([]);
  const [bleVisible, setBleVisible] = useState(false);
  const [SecurityCodeModalVisible, setSecurityCodeModalVisible] =
    useState(false);
  const [pinCode, setPinCode] = useState("");
  const [pinErrorMessage, setPinErrorMessage] = useState("");
  const [missingChainsForModal, setMissingChainsForModal] = useState([]);
  const [receivedAddresses, setReceivedAddresses] = useState({});
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [CheckStatusModalVisible, setCheckStatusModalVisible] = useState(false);
  const [receivedVerificationCode, setReceivedVerificationCode] = useState("");
  const [receivedPubKeys, setReceivedPubKeys] = useState({});
  const [deviceToDisconnect, setDeviceToDisconnect] = useState(null);
  const [confirmDisconnectModalVisible, setConfirmDisconnectModalVisible] =
    useState(false);
  const [blueToothStatus, setBlueToothStatus] = useState(null);
  const monitorSubscription = useRef(null);

  const [securityWarningVisible, setSecurityWarningVisible] = useState(false);
  const [securityWarningMessage, setSecurityWarningMessage] = useState("");

  const { verificationStatus, setVerificationStatus } =
    useContext(DeviceContext);

  const stopMonitoringVerificationCode =
    createStopMonitoringVerificationCode(monitorSubscription);

  useEffect(() => {
    if (verifiedDevices.length === 0) {
      stopMonitoringVerificationCode();
      if (RUNTIME_DEV) {
        console.log("No verified devices, stopped BLE monitor.");
      }
    }
  }, [verifiedDevices]);

  useEffect(() => {
    let alive = true;
    const checkState = async () => {
      try {
        const s = await bleManagerRef?.current?.state?.();
        if (alive && s) setBlueToothStatus(s);
      } catch {}
    };
    if (bleVisible) checkState();
    return () => {
      alive = false;
    };
  }, [bleVisible, bleManagerRef]);

  const handleBluetoothPairing = () =>
    handleBluetoothPairingUtil({
      t,
      scanDevices,
      isScanning,
      setIsScanning,
      bleManagerRef,
      setDevices,
      setBleVisible,
      openExclusiveModal,
    });

  const handleGetStartedScreenFocus = React.useCallback(() => {
    try {
      bleManagerRef?.current?.stopDeviceScan?.();
    } catch {}
    setBleVisible(false);
    setIsScanning(false);
  }, [bleManagerRef]);

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
          base64Fail,
        );
        console.log("[PIN_FAIL] sent on cancel");
      } catch (error) {
        console.log("[PIN_FAIL] send failed on cancel:", error);
      }
    },
    [selectedDevice, bleManagerRef, serviceUUID, writeCharacteristicUUID],
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
      console.log("[PIN_TIMEOUT] triggered");
      await clearWalletOnPinTimeout({
        setCryptoCards,
        setAddedCryptos,
        setInitialAdditionalCryptos,
        setAdditionalCryptos,
        setCryptoCount,
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
    setCryptoCards,
    setAddedCryptos,
    setInitialAdditionalCryptos,
    setAdditionalCryptos,
    setCryptoCount,
    setVerifiedDevices,
    setIsVerificationSuccessful,
    setVerificationStatus,
    initialAdditionalCryptos,
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
        typeof target?.connect === "function",
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
              "base64",
            );
            await target.writeCharacteristicWithResponseForService(
              serviceUUID,
              writeCharacteristicUUID,
              base64Message,
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
          "utf-8",
        ).toString("base64");
        await target.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64requestString,
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
    ],
  );

  const {
    updateCryptoAddress,
    refreshBtcAddressData,
    cryptoCards,
    setCryptoCards,
    addedCryptos,
    setAddedCryptos,
    initialAdditionalCryptos,
    setInitialAdditionalCryptos,
    additionalCryptos,
    setAdditionalCryptos,
    cryptoCount,
    setCryptoCount,
    verifiedDevices,
    setVerifiedDevices,
    setIsVerificationSuccessful,
    notifications,
    settingsLoaded,
    setAccountName,
    setAccountId,
  } = useContext(DeviceContext);

  const hasUnread = React.useMemo(
    () => (notifications || []).some((n) => n && n.read !== true),
    [notifications],
  );
  const hasCryptoCards = Array.isArray(cryptoCards) && cryptoCards.length > 0;
  const isPaired = Array.isArray(verifiedDevices) && verifiedDevices.length > 0;
  const isPairedOrDev = settingsLoaded && hasCryptoCards && isPaired;

  useEffect(() => {
    if (!__DEV__) return;
    const hasCards = Array.isArray(cryptoCards) && cryptoCards.length > 0;
    const pairedOrDev = isPaired || RUNTIME_DEV;
    // console.log("[PAIR_STATE] settingsLoaded:", settingsLoaded);
    // console.log("[PAIR_STATE] verifiedDevices:", verifiedDevices);
    // console.log("[PAIR_STATE] isPaired:", isPaired);
    // console.log("[PAIR_STATE] RUNTIME_DEV:", RUNTIME_DEV);
    // console.log("[PAIR_STATE] hasCryptoCards:", hasCards);
    // console.log("[PAIR_STATE] isPaired || RUNTIME_DEV:", pairedOrDev);
    // console.log("[PAIR_STATE] isPairedOrDev:", isPairedOrDev);
  }, [verifiedDevices, isPaired, isPairedOrDev, settingsLoaded, cryptoCards]);

  useEffect(() => {
    if (!settingsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const memHasCards =
          Array.isArray(cryptoCards) && cryptoCards.length > 0;

        let asHasAdded = false;
        let asHasCards = false;
        try {
          const [asAddedRaw, asCardsRaw] = await Promise.all([
            AsyncStorage.getItem("addedCryptos"),
            AsyncStorage.getItem("cryptoCards"),
          ]);
          if (asAddedRaw) {
            try {
              const parsed = JSON.parse(asAddedRaw);
              asHasAdded = Array.isArray(parsed) && parsed.length > 0;
            } catch {}
          }
          if (asCardsRaw) {
            try {
              const parsed2 = JSON.parse(asCardsRaw);
              asHasCards = Array.isArray(parsed2) && parsed2.length > 0;
            } catch {}
          }
        } catch {}

        const hasAnyCards = memHasCards || asHasAdded || asHasCards;
        if (hasAnyCards) return;
        if (!Array.isArray(verifiedDevices) || verifiedDevices.length === 0)
          return;
        if (cancelled) return;
        setVerifiedDevices([]);
        setIsVerificationSuccessful(false);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [
    settingsLoaded,
    cryptoCards,
    verifiedDevices,
    setVerifiedDevices,
    setIsVerificationSuccessful,
  ]);

  if (!settingsLoaded) {
    return <AppBootSplash isDarkMode={isDarkMode} />;
  }

  useEffect(() => {
    if (!bleVisible) return;
    (async () => {
      try {
        const memHasCards =
          Array.isArray(cryptoCards) && cryptoCards.length > 0;

        let asHasAdded = false;
        let asHasCards = false;
        try {
          const [asAddedRaw, asCardsRaw] = await Promise.all([
            AsyncStorage.getItem("addedCryptos"),
            AsyncStorage.getItem("cryptoCards"),
          ]);
          if (asAddedRaw) {
            try {
              const parsed = JSON.parse(asAddedRaw);
              asHasAdded = Array.isArray(parsed) && parsed.length > 0;
            } catch {}
          }
          if (asCardsRaw) {
            try {
              const parsed2 = JSON.parse(asCardsRaw);
              asHasCards = Array.isArray(parsed2) && parsed2.length > 0;
            } catch {}
          }
        } catch {}

        const hasAnyCards = memHasCards || asHasAdded || asHasCards;
        if (hasAnyCards) return;
        if (!Array.isArray(verifiedDevices) || verifiedDevices.length === 0)
          return;

        const ids = verifiedDevices.filter(
          (id) => typeof id === "string" && id.length > 0,
        );

        try {
          const mgr = bleManagerRef?.current;
          if (mgr?.devices) {
            try {
              const devs = await mgr.devices(ids);
              for (const d of devs || []) {
                try {
                  if (d?.isConnected) {
                    const isConn = await d.isConnected();
                    if (isConn) {
                      await d.cancelConnection();
                      console.log(
                        `[BLE_MODAL][NO_CARDS] Instance disconnect ok: ${d.id}`,
                      );
                    } else {
                      console.log(
                        `[BLE_MODAL][NO_CARDS] Instance already disconnected: ${d?.id}`,
                      );
                    }
                  }
                } catch (e) {
                  console.log(
                    `[BLE_MODAL][NO_CARDS] Instance disconnect error: ${d?.id}`,
                    e?.message || e,
                  );
                }
              }
            } catch {}
          }
        } catch {}

        try {
          const mgr = bleManagerRef?.current;
          if (mgr?.cancelDeviceConnection) {
            for (const id of ids) {
              try {
                await mgr.cancelDeviceConnection(id);
                console.log(
                  `[BLE_MODAL][NO_CARDS] BleManager disconnect ok: ${id}`,
                );
              } catch (e2) {
                console.log(
                  `[BLE_MODAL][NO_CARDS] BleManager disconnect err: ${id}`,
                  e2?.message || e2,
                );
              }
            }
          }
        } catch {}

        try {
          await new Promise((r) => setTimeout(r, 250));
        } catch {}

        console.log(
          "[BLE_MODAL][NO_CARDS] Clearing verifiedDevices due to no cards.",
        );
        setVerifiedDevices([]);
        setIsVerificationSuccessful(false);
      } catch (e) {
        console.log(
          "[BLE_MODAL][NO_CARDS] Cleanup verifiedDevices failed:",
          e?.message || e,
        );
      }
    })();
  }, [bleVisible, cryptoCards, verifiedDevices]);

  const monitorVerificationCode = React.useMemo(
    () =>
      createMonitorVerificationCode({
        serviceUUID,
        notifyCharacteristicUUID,
        writeCharacteristicUUID,
        prefixToShortName,
        updateCryptoAddress,
        setReceivedAddresses,
        setVerificationStatus,
        setMissingChainsForModal,
        setAccountName,
        setAccountId,
        setVerifiedDevices,
        setIsVerificationSuccessful,
        parseDeviceCode,
        setReceivedVerificationCode,
        setReceivedPubKeys,
        onBtcPubkeySynced: refreshBtcAddressData,
        Buffer,
        onSyncTimeoutReset: async () => {
          await clearWalletOnPinTimeout({
            setCryptoCards,
            setAddedCryptos,
            setInitialAdditionalCryptos,
            setAdditionalCryptos,
            setCryptoCount,
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
      }),
    [
      serviceUUID,
      notifyCharacteristicUUID,
      writeCharacteristicUUID,
      prefixToShortName,
      updateCryptoAddress,
      setReceivedAddresses,
      setVerificationStatus,
      setMissingChainsForModal,
      setVerifiedDevices,
      setIsVerificationSuccessful,
      parseDeviceCode,
      setReceivedVerificationCode,
      setReceivedPubKeys,
      refreshBtcAddressData,
      Buffer,
      setCryptoCards,
      setAddedCryptos,
      setInitialAdditionalCryptos,
      setAdditionalCryptos,
      setCryptoCount,
      initialAdditionalCryptos,
    ],
  );

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
        openExclusiveModal,
        debugSource: "App",
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
      openExclusiveModal,
    ],
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

  const styles = isDarkMode ? darkTheme : lightTheme;
  const secStyles = SecureDeviceScreenStylesRoot(isDarkMode);

  const refreshDarkMode = React.useCallback(() => {}, []);

  const tabBarActiveTintColor = isDarkMode ? "#CCB68C" : "#CFAB95";
  const tabBarInactiveTintColor = isDarkMode ? "#ffffff50" : "#676776";
  const headerTitleColor = isDarkMode ? "#ffffff" : "#333333";
  const tabBarBackgroundColor = isDarkMode ? "#22201F" : "#fff";
  const bottomBackgroundColor = isDarkMode ? "#0E0D0D" : "#EDEBEF";
  const iconColor = isDarkMode ? "#ffffff" : "#000000";
  const navigation = useNavigation();
  const hasAutoNavigatedOnWalletReadyRef = useRef(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [toastMessage, setToastMessage] = useState(
    t ? t("Device signature rejected, transaction canceled") : "",
  );
  const [toastVariant, setToastVariant] = useState("cancel");
  const [toastDurationMs, setToastDurationMs] = useState(3000);
  const [toastShowCountdown, setToastShowCountdown] = useState(true);

  const closeAllModalsForSecurityWarning = React.useCallback(() => {
    setSecurityCodeModalVisible(false);
    setCheckStatusModalVisible(false);
    setConfirmDisconnectModalVisible(false);
    setBleVisible(false);
    setHeaderDropdownVisible(false);
    setVerificationStatus(null);
    setPinErrorMessage("");
  }, [
    setSecurityCodeModalVisible,
    setCheckStatusModalVisible,
    setConfirmDisconnectModalVisible,
    setBleVisible,
    setHeaderDropdownVisible,
    setVerificationStatus,
    setPinErrorMessage,
  ]);
  const openExclusiveModal = React.useCallback(
    (openAction) => {
      closeAllModalsForSecurityWarning();
      if (typeof openAction === "function") {
        openAction();
      }
    },
    [closeAllModalsForSecurityWarning],
  );

  useEffect(() => {
    if (verificationStatus === "walletReady") {
      if (hasAutoNavigatedOnWalletReadyRef.current) return undefined;
      hasAutoNavigatedOnWalletReadyRef.current = true;
      navigation.navigate("Back", { screen: "Assets" });
      const ensureTid = setTimeout(() => {
        navigation.navigate("Back", { screen: "Assets" });
      }, 80);
      return () => clearTimeout(ensureTid);
    }
    hasAutoNavigatedOnWalletReadyRef.current = false;
    return undefined;
  }, [verificationStatus, navigation]);
  useEffect(() => {
    if (verifiedDevices.length === 0) {
      stopMonitoringVerificationCode();
    }
  }, [verifiedDevices]);
  useEffect(() => {
    const unsubscribe = navigation.addListener("state", (e) => {
      const rootRoutes = e.data.state?.routes;
      const backRoute = rootRoutes?.find((route) => route.name === "Back");
      if (backRoute && backRoute.state) {
        const tabRoutes = backRoute.state.routes;
        const walletRoute = tabRoutes.find((route) => route.name === "Assets");
        if (walletRoute?.params?.isModalVisible !== undefined) {
          setWalletModalVisible(walletRoute.params.isModalVisible);
        } else if (!walletRoute) {
          setWalletModalVisible(false);
        }
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (Platform.OS === "android" && NavigationBarRef) {
      try {
        const navBgColor =
          walletModalVisible || !isPairedOrDev
            ? bottomBackgroundColor
            : tabBarBackgroundColor;

        NavigationBarRef.setButtonStyleAsync?.(isDarkMode ? "light" : "dark");

        const tid = setTimeout(() => {
          try {
            NavigationBarRef.setButtonStyleAsync?.(
              isDarkMode ? "light" : "dark",
            );
          } catch {}
        }, 120);

        return () => {
          try {
            clearTimeout(tid);
          } catch {}
        };
      } catch (_e) {
        // no-op
      }
    }
  }, [
    isDarkMode,
    tabBarBackgroundColor,
    bottomBackgroundColor,
    walletModalVisible,
    isPairedOrDev,
  ]);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === "android" && NavigationBarRef) {
        try {
          const navBgColor =
            walletModalVisible || !isPairedOrDev
              ? bottomBackgroundColor
              : tabBarBackgroundColor;

          NavigationBarRef.setButtonStyleAsync?.(isDarkMode ? "light" : "dark");

          const tid = setTimeout(() => {
            try {
              NavigationBarRef.setButtonStyleAsync?.(
                isDarkMode ? "light" : "dark",
              );
            } catch {}
          }, 120);

          return () => {
            try {
              clearTimeout(tid);
            } catch {}
          };
        } catch (_e) {}
      }
    }, [
      isDarkMode,
      tabBarBackgroundColor,
      bottomBackgroundColor,
      walletModalVisible,
      isPairedOrDev,
    ]),
  );

  useEffect(() => {
    const showToast = (options = {}) => {
      const {
        message = t
          ? t("Device signature rejected, transaction canceled")
          : "Device signature rejected, transaction canceled",
        variant = "cancel",
        durationMs = 3000,
        showCountdown = true,
      } = options || {};
      setToastMessage(message);
      setToastVariant(variant);
      setToastDurationMs(durationMs);
      setToastShowCountdown(showCountdown);
      setToastVisible(true);
      setToastKey((value) => value + 1);
    };
    global.__SHOW_APP_TOAST__ = showToast;
    if (RUNTIME_DEV || __DEV__) {
      global.__SHOW_DEV_TOAST__ = showToast;
    }
    return () => {
      if (global.__SHOW_APP_TOAST__) delete global.__SHOW_APP_TOAST__;
      if (global.__SHOW_DEV_TOAST__) delete global.__SHOW_DEV_TOAST__;
    };
  }, []);

  const handleDisconnectPress = (device) => {
    setDeviceToDisconnect(device);
    openExclusiveModal(() => setConfirmDisconnectModalVisible(true));
  };

  const handleDisconnectDevice = async (device) => {
    try {
      // Unsubscribe first and then disconnect Bluetooth to meet the process specifications
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
        (id) => id !== device.id,
      );
      setVerifiedDevices(updatedVerifiedDevices);
      await AsyncStorage.setItem(
        "verifiedDevices",
        JSON.stringify(updatedVerifiedDevices),
      );
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
  const confirmDisconnect = async () => {
    if (deviceToDisconnect) {
      await handleDisconnectDevice(deviceToDisconnect);
      setConfirmDisconnectModalVisible(false);
      setDeviceToDisconnect(null);
    }
  };

  const cancelDisconnect = () => {
    openExclusiveModal(() => setBleVisible(true));
  };

  const handleCancel = () => {
    console.log("[BluetoothModal] handleCancel (App.js)");
    try {
      bleManagerRef?.current?.stopDeviceScan?.();
    } catch {}
    setIsScanning(false);
    setBleVisible(false);
  };
  const handleConfirmDelete = () => {
    setHeaderDropdownVisible(false);
    navigation.navigate("Back", {
      screen: "Assets",
      params: {
        showDeleteConfirmModal: true,
        isModalVisible: true,
      },
    });
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: bottomBackgroundColor }}>
      <DevToast
        key={`app-toast-${toastKey}`}
        visible={toastVisible}
        isDarkMode={isDarkMode}
        message={toastMessage}
        variant={toastVariant}
        autoHideDurationMs={toastDurationMs}
        showCountdown={toastShowCountdown}
        onHide={() => setToastVisible(false)}
      />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          lazy: false,
          tabBarIcon: ({ focused, size }) => {
            let iconName;
            if (route.name === "Assets") {
              iconName = "account-balance-wallet";
            } else if (route.name === "Get Started") {
              iconName = "play-circle-outline";
            } else if (route.name === "Actions") {
              iconName = "swap-horiz";
            } else if (route.name === "General") {
              iconName = "smartphone";
            }
            return (
              <Icon
                name={iconName}
                size={size}
                color={
                  focused ? tabBarActiveTintColor : tabBarInactiveTintColor
                }
              />
            );
          },
          tabBarLabel: ({ focused }) => {
            let label;
            if (route.name === "Assets") label = t("Assets");
            else if (route.name === "Get Started") label = t("Get Started");
            else if (route.name === "Actions") label = t("Actions");
            else if (route.name === "General") label = t("General");
            return (
              <Text
                style={{
                  color: focused
                    ? tabBarActiveTintColor
                    : tabBarInactiveTintColor,
                }}
              >
                {label}
              </Text>
            );
          },
          tabBarActiveTintColor,
          tabBarInactiveTintColor,
          tabBarStyle: {
            backgroundColor: tabBarBackgroundColor,
            borderTopWidth: 0,
            height: walletModalVisible ? 0 : 100,
            paddingBottom: walletModalVisible ? 0 : 30,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            display: walletModalVisible ? "none" : "flex",

            // Remove platform shadows on Tab Bar
            elevation: 0, // Android
            shadowColor: "transparent", // iOS
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
          },
          tabBarLabelStyle: { fontSize: 12 },
          headerStyle: {
            backgroundColor:
              route.name === "General"
                ? isDarkMode
                  ? styles.headerStyle.backgroundColor
                  : "#F2F2F7"
                : styles.headerStyle.backgroundColor,
            borderBottomColor: styles.headerStyle.borderBottomColor,
            borderBottomWidth: 0,
          },
          headerTintColor: styles.headerTintColor,
          headerTitleStyle: { fontWeight: "bold", color: headerTitleColor },
          headerTitle: t(route.name),
          headerRight: () =>
            route.name === "General" && hasCryptoCards ? (
              <GeneralHeaderActions
                navigation={navigation}
                iconColor={iconColor}
                hasUnread={hasUnread}
              />
            ) : null,
          headerShadowVisible: false,
        })}
      >
        {isPairedOrDev ? (
          <Tab.Screen
            name="Assets"
            component={VaultScreen}
            initialParams={{ isDarkMode }}
            options={({ route, navigation }) => {
              const headerCards =
                (route.params?.cryptoCards ?? cryptoCards) || [];
              return {
                headerLeft: () =>
                  route.params?.isModalVisible ? (
                    <TouchableOpacity
                      onPress={() => {
                        navigation.setParams({
                          requestCloseModal: true,
                          isModalVisible: false,
                        });
                      }}
                      style={{ paddingLeft: 16 }}
                      accessibilityLabel="Close"
                      accessibilityRole="button"
                    >
                      <Icon name="close" size={24} color={iconColor} />
                    </TouchableOpacity>
                  ) : route.params?.isCardEditMode ? (
                    <TouchableOpacity
                      onPress={() =>
                        navigation.setParams({ requestBulkDelete: true })
                      }
                      disabled={
                        Number(route.params?.selectedDeleteCount || 0) <= 0
                      }
                      style={{
                        paddingLeft: headerEdgePadding,
                        opacity:
                          Number(route.params?.selectedDeleteCount || 0) > 0
                            ? 1
                            : 0.45,
                      }}
                      accessibilityLabel={t("Delete")}
                      accessibilityRole="button"
                    >
                      <Text
                        style={{
                          color: "#FF5252",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {t("Delete")}
                      </Text>
                    </TouchableOpacity>
                  ) : null,
                headerRight: () => (
                  <AssetsHeaderActions
                    isModalVisible={!!route.params?.isModalVisible}
                    isCardEditMode={!!route.params?.isCardEditMode}
                    selectedView={route.params?.selectedView}
                    headerCardsLength={headerCards.length}
                    iconColor={iconColor}
                    headerEdgePadding={headerEdgePadding}
                    t={t}
                    onOpenSettings={() => {
                      openExclusiveModal(() => setHeaderDropdownVisible(true));
                      setSelectedCardName(route.params?.selectedCardName);
                    }}
                    onOpenActivityLog={() => navigation.navigate("ActivityLog")}
                    onAddItem={() => navigation.navigate("AddItem")}
                    onDone={() =>
                      navigation.setParams({ requestExitCardEdit: true })
                    }
                  />
                ),
              };
            }}
          />
        ) : (
          <Tab.Screen name="Get Started" options={{ title: t("Get Started") }}>
            {(props) => (
              <GetStartedScreen
                {...props}
                onGetStarted={handleBluetoothPairing}
                onScreenFocus={handleGetStartedScreenFocus}
              />
            )}
          </Tab.Screen>
        )}

        <Tab.Screen name="General">
          {(props) => (
            <SecureDeviceScreen {...props} onDarkModeChange={refreshDarkMode} />
          )}
        </Tab.Screen>
      </Tab.Navigator>
      <BluetoothFloatingButton
        visible={!isPairedOrDev}
        bottomBackgroundColor={bottomBackgroundColor}
        buttonColor={tabBarActiveTintColor}
        onPress={handleBluetoothPairing}
      />
      <StatusBar
        backgroundColor={isDarkMode ? "#21201E" : "#FFFFFF"}
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      {headerDropdownVisible && (
        <Modal
          animationType="fade"
          transparent
          visible={headerDropdownVisible}
          onRequestClose={() => setHeaderDropdownVisible(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setHeaderDropdownVisible(false)}
            >
              <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
            </Pressable>
            <View style={styles.centeredView} pointerEvents="box-none">
              <View
                style={styles.dropdown}
                onStartShouldSetResponder={() => true}
              >
                <TouchableOpacity
                  onPress={handleConfirmDelete}
                  style={styles.dropdownButton}
                >
                  <Text style={styles.droBtnTxt}>{t("Delete Card")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {/* Bluetooth Modal */}
      <BluetoothModal
        visible={bleVisible}
        devices={devices}
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        onDisconnectPress={handleDisconnectPress}
        handleDevicePress={handleDevicePress}
        onCancel={handleCancel}
        verifiedDevices={verifiedDevices}
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
        blueToothStatus={blueToothStatus}
      />
      {/* PIN Modal */}
      <SecurityCodeModal
        visible={SecurityCodeModalVisible}
        pinCode={pinCode}
        setPinCode={setPinCode}
        pinErrorMessage={pinErrorMessage}
        setPinErrorMessage={setPinErrorMessage}
        onSubmit={handlePinSubmitProxy}
        onCancel={() => {
          stopMonitoringVerificationCode();
          setSecurityCodeModalVisible(false);
          setVerificationStatus(null);
          setPinErrorMessage("");
        }}
        status={verificationStatus}
        selectedDevice={selectedDevice}
        onSendPinFail={sendPinFailOnCancel}
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
              console.log(`equipment ${device.id} Connection canceled`);
            }
          } catch (error) {
            console.log("Error while canceling device connection:", error);
            throw error;
          }
        }}
        onSecurityRiskDetected={(msg) => {
          closeAllModalsForSecurityWarning();
          setSecurityWarningMessage(msg);
          setSecurityWarningVisible(true);
        }}
        onRetryPairing={resendPairingRequest}
      />
      {/* Verification Modal */}
      <CheckStatusModal
        visible={CheckStatusModalVisible && verificationStatus !== null}
        status={verificationStatus}
        missingChains={missingChainsForModal}
        onClose={() => setCheckStatusModalVisible(false)}
        progress={
          verificationStatus === "waiting"
            ? (Object.keys(receivedAddresses || {}).length +
                Object.keys(receivedPubKeys || {}).filter((k) =>
                  [
                    "cosmos",
                    "ripple",
                    "celestia",
                    // "juno", // Hidden for now
                    "osmosis",
                    "aptos",
                  ].includes(k),
                ).length) /
              (Object.keys(prefixToShortName).length + 5)
            : undefined
        }
      />

      <SecurityWarningModal
        visible={securityWarningVisible}
        onClose={() => setSecurityWarningVisible(false)}
        message={securityWarningMessage}
        styles={secStyles}
      />
      <ConfirmActionModal
        visible={confirmDisconnectModalVisible}
        onConfirm={confirmDisconnect}
        onCancel={cancelDisconnect}
        styles={secStyles}
        title={t("Confirm Disconnect")}
        message={t("Are you sure you want to disconnect this device?")}
        cancelText={t("Back")}
        confirmText={t("Confirm")}
        containerStyle={secStyles.discMdlView}
        subtitleStyle={secStyles.discSub}
        cancelButtonStyle={[
          secStyles.cancelButton,
          { flex: 1, marginRight: 10, borderRadius: 15 },
        ]}
        confirmButtonStyle={[
          secStyles.confirmButton,
          { flex: 1, marginLeft: 10, borderRadius: 15 },
        ]}
        cancelTextStyle={secStyles.cancelButtonText}
        confirmTextStyle={secStyles.buttonTextWhite}
        disableBackdropClose
      />
      {RUNTIME_DEV && <FloatingDev />}
    </View>
  );
}

export default function App() {
  return (
    <CryptoProvider>
      <AppInner MainStackComponent={MainStackNavigator} />
    </CryptoProvider>
  );
}
