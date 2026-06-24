/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// components/GeneralScreen/PrivacyScreen.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Vibration,
  Switch,
  Linking,
  Platform,
  AppState,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { DarkModeContext, DeviceContext } from "../../utils/DeviceContext";
import { externalLinks } from "../../env/apiEndpoints";
import * as Notifications from "expo-notifications";
import checkAndReqPermission, {
  isAndroidBlePermissionGranted,
  isBlePermissionGrantedByState,
  requestIosBlePermission,
} from "../../utils/BluetoothPermissions";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
/**
 * Privacy page
 * - Cross-platform display/guidance control: Bluetooth, notification permissions and status
 * - Capability boundaries:
 * - iOS/Android cannot "turn on/off" the system switch directly in the app. You can only:
 * 1) Query the current status
 * 2) Initiate permission request (system pop-up window)
 * 3) Jump to the system settings page and manually switch it on and off by the user
 */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isDarkMode } = React.useContext(DarkModeContext);
  const { bleManagerRef } = React.useContext(DeviceContext);
  const iosBleRequestAttemptedRef = React.useRef(false);
  const iosNotifRequestAttemptedRef = React.useRef(false);

  // Sync header styles
  useEffect(() => {
    navigation.setOptions({
      title: t("Privacy"),
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: isDarkMode ? "#21201E" : "#F2F2F7",
      },
      headerTitleStyle: {
        color: isDarkMode ? "#FFFFFF" : "#333333",
        fontWeight: "bold",
      },
      headerTintColor: isDarkMode ? "#FFFFFF" : "#333333",
    });
  }, [navigation, t, isDarkMode]);

  const sdStyles = useMemo(
    () => SecureDeviceScreenStylesRoot(isDarkMode),
    [isDarkMode]
  );
  const iconColor = isDarkMode ? "#ffffff" : "#676776";
  const rightArrowColor = isDarkMode ? iconColor : "#cccccc";
  // Switch colors consistent with General
  const toggleColor = isDarkMode ? "#CCB68C" : "#CFAB95";

  // Bluetooth status (via ble-plx)
  const [btState, setBtState] = useState("Unknown"); // PoweredOn/PoweredOff/Unauthorized/Unsupported/Resetting/Unknown
  useEffect(() => {
    let unsub = null;
    try {
      const mgr = bleManagerRef?.current;
      if (mgr?.state) {
        mgr
          .state()
          .then((s) => setBtState(s || "Unknown"))
          .catch(() => {});
      }
      if (mgr?.onStateChange) {
        unsub = mgr.onStateChange((s) => setBtState(s || "Unknown"), true);
      }
    } catch {}
    return () => {
      try {
        unsub && unsub.remove && unsub.remove();
      } catch {}
    };
  }, [bleManagerRef]);
  const btOn = btState === "PoweredOn";
  const btStatusLabel =
    btState === "PoweredOn"
      ? t("On")
      : btState === "PoweredOff"
      ? t("Off")
      : t("Unknown");

  // bleAppPermGranted will be declared below (put after blePermGranted state to avoid TDZ)

  // Actively refresh Bluetooth status (for real-time synchronization with system settings)
  const refreshBluetoothState = useCallback(async () => {
    try {
      const mgr = bleManagerRef?.current;
      if (mgr?.state) {
        const s = await mgr.state();
        setBtState(s || "Unknown");
      }
    } catch {}
  }, [bleManagerRef]);

  // Notifications permissions
  const [notifGranted, setNotifGranted] = useState(false);
  const refreshNotifStatus = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      setNotifGranted(perm?.status === "granted");
    } catch {}
  }, []);
  useEffect(() => {
    refreshNotifStatus();
  }, [refreshNotifStatus]);

  // Android BLE permission grant state (separate from adapter power state)
  const [blePermGranted, setBlePermGranted] = useState(false);
  const refreshBlePermStatus = useCallback(async () => {
    if (Platform.OS === "android") {
      try {
        const g = await isAndroidBlePermissionGranted();
        setBlePermGranted(!!g);
      } catch {
        setBlePermGranted(false);
      }
    } else {
      // iOS: Use the state of ble-plx to map whether it is rejected by the system (Unauthorized)
      try {
        const mgr = bleManagerRef?.current;
        if (mgr?.state) {
          const s = await mgr.state();
          setBlePermGranted(isBlePermissionGrantedByState(s));
        } else {
          setBlePermGranted(false);
        }
      } catch {
        setBlePermGranted(false);
      }
    }
  }, [bleManagerRef]);
  useEffect(() => {
    refreshBlePermStatus();
  }, [refreshBlePermStatus]);

  // Only represents the "Bluetooth permissions for this App" status (not coupled to the adapter power supply)
  // - Android: Whether runtime permissions are granted
  // - iOS: Whether ble-plx state indicates authorization has been granted
  const bleAppPermGranted = !!blePermGranted;

  // iOS: derive BLE permission from btState.
  useEffect(() => {
    if (Platform.OS === "ios") {
      setBlePermGranted(isBlePermissionGrantedByState(btState));
    }
  }, [btState]);

  // Start "real-time synchronization" when the page gets focus: AppState is restored to the foreground and refreshed immediately + scheduled polling refresh
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      const refreshAll = async () => {
        if (!mounted) return;
        try {
          await Promise.all([
            refreshBlePermStatus(), // Android Bluetooth permissions (runtime permissions)
            refreshNotifStatus(), // Notification permissions
            refreshBluetoothState(), // Bluetooth adapter/permission state (iOS depends on btState=Unauthorized)
          ]);
        } catch {}
      };

      // Initial refresh immediately
      refreshAll();

      // Foreground and background switching: refresh immediately when returning to the foreground
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          refreshAll();
        }
      });

      // Polling: Refresh every 1500ms while focusing on the page, trying to be as close to "real time" as possible
      const timer = setInterval(() => {
        refreshAll();
      }, 1500);

      return () => {
        mounted = false;
        try {
          clearInterval(timer);
        } catch {}
        try {
          sub && sub.remove && sub.remove();
        } catch {}
      };
    }, [refreshBlePermStatus, refreshNotifStatus, refreshBluetoothState])
  );

  // Common operations
  const openAppSettings = async () => {
    try {
      if (typeof Linking.openSettings === "function") {
        await Linking.openSettings();
      }
    } catch {}
  };
  const requestNotifPermission = async () => {
    try {
      const res = await Notifications.requestPermissionsAsync();
      const granted = res?.status === "granted" || res?.granted === true;
      setNotifGranted(granted);
      try {
        Vibration.vibrate();
      } catch {}
      // If the system does not grant it (it may be permanently rejected or needs to be turned on in the system settings), boot jump settings
      const shouldOpenSettings =
        Platform.OS === "ios"
          ? iosNotifRequestAttemptedRef.current && !granted
          : !granted;
      iosNotifRequestAttemptedRef.current = true;
      if (shouldOpenSettings) {
        await openAppSettings();
      }
    } catch {}
    await refreshNotifStatus();
  };
  // Requesting location permissions has been removed
  const requestBluetoothPermission = async () => {
    try {
      let ok = false;
      if (Platform.OS === "android") {
        ok = await checkAndReqPermission();
      } else if (Platform.OS === "ios") {
        ok = await requestIosBlePermission(bleManagerRef);
      } else {
        ok = true;
      }
      try {
        Vibration.vibrate();
      } catch {}
      return !!ok;
    } catch {
      return false;
    }
  };

  // static entry
  const items = [
    {
      key: "policy",
      icon: "gpp-good",
      title: t("Privacy Policy"),
      onPress: async () => {
        try {
          Vibration.vibrate();
        } catch {}
        if (!externalLinks.privacyEnabled) return;
        try {
          await Linking.openURL(externalLinks.privacyPolicy);
        } catch {}
      },
    },
    {
      key: "system-settings",
      icon: "settings",
      title: t("System Settings"),
      onPress: openAppSettings,
    },
  ];

  // Uses the same "grouped rounded cards" rendering style as General (see ModuleSecureView)

  return (
    <View
      style={[
        sdStyles.container,
        { backgroundColor: isDarkMode ? "#21201E" : "#F2F2F7" },
      ]}
    >
      <ScrollView
        style={sdStyles.scrollView}
        contentContainerStyle={sdStyles.contentContainer}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {/* Group 1: Permission switch (iOS setting style) */}
        <View style={sdStyles.groupCard}>
          {/* Bluetooth */}
          <View style={sdStyles.groupRow}>
            <View style={sdStyles.groupIconWrap}>
              <Icon name="bluetooth" size={22} color={iconColor} />
            </View>
            <Text style={[sdStyles.Text, { flex: 1 }]}>
              {t("Bluetooth Access")}
            </Text>
            <View
              style={{
                marginLeft: "auto",
                alignSelf: "center",
                justifyContent: "center",
              }}
            >
              <Switch
                style={{ marginLeft: "auto", alignSelf: "center" }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                trackColor={{ false: "#767577", true: toggleColor }}
                thumbColor={isDarkMode ? "#fff" : "#fff"}
                ios_backgroundColor="#E8E8EA"
                value={bleAppPermGranted}
                onValueChange={async (val) => {
                  try {
                    Vibration.vibrate();
                  } catch {}
                  if (Platform.OS === "ios") {
                    if (val) {
                      const ok = await requestBluetoothPermission();
                      const shouldOpenSettings =
                        iosBleRequestAttemptedRef.current && !ok;
                      iosBleRequestAttemptedRef.current = true;
                      if (shouldOpenSettings) {
                        await openAppSettings();
                      }
                    } else {
                      await openAppSettings();
                    }
                    await refreshBlePermStatus();
                    await refreshBluetoothState();
                    return;
                  }
                  if (val) {
                    const ok = await requestBluetoothPermission();
                    if (!ok) {
                      await openAppSettings();
                    }
                  } else {
                    await openAppSettings();
                  }
                  await refreshBlePermStatus();
                  await refreshBluetoothState();
                }}
              />
            </View>
          </View>

          <View style={sdStyles.groupDivider} />

          {/* Notifications */}
          <View style={sdStyles.groupRow}>
            <View style={sdStyles.groupIconWrap}>
              <Icon name="notifications" size={22} color={iconColor} />
            </View>
            <Text style={[sdStyles.Text, { flex: 1 }]}>
              {t("Notifications")}
            </Text>
            <View
              style={{
                marginLeft: "auto",
                alignSelf: "center",
                justifyContent: "center",
              }}
            >
              <Switch
                style={{ marginLeft: "auto", alignSelf: "center" }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                trackColor={{ false: "#767577", true: toggleColor }}
                thumbColor={isDarkMode ? "#fff" : "#fff"}
                ios_backgroundColor="#E8E8EA"
                value={!!notifGranted}
                onValueChange={async (val) => {
                  try {
                    Vibration.vibrate();
                  } catch {}
                  if (val) {
                    await requestNotifPermission();
                  } else {
                    await openAppSettings();
                  }
                  await refreshNotifStatus();
                }}
              />
            </View>
          </View>
        </View>

        {/* Group 2: Link items (privacy policy, system settings) */}
        <View style={sdStyles.groupCard}>
          {items.map((it, idx) => (
            <React.Fragment key={it.key}>
              <TouchableOpacity activeOpacity={0.85} onPress={it.onPress}>
                <View style={sdStyles.groupRow}>
                  <View style={sdStyles.groupIconWrap}>
                    <Icon name={it.icon} size={22} color={iconColor} />
                  </View>
                  <Text style={[sdStyles.Text, { flex: 1 }]}>{it.title}</Text>
                  <Icon
                    name="chevron-right"
                    size={22}
                    color={rightArrowColor}
                  />
                </View>
              </TouchableOpacity>
              {idx < items.length - 1 && <View style={sdStyles.groupDivider} />}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
