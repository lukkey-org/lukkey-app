/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import createMonitorSignedResult from "../ActivityScreen/monitorSignedResult";
import { RUNTIME_DEV } from "../../utils/runtimeFlags";
import { accountAPI, galleryAPI } from "../../env/apiEndpoints";
import * as ImageManipulator from "expo-image-manipulator";
import { Buffer } from "buffer";
import { bluetoothConfig } from "../../env/bluetoothConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { handleSaveToDevice } from "../../utils/handleSaveToDevice";
import { handleSendDigital } from "../../utils/handleSendDigital";
import { ensureDeviceReady } from "../../utils/ensureDeviceReady";
import { buildChainAddrEntry, detectNetwork } from "../../config/networkUtils";
import {
  getRuntimeBalance,
  getRuntimePriceUsd,
} from "../../utils/assetRuntimeFields";
import {
  formatCryptoBalanceDisplay,
  formatFiatBalanceDisplay,
} from "../../utils/assetDisplayFormat";
import { resolveChainIcon } from "../../utils/assetIconResolver";
import { getBchQueryAddressesFromCard, isBchCard } from "../../utils/bchAddress";
import { getBtcQueryAddressesFromCard, isBtcCard } from "../../utils/btcAddress";
import { resolveGasFeeSymbolForChain } from "../../config/gasFeeToken";
import AssetsWalletPage from "./AssetsWalletPage";
import AssetsGalleryPage from "./AssetsGalleryPage";

const serviceUUID = bluetoothConfig.serviceUUID;
const writeCharacteristicUUID = bluetoothConfig.writeCharacteristicUUID;
const notifyCharacteristicUUID = bluetoothConfig.notifyCharacteristicUUID;

const getNftMintValue = (nft) => String(nft?.tokenId ?? nft?.mint ?? "");

const buildNftKey = (nft) =>
  `${String(nft?.queryChainName || "").toLowerCase()}:${String(
    nft?.tokenContractAddress || "",
  ).toLowerCase()}:${getNftMintValue(nft)}`;

const normalizeChainName = (value) => String(value || "").trim().toLowerCase();

const isValidImageSize = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
const normalizeLower = (value) => String(value || "").trim().toLowerCase();
const extractAssetAmount = (asset) => {
  const candidates = [
    asset?.amount,
    asset?.balance,
    asset?.availableAmount,
    asset?.available,
    asset?.value,
  ];
  for (const value of candidates) {
    if (typeof value === "number") return String(value);
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
};
const findNativeAsset = (assets) =>
  (Array.isArray(assets) ? assets : []).find((asset) => {
    const coinType = normalizeLower(asset?.coin_type);
    return coinType === "native" || !normalizeLower(asset?.tokenContractAddress);
  }) || null;
const getNftListFromResponse = (payload) =>
  Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.list)
      ? payload.data.list
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];

const getImageSizeAsync = (url) =>
  new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("empty image url"));
      return;
    }
    Image.getSize(
      url,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });

/* Styles have been migrated to styles.js */

const AssetsPage = ({
  setBleVisible,
  showWorkflowBluetoothModal,
  devices = [],
  verifiedDevices: propsVerifiedDevices = [],
  ...props
}) => {
  const effectiveVerifiedDevices = Array.isArray(propsVerifiedDevices)
    ? propsVerifiedDevices
    : [];

  // NFT card animation related
  const scaleAnimsRef = React.useRef([]);
  const monitorSubscription = React.useRef(null);
  // animation parameters
  const PRESS_IN_SCALE = 0.95;
  const ANIMATION_DURATION = 200;
  // animation function
  const animatePressIn = (animatedValue) => {
    Animated.timing(animatedValue, {
      toValue: PRESS_IN_SCALE,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  };
  const animatePressOut = (animatedValue, callback) => {
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (typeof callback === "function") callback();
    });
  };
  // Synchronize animation array length when NFT data changes
  useEffect(() => {
    const list = getNftListFromResponse(nftData);
    if (nftData && nftData.code === "0" && Array.isArray(list)) {
      if (!scaleAnimsRef.current) scaleAnimsRef.current = [];
      const targetLen = list.length;
      // Expand
      for (let i = scaleAnimsRef.current.length; i < targetLen; i++) {
        scaleAnimsRef.current[i] = new Animated.Value(1);
      }
      // Truncate
      if (scaleAnimsRef.current.length > targetLen) {
        scaleAnimsRef.current.length = targetLen;
      }
    }
  }, [nftData]);
  const [nftData, setNftData] = useState(null);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [detectedNetwork, setDetectedNetwork] = useState("");
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [galleryRefreshing, setGalleryRefreshing] = useState(false);
  const [dataUrl, setDataUrl] = useState(null);
  const [elevatedCardIndex, setElevatedCardIndex] = useState(null);
  const [prefetchedFeeBalance, setPrefetchedFeeBalance] = useState("");
  const [prefetchedFeeSymbol, setPrefetchedFeeSymbol] = useState("");
  const elevationTimerRef = React.useRef(null);
  const nftFetchPromiseRef = React.useRef(null);
  const nftFetchFingerprintRef = React.useRef("");
  const nftQueryTargets = useMemo(() => {
    const cards = Array.isArray(props.initialAdditionalCryptos)
      ? props.initialAdditionalCryptos
      : [];
    const unique = new Map();
    for (const c of cards) {
      const chain = c?.queryChainName || c?.queryChainShortName;
      const addresses = isBchCard(c)
        ? getBchQueryAddressesFromCard(c)
        : isBtcCard(c)
          ? getBtcQueryAddressesFromCard(c)
          : [String(c?.address || "").replace(/\s+/g, "")];
      if (!chain || addresses.length === 0) continue;
      for (const addr of addresses) {
        const normalizedAddr = String(addr || "").replace(/\s+/g, "");
        if (!normalizedAddr) continue;
        const key = `${String(chain).toLowerCase()}:${String(normalizedAddr).toLowerCase()}`;
        if (!unique.has(key)) {
          unique.set(key, { chain, address: normalizedAddr });
        }
      }
    }
    return Array.from(unique.values());
  }, [props.initialAdditionalCryptos]);
  const nftQueryFingerprint = useMemo(
    () =>
      nftQueryTargets
        .map(
          ({ chain, address }) =>
            `${String(chain).toLowerCase()}:${String(address).toLowerCase()}`,
        )
        .sort()
        .join("|"),
    [nftQueryTargets],
  );
  const closeAllModals = React.useCallback(() => {
    setSendModalVisible(false);
    setPreviewModalVisible(false);
    props.setCheckStatusModalVisible?.(false);
    props.setErrorModalVisible?.(false);
    props.setChainSelectionModalVisible?.(false);
  }, [
    setSendModalVisible,
    setPreviewModalVisible,
    props.setCheckStatusModalVisible,
    props.setErrorModalVisible,
    props.setChainSelectionModalVisible,
  ]);
  const openExclusiveModal = React.useCallback(
    (openAction) => {
      closeAllModals();
      if (typeof openAction === "function") {
        openAction();
      }
    },
    [closeAllModals],
  );
  const setBleVisibleExclusive = React.useCallback(
    (next = true) => {
      if (next) {
        if (typeof showWorkflowBluetoothModal === "function") {
          showWorkflowBluetoothModal();
          return;
        }
        openExclusiveModal(() => setBleVisible(true));
        return;
      }
      setBleVisible(false);
    },
    [openExclusiveModal, setBleVisible, showWorkflowBluetoothModal],
  );
  const setCheckStatusModalVisibleExclusive = React.useCallback(
    (next = true) => {
      if (next) {
        openExclusiveModal(() => props.setCheckStatusModalVisible?.(true));
        return;
      }
      props.setCheckStatusModalVisible?.(false);
    },
    [openExclusiveModal, props.setCheckStatusModalVisible],
  );
  const setErrorModalVisibleExclusive = React.useCallback(
    (next = true) => {
      if (next) {
        openExclusiveModal(() => props.setErrorModalVisible?.(true));
        return;
      }
      props.setErrorModalVisible?.(false);
    },
    [openExclusiveModal, props.setErrorModalVisible],
  );

  const openSendModalWithPreflight = React.useCallback(
    async (nextVisible) => {
      if (!nextVisible) {
        setSendModalVisible(false);
        return;
      }
      const { ok } = await ensureDeviceReady({
        device: props.device,
        devices,
        verifiedDevices: effectiveVerifiedDevices,
        setBleVisible,
        openBleModal: () => setBleVisibleExclusive(true),
      });
      if (!ok) return;
      openExclusiveModal(() => setSendModalVisible(true));
    },
    [
      devices,
      effectiveVerifiedDevices,
      props.device,
      setBleVisible,
      openExclusiveModal,
    ],
  );

  // Handle "Next" button to open preview Modal
  const handlePreview = () => {
    if (!selectedNFT || !recipientAddress) {
      console.log("NFT or address is empty and cannot be previewed");
      return;
    }

    console.log("Opening Preview Modal...");
    setSendModalVisible(false); // Close `sendModal` first
    setTimeout(async () => {
      const chainKey = String(selectedNFT?.queryChainName || "")
        .trim()
        .toLowerCase();
      const hasFeeCard = !!feeCardForNFT;

      if (
        !hasFeeCard &&
        accountAPI?.enabled &&
        chainKey &&
        paymentAddressForNFT
      ) {
        try {
          const chainAddr = buildChainAddrEntry(chainKey, paymentAddressForNFT);
          if (chainAddr) {
            const response = await fetch(accountAPI.balance, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ chainAddr }),
            });
            const data = await response.json().catch(() => null);
            const accounts = Array.isArray(data?.data?.accounts)
              ? data.data.accounts
              : Array.isArray(data?.accounts)
                ? data.accounts
                : [];
            const account = accounts.find(
              (item) =>
                normalizeLower(item?.chain) === chainKey &&
                normalizeLower(item?.address) ===
                  normalizeLower(paymentAddressForNFT),
            );
            const nativeAsset = findNativeAsset(account?.assets);
            const nextBalance = extractAssetAmount(nativeAsset);
            const nextSymbol =
              nativeAsset?.symbol ||
              selectedNFT?.queryChainShortName ||
              "";

            if (nextBalance !== "") {
              setPrefetchedFeeBalance(nextBalance);
            }
            if (nextSymbol) {
              setPrefetchedFeeSymbol(String(nextSymbol).trim().toUpperCase());
            }
          }
        } catch (error) {
          console.log(
            "[NFT_PREVIEW] prefetch native gas balance failed:",
            error?.message || error,
          );
        }
      }

      openExclusiveModal(() => setPreviewModalVisible(true)); // Open `previewModal`
    }, 300);
  };

  useEffect(() => {
    if (!recipientAddress) {
      setDetectedNetwork("");
      setIsAddressValid(false);
    }
  }, [recipientAddress]);

  // Functions to request NFT data
  useEffect(() => {
    const loadNftData = async () => {
      try {
        const savedNftData = await AsyncStorage.getItem("nftData");
        if (savedNftData !== null) {
          setNftData(JSON.parse(savedNftData));
        }
      } catch (e) {
        console.error("Error loading nftData from AsyncStorage", e);
      }
    };
    loadNftData();
  }, []);

  const fetchNFTData = async ({
    targets = nftQueryTargets,
    fingerprint = nftQueryFingerprint,
  } = {}) => {
    if (!Array.isArray(targets) || targets.length === 0 || !fingerprint) {
      return;
    }
    if (!galleryAPI.enabled) {
      setNftData({ code: "0", data: [] });
      return;
    }

    if (
      nftFetchPromiseRef.current &&
      nftFetchFingerprintRef.current === fingerprint
    ) {
      return nftFetchPromiseRef.current;
    }

    let runFetchPromise = null;
    runFetchPromise = (async () => {
      try {
        const targetMap = new Map(
          targets.map(({ chain, address }) => [
            `${normalizeChainName(chain)}:${normalizeLower(address)}`,
            { chain, address },
          ]),
        );
        const chainAddr = targets
          .map(({ chain, address }) => {
            const normalizedChain = String(chain || "").trim();
            const normalizedAddress = String(address || "").replace(/\s+/g, "");
            if (!normalizedChain || !normalizedAddress) return "";
            return `${normalizedChain}:${normalizedAddress}`;
          })
          .filter(Boolean)
          .join(",");
        if (!chainAddr) {
          setNftData({ code: "0", data: [] });
          return;
        }

        const resp = await fetch(galleryAPI.queryNFTBalance, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainAddr,
            pageSize: "50",
            page: "1",
          }),
        });
        const text = await resp.text();
        const hasText = typeof text === "string" && text.trim().length > 0;
        let json;
        try {
          json = hasText ? JSON.parse(text) : { code: "-1", data: { items: [] } };
        } catch {
          json = { code: "-1", data: { items: [] } };
        }
        const ok = json?.code === "0" || json?.code === 0;
        const combined = (ok ? getNftListFromResponse(json) : []).map((item) => {
          const {
            mint: rawMintAddress,
            tokenId,
            ...restItem
          } = item && typeof item === "object" ? item : {};
          const itemChain = item?.queryChainName || item?.chain || "";
          const ownerAddress =
            item?.ownerAddress ??
            item?.walletAddress ??
            item?.address ??
            item?.holderAddress ??
            "";
          const matchedTarget = targetMap.get(
            `${normalizeChainName(itemChain)}:${normalizeLower(ownerAddress)}`,
          );
          return {
            ...restItem,
            queryChainName: itemChain || matchedTarget?.chain || "",
            chain: item?.chain ?? itemChain ?? matchedTarget?.chain ?? "",
            ownerAddress: ownerAddress || matchedTarget?.address || "",
            walletAddress:
              item?.walletAddress ??
              ownerAddress ??
              matchedTarget?.address ??
              "",
            tokenContractAddress: item?.tokenContractAddress ?? "",
            mint: tokenId ?? rawMintAddress ?? "",
            mintAddress: rawMintAddress ?? "",
            logoUrl: item?.logoUrl ?? "",
            name: item?.name ?? "",
            protocolType: item?.protocolType ?? "",
            amount: item?.amount ?? 1,
            des: item?.des ?? "",
          };
        });

        const dedupMap = new Map();
        for (const it of combined) {
          const k = buildNftKey(it);
          if (!dedupMap.has(k)) dedupMap.set(k, it);
        }
        const prevList = getNftListFromResponse(nftData);
        const sizeMap = new Map();
        prevList.forEach((item) => {
          if (
            isValidImageSize(item?.imageWidth) &&
            isValidImageSize(item?.imageHeight)
          ) {
            sizeMap.set(buildNftKey(item), {
              imageWidth: Number(item.imageWidth),
              imageHeight: Number(item.imageHeight),
            });
          }
        });
        const merged = Array.from(dedupMap.values()).map((item) => {
          const cachedSize = sizeMap.get(buildNftKey(item));
          if (!cachedSize) return item;
          return {
            ...item,
            imageWidth:
              item?.imageWidth ?? cachedSize.imageWidth ?? item?.imageWidth,
            imageHeight:
              item?.imageHeight ?? cachedSize.imageHeight ?? item?.imageHeight,
          };
        });
        const combinedData = {
          code: "0",
          msg: json?.msg || "success",
          data: {
            ...(json?.data && typeof json.data === "object" ? json.data : {}),
            items: merged,
          },
        };
        setNftData(combinedData);
        try {
          await AsyncStorage.setItem("nftData", JSON.stringify(combinedData));
        } catch (e) {
          console.error("Error saving nftData to AsyncStorage", e);
        }
      } catch (error) {
        console.log("Error fetching NFT data", error);
      } finally {
        if (nftFetchPromiseRef.current === runFetchPromise) {
          nftFetchPromiseRef.current = null;
        }
      }
    })();
    nftFetchFingerprintRef.current = fingerprint;
    nftFetchPromiseRef.current = runFetchPromise;
    return runFetchPromise;
  };

  useEffect(() => {
    if (!nftQueryFingerprint) return;
    fetchNFTData({
      targets: nftQueryTargets,
      fingerprint: nftQueryFingerprint,
    });
  }, [nftQueryFingerprint]);

  // Trigger a full NFT refresh after walletReady → fetchWalletBalance is completed
  useEffect(() => {
    if (typeof props.nftRefreshTick === "number" && props.nftRefreshTick > 0) {
      setGalleryRefreshing(true);
      Promise.race([
        fetchNFTData({
          targets: nftQueryTargets,
          fingerprint: nftQueryFingerprint,
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).finally(() => setGalleryRefreshing(false));
    }
  }, [props.nftRefreshTick]);

  useEffect(() => {
    const list = getNftListFromResponse(nftData);
    if (nftData?.code !== "0" || !Array.isArray(list) || list.length === 0) {
      return;
    }

    let cancelled = false;
    const fillMissingImageSize = async () => {
      const targets = list.filter(
        (nft) =>
          nft?.logoUrl &&
          (!isValidImageSize(nft?.imageWidth) ||
            !isValidImageSize(nft?.imageHeight)),
      );
      if (targets.length === 0) return;

      const updates = new Map();
      await Promise.all(
        targets.map(async (nft) => {
          try {
            const size = await getImageSizeAsync(nft.logoUrl);
            if (
              isValidImageSize(size?.width) &&
              isValidImageSize(size?.height)
            ) {
              updates.set(buildNftKey(nft), {
                imageWidth: Number(size.width),
                imageHeight: Number(size.height),
              });
            }
          } catch (err) {
            if (RUNTIME_DEV) {
              console.warn(`Failed to get image size for ${nft.logoUrl}`, err);
            }
          }
        }),
      );

      if (cancelled || updates.size === 0) return;

      setNftData((prev) => {
        const prevList = getNftListFromResponse(prev);
        if (!Array.isArray(prevList) || prevList.length === 0) return prev;

        let changed = false;
        const nextList = prevList.map((item) => {
          const hit = updates.get(buildNftKey(item));
          if (!hit) return item;
          if (
            Number(item?.imageWidth) === hit.imageWidth &&
            Number(item?.imageHeight) === hit.imageHeight
          ) {
            return item;
          }
          changed = true;
          return {
            ...item,
            imageWidth: hit.imageWidth,
            imageHeight: hit.imageHeight,
          };
        });

        if (!changed) return prev;
        const next = {
          ...prev,
          data: Array.isArray(prev?.data)
            ? nextList
            : {
                ...(prev?.data && typeof prev.data === "object" ? prev.data : {}),
                items: nextList,
              },
        };
        AsyncStorage.setItem("nftData", JSON.stringify(next)).catch((e) => {
          if (RUNTIME_DEV) {
            console.warn("Error saving nftData(image size) to AsyncStorage", e);
          }
        });
        return next;
      });
    };

    fillMissingImageSize();
    return () => {
      cancelled = true;
    };
  }, [nftData]);

  const {
    selectedView,
    scrollViewRef,
    scrollContainerRef,
    onScrollContainerLayout,
    VaultScreenStyle,
    modalVisible,
    hideOtherCards,
    isClosing,
    elevateDuringReturn,
    cryptoCards,
    refreshing,
    onRefresh,
    opacityAnim,
    currencyUnit,
    t,
    setChainSelectionModalVisible,
    selectedChain,
    isDarkMode,
    chainFilteredCards,
    cardRefs,
    initCardPosition,
    onCardLayout,
    handleCardPress,
    selectedCardIndex,
    isCardExpanded,
    selectCardOffsetOpenAni,
    selectCardOffsetCloseAni,
    hideNumbers,
    setHideNumbers,
    freezeNumbers,
    tabRefreshLoading,
  } = props;
  const chainSelectorCards = Array.isArray(props.chainSelectorCards)
    ? props.chainSelectorCards
    : cryptoCards;

  const formatFiatBalance = (
    value,
    { compactLarge = false } = {},
  ) => formatFiatBalanceDisplay(value, { compactLarge });

  const formatBalance = (
    balance,
    { symbol = "", context = "CardItem", compactLarge = false } = {},
  ) =>
    formatCryptoBalanceDisplay(balance, {
      symbol,
      context,
      compactLarge,
    });

  const totalBalanceRaw = React.useMemo(() => {
    try {
      const sum = (Array.isArray(chainFilteredCards) ? chainFilteredCards : []).reduce(
        (total, card) => {
          if (!card || typeof card.balance === "undefined") return total;
          const converted = props.getConvertedBalance(
            card.balance,
            card.shortName,
            "AssetsPage.totalBalanceFiltered",
          );
          const n = Number(converted);
          return Number.isFinite(n) ? total + n : total;
        },
        0,
      );
      return sum.toFixed(2);
    } catch {
      return "0.00";
    }
  }, [chainFilteredCards, props.getConvertedBalance]);
  const totalBalanceNumber = Number(totalBalanceRaw);
  const totalBalanceDecimals = (() => {
    const raw = String(totalBalanceRaw || "");
    const fractional = raw.split(".")[1];
    return fractional ? fractional.length : 0;
  })();
  const totalBalanceValue = Number.isFinite(totalBalanceNumber)
    ? totalBalanceNumber
    : 0;
  const totalBalanceUseScientific = Math.abs(totalBalanceValue) >= 1e12;
  const totalBalanceDisplayText = formatFiatBalance(totalBalanceValue, {
    compactLarge: true,
  });

  // Derive the current account address used for "do not send to own address" (consistent with ContactFormModal reuse)
  const feeCardForNFT = React.useMemo(() => {
    const chainKey = selectedNFT?.queryChainName?.toLowerCase?.();
    const cards = Array.isArray(cryptoCards) ? cryptoCards : [];
    const feeSymbol = resolveGasFeeSymbolForChain(chainKey, cards);
    if (!feeSymbol) return null;
    return (
      cards.find(
        (c) =>
          c?.queryChainName?.toLowerCase?.() === chainKey &&
          String(c?.shortName || "").trim().toLowerCase() === feeSymbol,
      ) || null
    );
  }, [selectedNFT, cryptoCards]);

  const paymentAddressForNFT = React.useMemo(() => {
    const chainKey = selectedNFT?.queryChainName?.toLowerCase?.();
    const sameChainCard = (Array.isArray(cryptoCards) ? cryptoCards : []).find(
      (c) => c?.queryChainName?.toLowerCase?.() === chainKey,
    );
    const fallbackTarget = nftQueryTargets.find(
      ({ chain }) => String(chain || "").trim().toLowerCase() === chainKey,
    );
    return (
      feeCardForNFT?.address ||
      sameChainCard?.address ||
      String(
        selectedNFT?.walletAddress ||
          selectedNFT?.ownerAddress ||
          selectedNFT?.address ||
          "",
      ).trim() ||
      String(fallbackTarget?.address || "").trim()
    );
  }, [selectedNFT, cryptoCards, nftQueryTargets, feeCardForNFT]);

  const availableFeeCoinBalance = React.useMemo(() => {
    if (feeCardForNFT) {
      const cardBalance = parseFloat(getRuntimeBalance(feeCardForNFT?.balance));
      if (Number.isFinite(cardBalance)) return String(cardBalance);
    }
    const prefetchedBalance = parseFloat(prefetchedFeeBalance);
    return Number.isFinite(prefetchedBalance) ? String(prefetchedBalance) : "0";
  }, [feeCardForNFT, prefetchedFeeBalance]);

  const feeTokenMeta = React.useMemo(() => {
    return {
      symbol:
        feeCardForNFT?.shortName ||
        prefetchedFeeSymbol ||
        selectedNFT?.queryChainShortName ||
        "",
      priceUsd: getRuntimePriceUsd(feeCardForNFT?.priceUsd),
    };
  }, [feeCardForNFT, prefetchedFeeSymbol, selectedNFT]);

  useEffect(() => {
    setPrefetchedFeeBalance("");
    setPrefetchedFeeSymbol("");
  }, [selectedNFT]);

  // Button coloring that behaves consistent with ActivityScreen
  const buttonBackgroundColor = isDarkMode ? "#CCB68C" : "#CFAB95";
  const disabledButtonBackgroundColor = isDarkMode ? "#6c6c6c" : "#ccc";

  useEffect(() => {
    if (elevationTimerRef.current) {
      clearTimeout(elevationTimerRef.current);
      elevationTimerRef.current = null;
    }

    const hasValidSelection =
      typeof selectedCardIndex === "number" && selectedCardIndex >= 0;
    const shouldElevateLater = hasValidSelection && modalVisible && !isClosing;

    if (shouldElevateLater) {
      setElevatedCardIndex(null);
      elevationTimerRef.current = setTimeout(() => {
        setElevatedCardIndex(selectedCardIndex);
        elevationTimerRef.current = null;
      }, 100);
    } else {
      setElevatedCardIndex(null);
    }

    return () => {
      if (elevationTimerRef.current) {
        clearTimeout(elevationTimerRef.current);
        elevationTimerRef.current = null;
      }
    };
  }, [selectedCardIndex, modalVisible, isClosing]);

  const handleGallerySelect = (nft) => {
    setSelectedNFT(nft);
    if (typeof props.openNftDetail === "function") {
      props.openNftDetail(nft);
    }
  };

  const handleGalleryRefresh = () => {
    setGalleryRefreshing(true);
    Promise.race([
      fetchNFTData({
        targets: nftQueryTargets,
        fingerprint: nftQueryFingerprint,
      }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]).finally(() => setGalleryRefreshing(false));
  };

  const handleAddressChange = (text) => {
    const sanitizedAddress = String(text || "").replace(/\s+/g, "");
    setRecipientAddress(sanitizedAddress);
    const network = detectNetwork(
      sanitizedAddress,
      selectedNFT?.queryChainName || "",
    );
    setDetectedNetwork(network);
    setIsAddressValid(network !== "Invalid address");
  };

  const handleSaveNFTToDevice = async (nftOverride = null) => {
    const targetNft = nftOverride || selectedNFT;
    if (!targetNft) return;
    setSelectedNFT(targetNft);

    setTimeout(async () => {
      const { ok, device: readyDevice } = await ensureDeviceReady({
        device: props.device,
        devices,
        verifiedDevices: effectiveVerifiedDevices,
        setBleVisible,
        openBleModal: () => setBleVisibleExclusive(true),
      });
      if (!ok || !readyDevice) return;

      try {
        props.setCheckStatusProgress && props.setCheckStatusProgress(0);
      } catch {}
      try {
        props.setVerificationStatus && props.setVerificationStatus("nftSaving");
        setCheckStatusModalVisibleExclusive(true);
      } catch {}

      await handleSaveToDevice({
        selectedNFT: targetNft,
        device: readyDevice,
        ImageManipulator,
        FileSystem,
        Buffer,
        serviceUUID,
        writeCharacteristicUUID,
        notifyCharacteristicUUID,
        setVerificationStatus: props.setVerificationStatus,
        setCheckStatusModalVisible: setCheckStatusModalVisibleExclusive,
        setCheckStatusProgress: props.setCheckStatusProgress,
      });
    }, 300);
  };

  useEffect(() => {
    if (!props.nftRouteAction) return;
    const payload = props.nftRoutePayload || null;
    if (payload) {
      setSelectedNFT(payload);
    }
    if (props.nftRouteAction === "openSend") {
      setRecipientAddress("");
      requestAnimationFrame(() => {
        openSendModalWithPreflight(true);
      });
    } else if (props.nftRouteAction === "saveToDevice") {
      handleSaveNFTToDevice(payload);
    }
    if (typeof props.clearNftRouteAction === "function") {
      props.clearNftRouteAction();
    }
  }, [
    props.nftRouteAction,
    props.nftRoutePayload,
    props.clearNftRouteAction,
    handleSaveNFTToDevice,
    openSendModalWithPreflight,
  ]);

  const handleSendDigitalFromPreview = async (opts = {}) => {
    const chainKey = selectedNFT?.queryChainName?.toLowerCase?.();
    const fromCard = feeCardForNFT || (Array.isArray(cryptoCards) ? cryptoCards : []).find(
      (c) => c?.queryChainName?.toLowerCase?.() === chainKey,
    );
    const paymentAddress = fromCard?.address || paymentAddressForNFT || "";

    const monitor = createMonitorSignedResult({
      setModalStatus:
        props.setModalStatus ||
        ((status) => console.log("[Vault monitor] modalStatus:", status)),
      t,
      reconnectDevice:
        props.reconnectDevice ||
        ((d) => {
          try {
            d?.isConnected && d.connect?.();
          } catch {}
        }),
      selectedAddress: paymentAddress,
      monitorSubscription,
      addNotification: props.addNotification,
      setVerificationStatus: props.setVerificationStatus,
      setCheckStatusModalVisible: setCheckStatusModalVisibleExclusive,
      setErrorModalVisible: setErrorModalVisibleExclusive,
      setErrorModalMessage: props.setErrorModalMessage,
      isDarkMode,
    });

    const { ok, device: readyDevice } = await ensureDeviceReady({
      device: props.device,
      devices,
      verifiedDevices: effectiveVerifiedDevices,
      setBleVisible,
      openBleModal: () => setBleVisibleExclusive(true),
    });
    if (!ok || !readyDevice) return;

    try {
      props.setVerificationStatus && props.setVerificationStatus("txInit");
      setCheckStatusModalVisibleExclusive(true);
    } catch {}

    await handleSendDigital({
      selectedNFT,
      device: readyDevice,
      Buffer,
      serviceUUID,
      writeCharacteristicUUID,
      notifyCharacteristicUUID,
      recipientAddress,
      paymentAddress,
      setBleVisible: setBleVisibleExclusive,
      t,
      monitorSubscription,
      monitorSignedResult: monitor,
      setVerificationStatus: props.setVerificationStatus,
      setCheckStatusModalVisible: setCheckStatusModalVisibleExclusive,
      ...opts,
      isDarkMode,
    });
  };

  // Number masking: Generate 3~8 digit asterisks based on the number of digits (for total amount/card/fiat currency/percentage)
  const maskAmountStr = (val, { min = 3, max = 8 } = {}) => {
    try {
      const digits = String(val ?? "").replace(/[^0-9]/g, "");
      const n = Math.min(max, Math.max(min, digits.length || min));
      return "*".repeat(n);
    } catch {
      return "*".repeat(min);
    }
  };

  const renderChainButton = () => {
    return (
      <TouchableOpacity
        onPress={() =>
          openExclusiveModal(() => setChainSelectionModalVisible(true))
        }
        style={{
          marginTop: 10,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {selectedChain === "All" ? (
          <Image
            source={require("../../assets/branding/AssetsScreenLogo.webp")}
            style={VaultScreenStyle.chainAllIcon}
          />
        ) : (
          chainSelectorCards.length > 0 &&
          (() => {
            const uniqueChainIcons = new Set();
            return chainSelectorCards
              .filter((card) => {
                const shortName = card?.queryChainShortName;
                if (
                  selectedChain === shortName &&
                  resolveChainIcon(card?.queryChainName) &&
                  !uniqueChainIcons.has(shortName)
                ) {
                  uniqueChainIcons.add(shortName);
                  return true;
                }
                return false;
              })
              .map((card, index) => (
                <Image
                  key={`${card?.queryChainShortName}-${index}`}
                  source={resolveChainIcon(card?.queryChainName)}
                  style={VaultScreenStyle.chnSelIcn}
                />
              ));
          })()
        )}
        <Text style={{ color: isDarkMode ? "#FFFFFF" : "#000000" }}>
          {selectedChain === "All"
            ? t("All Chains")
            : (() => {
                const name = chainSelectorCards.find((card) => {
                  const shortName = card?.queryChainShortName;
                  return shortName === selectedChain;
                })?.queryChainName;
                return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
              })()}
        </Text>
      </TouchableOpacity>
    );
  };

  const galleryFilterCards = useMemo(() => {
    const list = nftData && nftData.code === "0" ? getNftListFromResponse(nftData) : [];
    if (list.length === 0) return [];

    const cardMap = new Map();
    (Array.isArray(cryptoCards) ? cryptoCards : []).forEach((card) => {
      const shortName = String(card?.queryChainShortName || "").trim();
      const chainName = normalizeChainName(card?.queryChainName);
      if (shortName && !cardMap.has(`short:${shortName}`)) {
        cardMap.set(`short:${shortName}`, card);
      }
      if (chainName && !cardMap.has(`name:${chainName}`)) {
        cardMap.set(`name:${chainName}`, card);
      }
    });

    const optionsMap = new Map();
    list.forEach((nft) => {
      const nftShortName = String(nft?.queryChainShortName || "").trim();
      const nftChainName = normalizeChainName(nft?.queryChainName);
      const matchedCard =
        cardMap.get(`short:${nftShortName}`) || cardMap.get(`name:${nftChainName}`);
      const key =
        nftShortName || String(matchedCard?.queryChainShortName || "").trim();
      if (!key || optionsMap.has(key)) return;

      const rawName =
        nft?.queryChainName ||
        matchedCard?.queryChainName ||
        matchedCard?.name ||
        key;

      optionsMap.set(key, {
        queryChainShortName: key,
        queryChainName:
          String(rawName).charAt(0).toUpperCase() + String(rawName).slice(1),
        chainIcon: resolveChainIcon(
          matchedCard?.queryChainName || nftChainName,
        ),
      });
    });

    return Array.from(optionsMap.values()).sort((a, b) =>
      String(a?.queryChainName || "").localeCompare(
        String(b?.queryChainName || ""),
      ),
    );
  }, [cryptoCards, nftData]);

  useEffect(() => {
    if (typeof props.onGalleryFilterCardsChange === "function") {
      props.onGalleryFilterCardsChange(galleryFilterCards);
    }
  }, [galleryFilterCards, props.onGalleryFilterCardsChange]);

  const filteredNftData = useMemo(() => {
    const list = nftData && nftData.code === "0" ? getNftListFromResponse(nftData) : [];

    if (selectedChain === "All") {
      return nftData;
    }

    const matchedChainNames = new Set(
      galleryFilterCards
        .filter((card) => {
          const shortName = card?.queryChainShortName;
          return shortName === selectedChain;
        })
        .map((card) => normalizeChainName(card?.queryChainName)),
    );

    const filteredList = list.filter((nft) => {
      const nftChainName = normalizeChainName(nft?.queryChainName);
      const nftChainShortName = String(nft?.queryChainShortName || "");
      return (
        nftChainShortName === selectedChain ||
        matchedChainNames.has(nftChainName)
      );
    });

    return {
      ...nftData,
      data: Array.isArray(nftData?.data)
        ? filteredList
        : {
            ...(nftData?.data && typeof nftData.data === "object" ? nftData.data : {}),
            items: filteredList,
          },
    };
  }, [galleryFilterCards, nftData, selectedChain]);


  return selectedView === "wallet" ? (
    <AssetsWalletPage
      scrollViewRef={scrollViewRef}
      scrollContainerRef={scrollContainerRef}
      onScrollContainerLayout={onScrollContainerLayout}
      VaultScreenStyle={VaultScreenStyle}
      modalVisible={modalVisible}
      isOpening={props.isOpening}
      hideOtherCards={hideOtherCards}
      isClosing={isClosing}
      cryptoCards={cryptoCards}
      refreshing={refreshing}
      onRefresh={onRefresh}
      opacityAnim={opacityAnim}
      totalBalanceRaw={totalBalanceRaw}
      totalBalanceValue={totalBalanceValue}
      totalBalanceDecimals={totalBalanceDecimals}
      totalBalanceDisplayText={totalBalanceDisplayText}
      totalBalanceUseScientific={totalBalanceUseScientific}
      currencyUnit={currencyUnit}
      t={t}
      renderChainButton={renderChainButton}
      selectedChain={selectedChain}
      chainFilteredCards={chainFilteredCards}
      priceChanges={props.priceChanges}
      getConvertedBalance={props.getConvertedBalance}
      formatFiatBalance={formatFiatBalance}
      handleQRCodePress={props.handleQRCodePress}
      onColorExtracted={props.onColorExtracted}
      isInitialLoading={props.isInitialLoading}
      isBalanceSyncing={props.isBalanceSyncing}
      isPriceLoading={props.isPriceLoading}
      selectedCardIndex={selectedCardIndex}
      selectCardOffsetOpenAni={selectCardOffsetOpenAni}
      selectCardOffsetCloseAni={selectCardOffsetCloseAni}
      elevateDuringReturn={elevateDuringReturn}
      cardRefs={cardRefs}
      initCardPosition={initCardPosition}
      onCardLayout={onCardLayout}
      cardLayoutYRef={props.cardLayoutYRef}
      handleCardPress={handleCardPress}
      isCardExpanded={isCardExpanded}
      formatBalance={formatBalance}
      hideNumbers={hideNumbers}
      setHideNumbers={setHideNumbers}
      hideNumbersByCard={props.hideNumbersByCard}
      getCardHideKey={props.getCardHideKey}
      onToggleCardHide={props.onToggleCardHide}
      freezeNumbers={freezeNumbers}
      bringToFrontCardIndex={elevatedCardIndex}
      scrollYOffset={props.scrollYOffset}
      renderTabView={props.renderTabView}
      maskAmountStr={maskAmountStr}
      isDarkMode={isDarkMode}
      tabRefreshLoading={tabRefreshLoading}
      setCryptoCards={props.setCryptoCards}
      scrollContainerAbsYRef={props.scrollContainerAbsYRef}
      onRequestDeleteCard={props.onRequestDeleteCard}
      selectedDeleteCardKeys={props.selectedDeleteCardKeys}
      onJiggleModeChange={props.onCardEditModeChange}
      exitEditRequested={!!props.exitEditRequested}
      onExitEditHandled={props.onExitEditHandled}
    />
  ) : (
    <AssetsGalleryPage
      VaultScreenStyle={VaultScreenStyle}
      isDarkMode={isDarkMode}
      t={t}
      modalVisible={modalVisible}
      isClosing={isClosing}
      renderChainButton={renderChainButton}
      showGalleryChainButton={galleryFilterCards.length > 0}
      galleryRefreshing={galleryRefreshing}
      onGalleryRefresh={handleGalleryRefresh}
      refreshing={refreshing}
      nftData={filteredNftData}
      scaleAnimsRef={scaleAnimsRef}
      animatePressIn={animatePressIn}
      animatePressOut={animatePressOut}
      handleGallerySelect={handleGallerySelect}
      selectedNFT={selectedNFT}
      sendModalVisible={sendModalVisible}
      setSendModalVisible={setSendModalVisible}
      recipientAddress={recipientAddress}
      detectedNetwork={detectedNetwork}
      isAddressValid={isAddressValid}
      handleAddressChange={handleAddressChange}
      handlePreview={handlePreview}
      paymentAddressForNFT={paymentAddressForNFT}
      buttonBackgroundColor={buttonBackgroundColor}
      disabledButtonBackgroundColor={disabledButtonBackgroundColor}
      previewModalVisible={previewModalVisible}
      setPreviewModalVisible={setPreviewModalVisible}
      availableFeeCoinBalance={availableFeeCoinBalance}
      feeTokenMeta={feeTokenMeta}
      handleSendDigital={handleSendDigitalFromPreview}
    />
  );
};

export default AssetsPage;
