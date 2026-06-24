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
  Keyboard,
  Pressable,
  Image,
  InteractionManager,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "../common/AppBlurView";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Clipboard from "@react-native-clipboard/clipboard";
import {
  clearNavigationCallback,
  registerNavigationCallback,
} from "../../utils/navigationCallbacks";
import {
  areAddressesEquivalent,
  isBchCashAddr,
  isBchChainName,
  isBchLegacyAddress,
} from "../../config/networkUtils";
import { getBtcAddressType, isBtcChainName } from "../../utils/btcAddress";
import { getLtcAddressType, isLtcChainName } from "../../utils/ltcAddress";
import { resolveChainIcon } from "../../utils/assetIconResolver";
import { displayChainName } from "../../utils/assetDisplayFormat";

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
  selectedAddressTypeLabel = "",
  selectedAddress,
  selectedNFT,
}) => {
  const addressInputRef = useRef(null);
  const hasAutoFocusedRef = useRef(false);
  const addressBookCallbackIdsRef = useRef(null);
  const isSubmitInFlightRef = useRef(false);

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
  const [hasPressedNext, setHasPressedNext] = useState(false);

  useEffect(() => {
    setShowModal(visible);
  }, [visible]);

  useEffect(() => {
    if (!showModal) {
      hasAutoFocusedRef.current = false;
      isSubmitInFlightRef.current = false;
      setIsSubmittingNext(false);
      setHasPressedNext(false);
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

  // Same-address guard: block exact same-format self sends, but allow same-wallet format swaps.
  const sanitizeAddressValue = (s) => String(s || "").replace(/\s+/g, "");
  const getAddressFormat = (chainName, address) => {
    if (isBchChainName(chainName)) {
      if (isBchLegacyAddress(address)) return "legacy";
      if (isBchCashAddr(address)) return "cashaddr";
      return "";
    }
    if (isBtcChainName(chainName)) {
      return getBtcAddressType(address);
    }
    if (isLtcChainName(chainName)) {
      return getLtcAddressType(address);
    }
    return "";
  };
  const addressesAreEquivalent = !!(
    inputAddress &&
    selectedAddress &&
    areAddressesEquivalent(selectedCryptoChain, inputAddress, selectedAddress)
  );
  const inputAddressFormat = getAddressFormat(selectedCryptoChain, inputAddress);
  const selectedAddressFormat = getAddressFormat(
    selectedCryptoChain,
    selectedAddress,
  );
  /*
   * Temporary production restriction: BCH send is single-address CashAddr only,
   * so BCH legacy/cashaddr self-send format swaps are not allowed. Restore
   * isBchChainName(selectedCryptoChain) in this condition when BCH multi-address
   * sending is re-enabled.
   */
  const isAllowedAddressFormatSwap =
    addressesAreEquivalent &&
    (isBtcChainName(selectedCryptoChain) ||
      isLtcChainName(selectedCryptoChain)) &&
    inputAddressFormat &&
    selectedAddressFormat &&
    inputAddressFormat !== selectedAddressFormat;
  const isSameAddress = addressesAreEquivalent && !isAllowedAddressFormatSwap;
  const showStatusMessage = !!inputAddress || isSameAddress;
  const isBchSendChain = isBchChainName(selectedCryptoChain);
  /*
   * Temporary production restriction: BCH send address modal uses the single
   * address style. Restore this label when BCH legacy/cashaddr multi-address
   * sending is re-enabled.
   *
   * const displayAddressTypeLabel = selectedAddressTypeLabel;
   */
  const displayAddressTypeLabel = isBchSendChain
    ? ""
    : selectedAddressTypeLabel;
  const selectedCryptoChainDisplay = displayChainName(selectedCryptoChain);
  /*
   * Chain titles must use formatted display names instead of internal
   * queryChainName values such as bitcoin_cash or ethereum_classic.
   */
  const cryptoTitleText = selectedCryptoChainDisplay
    ? `${selectedCrypto} (${selectedCryptoChainDisplay})`
    : selectedCrypto;

  const handleAddressSelect = (selectedItem) => {
    handleAddressChange(sanitizeAddressValue(selectedItem.address));
    if (typeof setContactFormModalVisible === "function") {
      InteractionManager.runAfterInteractions(() => {
        setContactFormModalVisible(true);
        requestAnimationFrame(() => {
          addressInputRef.current?.focus?.();
        });
      });
    }
  };

  const handleAddressInputChange = (text) => {
    if (hasPressedNext) return;
    handleAddressChange(sanitizeAddressValue(text));
  };

  const handleAddressBookClose = () => {
    if (typeof setContactFormModalVisible === "function") {
      InteractionManager.runAfterInteractions(() => {
        setContactFormModalVisible(true);
      });
    }
  };

  const handleIconPress = () => {
    Keyboard.dismiss();
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
    Keyboard.dismiss();
    setHasPressedNext(false);
    handleAddressChange("");
  };

  const handlePasteAddress = async () => {
    if (hasPressedNext) return;
    try {
      const text = await Clipboard.getString();
      const nextAddress = sanitizeAddressValue(text);
      if (!nextAddress) return;
      setHasPressedNext(false);
      handleAddressChange(nextAddress);
      requestAnimationFrame(() => {
        addressInputRef.current?.focus?.();
      });
    } catch {}
  };

  const isNextDisabled = !isAddressValid || isSameAddress;
  if (__DEV__ && typeof isNextDisabled !== "boolean") {
    throw new Error("disabled must be boolean");
  }
  const isNftSend = !!selectedNFT;
  const nftChainIcon = isNftSend
    ? resolveChainIcon(selectedNFT?.queryChainName || selectedCryptoChain)
    : null;

  const lockAddressInputForSubmit = () => {
    if (isNextDisabled || isSubmittingNext || isSubmitInFlightRef.current) return;
    addressInputRef.current?.blur?.();
    Keyboard.dismiss();
    setHasPressedNext(true);
  };

  const handleNextPress = async () => {
    if (isNextDisabled || isSubmittingNext || isSubmitInFlightRef.current) return;
    lockAddressInputForSubmit();
    isSubmitInFlightRef.current = true;
    setIsSubmittingNext(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await handleNextAfterAddress?.();
    } finally {
      isSubmitInFlightRef.current = false;
      setIsSubmittingNext(false);
      if (showModal) {
        setHasPressedNext(false);
      }
    }
  };

  const closeModalFromBackdrop = () => {
    Keyboard.dismiss();
    onRequestClose?.();
  };

  if (!showModal) return null;

  return (
    <>
      <Modal
        animationType="none"
        transparent={true}
        visible={showModal}
        onRequestClose={onRequestClose}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeModalFromBackdrop}
          >
            <BlurView style={StyleSheet.absoluteFillObject} />
          </Pressable>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[
              ActivityScreenStyle.centeredView,
              { zIndex: 2, elevation: 2 },
            ]}
            pointerEvents="box-none"
          >
              <View
                style={[
                  ActivityScreenStyle.cardContainer,
                  { borderRadius: 36, padding: 20, zIndex: 3, elevation: 3 },
                ]}
              >
              <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              {!isNftSend && selectedCryptoIcon && (
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
              {isNftSend ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 1,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      ActivityScreenStyle.modalTitle,
                      { flexShrink: 1, marginBottom: 0 },
                    ]}
                  >
                    {selectedCrypto}
                  </Text>
                  {selectedCryptoChain ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      <Text
                        style={[
                          ActivityScreenStyle.modalTitle,
                          {
                            marginBottom: 0,
                            marginRight: 6,
                            color: isDarkMode ? "#B8B8BD" : "#7F7F84",
                          },
                        ]}
                      >
                        ·
                      </Text>
                      {nftChainIcon ? (
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
                            marginRight: 6,
                          }}
                        >
                          <BlurView style={StyleSheet.absoluteFillObject} />
                          <Image
                            source={nftChainIcon}
                            style={{ width: 20, height: 20 }}
                          />
                        </View>
                      ) : null}
                      <Text
                        numberOfLines={1}
                        style={[
                          ActivityScreenStyle.modalTitle,
                          { marginBottom: 0 },
                        ]}
                      >
                        {selectedCryptoChainDisplay}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text
                  numberOfLines={1}
                  style={[
                    ActivityScreenStyle.modalTitle,
                    { flexShrink: 1, marginBottom: 0 },
                  ]}
                >
                  {cryptoTitleText}
                </Text>
              )}
              {displayAddressTypeLabel ? (
                <View
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 8,
                    backgroundColor: isDarkMode ? "#5A5A5A" : "#E9E9EE",
                    flexShrink: 1,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      lineHeight: 16,
                      fontWeight: "bold",
                      color: isDarkMode ? "#F1F1F3" : "#3A3838",
                    }}
                  >
                    {displayAddressTypeLabel}
                  </Text>
                </View>
              ) : null}
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
                    height: 60,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? "#21201E" : "#E0E0E0",
                    overflow: "hidden",
                    position: "relative",
                  }}
                  onLayout={() => {
                    if (!showModal || hasAutoFocusedRef.current) return;
                    hasAutoFocusedRef.current = true;
                    focusAddressInput();
                  }}
                >
                  {hasPressedNext ? (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      allowFontScaling={false}
                      maxFontSizeMultiplier={1}
                      style={{
                        color: isDarkMode ? "#ffffff" : "#000000",
                        position: "absolute",
                        left: 14,
                        right: 78,
                        top: 0,
                        bottom: 0,
                        height: 60,
                        fontSize: 16,
                        lineHeight: 60,
                        overflow: "hidden",
                      }}
                    >
                      {sanitizeAddressValue(inputAddress)}
                    </Text>
                  ) : (
                    <>
                      <Text
                        pointerEvents="none"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        allowFontScaling={false}
                        maxFontSizeMultiplier={1}
                        style={{
                          color: inputAddress
                            ? isDarkMode
                              ? "#ffffff"
                              : "#000000"
                            : isDarkMode
                              ? "#97979C"
                              : "#7F7F84",
                          position: "absolute",
                          left: 14,
                          right: inputAddress ? 42 : 42,
                          top: 0,
                          bottom: 0,
                          height: 60,
                          fontSize: 16,
                          lineHeight: 60,
                          overflow: "hidden",
                          zIndex: 1,
                        }}
                      >
                        {inputAddress
                          ? sanitizeAddressValue(inputAddress)
                          : t("Enter Address")}
                      </Text>
                    <TextInput
                      ref={addressInputRef}
                      style={{
                        backgroundColor: isDarkMode ? "#21201E" : "#E0E0E0",
                        color: "transparent",
                        width: "100%",
                        maxWidth: "100%",
                        minWidth: 0,
                        height: 60,
                        borderRadius: 16,
                        paddingLeft: 14,
                        paddingRight: inputAddress ? 42 : 42,
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
                        overflow: "hidden",
                      }}
                      onChangeText={handleAddressInputChange}
                      value={sanitizeAddressValue(inputAddress)}
                      onPressIn={() => addressInputRef.current?.focus?.()}
                      cursorColor={isDarkMode ? "#FFFFFF" : "#000000"}
                      selectionColor={isDarkMode ? "#FFFFFF" : "#000000"}
                      showSoftInputOnFocus={true}
                      disableFullscreenUI={true}
                      multiline={false}
                      numberOfLines={1}
                      scrollEnabled={true}
                      allowFontScaling={false}
                      maxFontSizeMultiplier={1}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                    />
                    </>
                  )}
                  {!hasPressedNext && !inputAddress ? (
                    <TouchableOpacity
                      style={{
                        position: "absolute",
                        right: 6,
                        bottom: 0,
                        top: 0,
                        justifyContent: "center",
                        paddingHorizontal: 4,
                        zIndex: 2,
                      }}
                      onPress={handlePasteAddress}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={t("Paste address")}
                    >
                      <Icon name="content-paste" size={24} color="#9E9E9E" />
                    </TouchableOpacity>
                  ) : null}
                  {inputAddress ? (
                    <TouchableOpacity
                      style={{
                        position: "absolute",
                        right: 6,
                        bottom: 0,
                        top: 0,
                        justifyContent: "center",
                        paddingHorizontal: 4,
                        zIndex: 2,
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
                  onPress={handleIconPress}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  style={{
                    marginLeft: 6,
                    height: 42,
                    width: 42,
                    borderRadius: 21,
                    justifyContent: "center",
                    alignItems: "center",
                    alignSelf: "center",
                    backgroundColor: isDarkMode
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.06)",
                    borderWidth: 1,
                    borderColor: isDarkMode
                      ? "rgba(255, 255, 255, 0.16)"
                      : "rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <Icon
                    name="portrait"
                    size={24}
                    color={isDarkMode ? "#ffffff" : "#676776"}
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
                          : `${t("Possible Networks")}: ${detectedNetwork}`
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
                onPress={() => {
                  Keyboard.dismiss();
                  setContactFormModalVisible(false);
                }}
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
                onPressIn={lockAddressInputForSubmit}
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
