/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Image,
  FlatList,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";

import { BlurView } from "../common/AppBlurView";
import { useTranslation } from "react-i18next";
import { DarkModeContext } from "../../utils/DeviceContext";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
import AnimatedWebP from "../common/AnimatedWebP";

const deviceLinkedImage = require("../../assets/images/illustrations/deviceLinked.webp");
const deviceImage = require("../../assets/images/illustrations/device.webp");

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const BluetoothModal = ({
  visible,
  devices,
  isScanning,
  setIsScanning,
  handleDevicePress,
  onCancel,
  verifiedDevices,
  onDisconnectPress,
  onRefreshPress,
  blueToothStatus,
  disableDisconnect = false,
  workflowRecoveryMode = false,
  onRecoveredVerifiedDevice,
}) => {
  const { t } = useTranslation();
  const { isDarkMode } = useContext(DarkModeContext);
  const SecureDeviceScreenStyle = SecureDeviceScreenStylesRoot(isDarkMode);
  const cancelTriggeredRef = useRef(false);
  const [forceHidden, setForceHidden] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const recoveredHandledRef = useRef(false);

  const blueToothColor = isDarkMode ? "#CCB68C" : "#CFAB95";

  const isBluetoothOff =
    blueToothStatus === "PoweredOff" ||
    blueToothStatus === "off" ||
    blueToothStatus === false;

  const bluetoothOffShakeX = useRef(new Animated.Value(0)).current;
  const prevBluetoothOffNotice = useRef(false);

  useEffect(() => {
    if (visible) {
      cancelTriggeredRef.current = false;
    }
    if (!visible && forceHidden) {
      setForceHidden(false);
    }
    if (!visible) {
      setRefreshPending(false);
      recoveredHandledRef.current = false;
    }
  }, [visible]);

  useEffect(() => {
    if (isScanning) {
      setRefreshPending(false);
    }
  }, [isScanning]);

  const requestClose = (source = "unknown") => {
    if (forceHidden) {
      console.log("[BluetoothModal] requestClose ignored, already hidden");
      return;
    }
    console.log("[BluetoothModal] requestClose from", source);
    setForceHidden(true);
    if (typeof setIsScanning === "function") {
      setIsScanning(false);
    }
    if (typeof onCancel === "function") {
      onCancel();
    }
  };

  const requestCloseWithDelay = (source = "unknown", delayMs = 90) => {
    if (forceHidden) {
      console.log("[BluetoothModal] requestCloseWithDelay ignored, hidden");
      return;
    }
    console.log(
      "[BluetoothModal] requestCloseWithDelay from",
      source,
      "delay",
      delayMs,
    );
    setTimeout(() => {
      requestClose(source);
    }, delayMs);
  };

  useEffect(() => {
    const shouldShake =
      visible && isBluetoothOff && !isScanning && devices.length === 0;

    if (shouldShake && !prevBluetoothOffNotice.current) {
      bluetoothOffShakeX.setValue(0);
      Animated.sequence([
        Animated.timing(bluetoothOffShakeX, {
          toValue: -7,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(bluetoothOffShakeX, {
          toValue: 7,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(bluetoothOffShakeX, {
          toValue: -7,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(bluetoothOffShakeX, {
          toValue: 7,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(bluetoothOffShakeX, {
          toValue: -7,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(bluetoothOffShakeX, {
          toValue: 7,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(bluetoothOffShakeX, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
    return () => {
      bluetoothOffShakeX.setValue(0);
    };
  }, [bluetoothOffShakeX, visible, isBluetoothOff, isScanning, devices.length]);

  useEffect(() => {
    prevBluetoothOffNotice.current =
      visible && isBluetoothOff && !isScanning && devices.length === 0;
  }, [visible, isBluetoothOff, isScanning, devices.length]);

  const verifiedDeviceIds = Array.isArray(verifiedDevices)
    ? verifiedDevices
    : [];

  const isVerifiedDevice = React.useCallback(
    (id) => verifiedDeviceIds.includes(id),
    [verifiedDeviceIds],
  );

  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  useEffect(() => {
    if (Array.isArray(devices) && devices.length > 0) {
      if (
        !selectedDeviceId ||
        !devices.find((d) => d.id === selectedDeviceId)
      ) {
        setSelectedDeviceId(devices[0].id);
      }
    } else {
      setSelectedDeviceId(null);
    }
  }, [devices]);

  const getSignalBars = (rssi) => {
    if (rssi >= -60) return 4;
    if (rssi >= -70) return 3;
    if (rssi >= -80) return 2;
    if (rssi >= -90) return 1;
    return 0;
  };

  const AnimatedTouchableWithScale = (props) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    };

    return (
      <AnimatedTouchable
        {...props}
        onPressIn={(e) => {
          onPressIn();
          if (props.onPressIn) props.onPressIn(e);
        }}
        onPressOut={(e) => {
          onPressOut();
          if (props.onPressOut) props.onPressOut(e);
        }}
        style={[props.style, { transform: [{ scale: scaleAnim }] }]}
      >
        {props.children}
      </AnimatedTouchable>
    );
  };

  const showScanningState = isScanning || refreshPending;
  const canRefresh = typeof onRefreshPress === "function";
  const hasRecoveredVerifiedDevice =
    Array.isArray(devices) && devices.some((device) => isVerifiedDevice(device?.id));
  const shouldShowWorkflowEmptyState =
    workflowRecoveryMode &&
    !hasRecoveredVerifiedDevice;

  useEffect(() => {
    if (
      !workflowRecoveryMode ||
      !visible ||
      forceHidden ||
      !hasRecoveredVerifiedDevice ||
      recoveredHandledRef.current
    ) {
      return;
    }
    recoveredHandledRef.current = true;
    if (typeof onRecoveredVerifiedDevice === "function") {
      onRecoveredVerifiedDevice();
    }
  }, [
    workflowRecoveryMode,
    visible,
    forceHidden,
    hasRecoveredVerifiedDevice,
    onRecoveredVerifiedDevice,
  ]);

  if (!visible || forceHidden) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible
      onRequestClose={() => requestClose("system-back")}
    >
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback
          onPress={() => {
            console.log("[BluetoothModal] backdrop pressed");
            requestClose("backdrop");
          }}
        >
          <View style={StyleSheet.absoluteFillObject}>
            <BlurView style={StyleSheet.absoluteFillObject} />
          </View>
        </TouchableWithoutFeedback>
        <View
          style={SecureDeviceScreenStyle.centeredView}
          pointerEvents="box-none"
        >
          <View
            style={SecureDeviceScreenStyle.btModalView}
            onStartShouldSetResponder={() => {
              console.log("[BluetoothModal] modal view start responder");
              return false;
            }}
            onTouchStart={() => {
            }}
          >
            <Text style={SecureDeviceScreenStyle.btModalTitle}>
              {t("LOOKING FOR DEVICES")}
            </Text>

            {workflowRecoveryMode && shouldShowWorkflowEmptyState ? (
              <View style={{ alignItems: "center" }}>
                <AnimatedWebP
                  source={require("../../assets/animations/Search.webp")}
                  style={{ width: 180, height: 180, margin: 30 }}
                />
                <Animated.Text
                  style={[
                    SecureDeviceScreenStyle.modalSubtitle,
                    isBluetoothOff && SecureDeviceScreenStyle.errorText,
                    isBluetoothOff && {
                      transform: [{ translateX: bluetoothOffShakeX }],
                      textAlign: "center",
                      fontWeight: "600",
                    },
                  ]}
                >
                  {t(
                    isBluetoothOff
                      ? "Bluetooth is off. Turn it on to continue."
                      : "Please make sure your Cold Wallet is unlocked and Bluetooth is enabled.",
                  )}
                </Animated.Text>
              </View>
            ) : showScanningState ? (
              <View style={{ alignItems: "center" }}>
                <AnimatedWebP
                  source={require("../../assets/animations/Lukkey.webp")}
                  style={SecureDeviceScreenStyle.bluetoothImg}
                />
                <Text style={SecureDeviceScreenStyle.scanModalSub}>
                  {t("Scanning...")}
                </Text>
              </View>
            ) : workflowRecoveryMode ? (
              hasRecoveredVerifiedDevice && (
                <FlatList
                  data={devices.filter((item) => isVerifiedDevice(item?.id))}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isVerified = isVerifiedDevice(item.id);
                    const signalBars = getSignalBars(item.rssi);
                    const bgColor = isVerified
                      ? isDarkMode
                        ? "#2C2A27"
                        : "#F2F2F7"
                      : isDarkMode
                        ? "#2C2A27"
                        : "#F2F2F7";
                    const textColor = isVerified
                      ? isDarkMode
                        ? "#F2F2F7"
                        : "#21201E"
                      : isDarkMode
                        ? "#F2F2F7"
                        : "#21201E";
                    isDarkMode ? "#DDDDDD" : "#000000";

                    const deviceImageSource = isVerified
                      ? deviceLinkedImage
                      : deviceImage;
                    const deviceImageSize =
                      Image.resolveAssetSource(deviceImageSource);
                    const deviceAspectRatio =
                      deviceImageSize?.width && deviceImageSize?.height
                        ? deviceImageSize.width / deviceImageSize.height
                        : 1;

                    return (
                      <AnimatedTouchableWithScale
                        onPress={() => {
                          setSelectedDeviceId(item.id);
                          if (!isVerified) {
                            handleDevicePress(item);
                          }
                        }}
                        style={{
                          padding: 10,
                          width: "100%",
                          justifyContent: "space-between",
                          borderRadius: 15,
                          height: 60,
                          alignItems: "center",
                          marginBottom: 16,
                          backgroundColor: bgColor,
                          flexDirection: "row",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flexShrink: 1,
                            flex: 1,
                          }}
                        >
                          <Image
                            source={deviceImageSource}
                            style={{
                              height: 45,
                              width: 45 * deviceAspectRatio,
                              marginRight: 8,
                            }}
                            resizeMode="contain"
                          />
                          <Text
                            style={[
                              SecureDeviceScreenStyle.modalSubtitle,
                              { color: textColor, flexShrink: 1 },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="middle"
                          >
                            {item.name || item.id}
                          </Text>
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-end",
                          }}
                        >
                          {Array.from({ length: 4 }).map((_, i) => {
                            const barHeights = [4, 8, 11, 14];
                            return (
                              <View
                                key={i}
                                style={{
                                  width: 4,
                                  height: barHeights[i],
                                  marginHorizontal: 1,
                                  backgroundColor:
                                    i < signalBars ? "#3CDA84" : "#ccc",
                                  borderRadius: 1,
                                }}
                              />
                            );
                          })}
                        </View>
                      </AnimatedTouchableWithScale>
                    );
                  }}
                />
              )
            ) : (
              devices.length > 0 && (
                <FlatList
                  data={devices}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isVerified = isVerifiedDevice(item.id);
                    const signalBars = getSignalBars(item.rssi);
                    const bgColor = isVerified
                      ? isDarkMode
                        ? "#2C2A27"
                        : "#F2F2F7"
                      : isDarkMode
                        ? "#2C2A27"
                        : "#F2F2F7";
                    const textColor = isVerified
                      ? isDarkMode
                        ? "#F2F2F7"
                        : "#21201E"
                      : isDarkMode
                        ? "#F2F2F7"
                        : "#21201E";
                    isDarkMode ? "#DDDDDD" : "#000000";

                    const deviceImageSource = isVerified
                      ? deviceLinkedImage
                      : deviceImage;
                    const deviceImageSize =
                      Image.resolveAssetSource(deviceImageSource);
                    const deviceAspectRatio =
                      deviceImageSize?.width && deviceImageSize?.height
                        ? deviceImageSize.width / deviceImageSize.height
                        : 1;

                    const isSelected = item.id === selectedDeviceId;

                    return (
                      <AnimatedTouchableWithScale
                        onPress={() => {
                          setSelectedDeviceId(item.id);
                          if (!isVerified) {
                            handleDevicePress(item);
                          }
                        }}
                        style={{
                          padding: 10,
                          width: "100%",
                          justifyContent: "space-between",
                          borderRadius: 15,
                          height: 60,
                          alignItems: "center",
                          marginBottom: 16,
                          backgroundColor: bgColor,
                          flexDirection: "row",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flexShrink: 1,
                            flex: 1,
                          }}
                        >
                          <Image
                            source={deviceImageSource}
                            style={{
                              height: 45,
                              width: 45 * deviceAspectRatio,
                              marginRight: 8,
                            }}
                            resizeMode="contain"
                          />
                          <Text
                            style={[
                              SecureDeviceScreenStyle.modalSubtitle,
                              { color: textColor, flexShrink: 1 },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="middle"
                          >
                            {item.name || item.id}
                          </Text>
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-end",
                          }}
                        >
                          {Array.from({ length: 4 }).map((_, i) => {
                            const barHeights = [4, 8, 11, 14];
                            return (
                              <View
                                key={i}
                                style={{
                                  width: 4,
                                  height: barHeights[i],
                                  marginHorizontal: 1,
                                  backgroundColor:
                                    i < signalBars ? "#3CDA84" : "#ccc",
                                  borderRadius: 1,
                                }}
                              />
                            );
                          })}
                        </View>
                      </AnimatedTouchableWithScale>
                    );
                  }}
                />
              )
            )}

            {!workflowRecoveryMode &&
              !showScanningState &&
              devices.length === 0 && (
              <View style={{ alignItems: "center" }}>
                <AnimatedWebP
                  source={require("../../assets/animations/Search.webp")}
                  style={{ width: 180, height: 180, margin: 30 }}
                />
                <Animated.Text
                  style={[
                    SecureDeviceScreenStyle.modalSubtitle,
                    isBluetoothOff && SecureDeviceScreenStyle.errorText,
                    isBluetoothOff && {
                      transform: [{ translateX: bluetoothOffShakeX }],
                      textAlign: "center",
                      fontWeight: "600",
                    },
                  ]}
                >
                  {t(
                    isBluetoothOff
                      ? "Bluetooth is off. Turn it on to continue."
                      : "Please make sure your Cold Wallet is unlocked and Bluetooth is enabled.",
                  )}
                </Animated.Text>
              </View>
            )}

            {!showScanningState || shouldShowWorkflowEmptyState ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  marginTop: 20,
                }}
              >
                <AnimatedTouchableWithScale
                  style={[
                    SecureDeviceScreenStyle.cancelButton,
                    {
                      flex: 1,
                      borderRadius: 15,
                      marginRight: 10,
                      opacity: canRefresh ? 1 : 0.5,
                    },
                  ]}
                  disabled={!canRefresh}
                  onPress={() => {
                    console.log("[BluetoothModal] Refresh pressed");
                    if (!canRefresh) return;
                    setRefreshPending(true);
                    onRefreshPress();
                  }}
                >
                  <Text style={SecureDeviceScreenStyle.cancelButtonText}>
                    {t("Refresh")}
                  </Text>
                </AnimatedTouchableWithScale>

                {devices.length > 0 && !shouldShowWorkflowEmptyState && (
                  <AnimatedTouchableWithScale
                    style={[
                      SecureDeviceScreenStyle.confirmButton,
                      {
                        flex: 1,
                        borderRadius: 15,
                        opacity:
                          disableDisconnect &&
                          isVerifiedDevice(selectedDeviceId)
                            ? 0.6
                            : 1,
                      },
                    ]}
                    disabled={
                      disableDisconnect &&
                      isVerifiedDevice(selectedDeviceId)
                    }
                    onPress={() => {
                      console.log(
                        "[BluetoothModal] Connect/Disconnect pressed",
                      );
                      const selected = Array.isArray(devices)
                        ? devices.find((d) => d.id === selectedDeviceId)
                        : null;
                      if (!selected) return;

                      const isVerifiedSelected = isVerifiedDevice(
                        selected.id,
                      );

                      if (isVerifiedSelected) {
                        if (
                          !disableDisconnect &&
                          typeof onDisconnectPress === "function"
                        ) {
                          onDisconnectPress(selected);
                        }
                      } else {
                        if (typeof handleDevicePress === "function") {
                          handleDevicePress(selected);
                        }
                      }
                    }}
                  >
                    <Text style={SecureDeviceScreenStyle.buttonTextWhite}>
                      {devices?.find((d) => d.id === selectedDeviceId) &&
                      isVerifiedDevice(selectedDeviceId)
                        ? t("Disconnect")
                        : t("Connect")}
                    </Text>
                  </AnimatedTouchableWithScale>
                )}
              </View>
            ) : (
              <View style={{ width: "100%" }}>
                <AnimatedTouchableWithScale
                  style={[
                    SecureDeviceScreenStyle.cancelBtnLooking,
                    { width: "100%" },
                  ]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPressIn={() => {
                    console.log("[BluetoothModal] Cancel press in (scanning)");
                    if (cancelTriggeredRef.current) {
                      console.log(
                        "[BluetoothModal] Cancel already triggered, ignore press in",
                      );
                      return;
                    }
                    cancelTriggeredRef.current = true;
                    requestCloseWithDelay("cancel-press-in");
                  }}
                  onPress={() => {
                    console.log("[BluetoothModal] Cancel pressed (scanning)");
                    if (cancelTriggeredRef.current) {
                      console.log(
                        "[BluetoothModal] Cancel already triggered, ignore press",
                      );
                      return;
                    }
                    cancelTriggeredRef.current = true;
                    requestCloseWithDelay("cancel-press");
                  }}
                  onPressOut={() =>
                    console.log("[BluetoothModal] Cancel press out (scanning)")
                  }
                >
                  <Text style={SecureDeviceScreenStyle.cancelButtonText}>
                    {t("Cancel")}
                  </Text>
                </AnimatedTouchableWithScale>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default BluetoothModal;
