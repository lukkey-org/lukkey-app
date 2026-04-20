/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  clamp,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withClamp,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import CardItem from "./CardItem";
import DataSkeleton from "./DataSkeleton";
import TotalBalanceHeader from "./TotalBalanceHeader";
import { resolveGasFeeSymbolForChain } from "../../config/gasFeeToken";
import { getBchQueryAddressesFromCard, isBchCard } from "../../utils/bchAddress";
import { getBtcQueryAddressesFromCard, isBtcCard } from "../../utils/btcAddress";

const getNftMintValue = (card) => String(card?.tokenId ?? card?.mint ?? "");

const AssetsWalletPage = ({
  scrollViewRef,
  scrollContainerRef,
  onScrollContainerLayout,
  VaultScreenStyle,
  modalVisible,
  isOpening,
  hideOtherCards,
  isClosing,
  cryptoCards,
  refreshing,
  onRefresh,
  opacityAnim,
  totalBalanceRaw,
  totalBalanceValue,
  totalBalanceDecimals,
  totalBalanceDisplayText,
  totalBalanceUseScientific,
  currencyUnit,
  t,
  renderChainButton,
  selectedChain,
  chainFilteredCards,
  priceChanges,
  getConvertedBalance,
  formatFiatBalance,
  handleQRCodePress,
  onColorExtracted,
  isInitialLoading,
  isBalanceSyncing,
  isPriceLoading,
  selectedCardIndex,
  selectCardOffsetOpenAni,
  selectCardOffsetCloseAni,
  elevateDuringReturn,
  cardRefs,
  initCardPosition,
  onCardLayout,
  handleCardPress,
  isCardExpanded,
  formatBalance,
  hideNumbers,
  setHideNumbers,
  hideNumbersByCard,
  getCardHideKey,
  onToggleCardHide,
  freezeNumbers,
  bringToFrontCardIndex,
  scrollYOffset,
  onRequestDeleteCard,
  selectedDeleteCardKeys = [],
  renderTabView,
  maskAmountStr,
  isDarkMode,
  tabRefreshLoading,
  setCryptoCards,
  scrollContainerAbsYRef,
  cardLayoutYRef,
  onJiggleModeChange,
  exitEditRequested,
  onExitEditHandled,
}) => {
  const ORDER_TAGS_KEY = "assetCardOrderTags";
  const entryAnimMapRef = React.useRef(new Map());
  const entryAnimatedKeysRef = React.useRef(new Set());
  const countUpTimerRef = React.useRef(null);
  const [allowTotalCountUp, setAllowTotalCountUp] = React.useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = React.useState(true);
  const [isJiggleMode, setIsJiggleMode] = React.useState(false);
  const [isDragReady, setIsDragReady] = React.useState(false);
  const isJiggleModeRef = React.useRef(false);
  const isDragReadyRef = React.useRef(false);
  const orderedCardsRef = React.useRef([]);
  const dataIndexByCardRef = React.useRef(new Map());
  const stableIdByDataIndexRef = React.useRef([]);
  const orderTagByIdRef = React.useRef({});
  const orderTagsLoadedRef = React.useRef(false);
  const lastSwapRef = React.useRef({ id: null, at: 0 });
  const autoScrollTimerRef = React.useRef(null);
  const listSkeletonGraceTimerRef = React.useRef(null);
  const autoScrollDirRef = React.useRef(null);
  const lastDragEntryTsRef = React.useRef(0);
  const lastDragDebugTsRef = React.useRef(0);
  const dragMoveCountRef = React.useRef(0);
  const scrollLock = useSharedValue(false);
  const frozenScrollY = useSharedValue(-1);
  const pullOffset = useSharedValue(0);
  const entryOffset = Math.min(
    120,
    Math.round(Dimensions.get("window").height * 0.2),
  );
  const scrollY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const maxScrollY = useSharedValue(0);
  const listHeightRef = React.useRef(0);
  const containerHeightRef = React.useRef(0);
  const [showInitialCardSkeleton, setShowInitialCardSkeleton] = React.useState(true);
  const [minimumSkeletonElapsed, setMinimumSkeletonElapsed] = React.useState(false);
  const [suppressListSkeleton, setSuppressListSkeleton] = React.useState(false);
  const initialSkeletonTimerRef = React.useRef(null);
  const cardSkeletonColors = React.useMemo(
    () =>
      isDarkMode
        ? [
            {
              cardBackground: "#B8ABDA",
              cardOverlay: "rgba(255,255,255,0.10)",
              accentBlock: "rgba(255,255,255,0.06)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.19)",
                shimmer: [
                  "rgba(255,255,255,0.10)",
                  "rgba(255,255,255,0.14)",
                  "rgba(255,255,255,0.20)",
                  "rgba(255,255,255,0.14)",
                  "rgba(255,255,255,0.10)",
                ],
              },
              iconDotSkeleton: {
                background: "#D6CDED",
                shimmer: ["#CFC6E7", "#D9D1EF", "#E4DDF5", "#D9D1EF", "#CFC6E7"],
              },
              skeleton: {
                background: "rgba(255,255,255,0.14)",
                shimmer: [
                  "rgba(255,255,255,0.07)",
                  "rgba(255,255,255,0.10)",
                  "rgba(255,255,255,0.15)",
                  "rgba(255,255,255,0.10)",
                  "rgba(255,255,255,0.07)",
                ],
              },
            },
            {
              cardBackground: "#9D8FCE",
              cardOverlay: "rgba(255,255,255,0.09)",
              accentBlock: "rgba(255,255,255,0.05)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.14)",
                shimmer: [
                  "rgba(255,255,255,0.07)",
                  "rgba(255,255,255,0.11)",
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.11)",
                  "rgba(255,255,255,0.07)",
                ],
              },
              iconDotSkeleton: {
                background: "#C8C0E0",
                shimmer: ["#C1B9D8", "#CBC4E2", "#D9D2EA", "#CBC4E2", "#C1B9D8"],
              },
              skeleton: {
                background: "rgba(255,255,255,0.12)",
                shimmer: [
                  "rgba(255,255,255,0.06)",
                  "rgba(255,255,255,0.09)",
                  "rgba(255,255,255,0.14)",
                  "rgba(255,255,255,0.09)",
                  "rgba(255,255,255,0.06)",
                ],
              },
            },
            {
              cardBackground: "#E2CC90",
              cardOverlay: "rgba(255,255,255,0.12)",
              accentBlock: "rgba(255,255,255,0.07)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.21)",
                shimmer: [
                  "rgba(255,255,255,0.12)",
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.23)",
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.12)",
                ],
              },
              iconDotSkeleton: {
                background: "#F0E6C9",
                shimmer: ["#E7DCBE", "#F0E7CB", "#F8F1DE", "#F0E7CB", "#E7DCBE"],
              },
              skeleton: {
                background: "rgba(255,255,255,0.16)",
                shimmer: [
                  "rgba(255,255,255,0.08)",
                  "rgba(255,255,255,0.11)",
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.11)",
                  "rgba(255,255,255,0.08)",
                ],
              },
            },
            {
              cardBackground: "#A5BFE4",
              cardOverlay: "rgba(255,255,255,0.10)",
              accentBlock: "rgba(255,255,255,0.06)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.14)",
                shimmer: [
                  "rgba(255,255,255,0.07)",
                  "rgba(255,255,255,0.10)",
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.10)",
                  "rgba(255,255,255,0.07)",
                ],
              },
              iconDotSkeleton: {
                background: "#CBD5E4",
                shimmer: ["#C3CDDC", "#CFD8E6", "#DCE4EE", "#CFD8E6", "#C3CDDC"],
              },
              skeleton: {
                background: "rgba(255,255,255,0.14)",
                shimmer: [
                  "rgba(255,255,255,0.07)",
                  "rgba(255,255,255,0.10)",
                  "rgba(255,255,255,0.15)",
                  "rgba(255,255,255,0.10)",
                  "rgba(255,255,255,0.07)",
                ],
              },
            },
          ]
        : [
            {
              cardBackground: "#DCCFF0",
              cardOverlay: "rgba(255,255,255,0.18)",
              accentBlock: "rgba(255,255,255,0.14)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.36)",
                shimmer: [
                  "rgba(255,255,255,0.24)",
                  "rgba(255,255,255,0.30)",
                  "rgba(255,255,255,0.40)",
                  "rgba(255,255,255,0.30)",
                  "rgba(255,255,255,0.24)",
                ],
              },
              iconDotSkeleton: {
                background: "#F1EAFB",
                shimmer: [
                  "#EAE3F6",
                  "#F2ECFB",
                  "#FBF8FE",
                  "#F2ECFB",
                  "#EAE3F6",
                ],
              },
              skeleton: {
                background: "rgba(255,255,255,0.38)",
                shimmer: [
                  "rgba(255,255,255,0.14)",
                  "rgba(255,255,255,0.22)",
                  "rgba(255,255,255,0.31)",
                  "rgba(255,255,255,0.22)",
                  "rgba(255,255,255,0.14)",
                ],
              },
            },
            {
              cardBackground: "#CDC3EB",
              cardOverlay: "rgba(255,255,255,0.16)",
              accentBlock: "rgba(255,255,255,0.12)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.34)",
                shimmer: [
                  "rgba(255,255,255,0.23)",
                  "rgba(255,255,255,0.28)",
                  "rgba(255,255,255,0.38)",
                  "rgba(255,255,255,0.28)",
                  "rgba(255,255,255,0.23)",
                ],
              },
              iconDotSkeleton: {
                background: "#EAE4F8",
                shimmer: [
                  "#E2DBF4",
                  "#ECE6F9",
                  "#F9F6FD",
                  "#ECE6F9",
                  "#E2DBF4",
                ],
              },
              skeleton: {
                background: "rgba(255,255,255,0.36)",
                shimmer: [
                  "rgba(255,255,255,0.12)",
                  "rgba(255,255,255,0.20)",
                  "rgba(255,255,255,0.29)",
                  "rgba(255,255,255,0.20)",
                  "rgba(255,255,255,0.12)",
                ],
              },
            },
            {
              cardBackground: "#E7D7A1",
              cardOverlay: "rgba(255,255,255,0.18)",
              accentBlock: "rgba(255,255,255,0.14)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.38)",
                shimmer: [
                  "rgba(255,255,255,0.26)",
                  "rgba(255,255,255,0.32)",
                  "rgba(255,255,255,0.42)",
                  "rgba(255,255,255,0.32)",
                  "rgba(255,255,255,0.26)",
                ],
              },
              iconDotSkeleton: {
                background: "#F8F0D5",
                shimmer: [
                  "#F1E5C5",
                  "#F8F0D9",
                  "#FEFCF2",
                  "#F8F0D9",
                  "#F1E5C5",
                ],
              },
              skeleton: {
                background: "rgba(255,255,255,0.40)",
                shimmer: [
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.24)",
                  "rgba(255,255,255,0.33)",
                  "rgba(255,255,255,0.24)",
                  "rgba(255,255,255,0.16)",
                ],
              },
            },
            {
              cardBackground: "#C6D8F0",
              cardOverlay: "rgba(255,255,255,0.18)",
              accentBlock: "rgba(255,255,255,0.14)",
              iconBubbleSkeleton: {
                background: "rgba(255,255,255,0.36)",
                shimmer: [
                  "rgba(255,255,255,0.24)",
                  "rgba(255,255,255,0.30)",
                  "rgba(255,255,255,0.40)",
                  "rgba(255,255,255,0.30)",
                  "rgba(255,255,255,0.24)",
                ],
              },
              iconDotSkeleton: {
                background: "#EBF3FC",
                shimmer: [
                  "#E2EBF7",
                  "#EDF4FB",
                  "#FBFDFE",
                  "#EDF4FB",
                  "#E2EBF7",
                ],
              },
              skeleton: {
                background: "rgba(255,255,255,0.38)",
                shimmer: [
                  "rgba(255,255,255,0.14)",
                  "rgba(255,255,255,0.22)",
                  "rgba(255,255,255,0.31)",
                  "rgba(255,255,255,0.22)",
                  "rgba(255,255,255,0.14)",
                ],
              },
            },
          ],
    [isDarkMode],
  );

  const renderCardListSkeleton = React.useCallback(() => {
    const textSkeletonRadius = 7;
    const topRowHeight = 20;
    const topRowBottom = 36;
    return Array.from({ length: 4 }).map((_, index) => (
      (() => {
        const palette = Array.isArray(cardSkeletonColors)
          ? cardSkeletonColors[index % cardSkeletonColors.length]
          : cardSkeletonColors;
        return (
      <View
        key={`asset-card-skeleton-${index}`}
        style={[
          VaultScreenStyle.cardContainer,
          {
            zIndex: index + 1,
          },
        ]}
      >
        <View
          style={[
            VaultScreenStyle.assetPageCard,
            index === 0 ? VaultScreenStyle.cardFirst : VaultScreenStyle.cardOthers,
            {
              position: "relative",
              overflow: "hidden",
              backgroundColor: palette.cardBackground,
            },
          ]}
        >
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: palette.cardOverlay,
            }}
          />

          <View style={{ position: "absolute", top: 16, left: 16, width: 60, height: 60 }}>
            <DataSkeleton
              width={40}
              height={40}
              isDarkMode={isDarkMode}
              colors={palette.iconBubbleSkeleton}
              style={{ borderRadius: 20 }}
            />
            <DataSkeleton
              width={16}
              height={16}
              isDarkMode={isDarkMode}
              colors={palette.iconDotSkeleton}
              style={{
                position: "absolute",
                top: 26,
                left: 28,
                borderRadius: 8,
              }}
            />
          </View>

          <View
            style={{
              position: "absolute",
              left: 71,
              right: 16,
              top: topRowBottom - topRowHeight,
              height: topRowHeight,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <View style={{ justifyContent: "flex-end", alignItems: "flex-start" }}>
              <DataSkeleton
                width={index % 2 === 0 ? 92 : 118}
                height={topRowHeight}
                isDarkMode={isDarkMode}
                colors={palette.skeleton}
                style={{ borderRadius: textSkeletonRadius }}
              />
            </View>
            <View style={{ justifyContent: "flex-end", alignItems: "flex-end" }}>
              <DataSkeleton
                width={index % 2 === 0 ? 92 : 106}
                height={topRowHeight}
                isDarkMode={isDarkMode}
                colors={palette.skeleton}
                style={{ borderRadius: textSkeletonRadius }}
              />
            </View>
          </View>

          <View style={{ position: "absolute", top: 42, left: 71 }}>
            <DataSkeleton
              width={index % 2 === 0 ? 62 : 74}
              height={16}
              isDarkMode={isDarkMode}
              colors={palette.skeleton}
              style={{ borderRadius: textSkeletonRadius }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 50,
                top: -60,
                opacity: 0.16,
                width: 280,
                height: 280,
                borderRadius: 48,
                backgroundColor: palette.accentBlock,
                transform: [{ rotate: "-10deg" }],
              }}
            />
          </View>

          <View
            style={{
              position: "absolute",
              top: 42,
              right: 16,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
            }}
          >
            <DataSkeleton
              width={52}
              height={18}
              isDarkMode={isDarkMode}
              colors={palette.skeleton}
              style={{ borderRadius: textSkeletonRadius }}
            />
            <DataSkeleton
              width={66}
              height={18}
              isDarkMode={isDarkMode}
              colors={palette.skeleton}
              style={{ borderRadius: textSkeletonRadius }}
            />
          </View>

        </View>
      </View>
        );
      })()
    ));
  }, [VaultScreenStyle, cardSkeletonColors, isDarkMode]);

  const updateMaxScroll = React.useCallback(() => {
    const max = Math.max(0, listHeightRef.current - containerHeightRef.current);
    maxScrollY.value = max;
    if (scrollY.value > max) {
      scrollY.value = max;
    }
  }, [maxScrollY, scrollY]);

  const updateScrollOffset = React.useCallback(
    (value) => {
      if (!modalVisible && scrollYOffset?.current !== undefined) {
        scrollYOffset.current = value;
      }
    },
    [modalVisible, scrollYOffset],
  );

  React.useEffect(() => {
    scrollLock.value = !!(modalVisible || isOpening || isClosing);
  }, [isClosing, isOpening, modalVisible, scrollLock]);

  React.useEffect(() => {
    if (modalVisible || isOpening || isClosing) {
      setIsJiggleMode(false);
    }
  }, [isClosing, isOpening, modalVisible]);

  React.useEffect(() => {
    if (chainFilteredCards.length === 0) {
      setIsJiggleMode(false);
    }
  }, [chainFilteredCards.length]);

  React.useEffect(() => {
    onJiggleModeChange?.(isJiggleMode);
  }, [isJiggleMode, onJiggleModeChange]);

  React.useEffect(() => {
    if (!exitEditRequested) return;
    if (isJiggleMode) {
      AsyncStorage.setItem(
        ORDER_TAGS_KEY,
        JSON.stringify(orderTagByIdRef.current || {}),
      ).catch(() => {});
      setIsJiggleMode(false);
      setIsDragReady(false);
    }
    onExitEditHandled?.();
  }, [exitEditRequested, isJiggleMode, onExitEditHandled]);

  const exitJiggleMode = React.useCallback(() => {
    if (!isJiggleModeRef.current) return;
    AsyncStorage.setItem(
      ORDER_TAGS_KEY,
      JSON.stringify(orderTagByIdRef.current || {}),
    ).catch(() => {});
    setIsJiggleMode(false);
    setIsDragReady(false);
  }, []);

  const handleCardLongPress = React.useCallback(() => {
    if (modalVisible || isOpening || isClosing) return;
    // Long press to enter card shaking mode (card editing mode)
    setIsJiggleMode((prev) => !prev);
  }, [isClosing, isOpening, modalVisible]);

  const handleCardDragReady = React.useCallback((_card, _index) => {
    isDragReadyRef.current = true;
    setIsDragReady(true);
    setIsScrollEnabled(false);
  }, []);

  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    autoScrollDirRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!isJiggleMode) {
      stopAutoScroll();
      isDragReadyRef.current = false;
      setIsDragReady(false);
      setIsScrollEnabled(true);
    }
  }, [isJiggleMode, stopAutoScroll]);

  React.useEffect(() => {
    isJiggleModeRef.current = isJiggleMode;
  }, [isJiggleMode]);

  React.useEffect(() => {
    isDragReadyRef.current = isDragReady;
  }, [isDragReady]);

  const getCardIdentityAddress = React.useCallback((card) => {
    if (!card) return "";
    if (!isBchCard(card) && !isBtcCard(card)) {
      return card?.address ? String(card.address).toLowerCase() : "";
    }
    const addresses = isBchCard(card)
      ? getBchQueryAddressesFromCard(card)
      : getBtcQueryAddressesFromCard(card);
    return addresses
      .map((address) => String(address || "").trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join("|");
  }, []);

  const getStableId = React.useCallback((card) => {
    const chain = card?.queryChainName || card?.queryChainShortName || "chain";
    const address = getCardIdentityAddress(card);
    const contract =
      card?.contractAddress ||
      card?.contract_address ||
      card?.tokenContractAddress ||
      "";
    const tokenId = getNftMintValue(card);
    const symbol = card?.shortName || "";
    const name = card?.name || "card";
    return `${chain}:${address}:${String(contract).toLowerCase()}:${String(
      tokenId,
    ).toLowerCase()}:${String(symbol).toLowerCase()}:${String(
      name,
    ).toLowerCase()}`;
  }, [getCardIdentityAddress]);

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
    const tokenId = getNftMintValue(card).toLowerCase();
    return `${chain}|${name}|${address}|${contract}|${tokenId}`;
  }, []);

  const selectedDeleteKeySet = React.useMemo(
    () => new Set(selectedDeleteCardKeys || []),
    [selectedDeleteCardKeys],
  );

  // Only one "network fee token" is marked per chain (coin_type=native is preferred)
  const gasFeeSymbolByChain = React.useMemo(() => {
    const map = new Map();
    const chainSet = new Set(
      (cryptoCards || [])
        .map((c) =>
          String(c?.queryChainName || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    chainSet.forEach((chain) => {
      const feeSymbol = resolveGasFeeSymbolForChain(chain, cryptoCards || []);
      if (feeSymbol) map.set(chain, feeSymbol);
    });
    return map;
  }, [cryptoCards]);

  const dataIndexByCard = React.useMemo(() => {
    const map = new Map();
    (cryptoCards || []).forEach((card, idx) => {
      map.set(card, idx);
    });
    return map;
  }, [cryptoCards]);

  const stableIdByDataIndex = React.useMemo(() => {
    const seen = new Map();
    return (cryptoCards || []).map((card, idx) => {
      const base = getStableId(card) || `card:${idx}`;
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}#${idx}`;
    });
  }, [cryptoCards, getStableId]);

  React.useEffect(() => {
    dataIndexByCardRef.current = dataIndexByCard;
    stableIdByDataIndexRef.current = stableIdByDataIndex;
  }, [dataIndexByCard, stableIdByDataIndex]);

  const [orderTagById, setOrderTagById] = React.useState({});

  React.useEffect(() => {
    const idSet = new Set(stableIdByDataIndex);
    setOrderTagById((prev) => {
      let changed = false;
      const next = { ...prev };
      stableIdByDataIndex.forEach((id, idx) => {
        if (next[id] == null) {
          next[id] = idx;
          changed = true;
        }
      });
      Object.keys(next).forEach((id) => {
        if (!idSet.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [stableIdByDataIndex]);

  React.useEffect(() => {
    orderTagByIdRef.current = orderTagById;
  }, [orderTagById]);

  React.useEffect(() => {
    if (orderTagsLoadedRef.current) return;
    if (!stableIdByDataIndex.length) return;
    orderTagsLoadedRef.current = true;
    AsyncStorage.getItem(ORDER_TAGS_KEY)
      .then((raw) => {
        if (!raw) return;
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        if (!parsed || typeof parsed !== "object") return;
        const idSet = new Set(stableIdByDataIndex);
        setOrderTagById((prev) => {
          const next = { ...prev };
          Object.keys(parsed).forEach((id) => {
            if (idSet.has(id) && Number.isFinite(parsed[id])) {
              next[id] = parsed[id];
            }
          });
          return next;
        });
      })
      .catch(() => {});
  }, [stableIdByDataIndex]);

  const orderedCards = React.useMemo(() => {
    const list = (chainFilteredCards || []).map((card) => {
      const dataIndex = dataIndexByCard.get(card);
      const stableId =
        Number.isInteger(dataIndex) && stableIdByDataIndex[dataIndex]
          ? stableIdByDataIndex[dataIndex]
          : getStableId(card);
      const orderTag = orderTagById[stableId];
      return {
        card,
        dataIndex: Number.isInteger(dataIndex) ? dataIndex : -1,
        stableId,
        orderTag: Number.isFinite(orderTag)
          ? orderTag
          : Number.isInteger(dataIndex)
            ? dataIndex
            : 0,
      };
    });
    return list.sort((a, b) => a.orderTag - b.orderTag);
  }, [
    chainFilteredCards,
    dataIndexByCard,
    getStableId,
    orderTagById,
    stableIdByDataIndex,
  ]);

  React.useEffect(() => {
    orderedCardsRef.current = orderedCards;
  }, [orderedCards]);

  const walletSyncReady = !isInitialLoading && !isBalanceSyncing;

  React.useEffect(() => {
    if (!showInitialCardSkeleton) return;
    if (!walletSyncReady) return;
    if (minimumSkeletonElapsed) return;
    if (initialSkeletonTimerRef.current) return;

    initialSkeletonTimerRef.current = setTimeout(() => {
      initialSkeletonTimerRef.current = null;
      setMinimumSkeletonElapsed(true);
    }, 620);
  }, [minimumSkeletonElapsed, showInitialCardSkeleton, walletSyncReady]);

  React.useEffect(() => {
    if (showInitialCardSkeleton) return;
    if (!initialSkeletonTimerRef.current) return;
    clearTimeout(initialSkeletonTimerRef.current);
    initialSkeletonTimerRef.current = null;
  }, [showInitialCardSkeleton]);

  React.useEffect(() => {
    if (!showInitialCardSkeleton || modalVisible || isOpening || isClosing) return;
    if (!walletSyncReady) return;
    if (!minimumSkeletonElapsed) return;

    const bootstrapFinished =
      orderedCards.length > 0 ||
      (!isInitialLoading && !isBalanceSyncing && !isPriceLoading);

    if (bootstrapFinished) {
      setShowInitialCardSkeleton(false);
    }
  }, [
    isBalanceSyncing,
    isClosing,
    isInitialLoading,
    isOpening,
    isPriceLoading,
    minimumSkeletonElapsed,
    modalVisible,
    orderedCards.length,
    showInitialCardSkeleton,
    walletSyncReady,
  ]);

  React.useEffect(() => {
    if (showInitialCardSkeleton || orderedCards.length === 0) return;
    setSuppressListSkeleton(true);
    if (listSkeletonGraceTimerRef.current) {
      clearTimeout(listSkeletonGraceTimerRef.current);
    }
    // Keep card waterfall entry visible long enough before any secondary sync skeleton can take over.
    listSkeletonGraceTimerRef.current = setTimeout(() => {
      setSuppressListSkeleton(false);
      listSkeletonGraceTimerRef.current = null;
    }, 1600);
  }, [orderedCards.length, showInitialCardSkeleton]);

  const showHeaderSkeletonState =
    isInitialLoading ||
    isBalanceSyncing ||
    isPriceLoading ||
    showInitialCardSkeleton;
  const hasRenderableCards = orderedCards.length > 0;
  // Once the first waterfall cards are on screen, keep the card list visible.
  // Follow-up balance/price sync should not swap the list back to skeleton.
  const keepCardListVisible = hasRenderableCards && !showInitialCardSkeleton;
  const shouldSuppressListSkeleton =
    suppressListSkeleton &&
    !modalVisible &&
    !isOpening &&
    !isClosing &&
    hasRenderableCards;
  const showCardListSkeleton =
    !modalVisible &&
    !keepCardListVisible &&
    showHeaderSkeletonState &&
    !shouldSuppressListSkeleton;

  React.useEffect(() => {
    if (modalVisible || isOpening || isClosing) return;
    scrollY.value = 0;
    frozenScrollY.value = -1;
    pullOffset.value = 0;
    runOnJS(updateScrollOffset)(0);
  }, [
    frozenScrollY,
    isClosing,
    isOpening,
    modalVisible,
    pullOffset,
    scrollY,
    selectedChain,
    updateScrollOffset,
  ]);

  const startAutoScroll = React.useCallback(
    (direction) => {
      if (autoScrollDirRef.current === direction) return;
      stopAutoScroll();
      autoScrollDirRef.current = direction;
      autoScrollTimerRef.current = setInterval(() => {
        if (!scrollViewRef?.current?.scrollTo) return;
        const current = scrollY.value;
        const next =
          direction === "up"
            ? Math.max(0, current - 10)
            : Math.min(maxScrollY.value, current + 10);
        if (next === current) {
          stopAutoScroll();
          return;
        }
        scrollViewRef.current.scrollTo({ y: next, animated: false });
      }, 16);
    },
    [maxScrollY, scrollViewRef, scrollY, stopAutoScroll],
  );

  const handleCardDragMove = React.useCallback(
    ({ card, moveY, dy }) => {
      if (!isJiggleModeRef.current || !isDragReadyRef.current) return;
      const swapThreshold = 8;
      const swapCooldownMs = 120;
      const ordered = orderedCardsRef.current || [];
      if (Array.isArray(ordered) && ordered.length > 1) {
        const dataIndex = dataIndexByCardRef.current.get(card);
        const stableId =
          Number.isInteger(dataIndex) &&
          stableIdByDataIndexRef.current[dataIndex]
            ? stableIdByDataIndexRef.current[dataIndex]
            : getStableId(card);
        const currentIndex = ordered.findIndex(
          (item) => item.stableId === stableId,
        );
        if (currentIndex >= 0) {
          const currentLayoutY = Number.isInteger(dataIndex)
            ? cardLayoutYRef?.current?.[dataIndex]
            : undefined;
          if (__DEV__) {
            const now = Date.now();
            if (now - lastDragDebugTsRef.current > 300) {
              lastDragDebugTsRef.current = now;
              console.log("[CardJiggle] live move (layout)", {
                index: currentIndex,
                currentLayoutY,
              });
            }
          }
          if (Number.isFinite(currentLayoutY)) {
            const targetY = currentLayoutY + dy;
            const movingDown = dy > 0;
            const movingUp = dy < 0;
            if (movingDown && currentIndex < ordered.length - 1) {
              const nextItem = ordered[currentIndex + 1];
              const nextLayoutY = Number.isInteger(nextItem?.dataIndex)
                ? cardLayoutYRef?.current?.[nextItem.dataIndex]
                : undefined;
              if (
                Number.isFinite(nextLayoutY) &&
                targetY >= nextLayoutY + swapThreshold
              ) {
                const now = Date.now();
                if (
                  lastSwapRef.current.id === stableId &&
                  now - lastSwapRef.current.at < swapCooldownMs
                ) {
                  return;
                }
                lastSwapRef.current = { id: stableId, at: now };
                setOrderTagById((prev) => {
                  const fromTag = prev[stableId];
                  const toTag = prev[nextItem.stableId];
                  if (!Number.isFinite(fromTag) || !Number.isFinite(toTag)) {
                    return prev;
                  }
                  return {
                    ...prev,
                    [stableId]: toTag,
                    [nextItem.stableId]: fromTag,
                  };
                });
              }
            } else if (movingUp && currentIndex > 0) {
              const prevItem = ordered[currentIndex - 1];
              const prevLayoutY = Number.isInteger(prevItem?.dataIndex)
                ? cardLayoutYRef?.current?.[prevItem.dataIndex]
                : undefined;
              if (
                Number.isFinite(prevLayoutY) &&
                targetY <= prevLayoutY - swapThreshold
              ) {
                const now = Date.now();
                if (
                  lastSwapRef.current.id === stableId &&
                  now - lastSwapRef.current.at < swapCooldownMs
                ) {
                  return;
                }
                lastSwapRef.current = { id: stableId, at: now };
                setOrderTagById((prev) => {
                  const fromTag = prev[stableId];
                  const toTag = prev[prevItem.stableId];
                  if (!Number.isFinite(fromTag) || !Number.isFinite(toTag)) {
                    return prev;
                  }
                  return {
                    ...prev,
                    [stableId]: toTag,
                    [prevItem.stableId]: fromTag,
                  };
                });
              }
            }
          }
        }
      }
      const containerTop = Number(scrollContainerAbsYRef?.current) || 0;
      const containerHeight = containerHeightRef.current || 0;
      if (!containerHeight) return;
      const edge = 60;
      const topEdge = containerTop + edge;
      const bottomEdge = containerTop + containerHeight - edge;
      if (moveY < topEdge) {
        startAutoScroll("up");
      } else if (moveY > bottomEdge) {
        startAutoScroll("down");
      } else {
        stopAutoScroll();
      }
    },
    [getStableId, scrollContainerAbsYRef, startAutoScroll, stopAutoScroll],
  );

  const handleCardDragEnd = React.useCallback(
    () => {
      stopAutoScroll();
      isDragReadyRef.current = false;
      setIsDragReady(false);
      setIsScrollEnabled(true);
      if (!isJiggleModeRef.current) return;
    },
    [stopAutoScroll],
  );

  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(
          !modalVisible &&
            !isOpening &&
            cryptoCards.length > 0 &&
            isScrollEnabled,
        )
        .onBegin(() => {
          if (scrollLock.value) return;
          cancelAnimation(scrollY);
          dragStartY.value = scrollY.value;
        })
        .onUpdate((event) => {
          if (scrollLock.value) return;
          if (
            !isJiggleMode &&
            scrollY.value <= 0 &&
            event.translationY > 0 &&
            !refreshing
          ) {
            pullOffset.value = Math.min(event.translationY, 90);
          } else if (!refreshing) {
            pullOffset.value = 0;
          }
          scrollY.value = clamp(
            dragStartY.value - event.translationY,
            0,
            maxScrollY.value,
          );
        })
        .onEnd((event) => {
          if (scrollLock.value) {
            pullOffset.value = withTiming(0, { duration: 180 });
            return;
          }
          if (!isJiggleMode && !refreshing && pullOffset.value >= 80) {
            runOnJS(onRefresh)();
            pullOffset.value = withTiming(50, { duration: 180 });
          } else if (!refreshing) {
            pullOffset.value = withTiming(0, { duration: 180 });
          }
          scrollY.value = withClamp(
            { min: 0, max: maxScrollY.value },
            withDecay({ velocity: -event.velocityY }),
          );
        }),
    [
      cryptoCards.length,
      dragStartY,
      isScrollEnabled,
      isJiggleMode,
      isOpening,
      maxScrollY,
      modalVisible,
      onRefresh,
      pullOffset,
      refreshing,
      scrollLock,
      scrollY,
    ],
  );

  const contentAnimatedStyle = useAnimatedStyle(() => {
    const effectiveScrollY =
      frozenScrollY.value >= 0 ? frozenScrollY.value : scrollY.value;
    return {
      transform: [{ translateY: -effectiveScrollY + pullOffset.value }],
    };
  });
  const shouldHideOtherCards =
    hideOtherCards || isOpening || (modalVisible && !isClosing);
  const getCardKey = React.useCallback((card, index) => {
    const chain = card?.queryChainName || card?.queryChainShortName || "chain";
    const address = getCardIdentityAddress(card);
    const name = card?.shortName || card?.name || "card";
    return `${chain}:${address || name}:${index}`;
  }, [getCardIdentityAddress]);

  const getEntryAnim = React.useCallback((key) => {
    if (!entryAnimMapRef.current.has(key)) {
      const initialValue = entryAnimatedKeysRef.current.has(key) ? 1 : 0;
      entryAnimMapRef.current.set(key, new Animated.Value(initialValue));
    }
    return entryAnimMapRef.current.get(key);
  }, []);

  React.useLayoutEffect(() => {
    if (chainFilteredCards.length === 0) {
      if (countUpTimerRef.current) {
        clearTimeout(countUpTimerRef.current);
        countUpTimerRef.current = null;
      }
      setAllowTotalCountUp(false);
      entryAnimatedKeysRef.current.clear();
      entryAnimMapRef.current.clear();
      return;
    }
    if (modalVisible || isClosing || isOpening || isInitialLoading || showInitialCardSkeleton) {
      if (countUpTimerRef.current) {
        clearTimeout(countUpTimerRef.current);
        countUpTimerRef.current = null;
      }
      setAllowTotalCountUp(false);
      return;
    }

    const newKeys = orderedCards
      .map((item, uiIndex) => {
        const stableIndex =
          Number.isInteger(item?.dataIndex) && item.dataIndex >= 0
            ? item.dataIndex
            : uiIndex;
        return getCardKey(item?.card, stableIndex);
      })
      .filter((key) => !entryAnimatedKeysRef.current.has(key));
    if (newKeys.length === 0) {
      if (!countUpTimerRef.current) {
        setAllowTotalCountUp(false);
      }
      return;
    }

    const animations = newKeys.map((key) => {
      const anim = getEntryAnim(key);
      anim.stopAnimation();
      anim.setValue(0);
      return Animated.timing(anim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    });
    newKeys.forEach((key) => entryAnimatedKeysRef.current.add(key));
    Animated.stagger(70, animations).start();
    setAllowTotalCountUp(true);
    if (countUpTimerRef.current) {
      clearTimeout(countUpTimerRef.current);
    }
    countUpTimerRef.current = setTimeout(() => {
      countUpTimerRef.current = null;
      setAllowTotalCountUp(false);
    }, 760);
  }, [
    chainFilteredCards,
    orderedCards,
    modalVisible,
    isClosing,
    isOpening,
    isInitialLoading,
    showInitialCardSkeleton,
    getCardKey,
    getEntryAnim,
  ]);

  React.useEffect(() => {
    return () => {
      if (countUpTimerRef.current) {
        clearTimeout(countUpTimerRef.current);
        countUpTimerRef.current = null;
      }
      if (listSkeletonGraceTimerRef.current) {
        clearTimeout(listSkeletonGraceTimerRef.current);
        listSkeletonGraceTimerRef.current = null;
      }
      if (initialSkeletonTimerRef.current) {
        clearTimeout(initialSkeletonTimerRef.current);
        initialSkeletonTimerRef.current = null;
      }
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    };
  }, []);

  useAnimatedReaction(
    () => scrollY.value,
    (value) => {
      runOnJS(updateScrollOffset)(value);
    },
    [updateScrollOffset],
  );

  React.useEffect(() => {
    if (!modalVisible && !isOpening && !isClosing) {
      frozenScrollY.value = -1;
    }
  }, [frozenScrollY, isClosing, isOpening, modalVisible]);

  React.useEffect(() => {
    pullOffset.value = refreshing
      ? withTiming(50, { duration: 180 })
      : withTiming(0, { duration: 180 });
  }, [pullOffset, refreshing]);

  React.useEffect(() => {
    if (isJiggleMode) {
      pullOffset.value = withTiming(0, { duration: 120 });
    }
  }, [isJiggleMode, pullOffset]);

  const refreshIndicatorStyle = useAnimatedStyle(() => ({
    height: pullOffset.value,
    opacity: Math.min(1, pullOffset.value / 80),
  }));

  const scrollToPosition = React.useCallback(
    ({ y = 0, animated = false } = {}) => {
      const clamped = Math.max(0, Math.min(y, maxScrollY.value));
      scrollY.value = animated
        ? withTiming(clamped, { duration: 250 })
        : clamped;
    },
    [maxScrollY, scrollY],
  );

  const freezeScrollPosition = React.useCallback(() => {
    frozenScrollY.value = scrollY.value;
  }, [frozenScrollY, scrollY]);

  const releaseScrollFreeze = React.useCallback(() => {
    frozenScrollY.value = -1;
  }, [frozenScrollY]);

  React.useEffect(() => {
    if (!scrollViewRef) return;
    scrollViewRef.current = {
      scrollTo: scrollToPosition,
      freezeScrollPosition,
      releaseScrollFreeze,
      setNativeProps: (props = {}) => {
        if (typeof props.scrollEnabled === "boolean") {
          setIsScrollEnabled(props.scrollEnabled);
        }
      },
    };
    return () => {
      scrollViewRef.current = null;
    };
  }, [
    freezeScrollPosition,
    releaseScrollFreeze,
    scrollToPosition,
    scrollViewRef,
    setIsScrollEnabled,
  ]);

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <View
          style={[
            VaultScreenStyle.scrollView,
            {
              overflow: "hidden",
              flex: 1,
              alignSelf: "stretch",
            },
          ]}
          ref={scrollContainerRef}
          onLayout={(event) => {
            containerHeightRef.current = event.nativeEvent.layout.height;
            updateMaxScroll();
            onScrollContainerLayout?.(event);
          }}
        >
          <Reanimated.View
            pointerEvents="none"
            style={[
              VaultScreenStyle.refreshTipView,
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                justifyContent: "center",
                alignItems: "center",
              },
              refreshIndicatorStyle,
            ]}
          >
            <ActivityIndicator
              size="small"
              color={isDarkMode ? "#FFFFFF" : "#333333"}
              style={{ marginBottom: 6 }}
            />
            <Text style={VaultScreenStyle.refreshTipText}>
              {refreshing ? t("Refreshing…") : t("Pull down to refresh")}
            </Text>
          </Reanimated.View>
          <Pressable
            style={{ flexGrow: 1 }}
            onPress={isJiggleMode ? exitJiggleMode : undefined}
          >
            <Reanimated.View
              style={[
                VaultScreenStyle.scrViewCont,
                modalVisible &&
                  !isClosing && { overflow: "hidden", minHeight: "100%" },
                cryptoCards.length !== 0 && { paddingBottom: 130 },
                contentAnimatedStyle,
              ]}
              onLayout={(event) => {
                listHeightRef.current = event.nativeEvent.layout.height;
                updateMaxScroll();
              }}
            >
              {(cryptoCards.length > 0 || showHeaderSkeletonState) &&
                (!modalVisible || isClosing) && (
                <TotalBalanceHeader
                  VaultScreenStyle={VaultScreenStyle}
                  opacityAnim={opacityAnim}
                  isOpening={isOpening}
                  isInitialLoading={isInitialLoading}
                  isBalanceSyncing={isBalanceSyncing}
                  isPriceLoading={isPriceLoading}
                  modalVisible={modalVisible}
                  isClosing={isClosing}
                hideNumbers={hideNumbers}
                setHideNumbers={setHideNumbers}
                totalBalanceRaw={totalBalanceRaw}
                totalBalanceValue={totalBalanceValue}
                totalBalanceDecimals={totalBalanceDecimals}
                totalBalanceDisplayText={totalBalanceDisplayText}
                totalBalanceUseScientific={totalBalanceUseScientific}
                currencyUnit={currencyUnit}
                allowTotalCountUp={allowTotalCountUp}
                maskAmountStr={maskAmountStr}
                isDarkMode={isDarkMode}
                renderChainButton={renderChainButton}
                t={t}
              />
            )}

              {showCardListSkeleton
                ? renderCardListSkeleton()
                : orderedCards.map((item, uiIndex) => {
                const { card, dataIndex } = item;
                const stableIndex =
                  Number.isInteger(dataIndex) && dataIndex >= 0
                    ? dataIndex
                    : uiIndex;
                const isBlackText = [""].includes(card.shortName);
                const priceChange =
                  priceChanges[card.shortName]?.priceChange || "0";
                const percentageChange =
                  priceChanges[card.shortName]?.percentageChange || "0";
                if (
                  shouldHideOtherCards &&
                  selectedCardIndex != null &&
                  selectedCardIndex !== stableIndex
                ) {
                  return null;
                }
                const entryKey = getCardKey(card, stableIndex);
                const entryAnim = getEntryAnim(entryKey);
                const cardHideKey = getCardHideKey?.(card);
                const deleteCardKey = getDeleteCardKey(card);
                const chainKey = String(card?.queryChainName || "")
                  .trim()
                  .toLowerCase();
                const symbolKey = String(card?.shortName || "")
                  .trim()
                  .toLowerCase();
                const showGasFeeIcon =
                  !!chainKey &&
                  !!symbolKey &&
                  gasFeeSymbolByChain.get(chainKey) === symbolKey;
                const isCardHidden =
                  hideNumbers ||
                  (cardHideKey && hideNumbersByCard?.[cardHideKey]);
                const textColor =
                  percentageChange > 0
                    ? isBlackText
                      ? "#00EE88"
                      : "#00EE88"
                    : isBlackText
                      ? "#F44336"
                      : "#F44336";

                return (
                  <CardItem
                    key={entryKey}
                    card={card}
                    index={stableIndex}
                    orderIndex={uiIndex}
                    modalVisible={modalVisible && !isClosing}
                    hideOtherCards={shouldHideOtherCards}
                    isClosing={isClosing}
                    elevateDuringReturn={elevateDuringReturn}
                    selectedCardIndex={selectedCardIndex}
                    selectCardOffsetOpenAni={selectCardOffsetOpenAni}
                    selectCardOffsetCloseAni={selectCardOffsetCloseAni}
                    VaultScreenStyle={VaultScreenStyle}
                    isBlackText={isBlackText}
                    cardRefs={cardRefs}
                    initCardPosition={initCardPosition}
                    onCardLayout={onCardLayout}
                    handleCardPress={handleCardPress}
                    isCardExpanded={isCardExpanded}
                    formatBalance={formatBalance}
                    formatFiatBalance={formatFiatBalance}
                    currencyUnit={currencyUnit}
                    textColor={textColor}
                    percentageChange={percentageChange}
                    getConvertedBalance={getConvertedBalance}
                    handleQRCodePress={handleQRCodePress}
                    onColorExtracted={onColorExtracted}
                    entryAnim={entryAnim}
                    entryOffset={entryOffset}
                    isDataLoading={
                      isBalanceSyncing ||
                      ((isInitialLoading || isPriceLoading) &&
                        modalVisible &&
                        !isClosing) ||
                      refreshing ||
                      (tabRefreshLoading && modalVisible)
                    }
                    isDarkMode={isDarkMode}
                    hideNumbers={isCardHidden}
                    freezeNumbers={freezeNumbers}
                    bringToFrontCardIndex={bringToFrontCardIndex}
                    onToggleCardHide={onToggleCardHide}
                    scrollYOffset={scrollYOffset}
                    scrollContainerAbsYRef={scrollContainerAbsYRef}
                    cardLayoutYRef={cardLayoutYRef}
                    isDeleteSelected={selectedDeleteKeySet.has(deleteCardKey)}
                    showGasFeeIcon={showGasFeeIcon}
                    onDeletePress={(pressedCard) =>
                      onRequestDeleteCard?.(pressedCard, deleteCardKey)
                    }
                    scrollLock={scrollLock}
                    isJiggleMode={isJiggleMode}
                    onCardLongPress={handleCardLongPress}
                    onCardDragReady={handleCardDragReady}
                    onCardDragMove={handleCardDragMove}
                    onCardDragEnd={handleCardDragEnd}
                    t={t}
                  />
                );
              })}
            </Reanimated.View>
          </Pressable>
        </View>
      </GestureDetector>

      {renderTabView && renderTabView()}
    </>
  );
};

export default AssetsWalletPage;
