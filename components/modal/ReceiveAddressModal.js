/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// ReceiveAddressModal.js
import React, { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  TouchableWithoutFeedback,
  Pressable,
  StyleSheet,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { BlurView } from "../common/AppBlurView";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import AnimatedWebP from "../common/AnimatedWebP";
import DevToast from "../common/DevToast";
import {
  BCH_ADDRESS_TYPES,
  deriveBchAddressFormats,
  isBchCashAddr,
  normalizeBchAddressType,
  resolveBchAddressByType,
  stripBchPrefix,
} from "../../config/networkUtils";
import {
  BTC_ADDRESS_TYPES,
  isBtcCard,
  normalizeBtcAddressType,
  resolveBtcAddressByType,
} from "../../utils/btcAddress";
import {
  LTC_ADDRESS_TYPES,
  normalizeLtcAddressType,
  resolveLtcAddressByType,
} from "../../utils/ltcAddress";

/**
 * Universal payment address pop-up window
 * props:
 *  - visible
 *  - onClose
 *  - styleObj
 *  - t
 *  - cryptoIcon
 *  - cryptoName
 *  - address
 *  - isVerifying
 *  - verifyMsg
 *  - handleVerify
 *  - isDarkMode
 *  - queryChainShortName
 */

const ReceiveAddressModal = ({
  visible,
  onClose,
  styleObj,
  cryptoIcon,
  cryptoName,
  address,
  bchAddressType,
  bchCashAddr,
  bchLegacyAddr,
  onSwitchBchAddressType,
  btcAddressType,
  btcLegacyAddr,
  btcNestedSegwitAddr,
  btcNativeSegwitAddr,
  btcTaprootAddr,
  onSwitchBtcAddressType,
  ltcAddressType,
  ltcLegacyAddr,
  ltcNestedSegwitAddr,
  ltcNativeSegwitAddr,
  onSwitchLtcAddressType,
  hasVerifyAddressAttempted,
  isPreparingVerifyAddress,
  isVerifying,
  verifyMsg,
  handleVerify,
  isDarkMode,
  queryChainShortName,
}) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(visible);
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [copyToastMessage, setCopyToastMessage] = useState("");
  const [copyToastKey, setCopyToastKey] = useState(0);

  useEffect(() => {
    setShowModal(visible);
  }, [visible]);

  const showCopyToast = (message) => {
    setCopyToastMessage(message);
    setCopyToastVisible(true);
    setCopyToastKey((value) => value + 1);
  };

  if (!showModal) return null;

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
        <View style={styleObj.centeredView} pointerEvents="box-none">
          <View
            style={[styleObj.receiveModalView, { height: "auto" }]}
            onStartShouldSetResponder={() => true}
          >
            <Header
              cryptoIcon={cryptoIcon}
              cryptoName={cryptoName}
              styleObj={styleObj}
              t={t}
            />
            <AddressInfo
              address={address}
              isDarkMode={isDarkMode}
              styleObj={styleObj}
              t={t}
              onShowToast={showCopyToast}
              queryChainShortName={queryChainShortName}
              bchAddressType={bchAddressType}
              bchCashAddr={bchCashAddr}
              bchLegacyAddr={bchLegacyAddr}
              onSwitchBchAddressType={onSwitchBchAddressType}
              btcAddressType={btcAddressType}
              btcLegacyAddr={btcLegacyAddr}
              btcNestedSegwitAddr={btcNestedSegwitAddr}
              btcNativeSegwitAddr={btcNativeSegwitAddr}
              btcTaprootAddr={btcTaprootAddr}
              onSwitchBtcAddressType={onSwitchBtcAddressType}
              ltcAddressType={ltcAddressType}
              ltcLegacyAddr={ltcLegacyAddr}
              ltcNestedSegwitAddr={ltcNestedSegwitAddr}
              ltcNativeSegwitAddr={ltcNativeSegwitAddr}
              onSwitchLtcAddressType={onSwitchLtcAddressType}
            />
            <QRCodeView address={address} cryptoIcon={cryptoIcon} />
            {(hasVerifyAddressAttempted || isPreparingVerifyAddress || isVerifying) && (
              <VerifyingStatus
                showHelperOnly={
                  hasVerifyAddressAttempted &&
                  !isPreparingVerifyAddress &&
                  !isVerifying
                }
                isPreparing={isPreparingVerifyAddress}
                message={verifyMsg}
                styleObj={styleObj}
                isDarkMode={isDarkMode}
              />
            )}
            <ActionButtons
              handleVerify={handleVerify}
              onClose={onClose}
              styleObj={styleObj}
              t={t}
              disabled={isVerifying}
              queryChainShortName={queryChainShortName}
              bchAddressType={bchAddressType}
              btcAddressType={btcAddressType}
              ltcAddressType={ltcAddressType}
            />
          </View>
        </View>
        <DevToast
          key={`receive-toast-${copyToastKey}`}
          visible={copyToastVisible}
          isDarkMode={isDarkMode}
          message={copyToastMessage}
          variant="success"
          autoHideDurationMs={1800}
          showCountdown
          onHide={() => setCopyToastVisible(false)}
        />
      </View>
    </Modal>
  );
};

const Header = ({ cryptoIcon, cryptoName, styleObj, t }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    }}
  >
    <Text style={styleObj.modalTitle}>{t("Address for")}</Text>
    {cryptoIcon && (
      <Image
        source={cryptoIcon}
        style={{ width: 24, height: 24, marginHorizontal: 5 }}
      />
    )}
    <Text style={styleObj.modalTitle}>{cryptoName}:</Text>
  </View>
);

const AddressRow = ({
  label,
  labelNode,
  value,
  isDarkMode,
  styleObj,
  t,
  onShowToast,
  marginTop = 0,
}) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      maxWidth: "100%",
      justifyContent: "center",
      width: "100%",
      marginTop,
    }}
  >
    <View style={{ flex: 1, marginRight: 8 }}>
      {labelNode ? (
        <View style={{ width: "100%", alignSelf: "flex-start", marginBottom: 4 }}>
          {labelNode}
        </View>
      ) : label ? (
        <Text
          style={[
            styleObj.subtitleText,
            { textAlign: "left", width: "100%", marginBottom: 4 },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <Text
        style={[
          styleObj.addressText,
          {
            textAlign: "left",
            width: "100%",
          },
        ]}
      >
        {value}
      </Text>
    </View>
    <TouchableOpacity
      onPress={() => {
        Clipboard.setString(value);
        onShowToast?.(t("Address copied to clipboard"));
      }}
    >
      <Icon
        name="content-copy"
        size={24}
        color={isDarkMode ? "#ffffff" : "#676776"}
      />
    </TouchableOpacity>
  </View>
);

const AddressTypeToggle = ({
  activeType,
  options,
  onSelect,
  isDarkMode,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [labelWidth, setLabelWidth] = useState(0);
  const activeOption =
    (Array.isArray(options) ? options : []).find(
      (option) => option.key === activeType,
    ) || (Array.isArray(options) ? options[0] : null);
  if (!activeOption) return null;
  const horizontalPadding = compact ? 10 : 12;
  const toggleWidth =
    labelWidth > 0 ? labelWidth + horizontalPadding * 2 + 24 : undefined;
  const toggleBg = isDarkMode ? "#5A5A5A" : "#E9E9EE";
  const toggleText = isDarkMode ? "#F1F1F3" : "#3A3838";
  const panelBg = isDarkMode ? "#3A3838" : "#FFFFFF";
  const panelBorder = isDarkMode ? "transparent" : "#E5E5EC";
  const selectedBg = isDarkMode ? "#4A4747" : "#F2F2F6";
  const selectedText = isDarkMode ? "#FFFFFF" : "#1F1F24";
  const defaultText = isDarkMode ? "#D1D1D6" : "#55555F";
  const selectedPreview = isDarkMode ? "#D8D8DD" : "#7A7A85";
  const defaultPreview = isDarkMode ? "#9A9AA3" : "#9A9AA3";
  const shadowColor = isDarkMode ? "#000" : "#8E8E99";

  return (
    <View
      style={{
        alignSelf: "flex-start",
        marginTop: compact ? 0 : 8,
        marginBottom: compact ? 0 : 6,
        zIndex: 20,
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((prev) => !prev)}
        activeOpacity={0.8}
        style={{
          width: toggleWidth,
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          justifyContent: "flex-start",
          paddingHorizontal: horizontalPadding,
          paddingVertical: compact ? 5 : 8,
          borderRadius: 12,
          backgroundColor: toggleBg,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            marginBottom: 0,
            textAlign: "left",
            fontSize: compact ? 14 : 16,
            lineHeight: compact ? 18 : 20,
            color: toggleText,
          }}
        >
          {activeOption.label}
        </Text>
        <Icon
          name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={18}
          color={toggleText}
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>

      <Text
        pointerEvents="none"
        numberOfLines={1}
        onLayout={(event) => {
          const nextWidth = Math.ceil(event.nativeEvent.layout.width);
          if (nextWidth && nextWidth !== labelWidth) {
            setLabelWidth(nextWidth);
          }
        }}
        style={{
          position: "absolute",
          opacity: 0,
          left: 0,
          top: 0,
          fontSize: compact ? 14 : 16,
          lineHeight: compact ? 18 : 20,
        }}
      >
        {activeOption.label}
      </Text>

      {open ? (
        <View
          style={{
            position: "absolute",
            top: compact ? 28 : 32,
            left: 0,
            width: 284,
            backgroundColor: panelBg,
            borderRadius: 18,
            borderWidth: isDarkMode ? 0 : 1,
            borderColor: panelBorder,
            paddingVertical: 8,
            paddingHorizontal: 10,
            shadowColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDarkMode ? 0.28 : 0.14,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {options.map((option) => {
            const selected = option.key === activeOption.key;
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.85}
                onPress={() => {
                  onSelect?.(option.key);
                  setOpen(false);
                }}
                style={{
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: selected ? selectedBg : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 20,
                    color: selected ? selectedText : defaultText,
                    fontWeight: selected ? "600" : "400",
                  }}
                >
                  {option.label}
                </Text>
                {option.preview ? (
                  <Text
                    style={{
                      marginTop: 3,
                      fontSize: 13,
                      lineHeight: 16,
                      color: selected ? selectedPreview : defaultPreview,
                    }}
                  >
                    {option.preview}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const AddressInfo = ({
  address,
  isDarkMode,
  styleObj,
  t,
  onShowToast,
  queryChainShortName,
  bchAddressType,
  bchCashAddr,
  bchLegacyAddr,
  onSwitchBchAddressType,
  btcAddressType,
  btcLegacyAddr,
  btcNestedSegwitAddr,
  btcNativeSegwitAddr,
  btcTaprootAddr,
  onSwitchBtcAddressType,
  ltcAddressType,
  ltcLegacyAddr,
  ltcNestedSegwitAddr,
  ltcNativeSegwitAddr,
  onSwitchLtcAddressType,
}) => {
  const safeAddress = (address || "").trim();
  const hasValidAddress = safeAddress !== "";
  const normalizedChain = String(queryChainShortName || "")
    .trim()
    .toUpperCase();
  const isBchChain =
    normalizedChain === "BCH" || normalizedChain === "BITCOIN_CASH";
  const isBitcoinChain =
    normalizedChain === "BTC" || normalizedChain === "BITCOIN";
  const isLitecoinChain =
    normalizedChain === "LTC" || normalizedChain === "LITECOIN";

  let addressRows = [];
  let resolvedType = normalizeBchAddressType(bchAddressType);
  const derivedFormats = deriveBchAddressFormats(
    safeAddress || bchCashAddr || bchLegacyAddr,
  );
  const resolvedCashAddr = resolveBchAddressByType(
    BCH_ADDRESS_TYPES.CASHADDR,
    safeAddress,
    bchCashAddr || derivedFormats.cashaddr,
    bchLegacyAddr || derivedFormats.legacy,
  );
  const resolvedLegacyAddr = resolveBchAddressByType(
    BCH_ADDRESS_TYPES.LEGACY,
    safeAddress,
    bchCashAddr || derivedFormats.cashaddr,
    bchLegacyAddr || derivedFormats.legacy,
  );
  const hasCashAddr = Boolean(
    derivedFormats.cashaddr || isBchCashAddr(resolvedCashAddr),
  );
  const hasLegacyAddr = Boolean(derivedFormats.legacy);
  const legacyLabel = String(resolvedLegacyAddr || "").startsWith("3")
    ? t("(Legacy format / P2SH)")
    : t("(Legacy format / P2PKH)");
  const formatPreview = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= 18) return text;
    return `${text.slice(0, 10)}...${text.slice(-6)}`;
  };
  const formatLabel = (value, fallback = "") =>
    String(value || fallback || "")
      .trim()
      .replace(/^\(/, "")
      .replace(/\)$/, "");
  const displayCashAddr = resolvedCashAddr
    ? resolvedCashAddr.includes(":")
      ? resolvedCashAddr
      : `bitcoincash:${stripBchPrefix(resolvedCashAddr)}`
    : "";
  const bchOptions = [
    {
      key: BCH_ADDRESS_TYPES.CASHADDR,
      label: formatLabel(
        "(CashAddr format / P2PKH)",
        "CashAddr format / P2PKH",
      ),
      preview: formatPreview(
        displayCashAddr.includes(":")
          ? displayCashAddr
          : `bitcoincash:${stripBchPrefix(displayCashAddr)}`,
      ),
    },
    {
      key: BCH_ADDRESS_TYPES.LEGACY,
      label: formatLabel(legacyLabel, "Legacy format"),
      preview: formatPreview(resolvedLegacyAddr),
    },
  ].filter((option) => String(option.preview || "").trim() !== "");
  if (isBchChain && hasCashAddr) {
    resolvedType = BCH_ADDRESS_TYPES.CASHADDR;
  } else if (hasLegacyAddr && !hasCashAddr) {
    resolvedType = BCH_ADDRESS_TYPES.LEGACY;
  }
  if (hasValidAddress) {
    if (isBchChain && hasCashAddr && hasLegacyAddr) {
      const value =
        resolvedType === BCH_ADDRESS_TYPES.LEGACY
          ? resolvedLegacyAddr
          : displayCashAddr;
      addressRows = [
        {
          label: "",
          labelNode: (
            <AddressTypeToggle
              activeType={resolvedType}
              options={bchOptions}
              onSelect={onSwitchBchAddressType}
              isDarkMode={isDarkMode}
              compact
            />
          ),
          value,
        },
      ];
    } else if (isBchChain && hasCashAddr) {
      addressRows = [
        {
          label: "",
          labelNode: (
            <AddressTypeToggle
              activeType={BCH_ADDRESS_TYPES.CASHADDR}
              options={bchOptions}
              onSelect={onSwitchBchAddressType}
              isDarkMode={isDarkMode}
              compact
            />
          ),
          value: displayCashAddr,
        },
      ];
    } else if (isBchChain && hasLegacyAddr) {
      addressRows = [
        {
          label: "",
          labelNode: (
            <AddressTypeToggle
              activeType={BCH_ADDRESS_TYPES.LEGACY}
              options={bchOptions}
              onSelect={onSwitchBchAddressType}
              isDarkMode={isDarkMode}
              compact
            />
          ),
          value: resolvedLegacyAddr,
        },
      ];
    } else if (isBitcoinChain) {
      const resolvedType = normalizeBtcAddressType(btcAddressType);
      const resolvedLegacyAddr = resolveBtcAddressByType(
        BTC_ADDRESS_TYPES.LEGACY,
        safeAddress,
        btcLegacyAddr,
        btcNestedSegwitAddr,
        btcNativeSegwitAddr,
        btcTaprootAddr,
      );
      const resolvedNestedAddr = resolveBtcAddressByType(
        BTC_ADDRESS_TYPES.NESTED_SEGWIT,
        safeAddress,
        btcLegacyAddr,
        btcNestedSegwitAddr,
        btcNativeSegwitAddr,
        btcTaprootAddr,
      );
      const resolvedNativeAddr = resolveBtcAddressByType(
        BTC_ADDRESS_TYPES.NATIVE_SEGWIT,
        safeAddress,
        btcLegacyAddr,
        btcNestedSegwitAddr,
        btcNativeSegwitAddr,
        btcTaprootAddr,
      );
      const resolvedTaprootAddr = resolveBtcAddressByType(
        BTC_ADDRESS_TYPES.TAPROOT,
        safeAddress,
        btcLegacyAddr,
        btcNestedSegwitAddr,
        btcNativeSegwitAddr,
        btcTaprootAddr,
      );
      const btcOptions = [
        {
          key: BTC_ADDRESS_TYPES.LEGACY,
          label: "Legacy / P2PKH",
          preview: formatPreview(resolvedLegacyAddr),
        },
        {
          key: BTC_ADDRESS_TYPES.NESTED_SEGWIT,
          label: "Nested SegWit / P2SH",
          preview: formatPreview(resolvedNestedAddr),
        },
        {
          key: BTC_ADDRESS_TYPES.NATIVE_SEGWIT,
          label: "Native SegWit / Bech32",
          preview: formatPreview(resolvedNativeAddr),
        },
        {
          key: BTC_ADDRESS_TYPES.TAPROOT,
          label: "Taproot / Bech32m",
          preview: formatPreview(resolvedTaprootAddr),
        },
      ].filter((option) => String(option.preview || "").trim() !== "");
      const value = resolveBtcAddressByType(
        resolvedType,
        safeAddress,
        btcLegacyAddr,
        btcNestedSegwitAddr,
        btcNativeSegwitAddr,
        btcTaprootAddr,
      );
      addressRows = [
        {
          label: "",
          labelNode: (
            <AddressTypeToggle
              activeType={resolvedType}
              options={btcOptions}
              onSelect={onSwitchBtcAddressType}
              isDarkMode={isDarkMode}
              compact
            />
          ),
          value,
        },
      ];
    } else if (isLitecoinChain) {
      const resolvedType = normalizeLtcAddressType(ltcAddressType);
      const resolvedLegacyAddr = resolveLtcAddressByType(
        LTC_ADDRESS_TYPES.LEGACY,
        safeAddress,
        ltcLegacyAddr,
        ltcNestedSegwitAddr,
        ltcNativeSegwitAddr,
      );
      const resolvedNestedAddr = resolveLtcAddressByType(
        LTC_ADDRESS_TYPES.NESTED_SEGWIT,
        safeAddress,
        ltcLegacyAddr,
        ltcNestedSegwitAddr,
        ltcNativeSegwitAddr,
      );
      const resolvedNativeAddr = resolveLtcAddressByType(
        LTC_ADDRESS_TYPES.NATIVE_SEGWIT,
        safeAddress,
        ltcLegacyAddr,
        ltcNestedSegwitAddr,
        ltcNativeSegwitAddr,
      );
      const ltcOptions = [
        {
          key: LTC_ADDRESS_TYPES.LEGACY,
          label: "Legacy / P2PKH",
          preview: formatPreview(resolvedLegacyAddr),
        },
        {
          key: LTC_ADDRESS_TYPES.NESTED_SEGWIT,
          label: "Nested SegWit / P2SH",
          preview: formatPreview(resolvedNestedAddr),
        },
        {
          key: LTC_ADDRESS_TYPES.NATIVE_SEGWIT,
          label: "Native SegWit / Bech32",
          preview: formatPreview(resolvedNativeAddr),
        },
      ].filter((option) => String(option.preview || "").trim() !== "");
      const value = resolveLtcAddressByType(
        resolvedType,
        safeAddress,
        ltcLegacyAddr,
        ltcNestedSegwitAddr,
        ltcNativeSegwitAddr,
      );
      addressRows = [
        {
          label: "",
          labelNode: (
            <AddressTypeToggle
              activeType={resolvedType}
              options={ltcOptions}
              onSelect={onSwitchLtcAddressType}
              isDarkMode={isDarkMode}
              compact
            />
          ),
          value,
        },
      ];
    } else {
      addressRows = [{ value: safeAddress }];
    }
  }

  return (
    <View>
      {hasValidAddress && (
        <Text
          style={[
            styleObj.subtitleText,
            { paddingHorizontal: 20, marginBottom: 0, marginTop: 8 },
          ]}
        >
          {t("Assets can only be sent within the same chain.")}
        </Text>
      )}

      <View
        style={{
          flexDirection: "column",
          justifyContent: "center",
          alignItems: hasValidAddress ? "stretch" : "center",
          paddingHorizontal: 20,
          paddingVertical: 10,
        }}
      >
        {hasValidAddress ? (
          <>
            {addressRows.map((row, index) => (
              <AddressRow
                key={`${row.label || "address"}-${index}`}
                label={row.label}
                labelNode={row.labelNode}
              value={row.value}
              isDarkMode={isDarkMode}
              styleObj={styleObj}
              t={t}
              onShowToast={onShowToast}
              marginTop={index === 0 ? 0 : 10}
            />
            ))}
          </>
        ) : (
          <Text
            style={[
              styleObj.addressText,
              { textAlign: "center", width: "100%" },
            ]}
          >
            {t("Click the Verify Address Button.")}
          </Text>
        )}
      </View>
    </View>
  );
};

const QRCodeView = ({ address, cryptoIcon }) => {
  const safeAddress = (address || "").trim();
  if (safeAddress === "") {
    return null;
  }
  const qrValue = isBchCashAddr(safeAddress)
    ? `bitcoincash:${stripBchPrefix(safeAddress)}`
    : safeAddress;

  return (
    <View
      style={{
        backgroundColor: "#fff",
        height: 284,
        width: 284,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 16,
        borderWidth: 2,
        borderColor: "#EEEEEF",
      }}
    >
      <QRCode
        value={qrValue}
        size={224}
        logo={cryptoIcon || undefined}
        logoSize={40}
        logoMargin={4}
        logoBorderRadius={8}
        logoBackgroundColor="#FFFFFF"
      />
    </View>
  );
};

const VerifyingStatus = ({
  showHelperOnly = false,
  isPreparing = false,
  message,
  styleObj,
  isDarkMode,
}) => {
  const { t } = useTranslation();
  const isAddressShown = message === t("addressShown");
  const helperMessage = t("Please check on your LUKKEY device.");

  useEffect(() => {
    console.log("[VERIFY_ADDR][STATUS] render", {
      ts: Date.now(),
      isPreparing,
      isAddressShown,
      message,
      helperMessage,
    });
  }, [isPreparing, isAddressShown, message, helperMessage]);

  return (
    <View
      style={{
        width: "100%",
        marginTop: 8,
        marginBottom: 2,
        alignItems: "center",
      }}
    >
      {isPreparing || showHelperOnly ? (
        <View
          style={{
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={[
              styleObj.verifyingAddressText,
              {
                color: "#3CDA84",
                textAlign: "center",
                marginTop: 2,
                fontSize: 13,
                lineHeight: 17,
                paddingHorizontal: 20,
              },
            ]}
          >
            {helperMessage}
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            }}
          >
            {!isAddressShown && (
              <AnimatedWebP
                source={require("../../assets/animations/Pending.webp")}
                style={{ width: 28, height: 28, marginRight: 3, marginLeft: 0 }}
              />
            )}
            <Text
              style={[
                styleObj.verifyingAddressText,
                {
                  color: "#3CDA84",
                  textAlign: "center",
                  marginTop: 2,
                  marginLeft: 0,
                },
              ]}
            >
              {message}
            </Text>
          </View>
          {!isAddressShown && (
            <Text
              style={[
                styleObj.verifyingAddressText,
                {
                  color: "#3CDA84",
                  textAlign: "center",
                  marginTop: 4,
                  fontSize: 13,
                  lineHeight: 17,
                  paddingHorizontal: 20,
                },
              ]}
            >
              {helperMessage}
            </Text>
          )}
        </>
      )}
    </View>
  );
};

const ActionButtons = ({
  handleVerify,
  onClose,
  styleObj,
  t,
  disabled = false,
  queryChainShortName,
  bchAddressType,
  btcAddressType,
  ltcAddressType,
}) => (
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
        styleObj.cancelAddressBtn,
        { flex: 1, marginRight: 4, borderRadius: 15 },
      ]}
      onPress={onClose}
    >
      <Text style={styleObj.cancelButtonText}>{t("Close")}</Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPressIn={() => {
        console.log("[VERIFY_ADDR][UI] pressIn", {
          ts: Date.now(),
          queryChainShortName,
          bchAddressType,
          btcAddressType,
          ltcAddressType,
        });
      }}
      onPress={() => {
        console.log("[VERIFY_ADDR][UI] press", {
          ts: Date.now(),
          queryChainShortName,
          bchAddressType,
          btcAddressType,
          ltcAddressType,
        });
        handleVerify(queryChainShortName, {
          bchAddressType,
          btcAddressType,
          ltcAddressType,
        });
      }}
      disabled={disabled}
      style={[
        styleObj.verifyAddressBtn,
        {
          flex: 1,
          marginLeft: 4,
          borderRadius: 15,
          marginBottom: 0,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styleObj.submitButtonText, { textAlign: "center" }]}>
        {t("Verify Address")}
      </Text>
    </TouchableOpacity>
  </View>
);

export default ReceiveAddressModal;
