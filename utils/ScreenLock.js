/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useRef, useState, useContext, useEffect } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Modal,
  Image,
  Platform,
  TouchableWithoutFeedback,
  Pressable,
  StyleSheet,
} from "react-native";
import { screenLockStyles, ScreenLockStylesRoot } from "../styles/styles";
import { DeviceContext, DarkModeContext } from "../utils/DeviceContext";
import PatternLockGrid from "../components/common/PatternLockGrid";
import { useTranslation } from "react-i18next";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "../components/common/AppBlurView";
import { confirmDeleteWallet } from "./confirmDeleteWallet";

const ScreenLock = () => {
  const {
    screenLockPassword,
    screenLockType,
    setIsAppLaunching,
    isSelfDestructEnabled,
    selfDestructPassword,
    selfDestructType,
    toggleScreenLock,
    toggleSelfDestruct,
    cryptoCards,
    setCryptoCards,
    setAddedCryptos,
    setInitialAdditionalCryptos,
    verifiedDevices,
    setVerifiedDevices,
    setIsVerificationSuccessful,
    clearNotifications,
    bleManagerRef,
  } = useContext(DeviceContext);
  const { isDarkMode } = useContext(DarkModeContext);
  const { t } = useTranslation();
  const [inputPassword, setInputPassword] = useState("");
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [patternResetKey, setPatternResetKey] = useState(0);
  const [patternErrorText, setPatternErrorText] = useState("");
  const [patternErrorKey, setPatternErrorKey] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shakeInputAnim = useRef(new Animated.Value(0)).current;
  const [passwordErrorText, setPasswordErrorText] = useState("");
  const passwordErrorTimerRef = useRef(null);

  // Blur animation removed

  const isPatternLock = screenLockType === "pattern";

  const handleSelfDestructTrigger = async () => {
    try {
      await confirmDeleteWallet({
        setVerifiedDevices,
        setDeleteWalletModalVisible: () => {},
        cryptoCards,
        setCryptoCards,
        setAddedCryptos,
        setInitialAdditionalCryptos,
        navigation: null,
        t,
        AsyncStorage,
        devices: [],
        bleManagerRef,
        verifiedDevices,
        setModalMessage: null,
        setSuccessModalVisible: null,
        setErrorModalVisible: null,
        clearNotifications,
        setIsVerificationSuccessful,
        toggleScreenLock,
        toggleSelfDestruct,
      });
    } catch {}
    setIsAppLaunching(false);
  };

  // Attempt to unlock with password
  const handleUnlock = () => {
    if (
      isSelfDestructEnabled &&
      selfDestructType === "password" &&
      inputPassword === selfDestructPassword
    ) {
      handleSelfDestructTrigger();
      return;
    }
    if (inputPassword === screenLockPassword) {
      setIsAppLaunching(false);
    } else {
      setPasswordErrorText(t("Incorrect password"));
      shakeInputAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeInputAnim, {
          toValue: 8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeInputAnim, {
          toValue: -8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeInputAnim, {
          toValue: 6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeInputAnim, {
          toValue: -6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeInputAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
      if (passwordErrorTimerRef.current) {
        clearTimeout(passwordErrorTimerRef.current);
      }
      passwordErrorTimerRef.current = setTimeout(() => {
        setPasswordErrorText("");
      }, 3000);
    }
  };

  const handlePatternUnlock = (patternNodes) => {
    const pattern = patternNodes.join("-");
    if (
      isSelfDestructEnabled &&
      selfDestructType === "pattern" &&
      pattern === selfDestructPassword
    ) {
      handleSelfDestructTrigger();
      return;
    }
    if (pattern === screenLockPassword) {
      setPatternErrorText("");
      setIsAppLaunching(false);
    } else {
      setPatternErrorText(t("Please try again."));
      setPatternErrorKey((prev) => prev + 1);
      shakeAnim.setValue(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => {
        setPatternResetKey((prev) => prev + 1);
      }, 420);
      setTimeout(() => {
        setPatternErrorText("");
      }, 900);
    }
  };

  const handleLostPassword = () => setModalVisible(true);
  const handleCloseModal = () => setModalVisible(false);
  const handleCloseErrorModal = () => setErrorModalVisible(false);

  const themeStyles = ScreenLockStylesRoot(isDarkMode);

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, themeStyles.container]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[screenLockStyles.container, themeStyles.container]}>
        <View style={screenLockStyles.header}>
          <Image
            source={require("../assets/branding/Logo@500.webp")}
            style={{ width: 50, height: 50, marginBottom: 20 }}
          />
          <Text style={[screenLockStyles.title, themeStyles.title]}>
            {t("LUKKEY")}
          </Text>
          <Text style={[screenLockStyles.subTitle, themeStyles.subTitle]}>
            {isPatternLock
              ? t("Draw Pattern to Unlock")
              : t("Enter Password to Unlock")}
          </Text>
        </View>

        {isPatternLock ? (
          <View style={{ width: "100%", alignItems: "center" }}>
            <PatternLockGrid
              isDarkMode={isDarkMode}
              onComplete={handlePatternUnlock}
              resetKey={patternResetKey}
              errorFlashKey={patternErrorKey}
              style={{ width: 240 }}
            />
            {patternErrorText ? (
              <Animated.Text
                style={[
                  themeStyles.modalText,
                  {
                    color: "#FF5252",
                    marginTop: 12,
                    transform: [{ translateX: shakeAnim }],
                    textAlign: "center",
                  },
                ]}
              >
                {patternErrorText}
              </Animated.Text>
            ) : null}
          </View>
        ) : (
          <>
            <Animated.View
              style={[
                screenLockStyles.passwordInputWr,
                {
                  borderRadius: 16,
                  height: 60,
                  transform: [{ translateX: shakeInputAnim }],
                },
              ]}
            >
              <TextInput
                style={[
                  screenLockStyles.input,
                  themeStyles.input,
                  {
                    height: 60,
                    borderRadius: 16,
                    borderColor: passwordErrorText ? "#FF5252" : undefined,
                    borderWidth: passwordErrorText ? 1 : 0,
                  },
                ]}
                secureTextEntry={isPasswordHidden}
                value={inputPassword}
                onChangeText={setInputPassword}
                placeholder={t("Enter Password")}
                placeholderTextColor={themeStyles.placeholder.color}
              />
              <TouchableOpacity
                onPress={() => setIsPasswordHidden(!isPasswordHidden)}
                style={[
                  screenLockStyles.eyeIcon,
                  {
                    top: 4,
                    bottom: 0,
                    justifyContent: "center",
                  },
                ]}
              >
                <Icon
                  name={isPasswordHidden ? "visibility-off" : "visibility"}
                  size={24}
                  color={themeStyles.placeholder.color}
                />
              </TouchableOpacity>
            </Animated.View>
            {passwordErrorText ? (
              <Text
                style={[
                  themeStyles.modalText,
                  { color: "#FF5252", marginBottom: 8 },
                ]}
              >
                {passwordErrorText}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                screenLockStyles.button,
                themeStyles.button,
                { borderRadius: 16, height: 60 },
              ]}
              onPress={handleUnlock}
            >
              <Text style={[themeStyles.buttonText, { fontWeight: "normal" }]}>
                {t("Unlock")}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={handleLostPassword}
          style={screenLockStyles.lostPwdContainer}
        >
          <Text
            style={[
              screenLockStyles.lostPasswordText,
              themeStyles.lostPasswordText,
            ]}
          >
            {t("I lost my password")}
          </Text>
        </TouchableOpacity>

        {/* Lost Password Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={handleCloseModal}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleCloseModal}
            >
              <BlurView style={StyleSheet.absoluteFillObject} />
            </Pressable>
            <View
              style={screenLockStyles.modalBackground}
              pointerEvents="box-none"
            >
              <View
                style={[screenLockStyles.modalView, themeStyles.modalView]}
                onStartShouldSetResponder={() => true}
              >
                <Text
                  style={[screenLockStyles.modalTitle, themeStyles.modalTitle]}
                >
                  {t("I lost my password")}
                </Text>
                <Text
                  style={[screenLockStyles.modalText, themeStyles.modalText]}
                >
                  {t(
                    "To reset the app and remove stored data, please uninstall and reinstall it on your phone."
                  )}
                </Text>
                <TouchableOpacity
                  style={[
                    screenLockStyles.closeButton,
                    themeStyles.closeButton,
                  ]}
                  onPress={handleCloseModal}
                >
                  <Text
                    style={[themeStyles.buttonText, { fontWeight: "normal" }]}
                  >
                    {t("Confirm")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ScreenLock;
