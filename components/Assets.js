/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useContext,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  BackHandler,
  useAnimatedValue,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import base64 from "base64-js";
import { Buffer } from "buffer";

import { VaultScreenStylesRoot } from "../styles/styles";
import { ActivityScreenStylesRoot } from "../styles/styles";
import { DeviceContext, DarkModeContext } from "../utils/DeviceContext";

import { getAddressSyncKeys, prefixToShortName } from "../config/chainPrefixes";
import { createHandlePinSubmit } from "../utils/handlePinSubmit";
import AssetsPage from "./AssetsScreen/AssetsPage";
import AssetsTabView from "./AssetsScreen/AssetsTabView";
import useCardLayout from "./AssetsScreen/useCardLayout";
import useChainSelection from "./AssetsScreen/useChainSelection";
import useHideNumbers from "./AssetsScreen/useHideNumbers";
import useNftRoute from "./AssetsScreen/useNftRoute";
import useReceiveModal from "./AssetsScreen/useReceiveModal";
import useAssetCardHandlers from "./AssetsScreen/useAssetCardHandlers";
import ModalsContainer from "./AssetsScreen/ModalsContainer";
import VaultHeaderToggle from "./AssetsScreen/VaultHeaderToggle";
import ContactFormModal from "./modal/ContactFormModal";
import AmountModal from "./modal/AmountModal";
import TransferConfirmModal from "./modal/TransferConfirmModal";
import CheckStatusModal from "./modal/CheckStatusModal";
import displayDeviceAddress from "../utils/displayDeviceAddress";
import { parseDeviceCode } from "../utils/parseDeviceCode";
import { accountAPI, metricsAPII } from "../env/apiEndpoints";
import { bluetoothConfig } from "../env/bluetoothConfig";
import {
  fetchPriceChanges,
  fetchWalletBalance,
} from "./AssetsScreen/AssetsDataFetcher";
import { createHandleDevicePress } from "../utils/handleDevicePress";
import { scanDevices } from "../utils/scanDevices";
import createMonitorVerificationCode from "../utils/monitorVerificationCode";
import { createStopMonitoringVerificationCode } from "../utils/stopMonitoringVerificationCode";
import { bleCmd, frameBle, buildAuthVerifyText } from "../utils/bleProtocol";
import { handleDisconnectDeviceForVault } from "../utils/handleDisconnectDevice";
import { handleVerifyAddressForVault } from "../utils/handleVerifyAddress";
import { ensureDeviceReady } from "../utils/ensureDeviceReady";
import { detectNetwork, isBchChainName } from "../config/networkUtils";
import { resolveGasFeeSymbolForChain } from "../config/gasFeeToken";
import { fetchTransactionFee } from "../utils/fetchTransactionFee";
import { clearWalletOnPinTimeout } from "../utils/clearWalletOnPinTimeout";
import signTransaction from "./ActivityScreen/signTransaction";
import createMonitorSignedResult from "./ActivityScreen/monitorSignedResult";
import {
  ensureCryptoCardRuntimeFields,
  getRuntimeBalance,
  getRuntimeEstimatedValue,
  getRuntimePriceUsd,
} from "../utils/assetRuntimeFields";
import { resolveAssetIcon } from "../utils/assetIconResolver";
import { switchBchAddressTypeForCard } from "../utils/bchAddress";
import { isBtcCard, switchBtcAddressTypeForCard } from "../utils/btcAddress";
import { isLtcCard, switchLtcAddressTypeForCard } from "../utils/ltcAddress";
const FILE_NAME = "Assets.js";
const serviceUUID = bluetoothConfig.serviceUUID;
const writeCharacteristicUUID = bluetoothConfig.writeCharacteristicUUID;
const notifyCharacteristicUUID = bluetoothConfig.notifyCharacteristicUUID;

const buildPriceFetchFingerprint = (cards) =>
  (Array.isArray(cards) ? cards : [])
    .map((card) => {
      const chain = String(card?.queryChainName || "").trim().toLowerCase();
      const symbol = String(card?.shortName || "").trim().toUpperCase();
      return chain && symbol ? `${chain}:${symbol}` : "";
    })
    .filter(Boolean)
    .sort()
    .join("|");

const HIDDEN_CHAIN_NAMES = new Set(["juno", "okb"]);

const filterHiddenChains = (cards) =>
  (Array.isArray(cards) ? cards : []).filter(
    (card) =>
      !HIDDEN_CHAIN_NAMES.has(
        String(card?.queryChainName || "").trim().toLowerCase(),
      ),
  );

function VaultScreen({ route, navigation }) {
  const [receivedVerificationCode, setReceivedVerificationCode] = useState("");
  const [mainColor, setMainColor] = useState("#ffffff");
  const [secondaryColor, setSecondaryColor] = useState("#cccccc");
  const {
    exchangeRates,
    initialAdditionalCryptos,
    setInitialAdditionalCryptos,
    updateCryptoAddress,
    refreshBtcAddressData,
    additionalCryptos,
    setAdditionalCryptos,
    cryptoCount,
    setCryptoCount,
    currencyUnit,
    addedCryptos,
    setAddedCryptos,
    isVerificationSuccessful,
    setIsVerificationSuccessful,
    verifiedDevices,
    setVerifiedDevices,
    switchBchAddressType,
    switchBtcAddressType,
    switchLtcAddressType,
    cryptoCards,
    setCryptoCards,
    updateExchangeRates,
    addNotification,
  } = useContext(DeviceContext);
  let isDarkMode = route.params?.isDarkMode;
  const { isDarkMode: contextDarkMode } = useContext(DarkModeContext);
  if (contextDarkMode !== undefined) {
    isDarkMode = contextDarkMode;
  }
  const [CheckStatusModalVisible, setCheckStatusModalVisible] = useState(false);
  const [checkStatusProgress, setCheckStatusProgress] = useState(0);
  const [isCardEditMode, setIsCardEditMode] = useState(false);
  const exitEditRequested = !!route.params?.requestExitCardEdit;
  const showAddIconModalRequested = !!route.params?.showAddIconModal;
  const showDeleteConfirmModalRequested = !!route.params?.showDeleteConfirmModal;
  const requestBulkDelete = !!route.params?.requestBulkDelete;

  useEffect(() => {
    navigation?.setParams({ isCardEditMode });
  }, [isCardEditMode, navigation]);

  const VaultScreenStyle = VaultScreenStylesRoot(isDarkMode);
  const ActivityScreenStyle = ActivityScreenStylesRoot(isDarkMode);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("Prices");
  const [modalVisible, setModalVisible] = useState(false);
  const [hideOtherCards, setHideOtherCards] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [selectedCardChainShortName, setSelectedCardChainShortName] =
    useState(null);
  const [selectedCardName, setSelectedCardName] = useState(null);
  const [selectedCardChain, setSelectedCardChain] = useState(null);
  const [selectedDeleteCardKeys, setSelectedDeleteCardKeys] = useState([]);
  const [addIconModalVisible, setAddIconModalVisible] = useState(false);
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [isPreparingVerifyAddress, setIsPreparingVerifyAddress] =
    useState(false);
  const [hasVerifyAddressAttempted, setHasVerifyAddressAttempted] =
    useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [priceChanges, setPriceChanges] = useState({});
  const scrollViewRef = useRef();
  const blueToothColor = isDarkMode ? "#CCB68C" : "#CFAB95";

  useEffect(() => {
    if (!selectedCrypto || !Array.isArray(cryptoCards)) return;
    const selectedKey = [
      selectedCrypto?.queryChainName,
      selectedCrypto?.shortName,
      selectedCrypto?.name,
      selectedCrypto?.contractAddress || selectedCrypto?.tokenContractAddress,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .join("__");
    const nextSelected = cryptoCards.find((card) => {
      const cardKey = [
        card?.queryChainName,
        card?.shortName,
        card?.name,
        card?.contractAddress || card?.tokenContractAddress,
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .join("__");
      return cardKey === selectedKey;
    });
    if (!nextSelected || nextSelected === selectedCrypto) return;
    setSelectedCrypto(nextSelected);
    if (addressModalVisible && String(nextSelected?.address || "").trim()) {
      setSelectedAddress(String(nextSelected.address).trim());
    }
  }, [addressModalVisible, cryptoCards, selectedCrypto]);
  const iconColor = isDarkMode ? "#ffffff" : "#676776";
  const buttonBackgroundColor = isDarkMode ? "#CCB68C" : "#CFAB95";
  const disabledButtonBackgroundColor = isDarkMode ? "#6c6c6c" : "#ccc";
  const darkColorsDown = ["#21201E", "#0E0D0D"];
  const lightColorsDown = ["#ffffff", "#EDEBEF"];
  const [SecurityCodeModalVisible, setSecurityCodeModalVisible] =
    useState(false);
  const modalAnim = useAnimatedValue(0);
  const backgroundAnim = useAnimatedValue(0);
  const balanceAnim = useAnimatedValue(1);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [selectedCryptoIcon, setSelectedCryptoIcon] = useState(null);
  const cardRefs = useRef([]);
  const cardStartPositions = useRef([]);
  const scrollYOffset = useRef(0);
  const cardLayoutYRef = useRef([]);
  const pendingScrollIndexRef = useRef(null);
  const [ActivityLog, setActivityLog] = useState([]);
  const [processMessages, setProcessMessages] = useState([]);
  const [showLetsGoButton, setShowLetsGoButton] = useState(false);
  const [tabOpacity] = useState(new Animated.Value(0));
  const [tabReady, setTabReady] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [elevateDuringReturn, setElevateDuringReturn] = useState(false);
  const isScanningRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [bleModalMode, setBleModalMode] = useState("default");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const { verificationStatus, setVerificationStatus } =
    useContext(DeviceContext);
  const latestCryptoCardsRef = useRef([]);
  const lastPriceFetchFingerprintRef = useRef("");
  const addressRefreshTimerRef = useRef(null);
  const lastAddressFingerprintRef = useRef("");
  const isAutoBalanceRefreshingRef = useRef(false);
  const walletReadyRefreshTimerRef = useRef(null);
  const lastWalletReadyFingerprintRef = useRef("");
  const [blueToothStatus, setBlueToothStatus] = useState(null);
  const [createPendingModalVisible, setCreatePendingModalVisible] =
    useState(false);
  const [addressVerificationMessage, setAddressVerificationMessage] = useState(
    t("Verifying address on your device..."),
  );
  useEffect(() => {
    if (addressModalVisible) return;
    setIsPreparingVerifyAddress(false);
    setIsVerifyingAddress(false);
    setHasVerifyAddressAttempted(false);
    setAddressVerificationMessage(t("Verifying address on your device..."));
  }, [addressModalVisible, t]);

  const [sendContactModalVisible, setSendContactModalVisible] = useState(false);
  const [sendAmountModalVisible, setSendAmountModalVisible] = useState(false);
  const [sendConfirmModalVisible, setSendConfirmModalVisible] = useState(false);
  const [sendErrorModalVisible, setSendErrorModalVisible] = useState(false);
  const [sendErrorModalMessage, setSendErrorModalMessage] = useState("");
  const [sendSelectedCrypto, setSendSelectedCrypto] = useState("");
  const [sendSelectedCryptoIcon, setSendSelectedCryptoIcon] = useState(null);
  const [sendSelectedCryptoName, setSendSelectedCryptoName] = useState("");
  const [sendSelectedCryptoDecimals, setSendSelectedCryptoDecimals] =
    useState("");
  const [sendSelectedQueryChainName, setSendSelectedQueryChainName] =
    useState("");

  const {
    nftRouteAction,
    nftRoutePayload,
    clearNftRouteAction,
    openNftDetail,
  } = useNftRoute({ route, navigation });
  const [sendChainShortName, setSendChainShortName] = useState("");
  const [sendSelectedAddress, setSendSelectedAddress] = useState("");
  const [sendBalance, setSendBalance] = useState("");
  const [sendEstimatedValue, setSendEstimatedValue] = useState("");
  const [sendPriceUsd, setSendPriceUsd] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendInputAddress, setSendInputAddress] = useState("");
  const [sendDetectedNetwork, setSendDetectedNetwork] = useState("");
  const [sendIsAddressValid, setSendIsAddressValid] = useState(false);
  const [sendFee, setSendFee] = useState("");
  const [sendRapidFee, setSendRapidFee] = useState("");
  const [sendSelectedFeeTab, setSendSelectedFeeTab] = useState("Recommended");
  const [sendIsFeeLoading, setSendIsFeeLoading] = useState(false);
  const [, setSendIsDevicePrefetching] = useState(false);
  const [sendModalStatus, setSendModalStatus] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isBalanceSyncing, setIsBalanceSyncing] = useState(false);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [tabRefreshLoading, setTabRefreshLoading] = useState(false);
  // One-time counter that triggers Gallery NFT refresh (walletReady → +1 after balance refresh is completed)
  const [nftRefreshTick, setNftRefreshTick] = useState(0);
  // Numeric Freeze: Freeze numerical display during expansion/closing animation to avoid calculation and value transfer jitters
  const [freezeNumbers, setFreezeNumbers] = useState(false);
  // Snapshot of totals during freeze period
  const totalBalanceFreezeRef = useRef("0.00");
  const sendFeeValue = isNaN(parseFloat(sendFee)) ? 0 : parseFloat(sendFee);
  const sendRapidFeeValueNum = isNaN(parseFloat(sendRapidFee))
    ? 0
    : parseFloat(sendRapidFee);
  const sendPriceUsdNum = Number(sendPriceUsd) || 0;
  const sendRate = exchangeRates?.[currencyUnit] || 0;
  const sendRecommendedFee = sendFee;
  const sendRecommendedValue = (
    sendFeeValue *
    sendPriceUsdNum *
    sendRate
  ).toFixed(2);
  const sendRapidFeeValue = sendRapidFee;
  const sendRapidCurrencyValue = (
    sendRapidFeeValueNum *
    sendPriceUsdNum *
    sendRate
  ).toFixed(2);
  const logWorkflowBluetoothModalTrigger = React.useCallback(
    (trigger = {}) => {
      const verifiedIds = Array.isArray(verifiedDevices) ? verifiedDevices : [];
      const deviceList = Array.isArray(devices) ? devices : [];
      const verifiedDeviceDetails = verifiedIds.map((id) => {
        const matched = deviceList.find((device) => device?.id === id) || null;
        return {
          id,
          foundInDevices: !!matched,
          name: matched?.name || matched?.localName || null,
          rssi: matched?.rssi ?? null,
          isConnectedFn: typeof matched?.isConnected === "function",
        };
      });

      if (__DEV__) {
        console.log("[BLE_MODAL_TRIGGER][WORKFLOW]", {
          ts: Date.now(),
          trigger,
          blueToothStatus,
          isScanning,
          bleVisible,
          bleModalMode,
          addressModalVisible,
          sendContactModalVisible,
          sendAmountModalVisible,
          sendConfirmModalVisible,
          sendErrorModalVisible,
          selectedDeviceId: selectedDevice?.id || null,
          sendSelectedQueryChainName,
          sendInputAddress: String(sendInputAddress || "").trim(),
          verifiedDevices: verifiedIds,
          verifiedDeviceDetails,
          devicesLength: deviceList.length,
          devices: deviceList.map((device) => ({
            id: device?.id || null,
            name: device?.name || device?.localName || null,
            rssi: device?.rssi ?? null,
            isConnectedFn: typeof device?.isConnected === "function",
          })),
          sendDeviceReadyPrefetchResult:
            sendDeviceReadyPrefetchResultRef.current || null,
        });
      }
    },
    [
      addressModalVisible,
      bleModalMode,
      bleVisible,
      blueToothStatus,
      devices,
      isScanning,
      selectedDevice,
      sendAmountModalVisible,
      sendConfirmModalVisible,
      sendContactModalVisible,
      sendErrorModalVisible,
      sendInputAddress,
      sendSelectedQueryChainName,
      verifiedDevices,
    ],
  );
  useEffect(() => {
    if (
      !sendSelectedCrypto &&
      !sendSelectedCryptoName &&
      !sendSelectedQueryChainName &&
      !sendSelectedAddress
    ) {
      return;
    }

    const normalizedChain = String(sendSelectedQueryChainName || "")
      .trim()
      .toLowerCase();
    const normalizedShortName = String(sendSelectedCrypto || "")
      .trim()
      .toLowerCase();
    const normalizedName = String(sendSelectedCryptoName || "")
      .trim()
      .toLowerCase();
    const normalizedAddress = String(sendSelectedAddress || "")
      .trim()
      .toLowerCase();

    const matchedCard = (cryptoCards || []).find((card) => {
      const cardChain = String(card?.queryChainName || "")
        .trim()
        .toLowerCase();
      const cardShortName = String(card?.shortName || "")
        .trim()
        .toLowerCase();
      const cardName = String(card?.name || "")
        .trim()
        .toLowerCase();
      const cardAddress = String(card?.address || "")
        .trim()
        .toLowerCase();

      if (normalizedChain && cardChain !== normalizedChain) return false;
      if (normalizedAddress && cardAddress && cardAddress !== normalizedAddress) {
        return false;
      }
      if (normalizedShortName && cardShortName === normalizedShortName) return true;
      if (normalizedName && cardName === normalizedName) return true;
      return false;
    });

    if (!matchedCard) return;

    setSendBalance(getRuntimeBalance(matchedCard.balance));
    setSendEstimatedValue(
      getRuntimeEstimatedValue(matchedCard.EstimatedValue),
    );
    setSendPriceUsd(getRuntimePriceUsd(matchedCard.priceUsd));
  }, [
    cryptoCards,
    sendSelectedAddress,
    sendSelectedCrypto,
    sendSelectedCryptoName,
    sendSelectedQueryChainName,
  ]);
  const closeAllOverlayModals = React.useCallback(() => {
    setBleVisible(false);
    setAddressModalVisible(false);
    setChainSelectionModalVisible(false);
    setDeleteConfirmVisible(false);
    setSecurityCodeModalVisible(false);
    setCheckStatusModalVisible(false);
    setCreatePendingModalVisible(false);
    setImportingModalVisible(false);
    setSendContactModalVisible(false);
    setSendAmountModalVisible(false);
    setSendConfirmModalVisible(false);
    setSendErrorModalVisible(false);
    setAddIconModalVisible(false);
  }, []);
  const openExclusiveModal = React.useCallback(
    (openAction) => {
      closeAllOverlayModals();
      if (typeof openAction === "function") {
        openAction();
      }
    },
    [closeAllOverlayModals],
  );
  const openSendContactModal = React.useCallback(() => {
    openExclusiveModal(() => setSendContactModalVisible(true));
  }, [openExclusiveModal]);
  const showWorkflowBluetoothModal = React.useCallback((trigger = {}) => {
    logWorkflowBluetoothModalTrigger(trigger);
    setBleModalMode("workflow");
    openExclusiveModal(() => setBleVisible(true));
  }, [logWorkflowBluetoothModalTrigger, openExclusiveModal]);
  const hideBluetoothModal = React.useCallback(() => {
    setBleVisible(false);
    setBleModalMode("default");
  }, []);
  const showCheckStatusModal = React.useCallback(
    (next = true) => {
      if (next) {
        openExclusiveModal(() => setCheckStatusModalVisible(true));
        return;
      }
      setCheckStatusModalVisible(false);
    },
    [openExclusiveModal],
  );
  const showSendErrorModal = React.useCallback(
    (next = true) => {
      if (next) {
        openExclusiveModal(() => setSendErrorModalVisible(true));
        return;
      }
      setSendErrorModalVisible(false);
    },
    [openExclusiveModal],
  );
  const handleCardEditModeChange = React.useCallback((next) => {
    setIsCardEditMode(!!next);
  }, []);
  const handleExitEditHandled = React.useCallback(() => {
    navigation?.setParams({ requestExitCardEdit: false });
  }, [navigation]);
  const sendDeviceReadyPrefetchPromiseRef = useRef(null);
  const sendDeviceReadyPrefetchTokenRef = useRef(0);
  const sendDeviceReadyPrefetchResultRef = useRef(null);
  const resetSendDeviceReadyPrefetch = React.useCallback(() => {
    sendDeviceReadyPrefetchTokenRef.current += 1;
    sendDeviceReadyPrefetchPromiseRef.current = null;
    sendDeviceReadyPrefetchResultRef.current = null;
    setSendIsDevicePrefetching(false);
  }, []);
  const startSendDeviceReadyPrefetch = React.useCallback(() => {
    const currentToken = sendDeviceReadyPrefetchTokenRef.current + 1;
    sendDeviceReadyPrefetchTokenRef.current = currentToken;
    sendDeviceReadyPrefetchResultRef.current = null;
    setSendIsDevicePrefetching(true);
    const prefetchPromise = ensureDeviceReady({
      devices,
      verifiedDevices,
    })
      .catch(() => ({ ok: false, device: null }))
      .then((result) => {
        if (sendDeviceReadyPrefetchTokenRef.current !== currentToken) {
          return { ok: false, device: null, reason: "stale-prefetch" };
        }
        sendDeviceReadyPrefetchResultRef.current = result;
        return result;
      })
      .finally(() => {
        if (sendDeviceReadyPrefetchTokenRef.current === currentToken) {
          setSendIsDevicePrefetching(false);
        }
      });
    sendDeviceReadyPrefetchPromiseRef.current = prefetchPromise;
    return prefetchPromise;
  }, [devices, verifiedDevices]);
  const normalizedSendErrorMessage = String(
    sendErrorModalMessage || "",
  ).includes("This contract is not supported")
    ? "This contract is not supported."
    : sendErrorModalMessage;
  const sendSelectedProcessingFee =
    parseFloat(
      sendSelectedFeeTab === "Recommended" ? sendFee : sendRapidFee,
    ) || 0;
  const isSendXrpTransfer =
    String(sendSelectedCrypto || "").toUpperCase() === "XRP";
  const sendIsXrpMinAmountValid =
    !isSendXrpTransfer ||
    (parseFloat(sendAmount) || 0) >= 1 + sendSelectedProcessingFee;
  const sendIsAmountValid =
    sendAmount &&
    parseFloat(sendAmount) > 0 &&
    parseFloat(sendAmount) <= parseFloat(sendBalance) + sendFeeValue &&
    sendIsXrpMinAmountValid;
  const sendGasFeeSymbol = resolveGasFeeSymbolForChain(
    sendSelectedQueryChainName,
    cryptoCards,
  );
  const sendGasFeeCard = (cryptoCards || []).find((card) => {
    const chain = String(card?.queryChainName || "")
      .trim()
      .toLowerCase();
    const symbol = String(card?.shortName || "")
      .trim()
      .toLowerCase();
    return (
      chain ===
        String(sendSelectedQueryChainName || "")
          .trim()
          .toLowerCase() &&
      symbol === String(sendGasFeeSymbol || "").toLowerCase()
    );
  });
  const sendGasBalance = Number(sendGasFeeCard?.balance || 0);
  const sendIsGasBalanceInsufficient =
    !!sendGasFeeSymbol && (!Number.isFinite(sendGasBalance) || sendGasBalance <= 0);
  const sendGasFeeChainDisplay = String(sendSelectedQueryChainName || "").trim();
  const sendTxHash =
    verificationStatus === "txInit" ||
    verificationStatus === "success" ||
    verificationStatus === "fail"
      ? sendModalStatus?.txHash
      : null;

  const getDeleteCardKey = React.useCallback((card) => {
    if (!card) return "";
    const chain = String(
      card.queryChainName || card.queryChainShortName || "",
    ).toLowerCase();
    const name = String(card.name || card.shortName || "").toLowerCase();
    const address = String(card.address || "").toLowerCase();
    const contract = String(
      card.contractAddress ||
        card.contract_address ||
        card.tokenContractAddress ||
        "",
    ).toLowerCase();
    const mint = String(card.tokenId ?? card.mint ?? "").toLowerCase();
    return `${chain}|${name}|${address}|${contract}|${mint}`;
  }, []);

  const selectedDeleteCards = React.useMemo(() => {
    if (!Array.isArray(selectedDeleteCardKeys) || selectedDeleteCardKeys.length === 0)
      return [];
    const keySet = new Set(selectedDeleteCardKeys);
    return (cryptoCards || []).filter((card) => keySet.has(getDeleteCardKey(card)));
  }, [cryptoCards, getDeleteCardKey, selectedDeleteCardKeys]);

  const selectedDeleteCount = selectedDeleteCards.length;
  const selectedDeleteSummary = React.useMemo(() => {
    const labels = selectedDeleteCards.map((card) => {
      const name = card?.name || card?.shortName || t("Asset");
      const chain = card?.queryChainName || card?.queryChainShortName || "";
      return chain ? `${name} (${chain})` : name;
    });
    if (labels.length <= 3) return labels.join(", ");
    const head = labels.slice(0, 3).join(", ");
    return `${head} ${t("and {{count}} more", { count: labels.length - 3 })}`;
  }, [selectedDeleteCards, t]);

  const deleteConfirmMessage =
    selectedDeleteCount > 0
      ? selectedDeleteCount === 1
        ? t("This will remove 1 asset card: {{cards}}.", {
            cards: selectedDeleteSummary,
          })
        : t("This will remove {{count}} asset cards: {{cards}}.", {
            count: selectedDeleteCount,
            cards: selectedDeleteSummary,
          })
      : t("This asset card will be removed");

  const showMinAssetCardToast = React.useCallback(() => {
    if (typeof global.__SHOW_APP_TOAST__ !== "function") return;
    global.__SHOW_APP_TOAST__({
      message: t("At least one asset card must remain in your wallet."),
      variant: "cancel",
      durationMs: 1500,
      showCountdown: true,
    });
  }, [t]);

  useEffect(() => {
    console.log("[BATCH_DELETE][ASSETS] selected count =", selectedDeleteCount);
  }, [selectedDeleteCount]);

  useEffect(() => {
    navigation?.setParams({ selectedDeleteCount });
  }, [navigation, selectedDeleteCount]);

  useEffect(() => {
    if (
      verificationStatus &&
      !["txInit", "success", "fail"].includes(verificationStatus) &&
      sendModalStatus?.txHash
    ) {
      setSendModalStatus({});
    }
  }, [verificationStatus, sendModalStatus?.txHash]);

  useEffect(() => {
    if (!sendContactModalVisible) return;

    if (
      bleVisible ||
      addressModalVisible ||
      isChainSelectionModalVisible ||
      deleteConfirmVisible ||
      CheckStatusModalVisible ||
      sendAmountModalVisible ||
      sendConfirmModalVisible ||
      sendErrorModalVisible
    ) {
      setBleVisible(false);
      setAddressModalVisible(false);
      setChainSelectionModalVisible(false);
      setDeleteConfirmVisible(false);
      setCheckStatusModalVisible(false);
      setSendAmountModalVisible(false);
      setSendConfirmModalVisible(false);
      setSendErrorModalVisible(false);
    }
  }, [
    sendContactModalVisible,
    bleVisible,
    addressModalVisible,
    isChainSelectionModalVisible,
    deleteConfirmVisible,
    CheckStatusModalVisible,
    sendAmountModalVisible,
    sendConfirmModalVisible,
    sendErrorModalVisible,
  ]);

  const [isChainSelectionModalVisible, setChainSelectionModalVisible] =
    useState(false);
  const [galleryFilterCards, setGalleryFilterCards] = useState([]);
  const {
    selectedChain: walletSelectedChain,
    chainFilteredCards: walletChainFilteredCards,
    handleSelectChain: handleSelectWalletChain,
  } =
    useChainSelection({
      cryptoCards,
      setChainSelectionModalVisible,
      storageKey: "assetsWalletSelectedChain",
    });
  const {
    selectedChain: gallerySelectedChain,
    chainFilteredCards: galleryChainFilteredCards,
    handleSelectChain: handleSelectGalleryChain,
  } =
    useChainSelection({
      cryptoCards: galleryFilterCards,
      setChainSelectionModalVisible,
      storageKey: "assetsGallerySelectedChain",
    });

  const [selectedView, setSelectedView] = useState("wallet");
  const selectedChain =
    selectedView === "wallet" ? walletSelectedChain : gallerySelectedChain;
  const chainFilteredCards =
    selectedView === "wallet"
      ? walletChainFilteredCards
      : galleryChainFilteredCards;
  const chainSelectorCards =
    selectedView === "wallet" ? cryptoCards : galleryFilterCards;
  const handleSelectChain =
    selectedView === "wallet"
      ? handleSelectWalletChain
      : handleSelectGalleryChain;
  const { isModalVisible } = route.params || {};

  const [importingModalVisible, setImportingModalVisible] = useState(false);
  const restoreIdentifier = Constants.installationId;
  const [pinCode, setPinCode] = useState("");
  const [pinErrorMessage, setPinErrorMessage] = useState("");
  const {
    hideNumbers,
    setHideNumbers,
    hideNumbersByCard,
    getCardHideKey,
    toggleCardHideNumbers,
  } = useHideNumbers();

  const { handleCardLayout, scrollCardToTop, initCardPosition } =
    useCardLayout({
      cardLayoutYRef,
      pendingScrollIndexRef,
      scrollViewRef,
      cardStartPositions,
    });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchPriceChanges(
      cryptoCards,
      setPriceChanges,
      setCryptoCards,
      setRefreshing,
      updateExchangeRates,
    );
    fetchWalletBalance(cryptoCards, setCryptoCards, {
      source: "pullToRefresh",
      verificationStatus,
    });
  }, [cryptoCards, updateExchangeRates, verificationStatus]);

  const refreshCardBalance = React.useCallback(
    async (card) => {
      if (!card) return;
      try {
        await fetchWalletBalance([card], setCryptoCards, {
          source: "singleCardRefresh",
          verificationStatus,
        });
      } catch (e) {
        console.log("[Vault] refreshCardBalance failed:", e?.message || e);
      }
    },
    [setCryptoCards, verificationStatus],
  );

  const { bleManagerRef } = useContext(DeviceContext);

  const [bleVisible, setBleVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    let subscription = null;

    const syncBluetoothState = async () => {
      try {
        const state = await bleManagerRef.current?.state?.();
        if (mounted) {
          setBlueToothStatus(state ?? null);
        }
      } catch {}
    };

    syncBluetoothState();

    try {
      subscription = bleManagerRef.current?.onStateChange?.((state) => {
        if (mounted) {
          setBlueToothStatus(state ?? null);
        }
      }, true);
    } catch {}

    return () => {
      mounted = false;
      try {
        subscription?.remove?.();
      } catch {}
    };
  }, [bleManagerRef]);

  useEffect(() => {
    if (!bleVisible) {
      setBleModalMode("default");
    }
  }, [bleVisible]);

  // Automatic Bluetooth scanning: Automatically scan devices when bleVisible becomes true
  useEffect(() => {
    if (bleVisible) {
      scanDevices({ isScanning, setIsScanning, bleManagerRef, setDevices });
    }
  }, [bleVisible]);

  const handleBluetoothRefresh = React.useCallback(() => {
    if (isScanning) {
      try {
        bleManagerRef.current?.stopDeviceScan?.();
      } catch {}
      setIsScanning(false);
    }

    setTimeout(() => {
      scanDevices({
        isScanning: false,
        setIsScanning,
        bleManagerRef,
        setDevices,
      });
    }, 100);
  }, [bleManagerRef, isScanning, setDevices]);

  // Warm-up: When the address pop-up window opens, try to obtain an instance of the "verified device" in advance or perform a silent scan to increase the speed of subsequent verification.
  useEffect(() => {
    let cancelled = false;
    const prewarmDevice = async () => {
      try {
        if (!addressModalVisible) return;
        if (isPreparingVerifyAddress || isVerifyingAddress) {
          return;
        }

        const targetId =
          Array.isArray(verifiedDevices) && verifiedDevices.length > 0
            ? verifiedDevices[0]
            : null;

        if (targetId && bleManagerRef?.current) {
          // If the device does not yet exist in devices, try to restore the Device instance from the native layer (no need to pop up the Bluetooth pop-up window)
          const exists = (devices || []).some((d) => d?.id === targetId);
          if (!exists) {
            try {
              const arr =
                (await bleManagerRef.current.devices([targetId])) || [];
              const candidate = arr[0];
              if (candidate && !cancelled) {
                setDevices((prev) => {
                  const idx = prev.findIndex((d) => d.id === candidate.id);
                  if (idx === -1) return [...prev, candidate];
                  const next = [...prev];
                  next[idx] = candidate;
                  return next;
                });
                return;
              }
            } catch {}
            try {
              const conns =
                (await bleManagerRef.current.connectedDevices([serviceUUID])) ||
                [];
              const found = conns.find((d) => d.id === targetId);
              if (found && !cancelled) {
                setDevices((prev) => {
                  const idx = prev.findIndex((d) => d.id === found.id);
                  if (idx === -1) return [...prev, found];
                  const next = [...prev];
                  next[idx] = found;
                  return next;
                });
                return;
              }
            } catch {}
          }
        }

        // If there is still no device and it is not currently being scanned, perform a "silent scan" to ensure that communication can be quickly established when "Verify Address" is clicked.
        if (!isScanning) {
          scanDevices({
            isScanning,
            setIsScanning,
            bleManagerRef,
            setDevices,
            scanDuration: 4000,
          });
        }
      } catch {}
    };
    prewarmDevice();
    return () => {
      cancelled = true;
    };
  }, [
    addressModalVisible,
    verifiedDevices,
    devices,
    isScanning,
    isPreparingVerifyAddress,
    isVerifyingAddress,
  ]);

  useLayoutEffect(() => {
    if (cryptoCards.length === 0) {
      setSelectedView("wallet");
    }
    navigation.setOptions({
      headerTitleAlign: "center",
      headerTitle: () =>
        !isModalVisible && !isCardEditMode && cryptoCards.length > 0 ? (
          <VaultHeaderToggle
            selectedView={selectedView}
            onSelect={setSelectedView}
            isDarkMode={isDarkMode}
            t={t}
          />
        ) : null,
    });
  }, [
    navigation,
    selectedView,
    isDarkMode,
    isModalVisible,
    isCardEditMode,
    t,
    cryptoCards.length,
  ]);

  useEffect(() => {
    setAddedCryptos(cryptoCards);
  }, [cryptoCards]);


  useEffect(() => {
    if (!bleVisible && selectedDevice) {
      openExclusiveModal(() => setSecurityCodeModalVisible(true));
    }
  }, [bleVisible, selectedDevice, openExclusiveModal]);

  useEffect(() => {
    // When the asset card or view state changes, update route.params for header use
    navigation.setParams({ cryptoCards, selectedCardName, selectedView });
  }, [cryptoCards, navigation, selectedCardName, selectedView]);

  useEffect(() => {
    // TabView is only forcibly hidden when collapsed, and is displayed after the card displacement is completed when expanded.
    if (!modalVisible) {
      try {
        tabOpacity.stopAnimation && tabOpacity.stopAnimation();
      } catch {}
      try {
        tabOpacity.setValue(0);
      } catch {}
      setTabReady(false);
    }
  }, [modalVisible]);

  useEffect(() => {
    latestCryptoCardsRef.current = Array.isArray(cryptoCards) ? cryptoCards : [];
  }, [cryptoCards]);

  useEffect(() => {
    const cards = Array.isArray(cryptoCards) ? cryptoCards : [];
    if (
      verificationStatus === "waiting" ||
      verificationStatus === "walletReady"
    ) {
      return undefined;
    }
    const fingerprint = cards
      .map((card) => {
        const chain = String(card?.queryChainName || "").trim().toLowerCase();
        const address = String(card?.address || "").trim().toLowerCase();
        return chain && address ? `${chain}:${address}` : "";
      })
      .filter(Boolean)
      .sort()
      .join("|");

    if (!fingerprint || fingerprint === lastAddressFingerprintRef.current) {
      return undefined;
    }

    lastAddressFingerprintRef.current = fingerprint;
    setIsBalanceSyncing(true);

    if (addressRefreshTimerRef.current) {
      clearTimeout(addressRefreshTimerRef.current);
      addressRefreshTimerRef.current = null;
    }

    addressRefreshTimerRef.current = setTimeout(async () => {
      if (isAutoBalanceRefreshingRef.current) return;
      isAutoBalanceRefreshingRef.current = true;
      setIsBalanceSyncing(true);
      try {
        await fetchWalletBalance(cards, setCryptoCards, {
          source: "addressAutoRefresh",
          verificationStatus,
        });
      } finally {
        isAutoBalanceRefreshingRef.current = false;
        setIsBalanceSyncing(false);
      }
    }, 250);

    return () => {
      if (addressRefreshTimerRef.current) {
        clearTimeout(addressRefreshTimerRef.current);
        addressRefreshTimerRef.current = null;
      }
    };
  }, [cryptoCards, setCryptoCards, verificationStatus]);

  useEffect(() => {
    const loadCryptoCards = async () => {
      setIsInitialLoading(true);
      try {
        const storedCards = await AsyncStorage.getItem("cryptoCards");
        if (storedCards !== null) {
          const parsedCards = filterHiddenChains(
            (JSON.parse(storedCards) || []).map((card) =>
              ensureCryptoCardRuntimeFields(card),
            ),
          );
          setCryptoCards(parsedCards);
          setAddedCryptos(parsedCards);
          if (parsedCards.length > 0) {
            setIsBalanceSyncing(true);
            try {
              await fetchWalletBalance(parsedCards, setCryptoCards, {
                source: "loadCryptoCards",
                verificationStatus,
              });
            } finally {
              setIsBalanceSyncing(false);
            }
          }
        }
      } catch (error) {
        console.log("Error loading crypto cards:", error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadCryptoCards();
  }, []);

  useEffect(() => {
    const saveCryptoCards = async () => {
      try {
        await AsyncStorage.setItem("cryptoCards", JSON.stringify(cryptoCards));
        await AsyncStorage.setItem("addedCryptos", JSON.stringify(cryptoCards));
        //  console.log("Updated addedCryptos wallet page:", cryptoCards); // Print updated addedCryptos
      } catch (error) {
        console.log("Error saving crypto cards:", error);
      }
    };
    saveCryptoCards();
  }, [cryptoCards]);

  useEffect(() => {
    const nextFingerprint = buildPriceFetchFingerprint(cryptoCards);
    if (nextFingerprint === lastPriceFetchFingerprintRef.current) {
      return;
    }
    lastPriceFetchFingerprintRef.current = nextFingerprint;
    const fetchPriceData = async () => {
      setIsPriceLoading(true);
      try {
        await fetchPriceChanges(
          cryptoCards,
          setPriceChanges,
          setCryptoCards,
          setRefreshing,
          updateExchangeRates,
        );
      } finally {
        setIsPriceLoading(false);
      }
    };

    fetchPriceData();
  }, [cryptoCards]);

  useEffect(() => {
    if (!SecurityCodeModalVisible) {
      stopMonitoringVerificationCode();
    }
  }, [SecurityCodeModalVisible]);

  useEffect(() => {
    if (verificationStatus !== "walletReady") return;

    const defaultCardChains = new Set(["ethereum", "bitcoin", "solana", "tron"]);
    const seededCards = (Array.isArray(initialAdditionalCryptos)
      ? initialAdditionalCryptos
      : []
    )
      .filter((card) =>
        defaultCardChains.has(String(card?.queryChainName || "").trim().toLowerCase()),
      )
      .filter(
        (card) => String(card?.coin_type || "").trim().toLowerCase() === "native",
      )
      .filter((card) => String(card?.address || "").trim() !== "")
      .map((card) => ensureCryptoCardRuntimeFields(card));

    if (seededCards.length === 0) return;

    setCryptoCards((prevCards) => {
      const prev = Array.isArray(prevCards) ? prevCards : [];
      const seen = new Set(
        prev.map((card) => {
          const chain = String(card?.queryChainName || "").trim().toLowerCase();
          const symbol = String(card?.shortName || "").trim().toUpperCase();
          const address = String(card?.address || "").trim().toLowerCase();
          return `${chain}:${symbol}:${address}`;
        }),
      );
      let changed = false;
      const next = [...prev];

      seededCards.forEach((card) => {
        const chain = String(card?.queryChainName || "").trim().toLowerCase();
        const symbol = String(card?.shortName || "").trim().toUpperCase();
        const address = String(card?.address || "").trim().toLowerCase();
        const key = `${chain}:${symbol}:${address}`;
        if (!chain || !symbol || !address || seen.has(key)) return;
        seen.add(key);
        next.push(card);
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [initialAdditionalCryptos, setCryptoCards, verificationStatus]);

  useEffect(() => {
    if (verificationStatus === "walletReady") {
      if (walletReadyRefreshTimerRef.current) {
        clearTimeout(walletReadyRefreshTimerRef.current);
        walletReadyRefreshTimerRef.current = null;
      }
      walletReadyRefreshTimerRef.current = setTimeout(async () => {
        const cardsForRefresh = Array.isArray(latestCryptoCardsRef.current)
          ? latestCryptoCardsRef.current
          : [];
        const fingerprint = cardsForRefresh
          .map((card) => {
            const chain = String(card?.queryChainName || "").trim().toLowerCase();
            const address = String(card?.address || "").trim().toLowerCase();
            return chain && address ? `${chain}:${address}` : "";
          })
          .filter(Boolean)
          .sort()
          .join("|");
        if (
          fingerprint &&
          fingerprint === lastWalletReadyFingerprintRef.current
        ) {
          return;
        }
        lastWalletReadyFingerprintRef.current = fingerprint;
        setIsBalanceSyncing(true);
        try {
          await fetchWalletBalance(cardsForRefresh, setCryptoCards, {
            source: "walletReady",
            verificationStatus,
            bypassInflightReuse: true,
          });
          setNftRefreshTick((t) => t + 1);
        } finally {
          setIsBalanceSyncing(false);
        }
      }, 120);
    }
    return () => {
      if (walletReadyRefreshTimerRef.current) {
        clearTimeout(walletReadyRefreshTimerRef.current);
        walletReadyRefreshTimerRef.current = null;
      }
    };
  }, [
    setCryptoCards,
    verificationStatus,
  ]);

  useEffect(() => {
    if (verificationStatus !== "walletReady") {
      lastWalletReadyFingerprintRef.current = "";
    }
  }, [verificationStatus]);

  useEffect(() => {
    if (showAddIconModalRequested) {
      openExclusiveModal(() => setAddIconModalVisible(true));
    }
    if (showDeleteConfirmModalRequested) {
      openExclusiveModal(() => setDeleteConfirmVisible(true));
    } else {
      setDeleteConfirmVisible(false);
    }
  }, [
    openExclusiveModal,
    showAddIconModalRequested,
    showDeleteConfirmModalRequested,
  ]);

  useEffect(() => {
    if (!requestBulkDelete) return;
    if (isCardEditMode && selectedDeleteCount > 0) {
      openExclusiveModal(() => setDeleteConfirmVisible(true));
      navigation?.setParams({ showDeleteConfirmModal: true });
    }
    navigation?.setParams({ requestBulkDelete: false });
  }, [
    isCardEditMode,
    navigation,
    openExclusiveModal,
    requestBulkDelete,
    selectedDeleteCount,
  ]);

  useEffect(() => {
    if (isCardEditMode) return;
    if (selectedDeleteCardKeys.length === 0) return;
    setSelectedDeleteCardKeys([]);
  }, [isCardEditMode, selectedDeleteCardKeys.length]);

  useEffect(() => {
    setCryptoCount(cryptoCards.length);
  }, [cryptoCards.length]);

  useEffect(() => {
    navigation.setParams({
      isModalVisible: modalVisible,
    });
  }, [modalVisible]);

  // Listen for the close request from the "X" button in the App.js header (trigger source C)
  useEffect(() => {
    if (route?.params?.requestCloseModal) {
      // Perform animated shutdown
      closeModal();
      // Clean routing parameters to avoid repeated triggering
      navigation.setParams({ requestCloseModal: false, isModalVisible: false });
    }
  }, [route?.params?.requestCloseModal]);
  const getConvertedBalance = (
    cardBalance,
    cardShortName,
    context = "Vault",
  ) => {
    const numericBalance = Number(cardBalance);
    if (!Number.isFinite(numericBalance)) {
      console.log(
        `[Vault][getConvertedBalance] non-finite asset balance, using default 0.00 -- card=${cardShortName}, context=${context}, raw=${cardBalance}`,
      );
      return "0.00";
    }

    const fiatRate = Number(exchangeRates[currencyUnit] ?? 0);
    if (!Number.isFinite(fiatRate) || fiatRate <= 0) {
      console.log(
        `[Vault][getConvertedBalance] invalid fiat exchange rate, using default 0.00 -- card=${cardShortName}, context=${context}, fiatRate=${exchangeRates[currencyUnit]}`,
      );
      return "0.00";
    }

    const priceFromTicker = Number(
      priceChanges[cardShortName]?.priceChange ?? 0,
    );
    const priceFromCache = Number(exchangeRates[cardShortName] ?? 0);
    const candidateCoinUsdPrice =
      priceFromTicker > 0
        ? priceFromTicker
        : priceFromCache > 0
          ? priceFromCache
          : 1;
    const coinUsdPrice = Number(candidateCoinUsdPrice);

    if (!Number.isFinite(coinUsdPrice) || coinUsdPrice <= 0) {
      console.log(
        `[Vault][getConvertedBalance] invalid asset price, using default 0.00 -- card=${cardShortName}, context=${context}, ticker=${priceFromTicker}, cache=${priceFromCache}`,
      );
      return "0.00";
    }

    const usdBalance = numericBalance * coinUsdPrice;
    const finalBalanceNum = usdBalance * fiatRate;

    if (!Number.isFinite(finalBalanceNum)) {
      console.log(
        `[Vault][getConvertedBalance] non-finite computed result, using default 0.00 -- card=${cardShortName}, context=${context}, balance=${numericBalance}, coinUsdPrice=${coinUsdPrice}, fiatRate=${fiatRate}`,
      );
      return "0.00";
    }

    return finalBalanceNum.toFixed(2);
  };

  const monitorVerificationCodeRef = useRef(monitorVerificationCode);
  useEffect(() => {
    monitorVerificationCodeRef.current = monitorVerificationCode;
  }, [monitorVerificationCode]);

  const handleDevicePress = createHandleDevicePress({
    setReceivedAddresses: () => {},
    setVerificationStatus: () => {},
    setSelectedDevice,
    setBleVisible,
    monitorVerificationCode: (...args) =>
      monitorVerificationCodeRef.current?.(...args),
    setSecurityCodeModalVisible,
    serviceUUID,
    writeCharacteristicUUID,
    Buffer,
    setModalVisible,
    setReceivedVerificationCode,
    setPinCode,
    setPinErrorMessage,
    // Pass in bleManagerRef to restore the native Device instance by id if necessary
    bleManagerRef,
    openExclusiveModal,
  });

  const handleCancelBluetooth = () => {
    console.log("[BluetoothModal] handleCancel (Assets.js)");
    try {
      bleManagerRef?.current?.stopDeviceScan?.();
    } catch {}
    setIsScanning(false);
    hideBluetoothModal();
    setSelectedDevice(null);
  };
  const handleRecoveredWorkflowDevice = React.useCallback(() => {
    try {
      bleManagerRef?.current?.stopDeviceScan?.();
    } catch {}
    setIsScanning(false);
    hideBluetoothModal();
    setSelectedDevice(null);
    if (typeof global.__SHOW_APP_TOAST__ === "function") {
      global.__SHOW_APP_TOAST__({
        message: t("Device reconnected. Please continue."),
        variant: "success",
        durationMs: 2200,
        showCountdown: true,
      });
    }
  }, [bleManagerRef, hideBluetoothModal, t]);

  // Logic to handle disconnection

  const { handleQRCodePress, handleReceivePress } = useReceiveModal({
    setSelectedCrypto,
    setSelectedAddress,
    setSelectedCryptoIcon,
    setSelectedCardChainShortName,
    setIsVerifyingAddress,
    setAddressModalVisible,
    openExclusiveModal,
  });

  const handleSwitchBchAddressType = React.useCallback(
    (nextType) => {
      const fallbackAddress =
        typeof switchBchAddressType === "function"
          ? switchBchAddressType(nextType)
          : "";

      const nextSelected = selectedCrypto
        ? switchBchAddressTypeForCard(selectedCrypto, nextType)
        : null;
      const nextAddress = String(
        nextSelected?.address || fallbackAddress || "",
      ).trim();

      if (nextSelected) {
        setSelectedCrypto(nextSelected);
      }
      if (nextAddress) {
        setSelectedAddress(nextAddress);
        if (isBchChainName(sendSelectedQueryChainName)) {
          setSendSelectedAddress(nextAddress);
        }
      }
    },
    [
      selectedCrypto,
      sendSelectedQueryChainName,
      setSendSelectedAddress,
      switchBchAddressType,
    ],
  );

  const handleSwitchBtcAddressType = React.useCallback(
    (nextType) => {
      const fallbackAddress =
        typeof switchBtcAddressType === "function"
          ? switchBtcAddressType(nextType)
          : "";

      const nextSelected = selectedCrypto
        ? switchBtcAddressTypeForCard(selectedCrypto, nextType)
        : null;
      const nextAddress = String(
        nextSelected?.address || fallbackAddress || "",
      ).trim();

      if (nextSelected) {
        setSelectedCrypto(nextSelected);
      }
      if (nextAddress) {
        setSelectedAddress(nextAddress);
        if (isBtcCard(nextSelected) || isBtcCard(selectedCrypto)) {
          setSendSelectedAddress(nextAddress);
        }
      }
    },
    [
      selectedCrypto,
      setSendSelectedAddress,
      switchBtcAddressType,
    ],
  );

  const handleSwitchLtcAddressType = React.useCallback(
    (nextType) => {
      const fallbackAddress =
        typeof switchLtcAddressType === "function"
          ? switchLtcAddressType(nextType)
          : "";

      const nextSelected = selectedCrypto
        ? switchLtcAddressTypeForCard(selectedCrypto, nextType)
        : null;
      const nextAddress = String(
        nextSelected?.address || fallbackAddress || "",
      ).trim();

      if (nextSelected) {
        setSelectedCrypto(nextSelected);
      }
      if (nextAddress) {
        setSelectedAddress(nextAddress);
        if (isLtcCard(nextSelected) || isLtcCard(selectedCrypto)) {
          setSendSelectedAddress(nextAddress);
        }
      }
    },
    [
      selectedCrypto,
      setSendSelectedAddress,
      switchLtcAddressType,
    ],
  );

  const handleSendPress = React.useCallback(
    async (crypto) => {
      if (!crypto) return;
      setSendSelectedCrypto(crypto.shortName || "");
      setSendSelectedCryptoName(crypto.name || "");
      setSendSelectedCryptoDecimals(crypto.Decimals ?? crypto.decimals ?? "");
      setSendSelectedCryptoIcon(resolveAssetIcon(crypto));
      setSendSelectedQueryChainName(crypto.queryChainName || "");
      setSendChainShortName(crypto.queryChainShortName || "");
      setSendSelectedAddress(crypto.address || "");
      setSendBalance(getRuntimeBalance(crypto.balance));
      setSendEstimatedValue(getRuntimeEstimatedValue(crypto.EstimatedValue));
      setSendPriceUsd(getRuntimePriceUsd(crypto.priceUsd));
      setSendFee(crypto.fee || "");
      setSendRapidFee("");
      setSendAmount("");
      setSendInputAddress("");
      setSendDetectedNetwork("");
      setSendIsAddressValid(false);
      setSendSelectedFeeTab("Recommended");
      setSendModalStatus({});
      setSendErrorModalVisible(false);
      openSendContactModal();
      resetSendDeviceReadyPrefetch();
      startSendDeviceReadyPrefetch();
    },
    [
      openSendContactModal,
      resetSendDeviceReadyPrefetch,
      startSendDeviceReadyPrefetch,
      setSendSelectedCrypto,
      setSendSelectedCryptoName,
      setSendSelectedCryptoDecimals,
      setSendSelectedCryptoIcon,
      setSendSelectedQueryChainName,
      setSendChainShortName,
      setSendSelectedAddress,
      setSendBalance,
      setSendEstimatedValue,
      setSendPriceUsd,
      setSendFee,
      setSendRapidFee,
      setSendAmount,
      setSendInputAddress,
      setSendDetectedNetwork,
      setSendIsAddressValid,
      setSendSelectedFeeTab,
      setSendModalStatus,
      setSendErrorModalVisible,
    ],
  );

  const handleSendAddressChange = (text) => {
    const sanitizedAddress = String(text || "").replace(/\s+/g, "");
    setSendInputAddress(sanitizedAddress);
    const network = detectNetwork(sanitizedAddress, sendSelectedQueryChainName);
    setSendDetectedNetwork(network);
    setSendIsAddressValid(network !== "Invalid address");
  };

  const handleSendNextAfterAddress = async () => {
    const cachedPrefetchResult = sendDeviceReadyPrefetchResultRef.current;
    if (cachedPrefetchResult && !cachedPrefetchResult.ok) {
      showWorkflowBluetoothModal({
        source: "handleSendNextAfterAddress.cachedPrefetchResult",
        reason: cachedPrefetchResult?.reason || "prefetch-not-ok",
        cachedPrefetchResult,
      });
      return;
    }

    let didOpenBleFallback = false;
    const bleFallbackTimer = setTimeout(() => {
      didOpenBleFallback = true;
      showWorkflowBluetoothModal({
        source: "handleSendNextAfterAddress.bleFallbackTimer",
        reason: "prefetch-timeout",
        timeoutMs: 600,
      });
    }, 600);

    try {
      const prefetchPromise =
        sendDeviceReadyPrefetchPromiseRef.current ||
        startSendDeviceReadyPrefetch();
      const { ok } = await prefetchPromise;

      if (!ok) {
        if (!didOpenBleFallback) {
          showWorkflowBluetoothModal({
            source: "handleSendNextAfterAddress.prefetchPromise",
            reason:
              sendDeviceReadyPrefetchResultRef.current?.reason ||
              "prefetch-not-ok",
            prefetchResult: sendDeviceReadyPrefetchResultRef.current || null,
          });
        }
        return;
      }

      resetSendDeviceReadyPrefetch();
      setSendAmount("");
      if (!didOpenBleFallback) {
        setSendContactModalVisible(false);
      }

      try {
        setSendIsFeeLoading(true);
        fetchTransactionFee({
          selectedQueryChainName: sendSelectedQueryChainName,
          setFee: setSendFee,
          setRapidFee: setSendRapidFee,
          accountAPI,
        }).finally(() => setSendIsFeeLoading(false));
      } catch (e) {
        setSendIsFeeLoading(false);
      }

      setTimeout(() => {
        openExclusiveModal(() => setSendAmountModalVisible(true));
      }, didOpenBleFallback ? 120 : 400);
    } finally {
      clearTimeout(bleFallbackTimer);
    }
  };

  const handleSendNextAfterAmount = () => {
    if (!sendIsAmountValid) return;
    if (sendIsGasBalanceInsufficient) {
      if (typeof global.__SHOW_APP_TOAST__ === "function") {
        global.__SHOW_APP_TOAST__({
          message: t("You don't have enough {{symbol}} to cover the network fee on {{chain}}.", {
            symbol: String(sendGasFeeSymbol || "").toUpperCase() || t("Network Fee"),
            chain: sendGasFeeChainDisplay || t("this network"),
          }),
          variant: "cancel",
          durationMs: 3000,
          showCountdown: true,
        });
      }
      return;
    }
    openExclusiveModal(() => setSendConfirmModalVisible(true));
  };

  const [receivedAddresses, setReceivedAddresses] = useState({});
  const [receivedPubKeys, setReceivedPubKeys] = useState({});

  const monitorSubscription = useRef(null);

  const monitorVerificationCode = createMonitorVerificationCode({
    serviceUUID,
    notifyCharacteristicUUID,
    prefixToShortName,
    updateCryptoAddress,
    setReceivedAddresses,
    setVerificationStatus,
    parseDeviceCode,
    setReceivedVerificationCode,
    setReceivedPubKeys,
    onBtcPubkeySynced: refreshBtcAddressData,
    Buffer,
    writeCharacteristicUUID,
    bleManagerRef,
    onSyncTimeoutReset: async () => {
      await clearWalletOnPinTimeout({
        setCryptoCards,
        setAddedCryptos,
        setInitialAdditionalCryptos,
        setAdditionalCryptos,
        setCryptoCount,
        setVerifiedDevices,
        setIsVerificationSuccessful,
        setVerificationStatus,
        keepVerificationStatus: true,
        initialAdditionalCryptos,
      });
    },
    onPwdCancel: () => {
      setSecurityCodeModalVisible(false);
      setPinCode("");
      setPinErrorMessage("");
    },
  });

  const reconnectDevice = async (device) => {
    try {
      await device.cancelConnection();
      await device.connect();
      await device.discoverAllServicesAndCharacteristics();
    } catch (error) {
      console.log("Device failed to reconnect:", error);
    }
  };

  const getSendNotificationMeta = React.useCallback(
    () => ({
      amount: sendAmount,
      unit: sendSelectedCrypto,
      from: sendSelectedAddress,
      to: sendInputAddress,
    }),
    [sendAmount, sendSelectedCrypto, sendSelectedAddress, sendInputAddress],
  );

  const sendMonitorSignedResult = React.useMemo(
    () =>
      createMonitorSignedResult({
        setModalStatus: setSendModalStatus,
        t,
        reconnectDevice,
        selectedAddress: sendSelectedAddress,
        monitorSubscription,
        addNotification,
        getNotificationMeta: getSendNotificationMeta,
        setVerificationStatus,
        setCheckStatusModalVisible: showCheckStatusModal,
        setErrorModalVisible: showSendErrorModal,
        setErrorModalMessage: setSendErrorModalMessage,
        isDarkMode,
      }),
    [
      setSendModalStatus,
      t,
      sendSelectedAddress,
      addNotification,
      getSendNotificationMeta,
      setVerificationStatus,
      showCheckStatusModal,
      showSendErrorModal,
      setSendErrorModalMessage,
      isDarkMode,
    ],
  );

  // Create a stop listening function using a public utility function
  const stopMonitoringVerificationCode =
    createStopMonitoringVerificationCode(monitorSubscription);

  // handlePinSubmit has been moved to utils/handlePinSubmit.js
  const handlePinSubmit = React.useMemo(
    () =>
      createHandlePinSubmit({
        setSecurityCodeModalVisible,
        setCheckStatusModalVisible,
        setVerificationStatus,
        setVerifiedDevices,
        setIsVerificationSuccessful,
        setPinCode,
        setPinErrorMessage,
        setReceivedAddresses,
        prefixToShortName,
        monitorVerificationCode,
        serviceUUID,
        writeCharacteristicUUID,
        openExclusiveModal,
        debugSource: "Vault",
      }),
    [
      setSecurityCodeModalVisible,
      setCheckStatusModalVisible,
      setVerificationStatus,
      setVerifiedDevices,
      setIsVerificationSuccessful,
      setPinCode,
      setPinErrorMessage,
      setReceivedAddresses,
      prefixToShortName,
      monitorVerificationCode,
      serviceUUID,
      writeCharacteristicUUID,
      openExclusiveModal,
    ],
  );

  const handlePinSubmitProxy = React.useCallback(() => {
    handlePinSubmit({
      receivedVerificationCode,
      pinCode,
      selectedDevice,
      receivedAddresses,
    });
  }, [
    handlePinSubmit,
    receivedVerificationCode,
    pinCode,
    selectedDevice,
    receivedAddresses,
  ]);

  const pinTimeoutRef = useRef(null);
  useEffect(() => {
    if (!SecurityCodeModalVisible || receivedVerificationCode) {
      if (pinTimeoutRef.current) {
        clearTimeout(pinTimeoutRef.current);
        pinTimeoutRef.current = null;
      }
      return;
    }
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
    }
    pinTimeoutRef.current = setTimeout(async () => {
      if (!SecurityCodeModalVisible || receivedVerificationCode) return;
      try {
        setPinErrorMessage(`pin_timeout:${Date.now()}`);
      } catch {}
      try {
        setPinCode("");
      } catch {}
      console.log("[PIN_TIMEOUT] Vault -> clearWalletOnPinTimeout");
      await clearWalletOnPinTimeout({
        setCryptoCards,
        setAddedCryptos,
        setInitialAdditionalCryptos,
        setAdditionalCryptos,
        setCryptoCount,
        setVerifiedDevices,
        setIsVerificationSuccessful,
        setVerificationStatus,
        initialAdditionalCryptos,
      });
      try {
        monitorVerificationCode?.cancel?.();
      } catch {}
      try {
        stopMonitoringVerificationCode();
      } catch {}
      try {
        const target = selectedDevice;
        const isConnected = await target?.isConnected?.();
        if (isConnected) {
          await target.cancelConnection();
        }
      } catch (error) {
        console.log("PIN timeout cancel connection failed:", error);
      }
    }, 10000);
    return () => {
      if (pinTimeoutRef.current) {
        clearTimeout(pinTimeoutRef.current);
        pinTimeoutRef.current = null;
      }
    };
  }, [
    SecurityCodeModalVisible,
    receivedVerificationCode,
    selectedDevice,
    setPinErrorMessage,
    setPinCode,
    monitorVerificationCode,
    stopMonitoringVerificationCode,
  ]);

  const resendPairingRequest = React.useCallback(
    async (device) => {
      let target = device || selectedDevice;
      if (!target) return;
      console.log("[PAIRING][retry] start", target?.id || "unknown");
      try {
        if (!target || typeof target.connect !== "function") {
          const manager = bleManagerRef?.current;
          if (manager && target?.id) {
            const list = await manager.devices([target.id]);
            if (Array.isArray(list) && list[0]) target = list[0];
          }
          if (manager && target?.id) {
            const conns = await manager.connectedDevices([serviceUUID]);
            const found = (conns || []).find((d) => d.id === target.id);
            if (found) target = found;
          }
        }
      } catch {}
      console.log(
        "[PAIRING][retry] device resolved",
        target?.id || "unknown",
        "hasConnect",
        typeof target?.connect === "function",
      );
      try {
        setReceivedVerificationCode("");
      } catch {}
      try {
        const isConnected = await target.isConnected?.();
        console.log("[PAIRING][retry] isConnected:", isConnected);
        if (!isConnected) {
          console.log("[PAIRING][retry] connect...");
          await target.connect();
          console.log("[PAIRING][retry] discover services...");
          await target.discoverAllServicesAndCharacteristics();
        }
        const sendparseDeviceCodeedValue = async (parseDeviceCodeedValue) => {
          try {
            const message = buildAuthVerifyText(parseDeviceCodeedValue);
            const base64Message = Buffer.from(message, "utf-8").toString(
              "base64",
            );
            await target.writeCharacteristicWithResponseForService(
              serviceUUID,
              writeCharacteristicUUID,
              base64Message,
            );
            console.log(`Sent parseDeviceCodeed value: ${message}`);
          } catch (error) {
            console.log("Error sending parseDeviceCodeed value:", error);
          }
        };
        console.log("[PAIRING][retry] monitorVerificationCode start");
        monitorVerificationCode(target, sendparseDeviceCodeedValue);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const requestString = bleCmd.authRequest() + "\r\n";
        const base64requestString = Buffer.from(
          requestString,
          "utf-8",
        ).toString("base64");
        await target.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64requestString,
        );
        console.log("[PAIRING] resent 'request'");
      } catch (error) {
        console.log("[PAIRING] resend request failed:", error);
      }
    },
    [
      selectedDevice,
      serviceUUID,
      writeCharacteristicUUID,
      setReceivedVerificationCode,
      monitorVerificationCode,
      bleManagerRef,
    ],
  );

  const sendPinFailOnCancel = React.useCallback(
    async (device) => {
      let target = device || selectedDevice;
      if (!target) return;
      try {
        console.log("[PIN_FAIL] send start", target?.id || "unknown");
        if (!target || typeof target.connect !== "function") {
          const manager = bleManagerRef?.current;
          if (manager && target?.id) {
            const list = await manager.devices([target.id]);
            if (Array.isArray(list) && list[0]) target = list[0];
          }
        }
        const isConnected = await target?.isConnected?.();
        console.log("[PIN_FAIL] isConnected:", isConnected);
        if (!isConnected && target?.connect) {
          console.log("[PIN_FAIL] connect...");
          await target.connect();
          console.log("[PIN_FAIL] discover services...");
          await target.discoverAllServicesAndCharacteristics();
        }
        const failMessage = bleCmd.pinFail() + "\r\n";
        const base64Fail = Buffer.from(failMessage, "utf-8").toString("base64");
        await target.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64Fail,
        );
        console.log("[PIN_FAIL] sent on cancel");
      } catch (error) {
        console.log("[PIN_FAIL] send failed on cancel:", error);
      }
    },
    [selectedDevice, bleManagerRef, serviceUUID, writeCharacteristicUUID],
  );

  const handlePinModalCancel = React.useCallback(async () => {
    console.log("[PIN_MODAL] onCancel (Vault)");
    const target = selectedDevice;
    try {
      monitorVerificationCode?.cancel?.();
    } catch {}
    try {
      stopMonitoringVerificationCode();
    } catch {}
    try {
      const isConnected = await target?.isConnected?.();
      if (isConnected) {
        await new Promise((r) => setTimeout(r, 80));
        await target.cancelConnection();
      }
    } catch (error) {
      console.log("Cancel connection failed on pin modal cancel:", error);
    }
    setSecurityCodeModalVisible(false);
    if (typeof setPinErrorMessage === "function") {
      setPinErrorMessage("");
    }
    try {
      setPinCode("");
    } catch {}
  }, [
    selectedDevice,
    monitorVerificationCode,
    stopMonitoringVerificationCode,
    setSecurityCodeModalVisible,
    setPinErrorMessage,
    setPinCode,
  ]);

  const handleDeleteCard = () => {
    scrollViewRef?.current?.setNativeProps({ scrollEnabled: true });
    const selectedKeySet = new Set(selectedDeleteCardKeys || []);
    const hasBatchSelection = selectedKeySet.size > 0;
    // Batch deletion takes priority; if there is no batch check, it will fall back to the historical single card deletion logic (header dropdown).
    const updatedCards = (cryptoCards || []).filter((card) => {
      if (hasBatchSelection) {
        return !selectedKeySet.has(getDeleteCardKey(card));
      }
      return !(
        card.name === selectedCardName &&
        card.queryChainName === selectedCardChain
      );
    });

    // Disable deletion of all asset cards: keep at least 1
    if (updatedCards.length === 0 && (cryptoCards || []).length > 0) {
      showMinAssetCardToast();
      setDeleteConfirmVisible(false);
      navigation.setParams({ showDeleteConfirmModal: false });
      return;
    }

    setCryptoCards(updatedCards);
    setCryptoCount(updatedCards.length);
    setAddedCryptos(updatedCards);
    setSelectedDeleteCardKeys([]);
    setDropdownVisible(false);
    setModalVisible(false);
    setDeleteConfirmVisible(false);
    setSelectedCardIndex(null);
    modalAnim.setValue(0);
    balanceAnim.setValue(1);
    navigation.setParams({ showDeleteConfirmModal: false });
  };

  // Animation parameters related to card displacement
  const selectCardOffsetOpenAni = useAnimatedValue(0);
  const selectCardOffsetCloseAni = useAnimatedValue(0);
  const selectCardTargetOffsetRef = useRef(0);
  const tabRevealTriggeredRef = useRef(false);
  const tabRevealListenerIdRef = useRef(null);
  const openStateCommittedRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const scrollContainerAbsYRef = useRef(0);
  const headerHeight = useHeaderHeight();
  // Turn off stage status markers to avoid hard cuts caused by race conditions
  const isClosingRef = useRef(false);
  // Intercept the external direct setModalVisible(false) situation and unify the closing process of the tape transport animation
  const prevModalVisibleRef = useRef(modalVisible);

  // Performance optimization during shutdown/homing phase: total calculation cache to avoid loop + conversion for each rendering
  const totalBalanceMemo = React.useMemo(() => {
    try {
      const sum = (cryptoCards || []).reduce((total, card) => {
        if (!card || typeof card.balance === "undefined") return total;

        const converted = getConvertedBalance(
          card.balance,
          card.shortName,
          "Vault.calculateTotalBalanceMemo",
        );
        const n = Number(converted);
        return Number.isFinite(n) ? total + n : total;
      }, 0);

      return sum.toFixed(2);
    } catch {
      return "0.00";
    }
  }, [cryptoCards, exchangeRates, priceChanges, currencyUnit]);

  // Backwards compatible with original call signature: function returns cached value
  const calculateTotalBalance = React.useCallback(
    () => (freezeNumbers ? totalBalanceFreezeRef.current : totalBalanceMemo),
    [freezeNumbers, totalBalanceMemo],
  );

  const handleScrollContainerLayout = React.useCallback((event) => {
    const layoutY = event?.nativeEvent?.layout?.y;
    if (Number.isFinite(layoutY)) {
      scrollContainerAbsYRef.current = layoutY;
    }
    const node = scrollContainerRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y) => {
        if (Number.isFinite(y)) {
          scrollContainerAbsYRef.current = y;
        }
      });
    }
  }, []);

  const { closeModal, handleCardPress } = useAssetCardHandlers({
    selectedCardIndex,
    setIsClosing,
    setHideOtherCards,
    totalBalanceFreezeRef,
    totalBalanceMemo,
    setFreezeNumbers,
    balanceAnim,
    navigation,
    setIsCardExpanded,
    setTabReady,
    setElevateDuringReturn,
    modalAnim,
    backgroundAnim,
    tabOpacity,
    selectCardOffsetOpenAni,
    selectCardOffsetCloseAni,
    setModalVisible,
    setSelectedCardIndex,
    isClosingRef,
    scrollViewRef,
    setIsOpening,
    cardLayoutYRef,
    scrollYOffset,
    scrollCardToTop,
    pendingScrollIndexRef,
    cryptoCards,
    openStateCommittedRef,
    setSelectedCardChainShortName,
    setSelectedAddress,
    setSelectedCardName,
    setSelectedCardChain,
    setSelectedCrypto,
    cardStartPositions,
    selectCardTargetOffsetRef,
    tabRevealListenerIdRef,
    headerHeight,
    scrollContainerAbsYRef,
  });

  // When the details are expanded, the return key is consumed first: close the details instead of dispatching GO_BACK to the root navigation.
  useFocusEffect(
    React.useCallback(() => {
      const onHardwareBackPress = () => {
        if (modalVisible) {
          closeModal();
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onHardwareBackPress,
      );
      return () => subscription.remove();
    }, [modalVisible, closeModal]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!modalVisible) return;
      if (event?.data?.action?.type !== "GO_BACK") return;
      event.preventDefault();
      closeModal();
    });
    return unsubscribe;
  }, [navigation, modalVisible, closeModal]);

  useEffect(() => {
    if (isClosingRef.current) return;
    if (!modalVisible && selectedCardIndex == null) {
      try {
        selectCardOffsetOpenAni.setValue(0);
        selectCardOffsetCloseAni.setValue(0);
        setHideOtherCards(false);
        balanceAnim.setValue(1);
        backgroundAnim.setValue(0);
        tabOpacity.setValue(0);
      } catch {}
    }
  }, [modalVisible, selectedCardIndex]);

  // Unifiedly intercept all paths that directly close the Tab container (trigger source B), and use the closeModal animation instead
  useEffect(() => {
    const prev = prevModalVisibleRef.current;
    // Only intercept the "from open -> close" edge, and there is currently a selected card and it is not in a controlled close
    if (
      prev &&
      !modalVisible &&
      selectedCardIndex != null &&
      !isClosingRef.current
    ) {
      // Restore visibility immediately, and initiate animated close in the next frame
      requestAnimationFrame(() => {
        try {
          // Restore first to avoid "hard cuts" caused by direct hiding
          setModalVisible(true);
          // The microtask/next round of event loops will be closed animatedly to avoid competition in the same frame state.
          setTimeout(() => {
            // Double confirmation does not enter controlled shutdown to avoid repeated calls
            if (!isClosingRef.current) {
              closeModal();
            }
          }, 0);
        } catch {}
      });
    }
    prevModalVisibleRef.current = modalVisible;
  }, [modalVisible, selectedCardIndex]);

  const handleColorExtracted = (main, secondary, card, index) => {
    if (index === selectedCardIndex) {
      setMainColor(main);
      setSecondaryColor(secondary);
    }
  };


  useEffect(() => {
    if (modalVisible) {
      setIsOpening(false);
    }
  }, [modalVisible]);

  const handleLetsGo = () => {
    navigation.navigate("AddItem");
  };

  const handleWalletTest = () => {
    navigation.navigate("AddItem");
  };

  const { height } = Dimensions.get("window");

  const isIphoneSE = Platform.OS === "ios" && height < 700;


  const renderTabView = () => (
    <AssetsTabView
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      closeModal={closeModal}
      VaultScreenStyle={VaultScreenStyle}
      ActivityScreenStyle={ActivityScreenStyle}
      t={t}
      tabOpacity={tabOpacity}
      tabReady={tabReady}
      ActivityLog={ActivityLog}
      scrollViewRef={scrollViewRef}
      selectedCrypto={selectedCrypto}
      exchangeRates={exchangeRates}
      currencyUnit={currencyUnit}
      isDarkMode={isDarkMode}
      modalVisible={modalVisible}
      backgroundAnim={backgroundAnim}
      darkColorsDown={darkColorsDown}
      lightColorsDown={lightColorsDown}
      mainColor={mainColor}
      secondaryColor={secondaryColor}
      isClosing={isClosing}
      onSendPress={handleSendPress}
      onReceivePress={handleReceivePress}
      onPriceRefresh={refreshCardBalance}
      setTabRefreshLoading={setTabRefreshLoading}
    />
  );

  return (
    <LinearGradient
      colors={isDarkMode ? ["#21201E", "#0E0D0D"] : ["#FFFFFF", "#EDEBEF"]}
      style={VaultScreenStyle.linearGradient}
    >
      <AssetsPage
        selectCardOffsetOpenAni={selectCardOffsetOpenAni}
        selectCardOffsetCloseAni={selectCardOffsetCloseAni}
        selectedView={selectedView}
        scrollViewRef={scrollViewRef}
        scrollContainerRef={scrollContainerRef}
        onScrollContainerLayout={handleScrollContainerLayout}
        VaultScreenStyle={VaultScreenStyle}
        modalVisible={modalVisible}
        hideOtherCards={hideOtherCards}
        isClosing={isClosing}
        isOpening={isOpening}
        elevateDuringReturn={elevateDuringReturn}
        cryptoCards={cryptoCards}
        initialAdditionalCryptos={initialAdditionalCryptos}
        refreshing={refreshing}
        onRefresh={onRefresh}
        opacityAnim={balanceAnim}
        calculateTotalBalance={calculateTotalBalance}
        currencyUnit={currencyUnit}
        t={t}
        hideNumbers={hideNumbers}
        setHideNumbers={setHideNumbers}
        hideNumbersByCard={hideNumbersByCard}
        getCardHideKey={getCardHideKey}
        onToggleCardHide={toggleCardHideNumbers}
        setCryptoCards={setCryptoCards}
        setChainSelectionModalVisible={setChainSelectionModalVisible}
        selectedChain={selectedChain}
        chainSelectorCards={chainSelectorCards}
        isDarkMode={isDarkMode}
        chainFilteredCards={chainFilteredCards}
        cardRefs={cardRefs}
        initCardPosition={initCardPosition}
        onCardLayout={handleCardLayout}
        cardLayoutYRef={cardLayoutYRef}
        handleCardPress={handleCardPress}
        selectedCardIndex={selectedCardIndex}
        isCardExpanded={isCardExpanded}
        priceChanges={priceChanges}
        getConvertedBalance={getConvertedBalance}
        handleQRCodePress={handleQRCodePress}
        renderTabView={renderTabView}
        scrollYOffset={scrollYOffset}
        scrollContainerAbsYRef={scrollContainerAbsYRef}
        tabRefreshLoading={tabRefreshLoading}
        device={devices.find((d) => d.id === verifiedDevices[0])}
        onOpenBluetoothModal={() => openExclusiveModal(() => setBleVisible(true))}
        setBleVisible={setBleVisible}
        showWorkflowBluetoothModal={showWorkflowBluetoothModal}
        devices={devices}
        verifiedDevices={verifiedDevices}
        onColorExtracted={handleColorExtracted}
        isInitialLoading={isInitialLoading}
        isBalanceSyncing={isBalanceSyncing}
        isPriceLoading={isPriceLoading}
        freezeNumbers={freezeNumbers}
        setVerificationStatus={setVerificationStatus}
        setCheckStatusModalVisible={setCheckStatusModalVisible}
        setCheckStatusProgress={setCheckStatusProgress}
        nftRefreshTick={nftRefreshTick}
        handleSendPress={handleSendPress}
        handleReceivePress={handleReceivePress}
        openNftDetail={openNftDetail}
        nftRouteAction={nftRouteAction}
        nftRoutePayload={nftRoutePayload}
        clearNftRouteAction={clearNftRouteAction}
        onCardEditModeChange={handleCardEditModeChange}
        exitEditRequested={exitEditRequested}
        onExitEditHandled={handleExitEditHandled}
        onGalleryFilterCardsChange={setGalleryFilterCards}
        selectedDeleteCardKeys={selectedDeleteCardKeys}
        onRequestDeleteCard={(card, cardKey) => {
          if (!card) return;
          const resolvedKey = cardKey || getDeleteCardKey(card);
          if (!resolvedKey) return;
          console.log("[BATCH_DELETE][ASSETS] toggle request", {
            name: card?.name || card?.shortName,
            chain: card?.queryChainName || card?.queryChainShortName,
            key: resolvedKey,
          });
          setSelectedDeleteCardKeys((prev) => {
            const set = new Set(prev || []);
            if (set.has(resolvedKey)) {
              set.delete(resolvedKey);
            } else {
              const totalCards = (cryptoCards || []).length;
              const maxSelectable = Math.max(totalCards - 1, 0);
              if (set.size >= maxSelectable) {
                setTimeout(() => {
                  showMinAssetCardToast();
                }, 0);
                return prev || [];
              }
              set.add(resolvedKey);
            }
            const next = Array.from(set);
            console.log("[BATCH_DELETE][ASSETS] selected keys ->", next);
            return next;
          });
        }}
      />
      {/* Send process (migrated from Actions) */}
      <ContactFormModal
        visible={sendContactModalVisible}
        onRequestClose={() => setSendContactModalVisible(false)}
        ActivityScreenStyle={ActivityScreenStyle}
        t={t}
        isDarkMode={isDarkMode}
        handleAddressChange={handleSendAddressChange}
        inputAddress={sendInputAddress}
        detectedNetwork={sendDetectedNetwork}
        isAddressValid={sendIsAddressValid}
        buttonBackgroundColor={buttonBackgroundColor}
        disabledButtonBackgroundColor={disabledButtonBackgroundColor}
        handleNextAfterAddress={handleSendNextAfterAddress}
        setContactFormModalVisible={setSendContactModalVisible}
        selectedCrypto={sendSelectedCrypto}
        selectedCryptoChain={sendSelectedQueryChainName}
        selectedCryptoIcon={sendSelectedCryptoIcon}
        selectedAddress={sendSelectedAddress}
      />
      <AmountModal
        visible={sendAmountModalVisible}
        onRequestClose={() => setSendAmountModalVisible(false)}
        ActivityScreenStyle={ActivityScreenStyle}
        t={t}
        isDarkMode={isDarkMode}
        amount={sendAmount}
        setAmount={setSendAmount}
        balance={sendBalance}
        fee={sendFee}
        rapidFee={sendRapidFee}
        setFee={setSendFee}
        isAmountValid={sendIsAmountValid}
        buttonBackgroundColor={buttonBackgroundColor}
        disabledButtonBackgroundColor={disabledButtonBackgroundColor}
        handleNextAfterAmount={handleSendNextAfterAmount}
        selectedCrypto={sendSelectedCrypto}
        selectedCryptoChain={sendSelectedQueryChainName}
        selectedCryptoIcon={sendSelectedCryptoIcon}
        currencyUnit={currencyUnit}
        exchangeRates={exchangeRates}
        cryptoCards={cryptoCards}
        selectedCryptoName={sendSelectedCryptoName}
        EstimatedValue={sendEstimatedValue}
        setCryptoCards={setCryptoCards}
        recommendedFee={sendRecommendedFee}
        recommendedValue={sendRecommendedValue}
        rapidFeeValue={sendRapidFeeValue}
        rapidCurrencyValue={sendRapidCurrencyValue}
        selectedFeeTab={sendSelectedFeeTab}
        setSelectedFeeTab={setSendSelectedFeeTab}
        isFeeLoading={sendIsFeeLoading}
      />
      <TransferConfirmModal
        visible={sendConfirmModalVisible}
        onRequestClose={() => setSendConfirmModalVisible(false)}
        onConfirm={async () => {
          try {
            if (!sendChainShortName)
              throw new Error("No chain selected or queryChainShortName is not set");

            const selectedCryptoObj =
              cryptoCards.find(
                (crypto) =>
                  crypto.shortName === sendSelectedCrypto &&
                  String(crypto.queryChainName || "").toLowerCase() ===
                    String(sendSelectedQueryChainName || "").toLowerCase(),
              ) ||
              initialAdditionalCryptos.find(
                (crypto) =>
                  crypto.shortName === sendSelectedCrypto &&
                  String(crypto.queryChainName || "").toLowerCase() ===
                    String(sendSelectedQueryChainName || "").toLowerCase(),
              );
            const paymentAddress = String(sendSelectedAddress || "").trim();
            if (!selectedCryptoObj) {
              setSendConfirmModalVisible(false);
              setSendErrorModalMessage(t("The chain and asset do not match. Please select again."));
              openExclusiveModal(() => setSendErrorModalVisible(true));
              return;
            }
            if (!paymentAddress) {
              setSendConfirmModalVisible(false);
              setSendErrorModalMessage(t("The current chain address is unavailable. Please re-sync the wallet and try again."));
              openExclusiveModal(() => setSendErrorModalVisible(true));
              return;
            }

            const selectedChainName = selectedCryptoObj.queryChainName;
            const selectedContractAddress = selectedCryptoObj.contractAddress;
            const selectedCoinType = selectedCryptoObj.coin_type;
            const selectedDecimals =
              sendSelectedCryptoDecimals ||
              selectedCryptoObj.Decimals ||
              selectedCryptoObj.decimals;
            const selectedShortName = selectedCryptoObj.shortName;
            const selectedName = selectedCryptoObj.name;
            if (!selectedChainName) {
              setSendConfirmModalVisible(false);
              setSendErrorModalMessage(t("The chain and asset do not match. Please select again."));
              openExclusiveModal(() => setSendErrorModalVisible(true));
              return;
            }

            const { ok, device: readyDevice } = await ensureDeviceReady({
              devices,
              verifiedDevices,
              setBleVisible,
              openBleModal: showWorkflowBluetoothModal,
            });
            if (!ok || !readyDevice) return;

            setSendConfirmModalVisible(false);
            setVerificationStatus("txInit");
            openExclusiveModal(() => setCheckStatusModalVisible(true));

            await signTransaction(
              readyDevice,
              sendAmount,
              paymentAddress,
              sendInputAddress,
              selectedChainName,
              selectedContractAddress,
              sendSelectedFeeTab,
              sendRecommendedFee,
              sendRapidFeeValue,
              setSendModalStatus,
              t,
              sendMonitorSignedResult,
              monitorSubscription,
              setVerificationStatus,
              showCheckStatusModal,
              selectedCoinType,
              selectedDecimals,
              selectedShortName,
              selectedName,
              isDarkMode,
              showSendErrorModal,
              setSendErrorModalMessage,
            );
          } catch (error) {
            console.log("Error while confirming transaction:", error);
          }
        }}
        onCancel={() => setSendConfirmModalVisible(false)}
        t={t}
        ActivityScreenStyle={ActivityScreenStyle}
        isDarkMode={isDarkMode}
        selectedCryptoIcon={sendSelectedCryptoIcon}
        selectedCrypto={sendSelectedCrypto}
        selectedCryptoChain={sendSelectedQueryChainName}
        amount={sendAmount}
        priceUsd={sendPriceUsd}
        exchangeRates={exchangeRates}
        currencyUnit={currencyUnit}
        recommendedFee={sendRecommendedFee}
        recommendedValue={sendRecommendedValue}
        rapidFeeValue={sendRapidFeeValue}
        rapidCurrencyValue={sendRapidCurrencyValue}
        selectedFeeTab={sendSelectedFeeTab}
        setSelectedFeeTab={setSendSelectedFeeTab}
        detectedNetwork={sendDetectedNetwork}
        selectedAddress={sendSelectedAddress}
        inputAddress={sendInputAddress}
        buttonBackgroundColor={buttonBackgroundColor}
        disabledButtonBackgroundColor={disabledButtonBackgroundColor}
      />
      <CheckStatusModal
        visible={sendErrorModalVisible}
        status="fail"
        onClose={() => setSendErrorModalVisible(false)}
        titleOverride={t("Error!")}
        subtitleOverride={normalizedSendErrorMessage}
      />
      <ModalsContainer
        selectedCardChainShortName={selectedCardChainShortName}
        addressModalVisible={addressModalVisible}
        setAddressModalVisible={setAddressModalVisible}
        selectedCryptoIcon={selectedCryptoIcon}
        selectedCrypto={selectedCrypto}
        selectedAddress={selectedAddress}
        bchAddressType={selectedCrypto?.bchAddressType}
        bchCashAddr={selectedCrypto?.bchCashAddr}
        bchLegacyAddr={selectedCrypto?.bchLegacyAddr}
        bchAddressBalances={selectedCrypto?.bchAddressBalances}
        bchCashaddrBalance={selectedCrypto?.bchCashaddrBalance}
        bchLegacyBalance={selectedCrypto?.bchLegacyBalance}
        onSwitchBchAddressType={handleSwitchBchAddressType}
        btcAddressType={selectedCrypto?.btcAddressType}
        btcLegacyAddr={selectedCrypto?.btcLegacyAddr}
        btcNestedSegwitAddr={selectedCrypto?.btcNestedSegwitAddr}
        btcNativeSegwitAddr={selectedCrypto?.btcNativeSegwitAddr}
        btcTaprootAddr={selectedCrypto?.btcTaprootAddr}
        btcAddressBalances={selectedCrypto?.btcAddressBalances}
        btcLegacyBalance={selectedCrypto?.btcLegacyBalance}
        btcNestedSegwitBalance={selectedCrypto?.btcNestedSegwitBalance}
        btcNativeSegwitBalance={selectedCrypto?.btcNativeSegwitBalance}
        btcTaprootBalance={selectedCrypto?.btcTaprootBalance}
        getConvertedBalance={getConvertedBalance}
        currencyUnit={currencyUnit}
        onSwitchBtcAddressType={handleSwitchBtcAddressType}
        ltcAddressType={selectedCrypto?.ltcAddressType}
        ltcLegacyAddr={selectedCrypto?.ltcLegacyAddr}
        ltcNestedSegwitAddr={selectedCrypto?.ltcNestedSegwitAddr}
        ltcNativeSegwitAddr={selectedCrypto?.ltcNativeSegwitAddr}
        ltcAddressBalances={selectedCrypto?.ltcAddressBalances}
        ltcLegacyBalance={selectedCrypto?.ltcLegacyBalance}
        ltcNestedSegwitBalance={selectedCrypto?.ltcNestedSegwitBalance}
        ltcNativeSegwitBalance={selectedCrypto?.ltcNativeSegwitBalance}
        onSwitchLtcAddressType={handleSwitchLtcAddressType}
        hasVerifyAddressAttempted={hasVerifyAddressAttempted}
        isPreparingVerifyAddress={isPreparingVerifyAddress}
        isVerifyingAddress={isVerifyingAddress}
        addressVerificationMessage={addressVerificationMessage}
        handleVerifyAddress={async (
          selectedCardChainShortName,
          verifyOptions = {},
        ) => {
          setHasVerifyAddressAttempted(true);
          if (isPreparingVerifyAddress || isVerifyingAddress) {
            console.log("[VERIFY_ADDR][UI] ignored:busy", {
              ts: Date.now(),
              selectedCardChainShortName,
              isPreparingVerifyAddress,
              isVerifyingAddress,
            });
            return;
          }
          setIsPreparingVerifyAddress(true);
          try {
            await handleVerifyAddressForVault({
              selectedCardChainShortName,
              bchAddressType: verifyOptions?.bchAddressType,
              btcAddressType: verifyOptions?.btcAddressType,
              ltcAddressType: verifyOptions?.ltcAddressType,
              verifiedDevices,
              devices,
              setAddressModalVisible,
              setBleVisible,
              openBleModal: showWorkflowBluetoothModal,
              bleManagerRef,
              displayDeviceAddress,
              setIsVerifyingAddress,
              setAddressVerificationMessage,
              t,
              setVerificationStatus,
              setCheckStatusModalVisible,
              openExclusiveModal,
            });
          } finally {
            setIsPreparingVerifyAddress(false);
          }
        }}
        VaultScreenStyle={VaultScreenStyle}
        t={t}
        isDarkMode={isDarkMode}
        handleWalletTest={handleWalletTest}
        processMessages={processMessages}
        showLetsGoButton={showLetsGoButton}
        handleLetsGo={handleLetsGo}
        isChainSelectionModalVisible={isChainSelectionModalVisible}
        setChainSelectionModalVisible={setChainSelectionModalVisible}
        selectedChain={selectedChain}
        handleSelectChain={handleSelectChain}
        cryptoCards={chainSelectorCards}
        deleteConfirmVisible={deleteConfirmVisible}
        setDeleteConfirmVisible={setDeleteConfirmVisible}
        handleDeleteCard={handleDeleteCard}
        deleteConfirmMessage={deleteConfirmMessage}
        navigation={navigation}
        bleVisible={bleVisible}
        devices={devices}
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        iconColor={iconColor}
        blueToothColor={blueToothColor}
        handleDevicePress={handleDevicePress}
        onCancelBluetooth={handleCancelBluetooth}
        setBleVisible={setBleVisible}
        bleModalMode={bleModalMode}
        onRecoveredVerifiedDevice={handleRecoveredWorkflowDevice}
        selectedDevice={selectedDevice}
        setSelectedDevice={setSelectedDevice}
        verifiedDevices={verifiedDevices}
        handleDisconnectDevice={async (device) => {
          await handleDisconnectDeviceForVault({
            device,
            verifiedDevices,
            setVerifiedDevices,
            setIsVerificationSuccessful,
            // Pass in the listener cancellation handle, make sure to cancel the subscription first and then disconnect it.
            monitorVerificationCode,
          });
        }}
        onRefreshBluetooth={handleBluetoothRefresh}
        SecurityCodeModalVisible={SecurityCodeModalVisible}
        pinCode={pinCode}
        setPinCode={setPinCode}
        pinErrorMessage={pinErrorMessage}
        setPinErrorMessage={setPinErrorMessage}
        handlePinSubmit={handlePinSubmitProxy}
        setSecurityCodeModalVisible={setSecurityCodeModalVisible}
        verificationStatus={verificationStatus}
        setVerificationStatus={setVerificationStatus}
        blueToothStatus={blueToothStatus}
        setBlueToothStatus={setBlueToothStatus}
        createPendingModalVisible={createPendingModalVisible}
        importingModalVisible={importingModalVisible}
        setCreatePendingModalVisible={setCreatePendingModalVisible}
        setImportingModalVisible={setImportingModalVisible}
        stopMonitoringVerificationCode={stopMonitoringVerificationCode}
        monitorVerificationCode={monitorVerificationCode}
        onCancelPinModal={handlePinModalCancel}
        onSendPinFail={sendPinFailOnCancel}
        CheckStatusModalVisible={CheckStatusModalVisible}
        setCheckStatusModalVisible={setCheckStatusModalVisible}
        missingChains={getAddressSyncKeys(prefixToShortName).filter(
          (shortName) => !(receivedAddresses || {})[shortName],
        )}
        receivedAddresses={receivedAddresses}
        receivedPubKeys={receivedPubKeys}
        prefixToShortName={prefixToShortName}
        checkStatusProgress={checkStatusProgress}
        onRetryPairing={resendPairingRequest}
        txHash={sendTxHash}
      />
    </LinearGradient>
  );
}

export default VaultScreen;
