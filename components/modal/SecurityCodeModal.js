/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// modal/SecurityCodeModal.js
import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  AppState,
  StyleSheet,
  Keyboard,
  InteractionManager,
  Animated,
} from "react-native";
import { BlurView } from "../common/AppBlurView";
import { useTranslation } from "react-i18next";
import { DarkModeContext } from "../../utils/DeviceContext";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
/**
 * Note: When using Expo Go or Dev Client that does not include native modules to scan and run,
 * Directly statically importing expo-screen-capture will throw an error due to the lack of native modules:
 * "Cannot find native module 'ExpoScreenCapture'".
 * Here, the runtime shim is used to wrap require. If native is not available, it will be downgraded to no-op to avoid crashes causing "main has not been registered".
 */
const ScreenCapture = (() => {
  // On Android 14+, expo-screen-capture will try to register a system screenshot observer when the module is initialized.
  // This operation requires signature level android.permission.DETECT_SCREEN_CAPTURE, and third-party applications are not authorized to use it.
  // To avoid "Permission Denial: registerScreenCaptureObserver ..." causing JS initialization to crash,
  // On the Android platform, it returns no-op directly and does not require native modules at all.
  if (Platform.OS === "android") {
    return {
      preventScreenCaptureAsync: async () => {},
      allowScreenCaptureAsync: async () => {},
      addScreenshotListener: () => ({ remove: () => {} }),
      isScreenCaptureEnabledAsync: undefined,
      getIsScreenCaptureEnabledAsync: undefined,
      getIsCapturedAsync: undefined,
    };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-screen-capture");
  } catch (e) {
    return {
      preventScreenCaptureAsync: async () => {},
      allowScreenCaptureAsync: async () => {},
      addScreenshotListener: () => ({ remove: () => {} }),
      isScreenCaptureEnabledAsync: undefined,
      getIsScreenCaptureEnabledAsync: undefined,
      getIsCapturedAsync: undefined,
    };
  }
})();
const SecurityCodeModal = ({
  visible,
  pinCode,
  setPinCode,
  onSubmit,
  onCancel,
  status,
  selectedDevice,
  onCancelConnection,
  onSendPinFail,
  onSecurityRiskDetected,
  pinErrorMessage,
  setPinErrorMessage,
  onRetryPairing,
}) => {
  const { t } = useTranslation();
  const { isDarkMode } = useContext(DarkModeContext);
  const styles = SecureDeviceScreenStylesRoot(isDarkMode);

  const recordingShownRef = useRef(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [incompleteError, setIncompleteError] = useState(false);
  const [retryHintVisible, setRetryHintVisible] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const PIN_ERROR_MISMATCH = "pin_mismatch";
  const PIN_ERROR_TIMEOUT = "pin_timeout";
  const pinErrorText = String(pinErrorMessage || "");
  const isPinMismatch = pinErrorText.startsWith(PIN_ERROR_MISMATCH);
  const isPinTimeout = pinErrorText.startsWith(PIN_ERROR_TIMEOUT);
  const hasPinError = pinErrorText.length > 0;

  // Hidden input and style for entering PIN
  const inputRef = useRef(null);
  const PIN_LEN = 4;
  const highlightColor = isDarkMode ? "#CCB68C" : "#CFAB95"; // Highlight border: dark/light
  const defaultBorderColor = isDarkMode ? "#363639" : "#E0E0E0"; // Default border
  const boxBg = isDarkMode ? "#2C2A27" : "#FFFFFF"; // square background

  const pinStyles = StyleSheet.create({
    // Android: Use minimal non-zero size to make it easier to bring up the soft keyboard after clicking; iOS remains at zero size
    hiddenInput:
      Platform.OS === "android"
        ? {
            position: "absolute",
            opacity: 0.01,
            width: 1,
            height: 1,
            zIndex: -1,
          }
        : { position: "absolute", opacity: 0, width: 0, height: 0, zIndex: -1 },
    row: {
      flexDirection: "row",
      justifyContent: "center",
      marginVertical: 24,
    },
    box: {
      width: 56,
      height: 56,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: boxBg,
    },
    char: {
      fontSize: 20,
      fontWeight: "600",
      color: isDarkMode ? "#fff" : "#21201E",
    },
  });

  const runShake = (anim) => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: -6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleRetryPairing = async () => {
    console.log("[PAIRING][retry] tap try again");
    try {
      setPinCode && setPinCode("");
    } catch {}
    try {
      if (typeof setPinErrorMessage === "function") {
        setPinErrorMessage("");
      }
    } catch {}
    try {
      inputRef.current?.focus?.();
    } catch {}
    try {
      setRetryHintVisible(true);
    } catch {}
    if (typeof onRetryPairing === "function") {
      try {
        console.log(
          "[PAIRING][retry] call onRetryPairing",
          selectedDevice?.id || "unknown",
        );
        await onRetryPairing(selectedDevice);
        console.log("[PAIRING][retry] onRetryPairing done");
      } catch (error) {
        console.log("[PAIRING][retry] failed:", error);
      }
      return;
    }
    console.log("[PAIRING][retry] fallback submit");
    handleSubmit();
  };

  useEffect(() => {
    if (!retryHintVisible) return;
    const timer = setTimeout(() => {
      setRetryHintVisible(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [retryHintVisible]);

  useEffect(() => {
    if (!pinErrorMessage) return;
    console.log(
      "[PIN_ERROR_UI] show pin error ->",
      String(pinErrorMessage || ""),
    );
    runShake(shakeAnim);
    try {
      inputRef.current?.focus?.();
    } catch {}
  }, [pinErrorMessage, shakeAnim]);

  // iOS automatically closes the PIN pop-up window when recording the screen (one-time), and then pops up the global SecurityWarningModal
  const closeDueToRecording = async () => {
    if (Platform.OS !== "ios") return;
    if (recordingShownRef.current) return;
    recordingShownRef.current = true;

    const msg = t(
      "Screen recording detected. Please stop recording to protect your privacy.",
    );

    try {
      if (selectedDevice && onCancelConnection) {
        await onCancelConnection(selectedDevice);
      }
    } catch (e) {
      console.log("onCancelConnection error:", e);
    }

    try {
      onCancel && onCancel();
    } catch (e) {
      console.log("onCancel error:", e);
    }

    triggerSecurityWarning(msg);
  };

  const triggerSecurityWarning = (msg) => {
    // A slight delay to avoid two Modals competing for the rendering level at the same time
    try {
      if (typeof onSecurityRiskDetected === "function") {
        setTimeout(() => {
          try {
            onSecurityRiskDetected(msg);
          } catch (e) {
            console.log("onSecurityRiskDetected callback error:", e);
          }
        }, 200);
      }
    } catch {}
  };

  // iOS/Android: Disable screen recording while the pop-up window is displayed (iOS can only prevent screen recording, not screenshots)
  useEffect(() => {
    let prevented = false;
    (async () => {
      try {
        if (visible) {
          await ScreenCapture.preventScreenCaptureAsync();
          prevented = true;
        } else {
          await ScreenCapture.allowScreenCaptureAsync();
        }
      } catch (e) {
        console.log("screen-capture prevent/allow error:", e);
      }
    })();

    return () => {
      if (prevented) {
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      }
    };
  }, [visible]);

  useEffect(() => {
    let screenshotSub;
    if (visible) {
      // Only monitor system screenshots on iOS; on Android, this monitoring will trigger a system-level permission error, so skip it.
      if (Platform.OS === "ios") {
        try {
          screenshotSub = ScreenCapture.addScreenshotListener(() => {
            const msg = t(
              "We detected a screenshot. Please avoid capturing sensitive information.",
            );
            triggerSecurityWarning(msg);
          });
        } catch (e) {
          console.log("addScreenshotListener error:", e);
        }
      }

      // iOS: If the screen recording has started before entering this pop-up window, proactively check the initial status and prompt
      if (Platform.OS === "ios") {
        (async () => {
          try {
            const candidates = [
              "isScreenCaptureEnabledAsync",
              "getIsScreenCaptureEnabledAsync",
              "getIsCapturedAsync",
            ];
            let initial = false;
            for (const k of candidates) {
              const fn = ScreenCapture?.[k];
              if (typeof fn === "function") {
                const v = await fn();
                if (typeof v === "boolean") {
                  initial = v;
                  break;
                }
              }
            }
            if (initial) {
              console.log(
                "[SecurityCodeModal] iOS screen recording detected (initial) -> auto close",
              );
              closeDueToRecording();
            }
          } catch {}
        })();
      }
    }
    return () => {
      try {
        screenshotSub?.remove?.();
      } catch {}
    };
  }, [visible, t]);

  // iOS polling: Some system versions/environments addScreenCaptureListener is unstable, add polling to ensure that the screen recording can be prompted
  useEffect(() => {
    if (Platform.OS !== "ios") return;

    let timer;
    const candidates = [
      "isScreenCaptureEnabledAsync",
      "getIsScreenCaptureEnabledAsync",
      "getIsCapturedAsync",
    ];

    const checkCapturedOnce = async () => {
      try {
        for (const k of candidates) {
          const fn = ScreenCapture?.[k];
          if (typeof fn === "function") {
            const v = await fn();
            const captured = !!v;
            if (captured && !recordingShownRef.current) {
              console.log(
                "[SecurityCodeModal] iOS screen recording detected (polling) -> auto close",
              );
              closeDueToRecording();
            }
            break;
          }
        }
      } catch {}
    };

    if (visible) {
      recordingShownRef.current = false;
      // Check once upon entry and start polling
      checkCapturedOnce();
      timer = setInterval(checkCapturedOnce, 1200);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible, t]);

  // iOS: It is inferred from AppState changes that the screen recording may start from the control center and automatically close once after returning to the foreground.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!visible) return;

    let inactiveAt = 0;
    const onChange = (state) => {
      if (state === "inactive" || state === "background") {
        inactiveAt = Date.now();
      } else if (state === "active") {
        const delta = Date.now() - inactiveAt;
        // If you leave and return for a short period of time (usually by pulling down the control center), it is considered that you may start recording the screen. For safety reasons, close it directly.
        if (inactiveAt && delta < 4000) {
          console.log(
            "[SecurityCodeModal] AppState active after brief inactive -> auto close (iOS)",
          );
          closeDueToRecording();
        }
        inactiveAt = 0;
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [visible]);

  // Keyboard visibility monitoring (enabled only when the pop-up window is visible), used to switch the keyboard when the input box is clicked
  useEffect(() => {
    if (!visible) return;
    const onShow = () => setKeyboardVisible(true);
    const onHide = () => setKeyboardVisible(false);
    const showSub = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      try {
        showSub.remove();
      } catch {}
      try {
        hideSub.remove();
      } catch {}
    };
  }, [visible]);

  // Android and some models have a secret: Delay focus once after visible changes to avoid focus failure during animation.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const doFocus = () => {
      if (cancelled) return;
      try {
        inputRef.current?.focus?.();
      } catch {}
    };
    const timer = setTimeout(
      () => {
        // Try focusing again after the interaction is completed, which is more stable.
        InteractionManager.runAfterInteractions(doFocus);
      },
      Platform.OS === "android" ? 200 : 120,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible]);

  const handleSubmit = () => {
    const len = pinCode?.length || 0;
    if (len < PIN_LEN) {
      setIncompleteError(true);
      runShake(shakeAnim);
      try {
        inputRef.current?.focus?.();
      } catch {}
      return;
    }
    try {
      onSubmit && onSubmit();
    } catch {}
  };

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onShow={() => {
          // After opening the pop-up window, automatically focus on hidden input and pull up the soft keyboard (does not rely on autoFocus)
          const delay = Platform.OS === "android" ? 150 : 50;
          const timer = setTimeout(() => {
            try {
              inputRef.current?.focus?.();
            } catch {}
          }, delay);
          // Clean up possible residual timers
          return () => clearTimeout(timer);
        }}
        onRequestClose={onCancel}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        hardwareAccelerated={true}
      >
        <BlurView style={styles.centeredView}>
          <View
            style={styles.secCodeModalViewSecureDevice}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {status === "VALID" && (
                  <Image
                    source={require("../../assets/branding/Authentic.webp")}
                    style={{
                      width: 40,
                      height: 40,
                      marginRight: 10,
                      marginBottom: 15,
                      resizeMode: "contain",
                    }}
                  />
                )}
                <Text style={styles.secCodeTitle}>
                  {t("Enter PIN to Connect")}
                </Text>
              </View>
              <Text style={styles.modalSubtitle}>
                {t(
                  "The PIN is displayed on your LUKKEY device. Please check it carefully.",
                )}
              </Text>
            </View>
            {/* PIN visual input box (four small squares) */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                try {
                  if (keyboardVisible) {
                    Keyboard.dismiss();
                    setKeyboardVisible(false);
                  } else {
                    inputRef.current?.focus?.();
                  }
                } catch {}
              }}
              style={{ alignSelf: "stretch", alignItems: "center" }}
            >
              <Animated.View
                style={[
                  pinStyles.row,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {Array.from({ length: PIN_LEN }).map((_, i) => {
                  const filled = (pinCode?.length || 0) > i;
                  return (
                    <View
                      key={i}
                      style={[
                        pinStyles.box,
                        {
                          borderWidth: 1,
                          borderColor: hasPinError
                            ? "#FF5252"
                            : incompleteError && !filled
                              ? "#FF5252"
                              : filled
                                ? highlightColor
                                : defaultBorderColor,
                          marginRight: i < PIN_LEN - 1 ? 10 : 0,
                        },
                      ]}
                    >
                      <Text style={pinStyles.char}>{pinCode?.[i] ?? ""}</Text>
                    </View>
                  );
                })}
              </Animated.View>
            </TouchableOpacity>
            {pinErrorMessage ? (
              <Text
                style={{ marginTop: 8, color: "#FF5252", textAlign: "center" }}
              >
                {isPinMismatch
                  ? t(
                      "The PIN code you entered is incorrect. Please try again.",
                    )
                  : isPinTimeout
                    ? t("No response from the device. Please try again.")
                    : pinErrorText}
              </Text>
            ) : null}
            {retryHintVisible ? (
              <Text
                style={{ marginTop: 8, color: "#66F87B", textAlign: "center" }}
              >
                {t(
                  "The PIN on your device has been refreshed. Please check it.",
                )}
              </Text>
            ) : null}
            {/* Hidden actual input box: Capture numeric typing (does not automatically pop up the keyboard, only focuses on clicking the box) */}
            <TextInput
              ref={inputRef}
              style={pinStyles.hiddenInput}
              value={pinCode}
              onChangeText={(text) => {
                const next = (text || "").replace(/\D/g, "").slice(0, PIN_LEN);
                try {
                  setPinCode && setPinCode(next);
                } catch {}
                setIncompleteError(false);
                if (typeof setPinErrorMessage === "function" && next) {
                  setPinErrorMessage("");
                }
              }}
              keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
              showSoftInputOnFocus={true}
              maxLength={PIN_LEN}
              autoFocus={false}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  { flex: 1, borderRadius: 15, marginRight: 10 },
                ]}
                onPress={async () => {
                  console.log("[PIN_MODAL] cancel pressed");
                  if (selectedDevice && typeof onSendPinFail === "function") {
                    try {
                      console.log(
                        "[PIN_FAIL] onSendPinFail start",
                        selectedDevice?.id || "unknown",
                      );
                      await onSendPinFail(selectedDevice);
                      console.log("[PIN_FAIL] onSendPinFail done");
                    } catch (error) {
                      console.log("[PIN_FAIL] send failed on cancel:", error);
                    }
                  } else {
                    console.log(
                      "[PIN_FAIL] onSendPinFail skipped",
                      Boolean(selectedDevice),
                      typeof onSendPinFail,
                    );
                  }
                  // If there is a selected device and a cancel connection callback is provided, cancel the connection first.
                  if (selectedDevice && onCancelConnection) {
                    try {
                      await onCancelConnection(selectedDevice);
                    } catch (error) {
                      console.log("Failed to cancel connection:", error);
                    }
                  }
                  // Then execute the original cancellation logic
                  onCancel();
                }}
              >
                <Text style={styles.cancelButtonText}>{t("Cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { flex: 1, borderRadius: 15 }]}
                onPress={
                  isPinMismatch || isPinTimeout
                    ? handleRetryPairing
                    : handleSubmit
                }
              >
                <Text style={styles.buttonTextWhite}>
                  {isPinMismatch || isPinTimeout ? t("Try Again") : t("Submit")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </>
  );
};

export default SecurityCodeModal;
