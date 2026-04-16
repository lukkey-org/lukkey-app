/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// TransferConfirmModal.js
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { BlurView } from "../common/AppBlurView";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { fetchTransactionFee } from "../../utils/fetchTransactionFee";
import { accountAPI } from "../../env/apiEndpoints";
import DataSkeleton from "../AssetsScreen/DataSkeleton";
import { ActivityScreenStylesRoot } from "../../styles/styles";
import { getRuntimePriceUsd } from "../../utils/assetRuntimeFields";
import DevToast from "../common/DevToast";
const TransferConfirmModal = (props) => {
  const {
    visible,
    t,
    isDarkMode,
    buttonBackgroundColor,
    disabledButtonBackgroundColor,
  } = props;

  const mode = props.mode || (props.selectedNFT ? "nft" : "crypto");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [nftSelectedFeeTab, setNftSelectedFeeTab] = useState("Recommended");
  const [nftRecommendedFee, setNftRecommendedFee] = useState("");
  const [nftRapidFee, setNftRapidFee] = useState("");
  const [nftIsFeeLoading, setNftIsFeeLoading] = useState(false);
  const [nftFeeTabLayouts, setNftFeeTabLayouts] = useState({});
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [copyToastMessage, setCopyToastMessage] = useState("");
  const [copyToastKey, setCopyToastKey] = useState(0);
  const underlineX = useRef(new Animated.Value(0)).current;
  const underlineW = useRef(new Animated.Value(0)).current;
  const activityStyles = ActivityScreenStylesRoot(isDarkMode);
  const transactionTextStyle = activityStyles.transactionText;
  const transactionTextBase = StyleSheet.flatten(transactionTextStyle);
  const chainKey =
    mode === "nft" ? props.selectedNFT?.queryChainName?.toLowerCase?.() : null;

  useEffect(() => {
    if (visible) setConfirmChecked(false);
  }, [visible]);

  const truncateMiddleValue = (value, maxChars) => {
    const str = String(value || "");
    if (!str) return "-";
    if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
    if (str.length <= maxChars) return str;
    if (maxChars <= 6) return str.slice(0, maxChars);
    const remaining = maxChars - 6;
    const head = Math.max(1, Math.floor(remaining / 2));
    const tail = Math.max(1, remaining - head);
    return `${str.slice(0, head)}......${str.slice(-tail)}`;
  };

  const handleCopy = async (value) => {
    if (!value) return;
    await Clipboard.setString(String(value));
    setCopyToastMessage(t("Copied to clipboard"));
    setCopyToastVisible(true);
    setCopyToastKey((value) => value + 1);
  };

  const CopyLine = ({
    label,
    value,
    displayValue,
    textStyle,
    valueColor,
    lineHeight = 22,
    truncateMiddle = false,
  }) => {
    const [rowWidth, setRowWidth] = useState(0);
    const [labelWidth, setLabelWidth] = useState(0);
    const baseTextStyle = StyleSheet.flatten(textStyle);
    const fontSize = Number(baseTextStyle?.fontSize) || 16;
    const approxCharWidth = fontSize * 0.6;
    const availableWidth = Math.max(0, rowWidth - labelWidth);
    const maxChars = Math.floor(availableWidth / approxCharWidth);
    const displayText = truncateMiddle
      ? truncateMiddleValue(value, maxChars)
      : displayValue || value || "-";
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => handleCopy(value)}
          onLayout={(event) => {
            if (!truncateMiddle) return;
            const nextWidth = event.nativeEvent.layout.width;
            if (nextWidth !== rowWidth) setRowWidth(nextWidth);
          }}
        >
          <Text style={[textStyle, { lineHeight }]}>
            <Text
              style={{ fontWeight: "bold" }}
              onLayout={(event) => {
                if (!truncateMiddle) return;
                const nextWidth = event.nativeEvent.layout.width;
                if (nextWidth !== labelWidth) setLabelWidth(nextWidth);
              }}
            >
              {label}:
            </Text>
            <Text style={valueColor ? { color: valueColor } : null}>
              {` ${displayText}`}
            </Text>
          </Text>
        </Pressable>
        <TouchableOpacity
          onPress={() => handleCopy(value)}
          style={{ padding: 6 }}
          disabled={!value}
        >
          <Icon
            name="content-copy"
            size={18}
            color={value ? (isDarkMode ? "#C9C9C9" : "#666") : "#aaa"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  useEffect(() => {
    let mounted = true;
    if (mode !== "nft" || !chainKey) return () => {};
    (async () => {
      try {
        setNftIsFeeLoading(true);
        await fetchTransactionFee({
          selectedQueryChainName: chainKey,
          setFee: (fee) => mounted && setNftRecommendedFee(String(fee ?? "")),
          setRapidFee: (fee) => mounted && setNftRapidFee(String(fee ?? "")),
          accountAPI,
        });
      } catch (e) {
        // If it fails, the sending will not be blocked and the empty string will be kept. handleSendDigital will keep the secret internally.
      } finally {
        mounted && setNftIsFeeLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [chainKey, mode]);

  useEffect(() => {
    if (mode !== "nft") return;
    const target = nftFeeTabLayouts[nftSelectedFeeTab];
    if (!target) return;
    Animated.parallel([
      Animated.timing(underlineX, {
        toValue: target.x,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(underlineW, {
        toValue: target.width,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [mode, nftFeeTabLayouts, nftSelectedFeeTab, underlineX, underlineW]);

  if (mode === "nft") {
    const {
      onClose,
      onRequestClose,
      onCancel,
      selectedNFT,
      VaultScreenStyle,
      recipientAddress,
      availableBalance,
      feeTokenSymbol,
      feeTokenPriceUsd,
      handleSendDigital,
    } = props;
    const nftIdValue = String(selectedNFT?.tokenId ?? selectedNFT?.mint ?? "");

    const selectedProcessingFee =
      parseFloat(
        nftSelectedFeeTab === "Recommended" ? nftRecommendedFee : nftRapidFee
      ) || 0;

    const hasValidFee =
      (nftSelectedFeeTab === "Recommended"
        ? typeof nftRecommendedFee === "string" &&
          nftRecommendedFee.trim() !== ""
        : typeof nftRapidFee === "string" && nftRapidFee.trim() !== "") &&
      selectedProcessingFee > 0;

    const showFeeSkeleton =
      !!nftIsFeeLoading ||
      (nftSelectedFeeTab === "Recommended"
        ? !nftRecommendedFee || nftRecommendedFee.trim() === ""
        : !nftRapidFee || nftRapidFee.trim() === "");

    const availableBalanceNum = parseFloat(availableBalance) || 0;
    const isInsufficientBalance =
      !showFeeSkeleton &&
      hasValidFee &&
      availableBalanceNum < selectedProcessingFee;

    const canSend =
      !!recipientAddress &&
      hasValidFee &&
      !showFeeSkeleton &&
      !isInsufficientBalance &&
      confirmChecked;
    const sendDisabled = !canSend;
    if (__DEV__ && typeof sendDisabled !== "boolean") {
      throw new Error("disabled must be boolean");
    }

    const feeTokenPriceNum = parseFloat(feeTokenPriceUsd);
    const formatUsd = (feeValue) => {
      const feeNum = parseFloat(feeValue);
      if (!Number.isFinite(feeNum) || feeNum <= 0) return "--";
      if (!Number.isFinite(feeTokenPriceNum) || feeTokenPriceNum <= 0)
        return "--";
      return (feeNum * feeTokenPriceNum).toFixed(2);
    };

    const effectiveButtonBackgroundColor =
      typeof buttonBackgroundColor === "string"
        ? buttonBackgroundColor
        : isDarkMode
        ? "#CCB68C"
        : "#CFAB95";
    const effectiveDisabledButtonBackgroundColor =
      typeof disabledButtonBackgroundColor === "string"
        ? disabledButtonBackgroundColor
        : isDarkMode
        ? "#6c6c6c"
        : "#ccc";

    const handleClose = onClose || onRequestClose || onCancel || (() => {});

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={handleClose}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <BlurView style={VaultScreenStyle.centeredView}>
            <DevToast
              key={`transfer-confirm-toast-${copyToastKey}`}
              visible={copyToastVisible}
              isDarkMode={isDarkMode}
              message={copyToastMessage}
              variant="success"
              autoHideDurationMs={1800}
              showCountdown
              onHide={() => setCopyToastVisible(false)}
            />
            <View
              style={VaultScreenStyle.ContactFormModal}
              onStartShouldSetResponder={(e) => e.stopPropagation()}
            >
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Text style={VaultScreenStyle.modalTitle}>
                  {t("Review & Confirm Transfer")}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: 20,
                  width: "100%",
                  alignSelf: "flex-start",
                }}
              >
                {selectedNFT?.logoUrl && (
                  <Image
                    source={{ uri: selectedNFT.logoUrl }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                  />
                )}
                <View style={{ flexDirection: "column", flex: 1 }}>
                  <Text
                    style={[
                      { flexWrap: "wrap" },
                      { color: isDarkMode ? "#97979C" : "#7F7F84" },
                    ]}
                  >
                    {selectedNFT?.name || "NFT Name"}
                  </Text>
                  <Text
                    style={[
                      { flexWrap: "wrap" },
                      { color: isDarkMode ? "#97979C" : "#7F7F84" },
                    ]}
                  >
                    {t("Token ID")}: {nftIdValue || "N/A"}
                  </Text>
                </View>
              </View>
              <View
                style={{ alignItems: "flex-start", alignSelf: "flex-start" }}
              >
                <CopyLine
                  label={t("Recipient Address")}
                  value={recipientAddress}
                  displayValue={
                    recipientAddress ? null : t("No Address Selected")
                  }
                  textStyle={transactionTextStyle}
                  valueColor="#FF5252"
                  lineHeight={24}
                />
              </View>

              <View style={{ width: "100%", marginTop: 18 }}>
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "center",
                      justifyContent: "center",
                      marginTop: 6,
                      position: "relative",
                    }}
                  >
                    <TouchableOpacity
                      style={{ paddingVertical: 2, paddingHorizontal: 4 }}
                      onPress={() => setNftSelectedFeeTab("Recommended")}
                      onLayout={(event) => {
                        const { x, width } = event.nativeEvent.layout;
                        setNftFeeTabLayouts((prev) => ({
                          ...prev,
                          Recommended: { x, width },
                        }));
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          letterSpacing: 0.2,
                          color:
                            nftSelectedFeeTab === "Recommended"
                              ? isDarkMode
                                ? "#E6E6E6"
                                : "#222222"
                              : "#B0B0B0",
                        }}
                      >
                        {t("Recommended")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 4,
                        marginLeft: 16,
                      }}
                      onPress={() => setNftSelectedFeeTab("Rapid")}
                      onLayout={(event) => {
                        const { x, width } = event.nativeEvent.layout;
                        setNftFeeTabLayouts((prev) => ({
                          ...prev,
                          Rapid: { x, width },
                        }));
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          letterSpacing: 0.2,
                          color:
                            nftSelectedFeeTab === "Rapid"
                              ? isDarkMode
                                ? "#E6E6E6"
                                : "#222222"
                              : "#B0B0B0",
                        }}
                      >
                        {t("Rapid")}
                      </Text>
                    </TouchableOpacity>
                    <Animated.View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        height: 1,
                        width: underlineW,
                        backgroundColor: isDarkMode ? "#6A6A6A" : "#C0C0C0",
                        transform: [{ translateX: underlineX }],
                      }}
                    />
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "column",
                    justifyContent: "space-between",
                    width: "100%",
                    marginTop: 12,
                  }}
                >
                  {showFeeSkeleton ? (
                    <View style={{ marginBottom: 10 }}>
                      <DataSkeleton
                        width={180}
                        height={16}
                        isDarkMode={isDarkMode}
                        style={{ marginBottom: 6 }}
                      />
                      <DataSkeleton
                        width={140}
                        height={14}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                  ) : nftSelectedFeeTab === "Recommended" ? (
                    <Text style={transactionTextStyle}>
                      <Text
                        style={{
                          fontWeight: "bold",
                          marginBottom: 8,
                          fontSize: transactionTextBase.fontSize,
                          color: transactionTextBase.color,
                        }}
                      >
                        {t("Processing Fee")}(Recommended):
                      </Text>
                      {` ${nftRecommendedFee} ${
                        feeTokenSymbol || ""
                      } ≈ ${formatUsd(nftRecommendedFee)} USD`}
                    </Text>
                  ) : (
                    <Text style={transactionTextStyle}>
                      <Text
                        style={{
                          fontWeight: "bold",
                          marginBottom: 8,
                          fontSize: transactionTextBase.fontSize,
                          color: transactionTextBase.color,
                        }}
                      >
                        {t("Processing Fee")}(Rapid):
                      </Text>
                      {` ${nftRapidFee} ${feeTokenSymbol || ""} ≈ ${formatUsd(
                        nftRapidFee
                      )} USD`}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setConfirmChecked((prev) => !prev)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 10,
                  paddingVertical: 6,
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: confirmChecked }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderWidth: 1,
                    borderColor: confirmChecked
                      ? "#66F87B"
                      : isDarkMode
                      ? "#CCB68C"
                      : "#CFAB95",
                    borderRadius: 4,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                    backgroundColor: confirmChecked ? "#66F87B" : "transparent",
                  }}
                >
                  {confirmChecked && (
                    <View
                      style={{
                        width: 14,
                        height: 10,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="check" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    transactionTextStyle,
                    {
                      marginBottom: 0,
                      lineHeight: 20,
                      fontSize: transactionTextBase.fontSize,
                      color: transactionTextBase.color,
                    },
                  ]}
                >
                  {t("I Confirm Address & Network")}
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: "column",
                  justifyContent: "space-between",
                  width: "90%",
                  alignSelf: "flex-start",
                }}
              >
                {isInsufficientBalance && (
                  <Text
                    style={{
                      color: "#FF5252",
                      fontSize: 12,
                      marginBottom: 10,
                    }}
                  >
                    {t("Not enough value")}
                  </Text>
                )}
                {!hasValidFee && (
                  <Text
                    style={{
                      color: "#FF5252",
                      fontSize: 12,
                      marginBottom: 10,
                    }}
                  >
                    {t("Processing fee unavailable. Please wait")}
                  </Text>
                )}
              </View>

              <View>
                <View
                  style={{
                    marginTop: 20,
                    width: "100%",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <TouchableOpacity
                    style={[
                      VaultScreenStyle.cancelButton,
                      { borderRadius: 15, flex: 1, marginRight: 4 },
                    ]}
                    onPress={handleClose}
                  >
                    <Text style={VaultScreenStyle.cancelButtonText}>
                      {t("Close")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      VaultScreenStyle.addModalButton,
                      { borderRadius: 15, flex: 1, marginLeft: 4 },
                      {
                        backgroundColor: canSend
                          ? effectiveButtonBackgroundColor
                          : effectiveDisabledButtonBackgroundColor,
                      },
                    ]}
                    disabled={!!sendDisabled}
                    onPress={() => {
                      handleClose && handleClose();
                      setTimeout(() => {
                        handleSendDigital({
                          selectedFeeTab: nftSelectedFeeTab,
                          recommendedFee: nftRecommendedFee,
                          rapidFeeValue: nftRapidFee,
                        });
                      }, 0);
                    }}
                  >
                    <Text style={[VaultScreenStyle.confirmText]}>
                      {t("Send")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </BlurView>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  const {
    onRequestClose,
    onConfirm,
    onCancel,
    ActivityScreenStyle,
    selectedCryptoIcon,
    selectedCrypto,
    selectedCryptoChain,
    amount,
    priceUsd,
    exchangeRates,
    currencyUnit,
    recommendedFee,
    recommendedValue,
    rapidFeeValue,
    rapidCurrencyValue,
    selectedFeeTab,
    detectedNetwork,
    selectedAddress,
    inputAddress,
  } = props;

  const confirmDisabled = !confirmChecked;
  if (__DEV__ && typeof confirmDisabled !== "boolean") {
    throw new Error("disabled must be boolean");
  }
  const confirmButtonBg = confirmDisabled
    ? disabledButtonBackgroundColor
    : buttonBackgroundColor;
  const normalizedPriceUsd = Number(getRuntimePriceUsd(priceUsd));
  const exchangeRate = Number(exchangeRates?.[currencyUnit] ?? 1);
  const convertedAmount = (
    (parseFloat(amount) || 0) *
    normalizedPriceUsd *
    exchangeRate
  ).toFixed(2);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <BlurView style={ActivityScreenStyle.centeredView}>
        <View style={ActivityScreenStyle.confirmModalView}>
          <Text style={ActivityScreenStyle.modalTitle}>
            {t("Review & Confirm Transfer")}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 6,
              marginBottom: 16,
            }}
          >
            {selectedCryptoIcon && (
              <Image
                source={selectedCryptoIcon}
                style={{
                  width: 24,
                  height: 24,
                  marginRight: 8,
                }}
              />
            )}
            <Text style={ActivityScreenStyle.modalTitle}>
              {`${selectedCrypto} (${selectedCryptoChain})`}
            </Text>
          </View>

          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingHorizontal: 0 }}
          >
            <Text style={ActivityScreenStyle.transactionText}>
              <Text style={{ fontWeight: "bold", marginBottom: 8 }}>
                {t("Amount")}:
              </Text>
              {` ${amount} ${selectedCrypto}`}
            </Text>

            <Text style={ActivityScreenStyle.transactionText}>
              {`≈ ${convertedAmount} ${currencyUnit}`}
            </Text>

            <CopyLine
              label={t("Payment Address")}
              value={selectedAddress}
              textStyle={ActivityScreenStyle.transactionText}
              truncateMiddle
            />

            <CopyLine
              label={t("Recipient Address")}
              value={inputAddress}
              textStyle={ActivityScreenStyle.transactionText}
              valueColor="#FF5252"
            />

            <View style={ActivityScreenStyle.transactionText}>
              <View>
                {selectedFeeTab === "Recommended" ? (
                  <>
                    <Text style={ActivityScreenStyle.transactionText}>
                      <Text style={{ fontWeight: "bold", marginBottom: 8 }}>
                        {t("Processing Fee")}(Recommended):
                      </Text>
                      {` ${recommendedFee} ${selectedCrypto} ≈ ${recommendedValue} ${currencyUnit}`}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={ActivityScreenStyle.balanceLabel}>
                      <Text style={{ fontWeight: "bold", marginBottom: 8 }}>
                        {t("Processing Fee")}(Rapid):
                      </Text>
                      {` ${rapidFeeValue} ${selectedCrypto} ≈ ${rapidCurrencyValue} ${currencyUnit}`}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <Text style={ActivityScreenStyle.transactionText}>
              <Text style={{ fontWeight: "bold", marginBottom: 8 }}>
                {t("Network")}:
              </Text>
              <Text style={{ color: "#FF5252" }}>
                {` ${((selectedCryptoChain || detectedNetwork || "") + "")
                  .replace(/_/g, " ")
                  .replace(/^\s*([a-z])/, (m, c) => c.toUpperCase())}`}
              </Text>
            </Text>
          </ScrollView>

          <TouchableOpacity
            onPress={() => setConfirmChecked((prev) => !prev)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 10,
              paddingVertical: 6,
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmChecked }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderWidth: 1,
                borderColor: confirmChecked
                  ? "#66F87B"
                  : isDarkMode
                  ? "#CCB68C"
                  : "#CFAB95",
                borderRadius: 4,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
                backgroundColor: confirmChecked ? "#66F87B" : "transparent",
              }}
            >
              {confirmChecked && (
                <View
                  style={{
                    width: 14,
                    height: 10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="check" size={10} color="#fff" />
                </View>
              )}
            </View>
            <Text
              style={[
                ActivityScreenStyle.transactionText,
                { marginBottom: 0, lineHeight: 20 },
              ]}
            >
              {t("I Confirm Address & Network")}
            </Text>
          </TouchableOpacity>

          <View
            style={{
              marginTop: 20,
              flexDirection: "row",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <TouchableOpacity
              style={[
                ActivityScreenStyle.cancelButton,
                { flex: 1, marginLeft: 8, borderRadius: 15 },
              ]}
              onPress={onCancel}
            >
              <Text style={ActivityScreenStyle.cancelButtonText}>
                {t("Cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                ActivityScreenStyle.optionButton,
                {
                  flex: 1,
                  marginLeft: 8,
                  marginBottom: 0,
                  borderRadius: 15,
                  backgroundColor: confirmButtonBg,
                },
              ]}
              disabled={!!confirmDisabled}
              onPress={() => {
                if (confirmDisabled) return;
                onConfirm();
              }}
            >
              <Text style={ActivityScreenStyle.submitButtonText}>
                {t("Confirm")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

export default TransferConfirmModal;
