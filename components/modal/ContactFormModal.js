/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// ContactFormModal.js
import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  InteractionManager,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "../common/AppBlurView";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  clearNavigationCallback,
  registerNavigationCallback,
} from "../../utils/navigationCallbacks";
import { areAddressesEquivalent } from "../../config/networkUtils";

const ContactFormModal = ({
  visible,
  onRequestClose,
  ActivityScreenStyle,
  t,
  isDarkMode,
  handleAddressChange,
  inputAddress,
  detectedNetwork,
  isAddressValid,
  buttonBackgroundColor,
  disabledButtonBackgroundColor,
  handleNextAfterAddress,
  setContactFormModalVisible,
  selectedCrypto,
  selectedCryptoChain,
  selectedCryptoIcon,
  selectedAddress,
}) => {
  const addressInputRef = useRef(null);
  const hasAutoFocusedRef = useRef(false);
  const addressBookCallbackIdsRef = useRef(null);

  useEffect(() => {
    return () => {
      if (addressBookCallbackIdsRef.current) {
        clearNavigationCallback(addressBookCallbackIdsRef.current.onSelectId);
        clearNavigationCallback(addressBookCallbackIdsRef.current.onCloseId);
        addressBookCallbackIdsRef.current = null;
      }
    };
  }, []);
  const navigation = useNavigation();

  const [showModal, setShowModal] = useState(visible);
  const [isSubmittingNext, setIsSubmittingNext] = useState(false);

  useEffect(() => {
    setShowModal(visible);
  }, [visible]);

  useEffect(() => {
    if (!showModal) {
      hasAutoFocusedRef.current = false;
      setIsSubmittingNext(false);
    }
  }, [showModal]);

  const focusAddressInput = () => {
    const focus = () => addressInputRef.current?.focus();
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        focus();
        setTimeout(() => {
          focus();
        }, 150);
      });
    });
  };

  // Same-address guard: recipient cannot be the current wallet address
  const sanitizeAddressValue = (s) => String(s || "").replace(/\s+/g, "");
  const isSameAddress = !!(
    inputAddress &&
    selectedAddress &&
    areAddressesEquivalent(selectedCryptoChain, inputAddress, selectedAddress)
  );
  const showStatusMessage = !!inputAddress || isSameAddress;

  const handleAddressSelect = (selectedItem) => {
    handleAddressChange(sanitizeAddressValue(selectedItem.address));
    if (typeof setContactFormModalVisible === "function") {
      setContactFormModalVisible(true);
    }
  };

  const handleAddressInputChange = (text) => {
    handleAddressChange(sanitizeAddressValue(text));
  };

  const handleAddressBookClose = () => {
    if (typeof setContactFormModalVisible === "function") {
      setContactFormModalVisible(true);
    }
  };

  const handleIconPress = () => {
    if (addressBookCallbackIdsRef.current) {
      clearNavigationCallback(addressBookCallbackIdsRef.current.onSelectId);
      clearNavigationCallback(addressBookCallbackIdsRef.current.onCloseId);
      addressBookCallbackIdsRef.current = null;
    }
    if (typeof setContactFormModalVisible === "function") {
      setContactFormModalVisible(false);
    }
    const onSelectId = registerNavigationCallback(handleAddressSelect);
    const onCloseId = registerNavigationCallback(handleAddressBookClose);
    addressBookCallbackIdsRef.current = { onSelectId, onCloseId };
    navigation.navigate("AddressBook", {
      onSelectId,
      onCloseId,
    });
  };

  const handleClearAddress = () => {
    handleAddressChange("");
  };

  const isNextDisabled = !isAddressValid || isSameAddress;
  if (__DEV__ && typeof isNextDisabled !== "boolean") {
    throw new Error("disabled must be boolean");
  }

  const handleNextPress = async () => {
    if (isNextDisabled || isSubmittingNext) return;
    setIsSubmittingNext(true);
    try {
      await handleNextAfterAddress?.();
    } finally {
      setIsSubmittingNext(false);
    }
  };

  if (!showModal) return null;

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showModal}
        onRequestClose={onRequestClose}
      >
        <View style={{ flex: 1 }}>
          <BlurView style={StyleSheet.absoluteFillObject} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={ActivityScreenStyle.centeredView}
            pointerEvents="box-none"
          >
            <View
              style={[
                ActivityScreenStyle.cardContainer,
                { borderRadius: 36, padding: 20 },
              ]}
            >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              {selectedCryptoIcon && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    backgroundColor: isDarkMode
                      ? "#ffffff80"
                      : "rgba(0, 0, 0, 0.05)",
                    overflow: "hidden",
                    marginRight: 8,
                  }}
                >
                  <BlurView style={StyleSheet.absoluteFillObject} />
                  <Image source={selectedCryptoIcon} style={{ width: 20, height: 20 }} />
                </View>
              )}
              <Text style={ActivityScreenStyle.modalTitle}>
                {selectedCrypto} ({selectedCryptoChain})
              </Text>
            </View>
            <Text style={ActivityScreenStyle.modalTitle}>
              {t("Enter the recipient's address:")}
            </Text>
            <View style={{ width: "100%", marginTop: 16 }}>
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    position: "relative",
                  }}
                  onLayout={() => {
                    if (!showModal || hasAutoFocusedRef.current) return;
                    hasAutoFocusedRef.current = true;
                    focusAddressInput();
                  }}
                >
                  <TextInput
                    ref={addressInputRef}
                    style={{
                      backgroundColor: isDarkMode ? "#21201E" : "#E0E0E0",
                      color: isDarkMode ? "#ffffff" : "#000000",
                      height: 60,
                      borderRadius: 16,
                      paddingLeft: 14,
                      paddingRight: 40,
                      paddingTop: 0,
                      paddingBottom: 0,
                      paddingVertical: 0,
                      marginTop: 0,
                      marginBottom: 0,
                      fontSize: 16,
                      lineHeight: 20,
                      textAlignVertical: "center",
                      includeFontPadding: false,
                      flexWrap: "nowrap",
                    }}
                    placeholder={t("Enter Address")}
                    placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
                    onChangeText={handleAddressInputChange}
                    value={sanitizeAddressValue(inputAddress)}
                    showSoftInputOnFocus={true}
                    multiline={false}
                    numberOfLines={1}
                    scrollEnabled={true}
                    allowFontScaling={false}
                    maxFontSizeMultiplier={1}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                  />
                  {inputAddress ? (
                    <TouchableOpacity
                      style={{
                        position: "absolute",
                        right: 6,
                        bottom: 0,
                        top: 0,
                        justifyContent: "center",
                        paddingHorizontal: 4,
                      }}
                      onPress={handleClearAddress}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={t("Clear address input")}
                    >
                      <Icon name="delete-outline" size={24} color="#9E9E9E" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    marginLeft: 6,
                    height: 60,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  onPress={handleIconPress}
                >
                  <Icon
                    name="portrait"
                    size={28}
                    color={isDarkMode ? "#ffffff" : "#000"}
                  />
                </TouchableOpacity>
              </View>

              {showStatusMessage && (
                <ScrollView
                  style={{ maxHeight: 60, marginTop: 16 }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  indicatorStyle={isDarkMode ? "white" : "black"}
                >
                  {!isSameAddress && (
                    <Text
                      style={{
                        color:
                          detectedNetwork === "Invalid address"
                            ? "#FF5252"
                            : "#22AA94",
                        lineHeight: 26,
                        textAlignVertical: "center",
                      }}
                    >
                      {inputAddress
                        ? detectedNetwork === "Invalid address"
                          ? t("Invalid address")
                          : `${t("Detected Network")}: ${detectedNetwork}`
                        : ""}
                    </Text>
                  )}
                  {isSameAddress ? (
                    <Text style={ActivityScreenStyle.errorText}>
                      {t("Recipient address cannot be your own address")}
                    </Text>
                  ) : null}
                </ScrollView>
              )}
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                width: "100%",
                marginTop: 16,
              }}
            >
              <TouchableOpacity
                style={[
                  ActivityScreenStyle.cancelButton,
                  { flex: 1, marginRight: 4, borderRadius: 16 },
                ]}
                onPress={() => setContactFormModalVisible(false)}
              >
                <Text style={ActivityScreenStyle.cancelButtonText}>
                  {t("Cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  ActivityScreenStyle.optionButton,
                  { flex: 1, marginLeft: 4, borderRadius: 16, marginBottom: 0 },
                  {
                    backgroundColor:
                      isAddressValid && !isSameAddress
                        ? buttonBackgroundColor
                        : disabledButtonBackgroundColor,
                  },
                ]}
                onPress={handleNextPress}
                disabled={!!isNextDisabled || isSubmittingNext}
              >
                {isSubmittingNext ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator
                      size="small"
                      color={isDarkMode ? "#FFFFFF" : "#FFFFFF"}
                    />
                    <Text
                      style={[
                        ActivityScreenStyle.submitButtonText,
                        { marginLeft: 8 },
                      ]}
                    >
                      {t("Next")}
                    </Text>
                  </View>
                ) : (
                  <Text style={ActivityScreenStyle.submitButtonText}>
                    {t("Next")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </>
  );
};

export default ContactFormModal;
