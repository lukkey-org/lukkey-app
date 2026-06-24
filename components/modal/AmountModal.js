/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
//  modal/AmountModal.js
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "../common/AppBlurView";
import { metricsAPII } from "../../env/apiEndpoints";
import DataSkeleton from "../AssetsScreen/DataSkeleton";
import { MaterialIcons } from "@expo/vector-icons";
import { resolveGasFeeSymbolForChain } from "../../config/gasFeeToken";
import DevToast from "../common/DevToast";
import {
  getRuntimeBalance,
} from "../../utils/assetRuntimeFields";
import { resolveAssetPriceUsd } from "../../utils/assetPrice";
import {
  displayChainName,
  formatCryptoBalanceDisplay,
  formatFiatBalanceDisplay,
} from "../../utils/assetDisplayFormat";
import { resolveMarketSymbol } from "../../config/priceSymbolAlias";
import {
  getAssetChainFullName,
  getAssetDisplayName,
  getAssetSymbol,
} from "../../config/assetInfo";
import { getNativeTransferFeeReserve } from "../../utils/transactionFeeReserve";
import {
  resolveAssetIcon,
  resolveAssetIconByValue,
  resolveChainIcon,
} from "../../utils/assetIconResolver";

const AMOUNT_MODAL_INPUT_MODE_KEY = "amountModalInputMode";

const AmountModal = ({
  visible,
  onRequestClose,
  ActivityScreenStyle,
  t,
  isDarkMode,
  amount,
  setAmount,
  balance,
  fee,
  rapidFee,
  setFee,
  isAmountValid,
  buttonBackgroundColor,
  disabledButtonBackgroundColor,
  handleNextAfterAmount,
  selectedCrypto,
  selectedCryptoChain,
  selectedCryptoIcon,
  currencyUnit,
  exchangeRates,
  cryptoCards,
  selectedCryptoName,
  selectedCryptoDecimals,
  EstimatedValue,
  setCryptoCards,
  recommendedFee,
  recommendedValue,
  rapidFeeValue,
  rapidCurrencyValue,
  selectedFeeTab,
  setSelectedFeeTab,
  isFeeLoading,
  validationError,
  isPrechecking,
}) => {
  const amountInputRef = useRef(null);
  const hasAutoFocusedRef = useRef(false);
  const hasKeyboardRetryRef = useRef(false);
  const keyboardVisibleRef = useRef(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [feeTabLayouts, setFeeTabLayouts] = useState({});
  const [inputMode, setInputMode] = useState("crypto");
  const [fiatAmountInput, setFiatAmountInput] = useState("");
  const [isAmountInputFocused, setIsAmountInputFocused] = useState(false);
  const [placeholderTextWidth, setPlaceholderTextWidth] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastKey, setToastKey] = useState(0);
  const underlineX = useRef(new Animated.Value(0)).current;
  const underlineW = useRef(new Animated.Value(0)).current;
  const fakeCaretOpacity = useRef(new Animated.Value(1)).current;
  const fakeCaretBlinkRef = useRef(null);

  useEffect(() => {
    if (visible) {
      fetchPriceChanges();
    }
  }, [visible]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisibleRef.current = false;
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      hasAutoFocusedRef.current = false;
      hasKeyboardRetryRef.current = false;
      setFiatAmountInput("");
      setIsAmountInputFocused(false);
      setToastVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    const target = feeTabLayouts[selectedFeeTab];
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
  }, [feeTabLayouts, selectedFeeTab, underlineX, underlineW]);

  const ensureKeyboardVisible = () => {
    if (keyboardVisibleRef.current || hasKeyboardRetryRef.current) return;
    hasKeyboardRetryRef.current = true;
    amountInputRef.current?.blur();
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 80);
  };

  const focusAmountInput = () => {
    const focus = () => amountInputRef.current?.focus();
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        focus();
      });
    });
  };

  useEffect(() => {
    if (!visible) return;
    focusAmountInput();
  }, [visible]);

  const fetchPriceChanges = async () => {
    if (cryptoCards.length === 0) return;
    if (!metricsAPII.enabled) return;
    const instIds = Array.from(
      new Set(
        cryptoCards
          .map((card) =>
            resolveMarketSymbol(getAssetSymbol(card), getAssetChainFullName(card)),
          )
          .filter(Boolean)
          .map((symbol) => `${symbol}-USD`),
      ),
    ).join(",");
    if (!instIds) return;
    try {
      const response = await fetch(
        `${metricsAPII.indexTickers}?instId=${instIds}`,
      );
      const data = await response.json();
      if (data.code === 0 && data.data) {
        setCryptoCards((prevCards) =>
          prevCards.map((card) => {
            const marketSymbol = resolveMarketSymbol(
              getAssetSymbol(card),
              getAssetChainFullName(card),
            );
            const ticker = data.data[`${marketSymbol}-USD`];
            return ticker ? { ...card, priceUsd: ticker.last || "0" } : card;
          }),
        );
      }
    } catch (error) {
      console.log("Error fetching price changes:", error);
    }
  };

  const selectedCryptoInfo = cryptoCards.find(
    (crypto) =>
      getAssetSymbol(crypto) === selectedCrypto || getAssetDisplayName(crypto) === selectedCryptoName,
  );
  const normalizedBalance = getRuntimeBalance(balance);
  const gasFeeSymbol = resolveGasFeeSymbolForChain(selectedCryptoChain, cryptoCards);
  const gasFeeCard = (cryptoCards || []).find((card) => {
    const chain = String(getAssetChainFullName(card) || "")
      .trim()
      .toLowerCase();
    const symbol = String(getAssetSymbol(card) || "")
      .trim()
      .toLowerCase();
    return (
      chain === String(selectedCryptoChain || "")
        .trim()
        .toLowerCase() && symbol === String(gasFeeSymbol || "").toLowerCase()
    );
  });
  const gasFeeSymbolDisplay = String(
    getAssetSymbol(gasFeeCard) || gasFeeSymbol || "",
  ).toUpperCase();
  const selectedCryptoChainDisplay = displayChainName(selectedCryptoChain);
  const gasFeeChainDisplay = selectedCryptoChainDisplay;
  const gasFeeIconSource =
    resolveAssetIcon(gasFeeCard) ||
    resolveAssetIconByValue({
      shortName: gasFeeSymbolDisplay,
      queryChainName: selectedCryptoChain,
    }) ||
    resolveChainIcon(selectedCryptoChain);
  const gasFeeBalance = Number(gasFeeCard?.balance || 0);
  const parsedCryptoDecimals = Number(selectedCryptoDecimals);
  const maxCryptoDecimals =
    Number.isFinite(parsedCryptoDecimals) && parsedCryptoDecimals >= 0
      ? Math.min(12, Math.floor(parsedCryptoDecimals))
      : 7;
  const quickAmountPercentages = [25, 50, 75, 100];
  const priceUsd = resolveAssetPriceUsd({
    card: selectedCryptoInfo,
    symbol: selectedCrypto,
    chain: selectedCryptoChain,
    exchangeRates,
  });
  const fxRate = Number(exchangeRates?.[currencyUnit] ?? 1);
  const fiatPerCrypto = priceUsd * fxRate;
  const gasFeePriceUsd = resolveAssetPriceUsd({
    card: gasFeeCard,
    symbol: gasFeeSymbolDisplay,
    chain: selectedCryptoChain,
    exchangeRates,
  });
  const getFeeFiatValue = (feeAmount) =>
    ((parseFloat(feeAmount) || 0) * gasFeePriceUsd * fxRate).toFixed(2);

  const floorToDecimals = (value, decimals) => {
    const factor = Math.pow(10, decimals);
    return Math.floor(value * factor) / factor;
  };
  const trimFixed = (value, decimals) =>
    Number(value || 0)
      .toFixed(decimals)
      .replace(/\.?0+$/, "");

  const getConvertedBalance = (cardBalance) => {
    const cryptoToUsdBalance = Number(cardBalance || 0) * priceUsd;
    return (cryptoToUsdBalance * fxRate).toFixed(2);
  };
  const convertedBalance = getConvertedBalance(normalizedBalance);
  const balanceDisplay = formatCryptoBalanceDisplay(normalizedBalance, {
    compactLarge: true,
  });
  const fiatBalanceDisplay = formatFiatBalanceDisplay(convertedBalance, {
    compactLarge: true,
  });

  const convertedAmount =
    amount && !isNaN(amount)
      ? (parseFloat(amount) * fiatPerCrypto).toFixed(2)
      : "0.00";
  const convertedCryptoDisplay =
    amount && !isNaN(amount) ? trimFixed(amount, maxCryptoDecimals) : "0";

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const loadPersistedInputMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(AMOUNT_MODAL_INPUT_MODE_KEY);
        if (cancelled) return;
        const nextMode = savedMode === "fiat" ? "fiat" : "crypto";
        setInputMode(nextMode);
        if (nextMode === "fiat") {
          const fiatFromCrypto =
            amount && !isNaN(amount) ? Number(amount) * fiatPerCrypto : 0;
          setFiatAmountInput(
            fiatFromCrypto > 0 ? trimFixed(fiatFromCrypto, 2) : "",
          );
        }
      } catch (error) {
        console.log("Failed to load amount input mode, using default crypto:", error);
        if (!cancelled) {
          setInputMode("crypto");
        }
      }
    };

    loadPersistedInputMode();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleAmountTextChange = (text) => {
    const normalizedText = text.replace(/^0+(?!\.|$)/, "");
    if (inputMode === "crypto") {
      const regex = new RegExp(`^\\d*\\.?\\d{0,${maxCryptoDecimals}}$`);
      if (regex.test(normalizedText)) {
        setAmount(normalizedText);
      }
      return;
    }

    const fiatRegex = /^\d*\.?\d{0,2}$/;
    if (!fiatRegex.test(normalizedText)) return;
    setFiatAmountInput(normalizedText);

    if (!normalizedText) {
      setAmount("");
      return;
    }
    if (!Number.isFinite(fiatPerCrypto) || fiatPerCrypto <= 0) {
      setAmount("");
      return;
    }

    const inputFiat = Number(normalizedText);
    if (!Number.isFinite(inputFiat) || inputFiat < 0) {
      setAmount("");
      return;
    }

    // Truncate downward to ensure that the back-calculated legal currency does not exceed the legal currency amount input by the user.
    const nextCrypto = floorToDecimals(inputFiat / fiatPerCrypto, maxCryptoDecimals);
    setAmount(nextCrypto > 0 ? trimFixed(nextCrypto, maxCryptoDecimals) : "0");
  };

  const toggleInputMode = () => {
    if (inputMode === "crypto") {
      const fiatFromCrypto =
        amount && !isNaN(amount) ? Number(amount) * fiatPerCrypto : 0;
      setFiatAmountInput(
        fiatFromCrypto > 0 ? trimFixed(fiatFromCrypto, 2) : "",
      );
      setInputMode("fiat");
      AsyncStorage.setItem(AMOUNT_MODAL_INPUT_MODE_KEY, "fiat").catch((error) =>
        console.log("Failed to save amount input mode:", error),
      );
    } else {
      setInputMode("crypto");
      AsyncStorage.setItem(AMOUNT_MODAL_INPUT_MODE_KEY, "crypto").catch((error) =>
        console.log("Failed to save amount input mode:", error),
      );
    }
    setTimeout(() => amountInputRef.current?.focus(), 50);
  };

  const handleQuickAmountPercent = (percent) => {
    if (!canUseQuickAmount) return;

    const nextCrypto = floorToDecimals(
      (quickAmountBaseValue * Number(percent)) / 100,
      maxCryptoDecimals,
    );
    const nextCryptoText =
      nextCrypto > 0 ? trimFixed(nextCrypto, maxCryptoDecimals) : "0";
    setAmount(nextCryptoText);

    if (inputMode === "fiat") {
      const nextFiat = nextCrypto * fiatPerCrypto;
      setFiatAmountInput(
        Number.isFinite(nextFiat) && nextFiat > 0
          ? trimFixed(nextFiat, 2)
          : "",
      );
    }

    requestAnimationFrame(() => {
      amountInputRef.current?.focus();
    });
  };

  // Derived validation: amount must be >= selected processing fee
  const selectedProcessingFee =
    parseFloat(
      selectedFeeTab === "Recommended" ? recommendedFee : rapidFeeValue,
    ) || 0;
  const enteredAmount = parseFloat(amount) || 0;
  const balanceValue = Number(normalizedBalance) || 0;
  const feeSymbolUsesSelectedAsset =
    String(gasFeeSymbolDisplay || "")
      .trim()
      .toUpperCase() ===
    String(selectedCrypto || "")
      .trim()
      .toUpperCase();
  const isXrpTransfer = String(selectedCrypto || "").toUpperCase() === "XRP";
  const isAmountBelowSelectedFee =
    amount !== "" &&
    !isNaN(enteredAmount) &&
    enteredAmount < selectedProcessingFee;
  const xrpMinimumAmount = 1 + selectedProcessingFee;
  const isXrpAmountBelowMinimum =
    isXrpTransfer &&
    amount !== "" &&
    !isNaN(enteredAmount) &&
    enteredAmount < xrpMinimumAmount;
  // A valid fee must exist (>0 and have a value) to continue
  const hasValidFee =
    (selectedFeeTab === "Recommended"
      ? typeof recommendedFee === "string" && recommendedFee.trim() !== ""
      : typeof rapidFeeValue === "string" && rapidFeeValue.trim() !== "") &&
    selectedProcessingFee > 0;
  const nativeFeeReserve = getNativeTransferFeeReserve({
    chain: selectedCryptoChain,
    feeAmount: selectedProcessingFee,
    hasFee: hasValidFee,
    isXrpTransfer,
  });
  const isAmountPlusFeeAboveBalance =
    amount !== "" &&
    feeSymbolUsesSelectedAsset &&
    !isNaN(enteredAmount) &&
    enteredAmount + nativeFeeReserve > balanceValue;
  const isGasBalanceInsufficient =
    !!gasFeeSymbolDisplay &&
    hasValidFee &&
    !feeSymbolUsesSelectedAsset &&
    (!Number.isFinite(gasFeeBalance) || gasFeeBalance < nativeFeeReserve);
  const quickAmountFeeReserve = feeSymbolUsesSelectedAsset ? nativeFeeReserve : 0;
  const quickAmountBaseValue =
    feeSymbolUsesSelectedAsset && hasValidFee
      ? Math.max(0, balanceValue - quickAmountFeeReserve)
      : balanceValue;
  const canUseQuickAmount =
    Number.isFinite(quickAmountBaseValue) &&
    quickAmountBaseValue > 0 &&
    (!feeSymbolUsesSelectedAsset || hasValidFee);
  const isQuickAmountBalanceInsufficient =
    feeSymbolUsesSelectedAsset &&
    hasValidFee &&
    Number.isFinite(balanceValue) &&
    balanceValue > 0 &&
    quickAmountBaseValue <= 0;
  const nativeCoinGenericError = t(
    "Insufficient balance for transfer amount + network fee. Please add the native coin on this network and try again.",
  );
  const hasNativeFeeValidationError =
    !!validationError &&
    String(validationError).trim() === String(nativeCoinGenericError).trim() &&
    !!gasFeeSymbolDisplay;
  const showNativeFeeWarning =
    isGasBalanceInsufficient || hasNativeFeeValidationError;

  // Fee skeleton screen: prefetched when entering, but if not returned or still loading, the skeleton screen is displayed
  const showFeeSkeleton =
    !!isFeeLoading ||
    (selectedFeeTab === "Recommended"
      ? !recommendedFee || recommendedFee.trim() === ""
      : !rapidFeeValue || rapidFeeValue.trim() === "");
  const isNextDisabled =
    !isAmountValid ||
    isAmountPlusFeeAboveBalance ||
    isAmountBelowSelectedFee ||
    isXrpAmountBelowMinimum ||
    !hasValidFee ||
    isGasBalanceInsufficient ||
    !!isPrechecking;
  const activeInputValue = inputMode === "crypto" ? amount : fiatAmountInput;
  const hasInputValue = String(activeInputValue ?? "").length > 0;
  const showFakeCaret = isAmountInputFocused && !hasInputValue;
  const placeholderLabel = t("Enter Amount");
  const placeholderColor = isDarkMode ? "#808080" : "#cccccc";
  const measuredPlaceholderWidth =
    placeholderTextWidth > 0 ? placeholderTextWidth : 220;
  const amountVisualMinWidth = hasInputValue
    ? 24
    : Math.ceil(measuredPlaceholderWidth + (showFakeCaret ? 11 : 0));
  if (__DEV__ && typeof isNextDisabled !== "boolean") {
    throw new Error("disabled must be boolean");
  }

  useEffect(() => {
    if (showFakeCaret) {
      fakeCaretOpacity.setValue(1);
      fakeCaretBlinkRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(fakeCaretOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(fakeCaretOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      fakeCaretBlinkRef.current.start();
      return () => {
        fakeCaretBlinkRef.current?.stop?.();
        fakeCaretBlinkRef.current = null;
        fakeCaretOpacity.setValue(1);
      };
    }

    fakeCaretBlinkRef.current?.stop?.();
    fakeCaretBlinkRef.current = null;
    fakeCaretOpacity.setValue(1);
  }, [showFakeCaret, fakeCaretOpacity]);

  const handleNextPress = () => {
    Keyboard.dismiss();
    if (isPrechecking) return;
    if (!isNextDisabled) {
      handleNextAfterAmount?.();
      return;
    }
    if (isGasBalanceInsufficient) {
      setToastMessage(
        t("Add {{symbol}} on {{chain}} to pay the network fee.", {
          symbol: gasFeeSymbolDisplay || t("Network Fee"),
          chain: gasFeeChainDisplay || t("this network"),
        }),
      );
      setToastVisible(true);
      setToastKey((v) => v + 1);
      return;
    }
    if (isAmountPlusFeeAboveBalance) {
      setToastMessage(t("Balance cannot cover the amount and network fee"));
      setToastVisible(true);
      setToastKey((v) => v + 1);
    }
  };

  const renderNativeFeeWarning = () => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        width: "100%",
        marginTop: 16,
        marginBottom: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: isDarkMode
          ? "rgba(255,82,82,0.10)"
          : "rgba(255,82,82,0.08)",
        borderWidth: 1,
        borderColor: isDarkMode
          ? "rgba(255,82,82,0.22)"
          : "rgba(255,82,82,0.16)",
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff50",
          marginRight: 10,
        }}
      >
        {gasFeeIconSource ? (
          <Image
            source={gasFeeIconSource}
            style={{ width: 25, height: 25 }}
            resizeMode="contain"
          />
        ) : (
          <Text
            style={{
              color: isDarkMode ? "#FFFFFF" : "#222222",
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {String(gasFeeSymbolDisplay || "?").slice(0, 1)}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            ActivityScreenStyle.AssetsValue,
            {
              color: "#FF5252",
              textAlign: "left",
              width: "100%",
              fontWeight: "600",
            },
          ]}
          numberOfLines={2}
        >
          {t("Add {{symbol}} on {{chain}} to pay the network fee.", {
            symbol: gasFeeSymbolDisplay || t("Network Fee"),
            chain: gasFeeChainDisplay || t("this network"),
          })}
        </Text>
        <Text
          style={{
            color: isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.58)",
            fontSize: 12,
            lineHeight: 16,
            marginTop: 2,
          }}
          numberOfLines={2}
        >
          {t("{{symbol}} is the native coin for {{chain}} network fees.", {
            symbol: gasFeeSymbolDisplay || t("Network Fee"),
            chain: gasFeeChainDisplay || t("this network"),
          })}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={ActivityScreenStyle.centeredView}
        enabled={Platform.OS === "ios" || keyboardVisible}
      >
        <DevToast
          key={`amount-toast-${toastKey}`}
          visible={toastVisible}
          isDarkMode={isDarkMode}
          message={toastMessage}
          variant="cancel"
          autoHideDurationMs={3000}
          showCountdown={true}
          onHide={() => setToastVisible(false)}
        />
        <BlurView style={ActivityScreenStyle.blurBackground} />
        <TouchableWithoutFeedback
          onPress={Keyboard.dismiss}
          accessible={false}
        >
          <View
            style={[
              ActivityScreenStyle.amountModalView,
              { alignSelf: "center", flexShrink: 1 },
            ]}
          >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {selectedCryptoIcon && (
              <Image
                source={selectedCryptoIcon}
                style={{ width: 24, height: 24, marginRight: 8 }}
              />
            )}
            <Text style={ActivityScreenStyle.modalTitle}>
              {selectedCryptoChainDisplay
                ? `${selectedCrypto} (${selectedCryptoChainDisplay})`
                : selectedCrypto}
            </Text>
          </View>

          <View style={{ width: "100%", alignItems: "center" }}>
            <View
              style={{
                width: "100%",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: "100%",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <Text
                  style={[
                    ActivityScreenStyle.assetMdlSub,
                    { fontSize: 13, textAlign: "center", alignSelf: "center" },
                  ]}
                >
                  {t("Balance")}: {balanceDisplay} {selectedCrypto} ≈{" "}
                  {fiatBalanceDisplay} {currencyUnit}
                </Text>
                {/*                 <Text
                  style={[
                    ActivityScreenStyle.balMdlSub,
                    { fontSize: 13, textAlign: "center", alignSelf: "center" },
                  ]}
                >
              
                    ≈ {convertedBalance} {currencyUnit} 
                </Text> */}
              </View>
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      position: "relative",
                      width: "auto",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TextInput
                      ref={amountInputRef}
                      style={[
                        ActivityScreenStyle.amountInput,
                        {
                          color: isDarkMode ? "#ffffff" : "#000000",
                          backgroundColor: "transparent",
                          fontSize: 30,
                          lineHeight: 36,
                          height: 40,
                          paddingTop: 0,
                          paddingBottom: 0,
                          paddingVertical: 0,
                          margin: 0,
                          textAlign: "center",
                          textAlignVertical: "bottom",
                          fontWeight: "bold",
                          width: undefined,
                          minWidth: amountVisualMinWidth,
                        },
                      ]}
                      placeholder=""
                      keyboardType="numeric"
                      onChangeText={handleAmountTextChange}
                      value={inputMode === "crypto" ? amount : fiatAmountInput}
                      caretHidden
                      showSoftInputOnFocus={true}
                      onFocus={() => {
                        setIsAmountInputFocused(true);
                      }}
                      onBlur={() => {
                        setIsAmountInputFocused(false);
                      }}
                    />
                    {!hasInputValue && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          alignSelf: "center",
                          top: 0,
                          bottom: 0,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {showFakeCaret ? (
                          <Animated.View
                            style={{
                              width: 3,
                              height: 34,
                              borderRadius: 2,
                              backgroundColor: "#FFFFFF",
                              marginRight: 8,
                              opacity: fakeCaretOpacity,
                            }}
                          />
                        ) : null}
                        <Text
                          onLayout={(event) => {
                            const w = Math.ceil(
                              event?.nativeEvent?.layout?.width || 0,
                            );
                            if (w > 0 && w !== placeholderTextWidth) {
                              setPlaceholderTextWidth(w);
                            }
                          }}
                          style={{
                            color: placeholderColor,
                            fontSize: 30,
                            lineHeight: 36,
                            fontWeight: "bold",
                          }}
                        >
                          {placeholderLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      height: 40,
                      justifyContent: "flex-end",
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={[
                        ActivityScreenStyle.balMdlSub,
                        {
                          fontSize: 14,
                          lineHeight: 18,
                          opacity: 0.9,
                          marginTop: 0,
                          marginBottom: 0,
                          marginVertical: 0,
                          paddingTop: 0,
                          paddingBottom: 0,
                          includeFontPadding: false,
                        },
                      ]}
                    >
                      {inputMode === "crypto" ? selectedCrypto : currencyUnit}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 4,
                    minHeight: 34,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      toggleInputMode();
                    }}
                    activeOpacity={0.8}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 8,
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.14)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  >
                    <MaterialIcons
                      name="swap-vert"
                      size={18}
                      color={isDarkMode ? "#F2F2F2" : "#2F2F2F"}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      ActivityScreenStyle.balMdlSub,
                      {
                        marginTop: 0,
                        marginBottom: 0,
                        marginVertical: 0,
                        lineHeight: 20,
                        includeFontPadding: false,
                      },
                    ]}
                  >
                    {inputMode === "crypto"
                      ? `≈ ${convertedAmount} ${currencyUnit}`
                      : `≈ ${convertedCryptoDisplay} ${selectedCrypto}`}
                  </Text>
                </View>
                {isAmountInputFocused && (
                  <View
                    style={{
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 8,
                      marginBottom: 2,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {quickAmountPercentages.map((percent) => {
                        const disabled = !canUseQuickAmount;
                        return (
                          <TouchableOpacity
                            key={`amount-percent-${percent}`}
                            activeOpacity={0.82}
                            disabled={disabled}
                            onPress={() => handleQuickAmountPercent(percent)}
                            style={{
                              minWidth: 54,
                              height: 26,
                              paddingHorizontal: 10,
                              borderRadius: 13,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: isDarkMode
                                ? "rgba(255,255,255,0.12)"
                                : "rgba(0,0,0,0.06)",
                              borderWidth: 1,
                              borderColor: isDarkMode
                                ? "rgba(255,255,255,0.14)"
                                : "rgba(0,0,0,0.08)",
                              opacity: disabled ? 0.45 : 1,
                            }}
                          >
                            <Text
                              style={{
                                color: isDarkMode ? "#E6E6E6" : "#2A2A2A",
                                fontSize: 12,
                                lineHeight: 15,
                                fontWeight: "600",
                                includeFontPadding: false,
                              }}
                            >
                              {percent}%
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {isQuickAmountBalanceInsufficient && (
                      <Text
                        style={[
                          ActivityScreenStyle.AssetsValue,
                          {
                            color: "#FF5252",
                            marginTop: 6,
                            textAlign: "center",
                            width: "100%",
                          },
                        ]}
                      >
                        {t("Balance cannot cover the amount and network fee")}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View
              style={{
                flexDirection: "column",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              {(parseFloat(amount) > parseFloat(normalizedBalance) ||
                isAmountPlusFeeAboveBalance) && (
                <Text
                  style={[
                    ActivityScreenStyle.AssetsValue,
                    {
                      color: "#FF5252",
                      marginTop: 16,
                      marginBottom: 10,
                      textAlign: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {isAmountPlusFeeAboveBalance
                    ? t("Balance cannot cover the amount and network fee")
                    : t("Not enough value")}
                </Text>
              )}
              {isAmountBelowSelectedFee && (
                <Text
                  style={[
                    ActivityScreenStyle.AssetsValue,
                    {
                      color: "#FF5252",
                      marginTop: 16,
                      marginBottom: 10,
                      textAlign: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {t("Amount cannot be less than the processing fee")}
                </Text>
              )}
              {isXrpAmountBelowMinimum && (
                <Text
                  style={[
                    ActivityScreenStyle.AssetsValue,
                    {
                      color: "#FF5252",
                      marginTop: 16,
                      marginBottom: 10,
                      textAlign: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {t("XRP minimum transfer amount is 1 + processing fee")}
                </Text>
              )}
              {!hasValidFee && (
                <Text
                  style={[
                    ActivityScreenStyle.AssetsValue,
                    {
                      color: isDarkMode ? "#CCB68C" : "#CFAB95",
                      marginTop: 16,
                      marginBottom: 10,
                      textAlign: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {t("Processing fee unavailable. Please wait")}
                </Text>
              )}
              {showNativeFeeWarning && renderNativeFeeWarning()}
              {!!validationError && !hasNativeFeeValidationError && (
                <Text
                  style={[
                    ActivityScreenStyle.AssetsValue,
                    {
                      color: "#FF5252",
                      marginTop: 16,
                      marginBottom: 10,
                      textAlign: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {validationError}
                </Text>
              )}
            </View>
            <View
              style={{
                flexDirection: "column",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Text style={ActivityScreenStyle.balanceLabel}>
                {t("Network Fee")}:
              </Text>
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
                  onPress={() => {
                    Keyboard.dismiss();
                    setSelectedFeeTab("Recommended");
                  }}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    setFeeTabLayouts((prev) => ({
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
                        selectedFeeTab === "Recommended"
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
                  onPress={() => {
                    Keyboard.dismiss();
                    setSelectedFeeTab("Rapid");
                  }}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    setFeeTabLayouts((prev) => ({
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
                        selectedFeeTab === "Rapid"
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
              {showFeeSkeleton ? (
                <View style={{ marginTop: 6, marginBottom: 10 }}>
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
              ) : (
                <Text
                  style={[
                    ActivityScreenStyle.balanceLabel,
                    {
                      marginTop: 6,
                      marginBottom: 10,
                      alignSelf: "center",
                      textAlign: "center",
                    },
                  ]}
                >
                  {selectedFeeTab === "Recommended"
                    ? `${recommendedFee} ${gasFeeSymbolDisplay || selectedCrypto} ≈ ${getFeeFiatValue(
                        recommendedFee,
                      )} ${currencyUnit}`
                    : `${rapidFeeValue} ${gasFeeSymbolDisplay || selectedCrypto} ≈ ${getFeeFiatValue(
                        rapidFeeValue,
                      )} ${currencyUnit}`}
                </Text>
              )}
            </View>
          </View>

          <View
            style={{
              flexDirection: "column",
              width: "100%",
              marginTop: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <TouchableOpacity
                style={[
                  ActivityScreenStyle.cancelButton,
                  { flex: 1, marginRight: 4, borderRadius: 15 },
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  onRequestClose?.();
                }}
              >
                <Text style={ActivityScreenStyle.cancelButtonText}>
                  {t("Back")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  ActivityScreenStyle.optionButton,
                  { flex: 1, marginLeft: 4, borderRadius: 15, marginBottom: 0 },
                  {
                    backgroundColor: !isNextDisabled
                      ? buttonBackgroundColor
                      : disabledButtonBackgroundColor,
                  },
                ]}
                onPress={handleNextPress}
              >
                <Text style={ActivityScreenStyle.submitButtonText}>
                  {t("Next")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default AmountModal;
