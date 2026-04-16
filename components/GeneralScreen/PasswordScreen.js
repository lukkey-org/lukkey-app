/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// components/GeneralScreen/PasswordScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Vibration,
  Switch,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { DarkModeContext, DeviceContext } from "../../utils/DeviceContext";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
import { BlurView } from "../common/AppBlurView";
import CheckStatusModal from "../modal/CheckStatusModal";
import LockCodeFlowModal from "../modal/LockCodeFlowModal";

export default function PasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isDarkMode } = React.useContext(DarkModeContext);
  const {
    isScreenLockEnabled,
    screenLockType,
    screenLockPassword,
    toggleScreenLock,
    setScreenLockCredential,
    isSelfDestructEnabled,
    selfDestructPassword,
    selfDestructType,
    toggleSelfDestruct,
    setSelfDestructCredential,
  } = React.useContext(DeviceContext);


  useEffect(() => {
    navigation.setOptions({
      title: t("Password"),
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

  useEffect(() => {
    if (!isScreenLockEnabled && isSelfDestructEnabled) {
      toggleSelfDestruct(false);
    }
  }, [isScreenLockEnabled, isSelfDestructEnabled, toggleSelfDestruct]);

  const sdStyles = useMemo(
    () => SecureDeviceScreenStylesRoot(isDarkMode),
    [isDarkMode]
  );
  const iconColor = isDarkMode ? "#ffffff" : "#676776";
  const rightArrowColor = isDarkMode ? iconColor : "#cccccc";
  const toggleColor = isDarkMode ? "#CCB68C" : "#CFAB95";
  const [selfDestructLockCodeModalVisible, setSelfDestructLockCodeModalVisible] =
    useState(false);
  const [screenLockEnterLockCodeModalVisible, setScreenLockEnterLockCodeModalVisible] =
    useState(false);
  const [selfDestructEnterLockCodeModalVisible, setSelfDestructEnterLockCodeModalVisible] =
    useState(false);
  const [selfDestructPatternLockModalVisible, setSelfDestructPatternLockModalVisible] =
    useState(false);
  const [selfDestructPatternLockMode, setSelfDestructPatternLockMode] =
    useState("create");
  const [selfDestructPatternLockFlow, setSelfDestructPatternLockFlow] =
    useState("enable");
  const [selfDestructPasswordInput, setSelfDestructPasswordInput] = useState("");
  const [selfDestructConfirmPasswordInput, setSelfDestructConfirmPasswordInput] =
    useState("");
  const [selfDestructPasswordError, setSelfDestructPasswordError] = useState("");
  const [isSelfDestructPasswordHidden, setIsSelfDestructPasswordHidden] =
    useState(true);
  const [isSelfDestructConfirmPasswordHidden, setIsSelfDestructConfirmPasswordHidden] =
    useState(true);
  const [selfDestructLockCodeInitialMode, setSelfDestructLockCodeInitialMode] =
    useState(null);
  const [selfDestructCurrentPassword, setSelfDestructCurrentPassword] =
    useState("");
  const [isSelfDestructCurrentPasswordHidden, setIsSelfDestructCurrentPasswordHidden] =
    useState(true);
  const [screenLockCurrentPassword, setScreenLockCurrentPassword] =
    useState("");
  const [isScreenLockCurrentPasswordHidden, setIsScreenLockCurrentPasswordHidden] =
    useState(true);
  const [screenLockPasswordError, setScreenLockPasswordError] = useState("");
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [returnToGeneralOnSuccess, setReturnToGeneralOnSuccess] =
    useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [changeLockTargetModalVisible, setChangeLockTargetModalVisible] =
    useState(false);
  const [changeLockCodeModalVisible, setChangeLockCodeModalVisible] =
    useState(false);
  const [newLockCodeModalVisible, setNewLockCodeModalVisible] =
    useState(false);
  const [changeLockPasswordError, setChangeLockPasswordError] = useState("");
  const [switchNewPassword, setSwitchNewPassword] = useState("");
  const [switchConfirmPassword, setSwitchConfirmPassword] = useState("");
  const [switchPasswordError, setSwitchPasswordError] = useState("");
  const [isSwitchPasswordHidden, setIsSwitchPasswordHidden] = useState(true);
  const [isSwitchConfirmPasswordHidden, setIsSwitchConfirmPasswordHidden] =
    useState(true);
  const [switchLockCodeModalVisible, setSwitchLockCodeModalVisible] =
    useState(false);
  const [switchLockCodeInitialMode, setSwitchLockCodeInitialMode] =
    useState(null);
  const [switchLockPassword, setSwitchLockPassword] = useState("");
  const [switchLockConfirmPassword, setSwitchLockConfirmPassword] =
    useState("");
  const [switchLockPasswordError, setSwitchLockPasswordError] = useState("");
  const [isSwitchLockPasswordHidden, setIsSwitchLockPasswordHidden] =
    useState(true);
  const [isSwitchLockConfirmPasswordHidden, setIsSwitchLockConfirmPasswordHidden] =
    useState(true);
  const [switchPatternLockModalVisible, setSwitchPatternLockModalVisible] =
    useState(false);
  const [switchPatternLockMode, setSwitchPatternLockMode] = useState("create");
  const [switchPatternLockFlow, setSwitchPatternLockFlow] =
    useState("enable");
  const [changePatternLockModalVisible, setChangePatternLockModalVisible] =
    useState(false);
  const [changePatternLockMode, setChangePatternLockMode] = useState("verify");
  const [changePatternLockFlow, setChangePatternLockFlow] =
    useState("change");
  const [pendingSwitchType, setPendingSwitchType] = useState(null);

  const closeAllModals = React.useCallback(() => {
    setSelfDestructLockCodeModalVisible(false);
    setScreenLockEnterLockCodeModalVisible(false);
    setSelfDestructEnterLockCodeModalVisible(false);
    setSelfDestructPatternLockModalVisible(false);
    setSuccessModalVisible(false);
    setErrorModalVisible(false);
    setChangeLockTargetModalVisible(false);
    setChangeLockCodeModalVisible(false);
    setNewLockCodeModalVisible(false);
    setSwitchLockCodeModalVisible(false);
    setSwitchPatternLockModalVisible(false);
    setChangePatternLockModalVisible(false);
  }, []);

  const openExclusiveModal = React.useCallback((openAction) => {
    closeAllModals();
    if (typeof openAction === "function") {
      openAction();
    }
  }, [closeAllModals]);

  const handleToggleScreenLock = () => {
    try {
      Vibration.vibrate();
    } catch {}
    if (isScreenLockEnabled) {
      if (screenLockType === "pattern") {
        openSwitchPatternLockModal("disable");
      } else {
        openScreenLockEnterLockCodeModal();
      }
      return;
    }
    if (screenLockType === "pattern") {
      openSwitchPatternLockModal("enable");
      return;
    }
    openSwitchLockCodeModal("password");
  };

  const handleChangeLock = () => {
    try {
      Vibration.vibrate();
    } catch {}
    if (screenLockType === "pattern") {
      if (isSelfDestructEnabled) {
        openExclusiveModal(() => setChangeLockTargetModalVisible(true));
        return;
      }
      setChangePatternLockFlow("change");
      setChangePatternLockMode("verify");
      openExclusiveModal(() => setChangePatternLockModalVisible(true));
      return;
    }
    setScreenLockCurrentPassword("");
    setIsScreenLockCurrentPasswordHidden(true);
    setChangeLockPasswordError("");
    openExclusiveModal(() => setChangeLockCodeModalVisible(true));
  };

  const openSelfDestructLockCodeModal = (mode = "password") => {
    setSelfDestructPasswordInput("");
    setSelfDestructConfirmPasswordInput("");
    setIsSelfDestructPasswordHidden(true);
    setIsSelfDestructConfirmPasswordHidden(true);
    setSelfDestructPasswordError("");
    setSelfDestructLockCodeInitialMode(mode);
    openExclusiveModal(() => setSelfDestructLockCodeModalVisible(true));
  };

  const closeSelfDestructLockCodeModal = () => {
    setSelfDestructLockCodeModalVisible(false);
    setSelfDestructLockCodeInitialMode(null);
    setSelfDestructPasswordInput("");
    setSelfDestructConfirmPasswordInput("");
    setIsSelfDestructPasswordHidden(true);
    setIsSelfDestructConfirmPasswordHidden(true);
    setSelfDestructPasswordError("");
  };

  const openSelfDestructPatternLockModal = (flow = "enable") => {
    setSelfDestructPatternLockFlow(flow);
    setSelfDestructPatternLockMode(flow === "enable" ? "create" : "verify");
    openExclusiveModal(() => setSelfDestructPatternLockModalVisible(true));
  };

  const openSelfDestructChangePatternLockModal = () => {
    setSelfDestructPatternLockFlow("change");
    setSelfDestructPatternLockMode("verify");
    openExclusiveModal(() => setSelfDestructPatternLockModalVisible(true));
  };

  const openSelfDestructEnterLockCodeModal = () => {
    setSelfDestructCurrentPassword("");
    setIsSelfDestructCurrentPasswordHidden(true);
    openExclusiveModal(() => setSelfDestructEnterLockCodeModalVisible(true));
  };

  const closeSelfDestructEnterLockCodeModal = () => {
    setSelfDestructEnterLockCodeModalVisible(false);
    setSelfDestructCurrentPassword("");
    setIsSelfDestructCurrentPasswordHidden(true);
  };

  const openScreenLockEnterLockCodeModal = () => {
    setScreenLockCurrentPassword("");
    setIsScreenLockCurrentPasswordHidden(true);
    setScreenLockPasswordError("");
    openExclusiveModal(() => setScreenLockEnterLockCodeModalVisible(true));
  };

  const closeScreenLockEnterLockCodeModal = () => {
    setScreenLockEnterLockCodeModalVisible(false);
    setScreenLockCurrentPassword("");
    setIsScreenLockCurrentPasswordHidden(true);
    setScreenLockPasswordError("");
  };

  const handleOpenSelfDestructPatternLockSettings = () => {
    closeSelfDestructLockCodeModal();
    setTimeout(() => {
      openSelfDestructPatternLockModal("enable");
    }, 60);
  };

  const handleOpenSwitchPatternLockSettings = () => {
    closeSwitchLockCodeModal();
    setTimeout(() => {
      openSwitchPatternLockModal("enable");
    }, 60);
  };

  const handleSetSelfDestructPassword = async () => {
    if (selfDestructPasswordInput.length < 4) {
      setSelfDestructPasswordError(
        t("Password must be at least 4 characters long")
      );
      return;
    }

    if (selfDestructPasswordInput === screenLockPassword) {
      setSelfDestructPasswordError(
        t("Self-Destruct Password must be different from Screen Lock")
      );
      return;
    }

    if (selfDestructPasswordInput !== selfDestructConfirmPasswordInput) {
      setSelfDestructPasswordError(t("Passwords do not match"));
      return;
    }

    try {
      await setSelfDestructCredential(selfDestructPasswordInput, "password");
      await toggleSelfDestruct(true);
      closeSelfDestructLockCodeModal();
      setModalMessage(t("Self-Destruct Password enabled successfully"));
      openExclusiveModal(() => setSuccessModalVisible(true));
    } catch (error) {
      console.error("Failed to enable self-destruct password:", error);
      setModalMessage(t("An error occurred while saving password"));
      openExclusiveModal(() => setErrorModalVisible(true));
    }
  };

  const handleSelfDestructPatternComplete = async (pattern) => {
    if (selfDestructPatternLockMode === "verify") {
      if (selfDestructPatternLockFlow === "change") {
        setSelfDestructPatternLockMode("create");
        setSelfDestructPatternLockFlow("change-create");
        return;
      }
      if (selfDestructPatternLockFlow === "disable") {
        try {
          await toggleSelfDestruct(false);
          setSelfDestructPatternLockModalVisible(false);
          setModalMessage(t("Self-Destruct Password disabled successfully"));
          openExclusiveModal(() => setSuccessModalVisible(true));
        } catch (error) {
          console.error("Failed to disable self-destruct password:", error);
          setModalMessage(t("An error occurred"));
          openExclusiveModal(() => setErrorModalVisible(true));
        }
      }
      return;
    }

    if (pattern === screenLockPassword) {
      setModalMessage(
        t("Self-Destruct Password must be different from Screen Lock")
      );
      openExclusiveModal(() => setErrorModalVisible(true));
      return;
    }

    try {
      await setSelfDestructCredential(pattern, "pattern");
      await toggleSelfDestruct(true);
      setSelfDestructPatternLockModalVisible(false);
      setModalMessage(
        selfDestructPatternLockFlow === "change-create"
          ? t("Self-Destruct Password changed successfully")
          : t("Self-Destruct Password enabled successfully")
      );
      openExclusiveModal(() => setSuccessModalVisible(true));
    } catch (error) {
      console.error("Failed to enable self-destruct pattern:", error);
      setModalMessage(t("An error occurred while saving password"));
      openExclusiveModal(() => setErrorModalVisible(true));
    }
  };

  const handleConfirmSelfDestructPassword = async () => {
    if (selfDestructCurrentPassword === selfDestructPassword) {
      try {
        await toggleSelfDestruct(false);
        setSelfDestructEnterLockCodeModalVisible(false);
        setModalMessage(t("Self-Destruct Password disabled successfully"));
        openExclusiveModal(() => setSuccessModalVisible(true));
      } catch (error) {
        console.error("Failed to disable self-destruct password:", error);
        setModalMessage(t("An error occurred"));
        openExclusiveModal(() => setErrorModalVisible(true));
      }
    } else {
      setSelfDestructEnterLockCodeModalVisible(false);
      setModalMessage(t("Incorrect password"));
      openExclusiveModal(() => setErrorModalVisible(true));
    }
  };

  const handleToggleSelfDestruct = () => {
    try {
      Vibration.vibrate();
    } catch {}
    if (isSelfDestructEnabled) {
      if (selfDestructType === "pattern") {
        openSelfDestructPatternLockModal("disable");
      } else {
        openSelfDestructEnterLockCodeModal();
      }
    } else {
      if (screenLockType === "pattern") {
        openSelfDestructPatternLockModal("enable");
      } else {
        openSelfDestructLockCodeModal("password");
      }
    }
  };

  const openSwitchLockCodeModal = (mode = "password") => {
    setSwitchLockPassword("");
    setSwitchLockConfirmPassword("");
    setIsSwitchLockPasswordHidden(true);
    setIsSwitchLockConfirmPasswordHidden(true);
    setSwitchLockPasswordError("");
    setSwitchLockCodeInitialMode(mode);
    openExclusiveModal(() => setSwitchLockCodeModalVisible(true));
  };

  const closeSwitchLockCodeModal = () => {
    setSwitchLockCodeModalVisible(false);
    setSwitchLockCodeInitialMode(null);
    setSwitchLockPassword("");
    setSwitchLockConfirmPassword("");
    setIsSwitchLockPasswordHidden(true);
    setIsSwitchLockConfirmPasswordHidden(true);
    setSwitchLockPasswordError("");
    setPendingSwitchType(null);
  };

  const openSwitchPatternLockModal = (flow = "enable") => {
    setSwitchPatternLockFlow(flow);
    setSwitchPatternLockMode(flow === "enable" ? "create" : "verify");
    openExclusiveModal(() => setSwitchPatternLockModalVisible(true));
  };

  const closeSwitchPatternLockModal = () => {
    setSwitchPatternLockModalVisible(false);
    setPendingSwitchType(null);
  };

  const handleSetSwitchPassword = async () => {
    if (switchLockPassword.length < 4) {
      setSwitchLockPasswordError(
        t("Password must be at least 4 characters long")
      );
      return;
    }

    if (switchLockPassword !== switchLockConfirmPassword) {
      setSwitchLockPasswordError(t("Passwords do not match"));
      return;
    }

    try {
      await setScreenLockCredential(switchLockPassword, "password");
      await AsyncStorage.setItem(
        "screenLockEnabled",
        JSON.stringify(true)
      );
      await toggleScreenLock(true);
      setSwitchLockCodeModalVisible(false);
      setSwitchLockPasswordError("");
      setModalMessage(t("Screen lock enabled successfully"));
      openExclusiveModal(() => setSuccessModalVisible(true));
      if (pendingSwitchType) {
        await toggleSelfDestruct(false);
        await setSelfDestructCredential("", pendingSwitchType);
        setPendingSwitchType(null);
      }
    } catch (error) {
      console.error("❌ Failed to enable lock:", error);
      setSwitchLockPasswordError(t("An error occurred while saving password"));
    }
  };

  const handleSwitchPatternComplete = async (pattern) => {
    if (switchPatternLockMode === "verify") {
      if (switchPatternLockFlow === "disable") {
        try {
          await AsyncStorage.setItem(
            "screenLockEnabled",
            JSON.stringify(false)
          );
          await toggleScreenLock(false);
          closeSwitchPatternLockModal();
          setModalMessage(t("Screen lock disabled successfully"));
          setReturnToGeneralOnSuccess(true);
          openExclusiveModal(() => setSuccessModalVisible(true));
        } catch (error) {
          console.error("❌ Failed to disable pattern lock:", error);
          setModalMessage(t("An error occurred"));
          openExclusiveModal(() => setErrorModalVisible(true));
        }
      }
      return;
    }

    try {
      await setScreenLockCredential(pattern, "pattern");
      await AsyncStorage.setItem(
        "screenLockEnabled",
        JSON.stringify(true)
      );
      await toggleScreenLock(true);
      setSwitchPatternLockModalVisible(false);
      setModalMessage(t("Screen lock enabled successfully"));
      openExclusiveModal(() => setSuccessModalVisible(true));
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

  const handleChangePatternComplete = async (pattern) => {
    if (changePatternLockMode === "verify") {
      if (changePatternLockFlow === "change") {
        setChangePatternLockMode("create");
        setChangePatternLockFlow("change-create");
      }
      return;
    }

    try {
      await setScreenLockCredential(pattern, "pattern");
      setChangePatternLockModalVisible(false);
      setModalMessage(t("Pattern changed successfully"));
      openExclusiveModal(() => setSuccessModalVisible(true));
    } catch (error) {
      console.error("❌ Failed to change pattern lock:", error);
      setModalMessage(t("An error occurred while saving password"));
      openExclusiveModal(() => setErrorModalVisible(true));
    }
  };

  const openNewLockCodeModal = () => {
    setSwitchPasswordError("");
    setSwitchNewPassword("");
    setSwitchConfirmPassword("");
    setIsSwitchPasswordHidden(true);
    setIsSwitchConfirmPasswordHidden(true);
    openExclusiveModal(() => setNewLockCodeModalVisible(true));
  };

  const handleNextForChangePassword = (currentPassword) => {
    if (currentPassword === screenLockPassword) {
      setChangeLockCodeModalVisible(false);
      setChangeLockPasswordError("");
      openNewLockCodeModal();
      return;
    }
    setChangeLockPasswordError(t("Incorrect current password"));
  };

  const handleConfirmScreenLockPassword = async () => {
    if (screenLockCurrentPassword === screenLockPassword) {
      try {
        await AsyncStorage.setItem(
          "screenLockEnabled",
          JSON.stringify(false)
        );
        await toggleScreenLock(false);
        setScreenLockEnterLockCodeModalVisible(false);
        setModalMessage(t("Screen lock disabled successfully"));
        setReturnToGeneralOnSuccess(true);
        openExclusiveModal(() => setSuccessModalVisible(true));
        setScreenLockPasswordError("");
      } catch (err) {
        console.error("❌ Failed to disable screen lock:", err);
        setModalMessage(t("An error occurred"));
        openExclusiveModal(() => setErrorModalVisible(true));
      }
    } else {
      setScreenLockPasswordError(t("Incorrect password"));
    }
  };

  const handleChangePassword = async () => {
    if (switchNewPassword === switchConfirmPassword) {
      if (!switchNewPassword || String(switchNewPassword).trim() === "") {
        setSwitchPasswordError(t("Password cannot be empty"));
        return;
      }
      if (switchNewPassword === screenLockPassword) {
        setSwitchPasswordError(t("New password must be different from current"));
        return;
      }
      try {
        await setScreenLockCredential(switchNewPassword, "password");
        setNewLockCodeModalVisible(false);
        setModalMessage(t("Password changed successfully"));
        openExclusiveModal(() => setSuccessModalVisible(true));
      } catch (error) {
        console.error("Failed to change password", error);
      }
    } else {
      setSwitchPasswordError(t("Passwords do not match"));
    }
  };

  const handleSwitchInputMode = () => {
    try {
      Vibration.vibrate();
    } catch {}
    const nextType = screenLockType === "pattern" ? "password" : "pattern";
    setPendingSwitchType(nextType);
    if (nextType === "password") {
      openSwitchLockCodeModal("password");
      return;
    }
    openSwitchPatternLockModal("enable");
  };

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
        <View style={sdStyles.groupCard}>
          <View style={sdStyles.groupRow}>
            <View style={sdStyles.groupIconWrap}>
              <Icon name="lock-outline" size={22} color={iconColor} />
            </View>
            <Text style={[sdStyles.Text, { flex: 1 }]}>
              {t("Enable Screen Lock")}
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
                value={!!isScreenLockEnabled}
                onValueChange={handleToggleScreenLock}
              />
            </View>
          </View>

          <View style={sdStyles.groupDivider} />

          <TouchableOpacity activeOpacity={0.85} onPress={handleToggleSelfDestruct}>
            <View style={sdStyles.groupRow}>
              <View style={sdStyles.groupIconWrap}>
                <Icon name="lock-outline" size={22} color={iconColor} />
              </View>
              <Text style={[sdStyles.Text, { flex: 1 }]}>
                {t("Self-Destruct Password")}
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
                  value={!!isSelfDestructEnabled}
                  onValueChange={handleToggleSelfDestruct}
                />
              </View>
            </View>
          </TouchableOpacity>

          {isScreenLockEnabled ? (
            <>
              <View style={sdStyles.groupDivider} />
              <TouchableOpacity activeOpacity={0.85} onPress={handleChangeLock}>
                <View style={sdStyles.groupRow}>
                  <View style={sdStyles.groupIconWrap}>
                    <Icon name="password" size={22} color={iconColor} />
                  </View>
                  <Text style={[sdStyles.Text, { flex: 1 }]}>
                    {screenLockType === "pattern"
                      ? t("Change Lock Pattern")
                      : t("Change Lock Password")}
                  </Text>
                  <Icon
                    name="chevron-right"
                    size={22}
                    color={rightArrowColor}
                  />
                </View>
              </TouchableOpacity>
            </>
          ) : null}

          <View style={sdStyles.groupDivider} />

          <TouchableOpacity activeOpacity={0.85} onPress={handleSwitchInputMode}>
            <View style={sdStyles.groupRow}>
              <View style={sdStyles.groupIconWrap}>
                <Icon name="swap-horiz" size={22} color={iconColor} />
              </View>
              <Text style={[sdStyles.Text, { flex: 1 }]}>
                {screenLockType === "pattern"
                  ? t("Use Password Instead")
                  : t("Switch to Pattern Lock")}
              </Text>
              <Icon
                name="chevron-right"
                size={22}
                color={rightArrowColor}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LockCodeFlowModal
        visible={selfDestructLockCodeModalVisible}
        mode={selfDestructLockCodeInitialMode ? "set" : "select"}
        onClose={closeSelfDestructLockCodeModal}
        onSubmit={handleSetSelfDestructPassword}
        onSelectPassword={() => setSelfDestructLockCodeInitialMode("password")}
        onSelectPattern={handleOpenSelfDestructPatternLockSettings}
        isDarkMode={isDarkMode}
        styles={sdStyles}
        t={t}
        titleText={t("Self-Destruct Password")}
        password={selfDestructPasswordInput}
        setPassword={setSelfDestructPasswordInput}
        passwordError={selfDestructPasswordError}
        setPasswordError={setSelfDestructPasswordError}
        confirmPassword={selfDestructConfirmPasswordInput}
        setConfirmPassword={setSelfDestructConfirmPasswordInput}
        isPasswordHidden={isSelfDestructPasswordHidden}
        setIsPasswordHidden={setIsSelfDestructPasswordHidden}
        isConfirmPasswordHidden={isSelfDestructConfirmPasswordHidden}
        setIsConfirmPasswordHidden={setIsSelfDestructConfirmPasswordHidden}
      />

      <LockCodeFlowModal
        visible={selfDestructPatternLockModalVisible}
        mode="pattern"
        onClose={() => setSelfDestructPatternLockModalVisible(false)}
        onPatternComplete={handleSelfDestructPatternComplete}
        expectedPattern={selfDestructPassword}
        forbiddenPattern={
          selfDestructPatternLockFlow === "change-create"
            ? selfDestructPassword || null
            : selfDestructPatternLockMode === "create"
            ? screenLockPassword || null
            : null
        }
        forbiddenPatternErrorText={
          selfDestructPatternLockFlow === "change-create"
            ? t("New pattern must be different")
            : t("Self-Destruct Password must be different from Screen Lock")
        }
        titleText={
          selfDestructPatternLockFlow === "change"
            ? t("Verify Current Pattern")
            : null
        }
        subtitleText={
          selfDestructPatternLockFlow === "change"
            ? t("Draw your current pattern to continue")
            : null
        }
        patternMode={selfDestructPatternLockMode}
        styles={sdStyles}
        isDarkMode={isDarkMode}
        t={t}
      />

      <LockCodeFlowModal
        visible={switchLockCodeModalVisible}
        mode={switchLockCodeInitialMode ? "set" : "select"}
        onClose={closeSwitchLockCodeModal}
        onSubmit={handleSetSwitchPassword}
        onSelectPassword={() => setSwitchLockCodeInitialMode("password")}
        onSelectPattern={handleOpenSwitchPatternLockSettings}
        isDarkMode={isDarkMode}
        styles={sdStyles}
        t={t}
        titleText={t("Enable Screen Lock")}
        password={switchLockPassword}
        setPassword={setSwitchLockPassword}
        passwordError={switchLockPasswordError}
        setPasswordError={setSwitchLockPasswordError}
        confirmPassword={switchLockConfirmPassword}
        setConfirmPassword={setSwitchLockConfirmPassword}
        isPasswordHidden={isSwitchLockPasswordHidden}
        setIsPasswordHidden={setIsSwitchLockPasswordHidden}
        isConfirmPasswordHidden={isSwitchLockConfirmPasswordHidden}
        setIsConfirmPasswordHidden={setIsSwitchLockConfirmPasswordHidden}
      />

      <LockCodeFlowModal
        visible={switchPatternLockModalVisible}
        mode="pattern"
        onClose={closeSwitchPatternLockModal}
        onPatternComplete={handleSwitchPatternComplete}
        expectedPattern={screenLockPassword}
        forbiddenPattern={
          switchPatternLockFlow === "change-create" ? screenLockPassword : null
        }
        titleText={
          switchPatternLockFlow === "change" ||
          switchPatternLockFlow === "disable"
            ? t("Verify Current Pattern")
            : null
        }
        subtitleText={
          switchPatternLockFlow === "change" ||
          switchPatternLockFlow === "disable"
            ? t("Draw your current pattern to continue")
            : null
        }
        patternMode={switchPatternLockMode}
        styles={sdStyles}
        isDarkMode={isDarkMode}
        t={t}
      />

      <LockCodeFlowModal
        visible={changePatternLockModalVisible}
        mode="pattern"
        onClose={() => setChangePatternLockModalVisible(false)}
        onPatternComplete={handleChangePatternComplete}
        expectedPattern={screenLockPassword}
        forbiddenPattern={
          changePatternLockFlow === "change-create" ? screenLockPassword : null
        }
        titleText={
          changePatternLockFlow === "change"
            ? t("Verify Current Pattern")
            : null
        }
        subtitleText={
          changePatternLockFlow === "change"
            ? t("Draw your current pattern to continue")
            : null
        }
        patternMode={changePatternLockMode}
        styles={sdStyles}
        isDarkMode={isDarkMode}
        t={t}
      />

      <Modal
        animationType="fade"
        transparent
        visible={changeLockTargetModalVisible}
        onRequestClose={() => setChangeLockTargetModalVisible(false)}
      >
        <View style={sdStyles.addrBookFlex}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setChangeLockTargetModalVisible(false)}
          >
            <BlurView style={StyleSheet.absoluteFillObject} />
          </Pressable>
          <View style={sdStyles.centeredView} pointerEvents="box-none">
            <View
              style={[sdStyles.enLockMdlView, { top: undefined }]}
            >
              <Text style={[sdStyles.modalTitle, { marginBottom: 8 }]}>
                {t("Change Lock Pattern")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setChangeLockTargetModalVisible(false);
                  setChangePatternLockFlow("change");
                  setChangePatternLockMode("verify");
                  openExclusiveModal(() => setChangePatternLockModalVisible(true));
                }}
                style={[
                  sdStyles.optionButton,
                  { marginBottom: 10, borderRadius: 16, width: "100%" },
                ]}
              >
                <Text style={[sdStyles.optionButtonText, { fontSize: 16 }]}>
                  {t("Screen Lock Password")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setChangeLockTargetModalVisible(false);
                  if (selfDestructType === "pattern") {
                    openSelfDestructChangePatternLockModal();
                  } else {
                    openSelfDestructLockCodeModal();
                  }
                }}
                style={[
                  sdStyles.optionButton,
                  { marginBottom: 0, borderRadius: 16, width: "100%" },
                ]}
              >
                <Text style={[sdStyles.optionButtonText, { fontSize: 16 }]}>
                  {t("Self-Destruct Password")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LockCodeFlowModal
        visible={screenLockEnterLockCodeModalVisible}
        mode="enter"
        onClose={closeScreenLockEnterLockCodeModal}
        onSubmit={handleConfirmScreenLockPassword}
        isDarkMode={isDarkMode}
        styles={sdStyles}
        t={t}
        currentPassword={screenLockCurrentPassword}
        setCurrentPassword={setScreenLockCurrentPassword}
        isCurrentPasswordHidden={isScreenLockCurrentPasswordHidden}
        setIsCurrentPasswordHidden={setIsScreenLockCurrentPasswordHidden}
        passwordError={screenLockPasswordError}
        setPasswordError={setScreenLockPasswordError}
      />

      <LockCodeFlowModal
        visible={selfDestructEnterLockCodeModalVisible}
        mode="enter"
        onClose={closeSelfDestructEnterLockCodeModal}
        onSubmit={handleConfirmSelfDestructPassword}
        isDarkMode={isDarkMode}
        styles={sdStyles}
        t={t}
        currentPassword={selfDestructCurrentPassword}
        setCurrentPassword={setSelfDestructCurrentPassword}
        isCurrentPasswordHidden={isSelfDestructCurrentPasswordHidden}
        setIsCurrentPasswordHidden={setIsSelfDestructCurrentPasswordHidden}
      />

      <LockCodeFlowModal
        visible={changeLockCodeModalVisible}
        mode="change"
        onClose={() => {
          setChangeLockCodeModalVisible(false);
          setChangeLockPasswordError("");
          setScreenLockCurrentPassword("");
          setIsScreenLockCurrentPasswordHidden(true);
        }}
        onSubmit={handleNextForChangePassword}
        isDarkMode={isDarkMode}
        styles={sdStyles}
        t={t}
        currentPassword={screenLockCurrentPassword}
        setCurrentPassword={setScreenLockCurrentPassword}
        isCurrentPasswordHidden={isScreenLockCurrentPasswordHidden}
        setIsCurrentPasswordHidden={setIsScreenLockCurrentPasswordHidden}
        passwordError={changeLockPasswordError}
        setPasswordError={setChangeLockPasswordError}
      />

      <LockCodeFlowModal
        visible={newLockCodeModalVisible}
        mode="set"
        setViewStyle="set"
        titleText={t("Set New Password")}
        onClose={() => {
          setNewLockCodeModalVisible(false);
          setSwitchPasswordError("");
        }}
        onSubmit={handleChangePassword}
        isDarkMode={isDarkMode}
        styles={sdStyles}
        t={t}
        password={switchNewPassword}
        setPassword={setSwitchNewPassword}
        confirmPassword={switchConfirmPassword}
        setConfirmPassword={setSwitchConfirmPassword}
        passwordError={switchPasswordError}
        setPasswordError={setSwitchPasswordError}
        isPasswordHidden={isSwitchPasswordHidden}
        setIsPasswordHidden={setIsSwitchPasswordHidden}
        isConfirmPasswordHidden={isSwitchConfirmPasswordHidden}
        setIsConfirmPasswordHidden={setIsSwitchConfirmPasswordHidden}
      />

      <CheckStatusModal
        visible={successModalVisible}
        status="success"
        onClose={() => {
          setSuccessModalVisible(false);
          if (returnToGeneralOnSuccess) {
            setReturnToGeneralOnSuccess(false);
            navigation.goBack();
          }
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
    </View>
  );
}
