/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "../common/AppBlurView";
import PatternLockGrid from "../common/PatternLockGrid";

const AnimatedTouchableOpacity = ({
  children,
  style,
  onPress,
  activeOpacity = 0.2,
  ...rest
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const LockCodeFlowModal = ({
  visible,
  mode,
  onClose,
  onSubmit,
  onSelectPassword,
  onSelectPattern,
  onPatternComplete,
  t,
  isDarkMode,
  styles,
  titleText,
  subtitleText,
  setViewStyle = "enable",
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  passwordError,
  setPasswordError,
  isPasswordHidden,
  setIsPasswordHidden,
  isConfirmPasswordHidden,
  setIsConfirmPasswordHidden,
  currentPassword: controlledCurrentPassword,
  setCurrentPassword: setControlledCurrentPassword,
  isCurrentPasswordHidden,
  setIsCurrentPasswordHidden,
  patternMode = "create",
  expectedPattern,
  forbiddenPattern,
  forbiddenPatternErrorText,
}) => {
  const [showModal, setShowModal] = useState(visible);
  const passwordInputRef = useRef(null);
  const currentPasswordInputRef = useRef(null);
  const hiddenInputRef = useRef(null);

  const [internalCurrentPassword, setInternalCurrentPassword] = useState("");
  const [internalCurrentHidden, setInternalCurrentHidden] = useState(true);
  const resolvedCurrentPassword =
    controlledCurrentPassword !== undefined
      ? controlledCurrentPassword
      : internalCurrentPassword;
  const setResolvedCurrentPassword =
    setControlledCurrentPassword || setInternalCurrentPassword;
  const resolvedCurrentHidden =
    typeof isCurrentPasswordHidden === "boolean"
      ? isCurrentPasswordHidden
      : internalCurrentHidden;
  const setResolvedCurrentHidden =
    setIsCurrentPasswordHidden || setInternalCurrentHidden;

  const shakePasswordAnim = useRef(new Animated.Value(0)).current;
  const shakeConfirmAnim = useRef(new Animated.Value(0)).current;
  const shakeCurrentAnim = useRef(new Animated.Value(0)).current;

  const modalCenterStyle = {
    position: "relative",
    top: 0,
    bottom: 0,
  };

  const mismatchErrorText = t ? t("Passwords do not match") : "";
  const isMismatchError = passwordError === mismatchErrorText;

  const passwordErrorInputStyle =
    passwordError && !isMismatchError
      ? { borderColor: "#FF5252", borderWidth: 1 }
      : null;
  const confirmErrorInputStyle = passwordError
    ? { borderColor: "#FF5252", borderWidth: 1 }
    : null;

  useEffect(() => {
    setShowModal(visible);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (mode !== "set") return;
    if (passwordError) {
      if (isMismatchError) {
        runShake(shakeConfirmAnim);
      } else {
        runShake(shakePasswordAnim);
        runShake(shakeConfirmAnim);
      }
    }
  }, [passwordError, isMismatchError, mode, visible]);

  useEffect(() => {
    if (!visible) return;
    if (mode !== "enter" && mode !== "change") return;
    if (!passwordError) return;
    runShake(shakeCurrentAnim);
  }, [passwordError, mode, visible]);

  useEffect(() => {
    if (!visible) return;
    if (mode !== "set") return;
    const timer = setTimeout(
      () => {
        InteractionManager.runAfterInteractions(() => {
          try {
            passwordInputRef.current?.focus?.();
          } catch {}
        });
      },
      Platform.OS === "android" ? 200 : 120
    );
    return () => clearTimeout(timer);
  }, [visible, mode]);

  useEffect(() => {
    if (!visible) return;
    if (mode !== "change") return;
    const timer = setTimeout(
      () => {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            try {
              currentPasswordInputRef.current?.focus?.();
            } catch {}
          });
        });
      },
      Platform.OS === "android" ? 200 : 120
    );
    return () => clearTimeout(timer);
  }, [visible, mode]);

  useEffect(() => {
    if (!visible) return;
    if (mode !== "select") return;
    Keyboard.dismiss();
  }, [visible, mode]);

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

  const renderSelectMode = () => {
    const modalTitleText = titleText || (t ? t("Enable Screen Lock") : "");

    return (
      <Modal
        animationType="fade"
        transparent
        visible={showModal}
        onRequestClose={onClose}
      >
        <View style={styles.addrBookFlex}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView style={StyleSheet.absoluteFillObject} />
          </Pressable>
          <View style={styles.centeredView} pointerEvents="box-none">
            <View
              style={[styles.enLockMdlView, modalCenterStyle]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.modalTitle, { marginBottom: 8 }]}>
                {modalTitleText}
              </Text>
              <TextInput
                ref={hiddenInputRef}
                style={{
                  position: "absolute",
                  opacity: 0.01,
                  width: 1,
                  height: 1,
                  zIndex: -1,
                }}
                showSoftInputOnFocus={true}
                autoFocus={false}
                value=""
                onChangeText={() => {}}
              />
              <TouchableOpacity
                onPress={onSelectPassword}
                style={[
                  styles.optionButton,
                  { marginBottom: 10, borderRadius: 16, width: "100%" },
                ]}
              >
                <Text style={[styles.optionButtonText, { fontSize: 16 }]}> 
                  {t ? t("Set Password") : ""}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSelectPattern}
                style={[
                  styles.optionButton,
                  { marginBottom: 0, borderRadius: 16, width: "100%" },
                ]}
              >
                <Text style={[styles.optionButtonText, { fontSize: 16 }]}> 
                  {t ? t("Set Pattern Lock") : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderSetMode = () => {
    const modalTitleText = titleText || (t ? t("Enable Screen Lock") : "");
    const containerStyle =
      setViewStyle === "set"
        ? styles.setLocCodMdlView
        : styles.enLockMdlView;

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showModal}
        onRequestClose={onClose}
      >
        <View style={{ flex: 1 }}>
          <BlurView style={StyleSheet.absoluteFillObject} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.centeredView}
            pointerEvents="box-none"
          >
            <View style={[containerStyle, modalCenterStyle]}>
              <Text style={styles.lockCodeMdlTtl}>{modalTitleText}</Text>
              <Animated.View
                style={[
                  styles.passwordInputWr,
                  { transform: [{ translateX: shakePasswordAnim }] },
                ]}
              >
                <TextInput
                  ref={passwordInputRef}
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: isDarkMode ? "#21201E" : "#E3E3E8",
                      borderRadius: 16,
                    },
                    passwordErrorInputStyle,
                  ]}
                  placeholder={t ? t("Enter new password") : ""}
                  placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
                  secureTextEntry={isPasswordHidden}
                  onChangeText={(text) => {
                    setPassword && setPassword(text);
                    setPasswordError && setPasswordError("");
                  }}
                  value={password}
                  autoFocus={true}
                />
                <AnimatedTouchableOpacity
                  onPress={() =>
                    setIsPasswordHidden && setIsPasswordHidden(!isPasswordHidden)
                  }
                  style={styles.eyeIcon}
                >
                  <Icon
                    name={isPasswordHidden ? "visibility-off" : "visibility"}
                    size={24}
                    color={isDarkMode ? "#ccc" : "#666"}
                  />
                </AnimatedTouchableOpacity>
              </Animated.View>

              <Animated.View
                style={[
                  styles.passwordInputWr,
                  { transform: [{ translateX: shakeConfirmAnim }] },
                ]}
              >
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: isDarkMode ? "#21201E" : "#E3E3E8",
                      borderRadius: 16,
                    },
                    confirmErrorInputStyle,
                  ]}
                  placeholder={t ? t("Confirm new password") : ""}
                  placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
                  secureTextEntry={isConfirmPasswordHidden}
                  onChangeText={(text) => {
                    setConfirmPassword && setConfirmPassword(text);
                    setPasswordError && setPasswordError("");
                  }}
                  value={confirmPassword}
                />
                <AnimatedTouchableOpacity
                  onPress={() =>
                    setIsConfirmPasswordHidden &&
                    setIsConfirmPasswordHidden(!isConfirmPasswordHidden)
                  }
                  style={styles.eyeIcon}
                >
                  <Icon
                    name={
                      isConfirmPasswordHidden ? "visibility-off" : "visibility"
                    }
                    size={24}
                    color={isDarkMode ? "#ccc" : "#666"}
                  />
                </AnimatedTouchableOpacity>
              </Animated.View>

              {passwordError ? (
                <Text style={[styles.errorText, { marginLeft: 10 }]}>
                  {passwordError}
                </Text>
              ) : null}
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { flex: 1, marginRight: 4, borderRadius: 15 },
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>
                    {t ? t("Cancel") : ""}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { flex: 1, marginLeft: 4, borderRadius: 15, marginBottom: 0 },
                  ]}
                  onPress={onSubmit}
                >
                  <Text style={styles.buttonTextWhite}>
                    {t ? t("Submit") : ""}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  const renderChangeMode = () => {
    const modalTitleText = titleText || (t ? t("Change Password") : "");
    const modalSubtitleText =
      subtitleText || (t ? t("Enter current password to continue") : "");
    const hasError = !!passwordError;
    const inputErrorStyle = hasError
      ? { borderColor: "#FF5252", borderWidth: 1 }
      : null;

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showModal}
        onRequestClose={onClose}
        onShow={() => {
          const delay = Platform.OS === "android" ? 150 : 50;
          const timer = setTimeout(() => {
            InteractionManager.runAfterInteractions(() => {
              requestAnimationFrame(() => {
                try {
                  currentPasswordInputRef.current?.focus?.();
                } catch {}
              });
            });
          }, delay);
          return () => clearTimeout(timer);
        }}
      >
        <View style={{ flex: 1 }}>
          <BlurView style={StyleSheet.absoluteFillObject} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.centeredView}
            pointerEvents="box-none"
          >
            <View style={styles.changeLockModal}>
              <Text style={styles.lockCodeMdlTtl}>{modalTitleText}</Text>
              <Text style={styles.lockCodeMdlTxt}>{modalSubtitleText}</Text>

              <Animated.View
                style={[
                  styles.passwordInputWr,
                  { transform: [{ translateX: shakeCurrentAnim }] },
                ]}
              >
                <TextInput
                  ref={currentPasswordInputRef}
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: isDarkMode ? "#21201E" : "#E3E3E8",
                      borderRadius: 16,
                    },
                    inputErrorStyle,
                  ]}
                  placeholder={t ? t("Enter current password") : ""}
                  placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
                  secureTextEntry={resolvedCurrentHidden}
                  onChangeText={(text) => {
                    setResolvedCurrentPassword(text);
                    setPasswordError && setPasswordError("");
                  }}
                  value={resolvedCurrentPassword}
                  autoFocus={true}
                />
                <TouchableOpacity
                  onPress={() => setResolvedCurrentHidden(!resolvedCurrentHidden)}
                  style={styles.eyeIcon}
                >
                  <Icon
                    name={resolvedCurrentHidden ? "visibility-off" : "visibility"}
                    size={24}
                    color={isDarkMode ? "#ccc" : "#666"}
                  />
                </TouchableOpacity>
              </Animated.View>

              {hasError ? (
                <Text style={[styles.errorText, { marginLeft: 10 }]}>
                  {passwordError}
                </Text>
              ) : null}
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { flex: 1, marginRight: 4, borderRadius: 15 },
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>
                    {t ? t("Cancel") : ""}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { flex: 1, marginLeft: 4, borderRadius: 15, marginBottom: 0 },
                  ]}
                  onPress={() => onSubmit && onSubmit(resolvedCurrentPassword)}
                >
                  <Text style={styles.buttonTextWhite}>{t ? t("Next") : ""}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  const renderEnterMode = () => {
    const modalTitleText = titleText || (t ? t("Disable Lock Screen") : "");
    const hasError = !!passwordError;
    const inputErrorStyle = hasError
      ? { borderColor: "#FF5252", borderWidth: 1 }
      : null;

    return (
      <Modal
        animationType="fade"
        transparent
        visible={showModal}
        onRequestClose={onClose}
      >
        <View style={{ flex: 1 }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView style={StyleSheet.absoluteFillObject} />
          </Pressable>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.centeredView}
            pointerEvents="box-none"
          >
            <View style={styles.disLockMdlView}>
              <Text style={styles.lockCodeMdlTtl}>{modalTitleText}</Text>

              <Animated.View
                style={[
                  styles.passwordInputWr,
                  {
                    marginBottom: 8,
                    transform: [{ translateX: shakeCurrentAnim }],
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: isDarkMode ? "#21201E" : "#E3E3E8",
                      borderRadius: 16,
                    },
                    inputErrorStyle,
                  ]}
                  placeholder={t ? t("Enter your password") : ""}
                  placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
                  secureTextEntry={resolvedCurrentHidden}
                  onChangeText={(text) => {
                    setResolvedCurrentPassword(text);
                    setPasswordError && setPasswordError("");
                  }}
                  value={resolvedCurrentPassword}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => setResolvedCurrentHidden(!resolvedCurrentHidden)}
                  style={styles.eyeIcon}
                >
                  <Icon
                    name={resolvedCurrentHidden ? "visibility-off" : "visibility"}
                    size={24}
                    color={isDarkMode ? "#ccc" : "#666"}
                  />
                </TouchableOpacity>
              </Animated.View>

              {hasError ? (
                <Text style={[styles.errorText]}>{passwordError}</Text>
              ) : null}
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { flex: 1, marginRight: 4, borderRadius: 16 },
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>
                    {t ? t("Cancel") : ""}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { flex: 1, marginLeft: 4, borderRadius: 16, marginBottom: 0 },
                  ]}
                  onPress={() => onSubmit && onSubmit(resolvedCurrentPassword)}
                >
                  <Text style={styles.buttonTextWhite}>
                    {t ? t("Submit") : ""}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  const [patternStage, setPatternStage] = useState(
    patternMode === "create" ? "create" : "verify"
  );
  const [firstPattern, setFirstPattern] = useState("");
  const [patternErrorText, setPatternErrorText] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [errorFlashKey, setErrorFlashKey] = useState(0);
  const patternShakeAnim = useRef(new Animated.Value(0)).current;
  const errorTimerRef = useRef(null);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    if (!visible || mode !== "pattern") return;
    setPatternStage(patternMode === "create" ? "create" : "verify");
    setFirstPattern("");
    setPatternErrorText("");
    setResetKey((prev) => prev + 1);
    setErrorFlashKey(0);
    patternShakeAnim.setValue(0);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, [patternMode, visible, mode]);

  const computedPatternTitle = useMemo(() => {
    if (titleText) return titleText;
    if (patternMode === "verify") return t ? t("Draw Pattern to Unlock") : "";
    return t ? t("Set Pattern Lock") : "";
  }, [patternMode, titleText, t]);

  const computedPatternSubtitle = useMemo(() => {
    if (subtitleText) return subtitleText;
    if (patternMode === "verify") return t ? t("Draw Pattern to Unlock") : "";
    if (patternStage === "confirm")
      return t ? t("Draw pattern again to confirm") : "";
    return t ? t("Draw an unlock pattern") : "";
  }, [patternMode, patternStage, subtitleText, t]);

  const resetGrid = () => setResetKey((prev) => prev + 1);

  const triggerPatternError = (message) => {
    setPatternErrorText(message);
    setErrorFlashKey((prev) => prev + 1);
    patternShakeAnim.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {}
    );
    Animated.sequence([
      Animated.timing(patternShakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(patternShakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(patternShakeAnim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(patternShakeAnim, {
        toValue: -6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(patternShakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(resetGrid, 420);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setPatternErrorText("");
    }, 900);
  };

  const handlePatternComplete = (patternNodes) => {
    const pattern = patternNodes.join("-");
    if (patternNodes.length < 4) {
      triggerPatternError(t ? t("Pattern must connect at least 4 dots") : "");
      return;
    }

    if (patternMode === "verify") {
      if (pattern !== expectedPattern) {
        triggerPatternError(t ? t("Please try again.") : "");
        return;
      }
      if (typeof onPatternComplete === "function") {
        onPatternComplete(pattern);
      }
      return;
    }

    if (forbiddenPattern && pattern === forbiddenPattern) {
      triggerPatternError(
        forbiddenPatternErrorText || (t ? t("New pattern must be different") : "")
      );
      return;
    }

    if (patternStage === "create") {
      setFirstPattern(pattern);
      setPatternStage("confirm");
      setPatternErrorText("");
      resetGrid();
      return;
    }

    if (pattern !== firstPattern) {
      triggerPatternError(t ? t("Patterns do not match") : "");
      return;
    }

    if (typeof onPatternComplete === "function") {
      onPatternComplete(pattern);
    }
  };

  const renderPatternMode = () => {
    return (
      <Modal
        animationType="fade"
        transparent
        visible={showModal}
        onRequestClose={onClose}
      >
        <View style={{ flex: 1 }}>
          <BlurView style={StyleSheet.absoluteFillObject} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={styles.centeredView} pointerEvents="box-none">
            <View style={[styles.enLockMdlView, modalCenterStyle]}>
              <Text style={styles.lockCodeMdlTtl}>{computedPatternTitle}</Text>
              <Text style={[styles.lockCodeMdlTxt, { marginBottom: 14 }]}>
                {computedPatternSubtitle}
              </Text>
              <PatternLockGrid
                isDarkMode={isDarkMode}
                onComplete={handlePatternComplete}
                resetKey={resetKey}
                errorFlashKey={errorFlashKey}
                style={{ width: "90%", alignSelf: "center" }}
              />
              {patternErrorText ? (
                <Animated.Text
                  style={[
                    styles.errorText,
                    {
                      marginTop: 10,
                      textAlign: "center",
                      alignSelf: "center",
                      transform: [{ translateX: patternShakeAnim }],
                    },
                  ]}
                >
                  {patternErrorText}
                </Animated.Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (!showModal) return null;

  if (mode === "select") return renderSelectMode();
  if (mode === "set") return renderSetMode();
  if (mode === "change") return renderChangeMode();
  if (mode === "enter") return renderEnterMode();
  if (mode === "pattern") return renderPatternMode();

  return null;
};

export default LockCodeFlowModal;
