/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// TabView.js
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Animated,
  Easing,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import PriceChartCom from "../AssetsScreen/PriceChart";
import { LinearGradient } from "expo-linear-gradient";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  resolveAssetIcon,
  resolveChainIcon,
} from "../../utils/assetIconResolver";
import { useNavigation } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountAPI } from "../../env/apiEndpoints";
import { fetchMergedTransactions } from "../../utils/queryTransactions";
import {
  getCachedTransactions,
  setCachedTransactions,
} from "../../utils/txCache";
import DataSkeleton from "./DataSkeleton";
import { resolveMarketSymbol } from "../../config/priceSymbolAlias";
import {
  areAddressesEquivalent,
  buildChainAddrEntry,
} from "../../config/networkUtils";
import { getBchQueryAddressesFromCard, isBchCard } from "../../utils/bchAddress";
import { getBtcQueryAddressesFromCard, isBtcCard } from "../../utils/btcAddress";

const ACTION_BUTTON_OFFSET = 16;
const ACTION_BUTTON_DURATION = 260;
const ACTION_BUTTON_STAGGER = 100;
const ACTION_BUTTON_HEIGHT = 48;

const TabView = ({
  activeTab,
  setActiveTab,
  closeModal, // Close the unified entrance of the details page (trigger sources A/B/C eventually converge to this callback)
  VaultScreenStyle,
  ActivityScreenStyle,
  t,
  tabOpacity,
  tabReady,
  scrollViewRef,
  selectedCrypto,
  exchangeRates,
  currencyUnit,
  isDarkMode,
  modalVisible, // New: Used to control pointer events during pre-mounting
  backgroundAnim,
  darkColorsDown,
  lightColorsDown,
  mainColor, // New
  secondaryColor, // New
  isClosing, // New: Close homing phase flag for immediate removal of BlurView
  onSendPress,
  onReceivePress,
  onPriceRefresh,
  setTabRefreshLoading,
}) => {
  const navigation = useNavigation();
  const [ActivityLog, setActivityLog] = useState([]);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [historyHasNext, setHistoryHasNext] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showBackdrop, setShowBackdrop] = useState(false);
  // Fade control for “No more records” prompt
  const [showNoMoreTip, setShowNoMoreTip] = useState(false);
  const noMoreOpacity = useRef(new Animated.Value(0)).current;
  const prevHasNextRef = useRef(historyHasNext);
  const prevHistoryRefreshingRef = useRef(historyRefreshing);
  const showBackdropRef = useRef(showBackdrop);
  const historyContainerRef = useRef(null);
  const priceRefreshHandlerRef = useRef(null);
  const tabPullOffset = useRef(new Animated.Value(0)).current;
  const tabPullOffsetRef = useRef(0);
  const historyScrollYRef = useRef(0);
  const TAB_PULL_MAX = 90;
  const TAB_PULL_TRIGGER = 80;
  const TAB_PULL_HOLD = 50;
  const [historyContainerHeight, setHistoryContainerHeight] = useState(292);
  const historyEntryAnimMapRef = useRef(new Map());
  const historyAnimatedKeysRef = useRef(new Set());
  const [receiveReady, setReceiveReady] = useState(false);
  const sendOpacity = useRef(new Animated.Value(0)).current;
  const receiveOpacity = useRef(new Animated.Value(0)).current;
  const sendTranslateY = useRef(
    new Animated.Value(ACTION_BUTTON_OFFSET),
  ).current;
  const receiveTranslateY = useRef(
    new Animated.Value(ACTION_BUTTON_OFFSET),
  ).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(
    new Animated.Value(ACTION_BUTTON_OFFSET),
  ).current;
  const receiveTimerRef = useRef(null);
  const entryAnimPlayedRef = useRef(false);
  const mountedRef = useRef(true);
  const prevModalVisibleRef = useRef(modalVisible);
  const latestChainAddrRef = useRef("");
  const historyRequestIdRef = useRef(0);
  const historyRefreshTimerRef = useRef(null);
  const getSelectedQueryAddresses = React.useCallback(
    (crypto) => {
      if (isBchCard(crypto)) return getBchQueryAddressesFromCard(crypto);
      if (isBtcCard(crypto)) return getBtcQueryAddressesFromCard(crypto);
      const address = String(crypto?.address || "").trim();
      return address ? [address] : [];
    },
    [],
  );
  const matchesSelectedAddress = React.useCallback(
    (candidateAddress, crypto = selectedCrypto) => {
      const chain = String(crypto?.queryChainName || "").trim();
      return getSelectedQueryAddresses(crypto).some((address) =>
        areAddressesEquivalent(chain, candidateAddress, address),
      );
    },
    [getSelectedQueryAddresses, selectedCrypto],
  );

  useLayoutEffect(() => {
    showBackdropRef.current = showBackdrop;
  }, [showBackdrop]);

  useEffect(() => {
    const chain = String(selectedCrypto?.queryChainName || "").trim();
    const addr = String(selectedCrypto?.address || "").trim();
    const addressesRaw = getSelectedQueryAddresses(selectedCrypto);
    const addresses = addressesRaw
      .map((address) => String(address || "").trim())
      .filter(Boolean);
    latestChainAddrRef.current =
      chain && addresses.length > 0
        ? addresses
            .map((address) => buildChainAddrEntry(chain, address))
            .filter(Boolean)
            .join(",")
        : "";
  }, [selectedCrypto?.queryChainName, selectedCrypto?.address]);

  useEffect(() => {
    const resetActionRow = () => {
      if (receiveTimerRef.current) {
        clearTimeout(receiveTimerRef.current);
        receiveTimerRef.current = null;
      }
      sendOpacity.setValue(0);
      receiveOpacity.setValue(0);
      sendTranslateY.setValue(ACTION_BUTTON_OFFSET);
      receiveTranslateY.setValue(ACTION_BUTTON_OFFSET);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(ACTION_BUTTON_OFFSET);
      setReceiveReady(false);
      entryAnimPlayedRef.current = false;
    };

    const wasVisible = prevModalVisibleRef.current;
    prevModalVisibleRef.current = modalVisible;

    if (!modalVisible || isClosing) {
      resetActionRow();
      return;
    }

    if (!wasVisible && modalVisible) {
      resetActionRow();
    }
  }, [
    modalVisible,
    isClosing,
    sendOpacity,
    receiveOpacity,
    sendTranslateY,
    receiveTranslateY,
    contentOpacity,
    contentTranslateY,
  ]);

  const isTabRefreshing =
    activeTab === "History" ? historyRefreshing : priceRefreshing;
  const triggerTabRefresh = React.useCallback(() => {
    if (activeTab === "History") {
      onHistoryRefresh();
    } else {
      priceRefreshHandlerRef.current?.();
    }
  }, [activeTab, onHistoryRefresh]);

  const tabPullResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          if (isTabRefreshing) return false;
          const { dy, dx } = gestureState;
          if (dy <= 6 || Math.abs(dy) < Math.abs(dx)) return false;
          if (activeTab === "History" && historyScrollYRef.current > 0) {
            return false;
          }
          return true;
        },
        onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
          if (isTabRefreshing) return false;
          const { dy, dx } = gestureState;
          if (dy <= 6 || Math.abs(dy) < Math.abs(dx)) return false;
          if (activeTab === "History" && historyScrollYRef.current > 0) {
            return false;
          }
          return true;
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (isTabRefreshing) return;
          const next = Math.min(Math.max(gestureState.dy, 0), TAB_PULL_MAX);
          tabPullOffset.setValue(next);
          tabPullOffsetRef.current = next;
        },
        onPanResponderRelease: () => {
          if (isTabRefreshing) return;
          if (tabPullOffsetRef.current >= TAB_PULL_TRIGGER) {
            Animated.timing(tabPullOffset, {
              toValue: TAB_PULL_HOLD,
              duration: 120,
              useNativeDriver: false,
            }).start();
            triggerTabRefresh();
          } else {
            Animated.timing(tabPullOffset, {
              toValue: 0,
              duration: 160,
              useNativeDriver: false,
            }).start(() => {
              tabPullOffsetRef.current = 0;
            });
          }
        },
        onPanResponderTerminate: () => {
          Animated.timing(tabPullOffset, {
            toValue: 0,
            duration: 160,
            useNativeDriver: false,
          }).start(() => {
            tabPullOffsetRef.current = 0;
          });
        },
      }),
    [activeTab, isTabRefreshing, tabPullOffset, triggerTabRefresh],
  );

  const handleTabPullScroll = React.useCallback(
    (y) => {
      if (isTabRefreshing) return;
      if (y < 0) {
        const next = Math.min(-y, TAB_PULL_MAX);
        tabPullOffset.setValue(next);
        tabPullOffsetRef.current = next;
      } else if (tabPullOffsetRef.current !== 0) {
        tabPullOffset.setValue(0);
        tabPullOffsetRef.current = 0;
      }
    },
    [isTabRefreshing, tabPullOffset],
  );

  const handleTabPullEndDrag = React.useCallback(() => {
    if (isTabRefreshing) return;
    if (tabPullOffsetRef.current >= TAB_PULL_TRIGGER) {
      Animated.timing(tabPullOffset, {
        toValue: TAB_PULL_HOLD,
        duration: 120,
        useNativeDriver: false,
      }).start();
      triggerTabRefresh();
    } else {
      Animated.timing(tabPullOffset, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }).start(() => {
        tabPullOffsetRef.current = 0;
      });
    }
  }, [isTabRefreshing, tabPullOffset, triggerTabRefresh]);

  useEffect(() => {
    if (isTabRefreshing) {
      Animated.timing(tabPullOffset, {
        toValue: TAB_PULL_HOLD,
        duration: 120,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(tabPullOffset, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }).start(() => {
        tabPullOffsetRef.current = 0;
      });
    }
  }, [isTabRefreshing, tabPullOffset]);

  useEffect(() => {
    if (typeof setTabRefreshLoading === "function") {
      setTabRefreshLoading(isTabRefreshing);
    }
  }, [isTabRefreshing, setTabRefreshLoading]);

  useEffect(() => {
    if (!modalVisible || isClosing || !tabReady) {
      return;
    }

    if (entryAnimPlayedRef.current) {
      return;
    }

    entryAnimPlayedRef.current = true;
    sendOpacity.setValue(0);
    receiveOpacity.setValue(0);
    sendTranslateY.setValue(ACTION_BUTTON_OFFSET);
    receiveTranslateY.setValue(ACTION_BUTTON_OFFSET);
    contentOpacity.setValue(0);
    contentTranslateY.setValue(ACTION_BUTTON_OFFSET);
    setReceiveReady(false);

    if (receiveTimerRef.current) {
      clearTimeout(receiveTimerRef.current);
      receiveTimerRef.current = null;
    }

    const sendAnim = Animated.parallel([
      Animated.timing(sendOpacity, {
        toValue: 1,
        duration: ACTION_BUTTON_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sendTranslateY, {
        toValue: 0,
        duration: ACTION_BUTTON_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const receiveAnim = Animated.parallel([
      Animated.timing(receiveOpacity, {
        toValue: 1,
        duration: ACTION_BUTTON_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(receiveTranslateY, {
        toValue: 0,
        duration: ACTION_BUTTON_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const contentAnim = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: ACTION_BUTTON_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: ACTION_BUTTON_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    Animated.sequence([
      Animated.stagger(ACTION_BUTTON_STAGGER, [sendAnim, receiveAnim]),
      contentAnim,
    ]).start();

    receiveTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setReceiveReady(true);
      receiveTimerRef.current = null;
    }, ACTION_BUTTON_STAGGER);
  }, [
    modalVisible,
    isClosing,
    tabReady,
    sendOpacity,
    receiveOpacity,
    sendTranslateY,
    receiveTranslateY,
    contentOpacity,
    contentTranslateY,
  ]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (historyRefreshTimerRef.current) {
        clearTimeout(historyRefreshTimerRef.current);
        historyRefreshTimerRef.current = null;
      }
      if (receiveTimerRef.current) {
        clearTimeout(receiveTimerRef.current);
        receiveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!modalVisible || isClosing) {
      if (showBackdropRef.current) {
        showBackdropRef.current = false;
        setShowBackdrop(false);
      }
      return;
    }

    if (!backgroundAnim || typeof backgroundAnim.addListener !== "function") {
      if (!showBackdropRef.current) {
        showBackdropRef.current = true;
        setShowBackdrop(true);
      }
      return;
    }

    try {
      if (typeof backgroundAnim.__getValue === "function") {
        const current = backgroundAnim.__getValue();
        const shouldShow = current >= 0.98 && modalVisible && !isClosing;
        if (shouldShow !== showBackdropRef.current) {
          showBackdropRef.current = shouldShow;
          setShowBackdrop(shouldShow);
        }
      }
    } catch {}

    const id = backgroundAnim.addListener(({ value }) => {
      const shouldShow = value >= 0.98 && modalVisible && !isClosing;
      if (shouldShow !== showBackdropRef.current) {
        showBackdropRef.current = shouldShow;
        setShowBackdrop(shouldShow);
      }
    });

    return () => {
      backgroundAnim.removeListener(id);
    };
  }, [backgroundAnim, modalVisible, isClosing]);

  // The amount string is truncated at the end (ends with "..." when the length exceeds the limit)
  const truncateTail = (value, maxLen = 12) => {
    const s = (value ?? "").toString();
    if (s.length <= maxLen) return s;
    if (maxLen <= 1) return "…";
    return s.slice(0, maxLen - 1) + "…";
  };

  // 6-second timeout encapsulation: If the API does not respond, an empty result will be returned after the timeout, and local/cached data will continue to be used.
  const fetchWithTimeout = async (p, timeoutMs = 6000) => {
    let t;
    try {
      return await Promise.race([
        p,
        new Promise((resolve) => {
          t = setTimeout(
            () =>
              resolve({
                ok: false,
                transactions: [],
                hasNext: false,
                timeout: true,
              }),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (t) clearTimeout(t);
    }
  };

  const onHistoryRefresh = async () => {
    const chain = String(selectedCrypto?.queryChainName || "").trim();
    const addr = String(selectedCrypto?.address || "").trim();
    const addressesRaw = getSelectedQueryAddresses(selectedCrypto);
    const addresses = addressesRaw
      .map((address) => String(address || "").trim())
      .filter(Boolean);
    const chainAddr =
      chain && addresses.length > 0
        ? addresses
            .map((address) => buildChainAddrEntry(chain, address))
            .filter(Boolean)
            .join(",")
        : "";
    if (!chainAddr) {
      setHistoryRefreshing(false);
      setHistoryLoading(false);
      return;
    }
    const refreshStartedAt = Date.now();
    if (historyRefreshTimerRef.current) {
      clearTimeout(historyRefreshTimerRef.current);
      historyRefreshTimerRef.current = null;
    }
    const frozenChainAddr = chainAddr;
    const requestId = ++historyRequestIdRef.current;
    setHistoryRefreshing(true);
    setHistoryLoading(true);
    try {
      // Read first cache (fast display)
      const cached = await getCachedTransactions(frozenChainAddr, 1);
      if (cached && Array.isArray(cached.items)) {
        if (frozenChainAddr !== latestChainAddrRef.current) return;
        const cachedData = cached.items.map((transaction) => {
          const fromAddr =
            transaction.fromAddress ||
            transaction.from_address ||
            transaction.from ||
            transaction.sender ||
            "";
          const isSend = matchesSelectedAddress(fromAddr, selectedCrypto);

          return {
            ...transaction,
            transactionType: isSend ? "Send" : "Receive",
          };
        });
        if (
          frozenChainAddr === latestChainAddrRef.current &&
          requestId === historyRequestIdRef.current
        ) {
          setActivityLog(cachedData);
          // Immediately end the skeleton diagram display when there is cache
          setHistoryLoading(false);
          AsyncStorage.setItem("ActivityLog", JSON.stringify(cachedData));
          try {
            setHistoryHasNext(Boolean(cached?.hasNext));
          } catch {}
        }
      }

      // Try network update again (keep cache if failed)
      const { ok, transactions, pageSize, hasNext } = await fetchWithTimeout(
        fetchMergedTransactions({
          endpoint: accountAPI.queryTransaction,
          chainAddr: frozenChainAddr,
          page: 1,
        }),
        6000,
      );
      try {
        const rawPreview = JSON.stringify({
          ok,
          pageSize,
          hasNext,
          txCount: Array.isArray(transactions) ? transactions.length : 0,
        });
        console.log("[History][Refresh][RESP]", rawPreview);
      } catch {}

      if (frozenChainAddr !== latestChainAddrRef.current) return;
      if (requestId !== historyRequestIdRef.current) return;

      if (ok && Array.isArray(transactions)) {
        const enhancedData = transactions.map((transaction) => {
          const fromAddr =
            transaction.fromAddress ||
            transaction.from_address ||
            transaction.from ||
            transaction.sender ||
            "";
          const isSend = matchesSelectedAddress(fromAddr, selectedCrypto);

          return {
            ...transaction,
            transactionType: isSend ? "Send" : "Receive",
          };
        });

        setActivityLog(enhancedData);
        AsyncStorage.setItem("ActivityLog", JSON.stringify(enhancedData));
        try {
          await setCachedTransactions(frozenChainAddr, 1, enhancedData, {
            pageSize,
            hasNext,
          });
        } catch {}
        try {
          setHistoryHasNext(Boolean(hasNext));
        } catch {}
      } else if (!cached) {
        setActivityLog([]);
      }
    } catch (error) {
      setActivityLog([]);
    } finally {
      if (requestId !== historyRequestIdRef.current) return;
      const elapsed = Date.now() - refreshStartedAt;
      const remaining = Math.max(0, 1000 - elapsed);
      if (remaining === 0) {
        setHistoryRefreshing(false);
        setHistoryLoading(false);
      } else {
        historyRefreshTimerRef.current = setTimeout(() => {
          if (requestId !== historyRequestIdRef.current) return;
          setHistoryRefreshing(false);
          setHistoryLoading(false);
        }, remaining);
      }
    }
  };

  useEffect(() => {
    // Print color value
    /*     if (mainColor && secondaryColor) {
      console.log("Primary color received by TabView:", mainColor, "Secondary color:", secondaryColor);
    } */
    const fetchActivityLog = async () => {
      if (
        !tabReady ||
        !modalVisible ||
        isClosing ||
        !selectedCrypto ||
        activeTab !== "History"
      ) {
        return;
      }
      try {
        setHistoryLoading(true);
        const chain = String(selectedCrypto?.queryChainName || "").trim();
        const addr = String(selectedCrypto?.address || "").trim();
        const addressesRaw = getSelectedQueryAddresses(selectedCrypto);
        const addresses = addressesRaw
          .map((address) => String(address || "").trim())
          .filter(Boolean);
        const chainAddr =
          chain && addresses.length > 0
            ? addresses
                .map((address) => buildChainAddrEntry(chain, address))
                .filter(Boolean)
                .join(",")
            : "";
        if (!chainAddr) {
          setActivityLog([]);
          setHistoryLoading(false);
          return;
        }
        const frozenChainAddr = chainAddr;
        const requestId = ++historyRequestIdRef.current;
        // Prioritize reading from persistent storage (global ActivityLog), filter by current address, and display quickly
        try {
          const stored = await AsyncStorage.getItem("ActivityLog");
          if (frozenChainAddr !== latestChainAddrRef.current) return;
          if (stored) {
            const all = JSON.parse(stored);
            const prefill = Array.isArray(all)
              ? all.filter((tx) => {
                  return (
                    matchesSelectedAddress(tx?.address, selectedCrypto) ||
                    matchesSelectedAddress(tx?.fromAddress, selectedCrypto) ||
                    matchesSelectedAddress(tx?.toAddress, selectedCrypto)
                  );
                })
              : [];
            if (prefill.length > 0) {
              if (
                frozenChainAddr === latestChainAddrRef.current &&
                requestId === historyRequestIdRef.current
              ) {
                setActivityLog(prefill);
              }
              // The skeleton diagram is not displayed when there is pre-filled data locally.
              setHistoryLoading(false);
            }
          }
        } catch {}

        const { ok, transactions, hasNext } = await fetchWithTimeout(
          fetchMergedTransactions({
            endpoint: accountAPI.queryTransaction,
            chainAddr: frozenChainAddr,
            page: 1,
          }),
          6000,
        );
        try {
          const rawPreview = JSON.stringify({
            ok,
            hasNext,
            txCount: Array.isArray(transactions) ? transactions.length : 0,
          });
          console.log("[History][Init][RESP]", rawPreview);
        } catch {}

        if (frozenChainAddr !== latestChainAddrRef.current) return;
        if (requestId !== historyRequestIdRef.current) return;

        if (!ok || !Array.isArray(transactions)) {
          try {
            console.log(`Tab page transaction history API Error: request failed or data is empty`);
          } catch {}
          setActivityLog([]);
          setHistoryLoading(false);
        } else {
          const enhancedData = transactions.map((transaction) => {
            const fromAddr =
              transaction.fromAddress ||
              transaction.from_address ||
              transaction.from ||
              transaction.sender ||
              "";
            const toAddr =
              transaction.toAddress ||
              transaction.to_address ||
              transaction.to ||
              transaction.recipient ||
              "";

            const isSend = matchesSelectedAddress(fromAddr, selectedCrypto);

            return {
              ...transaction,
              transactionType: isSend ? "Send" : "Receive",
            };
          });

          setActivityLog(enhancedData);
          // Successfully obtained online data and completed the skeleton diagram
          setHistoryLoading(false);
          AsyncStorage.setItem("ActivityLog", JSON.stringify(enhancedData));
          try {
            setHistoryHasNext(Boolean(hasNext));
          } catch {}
        }
      } catch (error) {
        // console.error(
        //   `Failed to fetch transaction history: ${error.message}`
        // );
        setActivityLog([]);
        setHistoryLoading(false);
      }
    };

    fetchActivityLog();
  }, [selectedCrypto, activeTab, modalVisible, isClosing, tabReady]);

  const openTransactionModal = (transaction) => {
    const typeLc = String(transaction.transactionType || "")
      .trim()
      .toLowerCase();
    const fromAddr =
      transaction.fromAddress ||
      transaction.from_address ||
      transaction.from ||
      transaction.sender ||
      "";
    const inferredType = typeLc
      ? transaction.transactionType
      : areAddressesEquivalent(
          selectedCrypto?.queryChainName,
          fromAddr,
          selectedCrypto?.address,
        )
        ? "Send"
        : "Receive";
    navigation.navigate("LogDetail", {
      transaction: {
        ...transaction,
        transactionType: inferredType,
      },
    });
  };
  const { height, width } = Dimensions.get("window");
  const { height: windowHeight } = useWindowDimensions();
  const historyEntryOffset = Math.min(120, Math.round(windowHeight * 0.2));
  const headerHeight = useHeaderHeight();
  const animatedTabContainerStyle = useMemo(
    () => StyleSheet.flatten(VaultScreenStyle.aniTabCtr),
    [VaultScreenStyle],
  );
  const tabContainerHeight =
    animatedTabContainerStyle?.height ??
    Math.max(
      0,
      windowHeight - (animatedTabContainerStyle?.top ?? headerHeight),
    );

  // Used for color value ball animation
  const leftAnim = useRef(new Animated.Value(width * 0.3)).current; // Initial 30%
  const rightAnim = useRef(new Animated.Value(width * 0.0)).current; // Initial 0%
  const leftBottomAnim = useRef(new Animated.Value(0)).current;
  const rightBottomAnim = useRef(new Animated.Value(0)).current;
  const leftTargetRef = useRef(width * 0.3);
  const rightTargetRef = useRef(width * 0.0);
  const leftBottomTranslate = useMemo(
    () => Animated.multiply(leftBottomAnim, -1),
    [leftBottomAnim],
  );
  const rightBottomTranslate = useMemo(
    () => Animated.multiply(rightBottomAnim, -1),
    [rightBottomAnim],
  );
  const rightTranslate = useMemo(
    () => Animated.multiply(rightAnim, -1),
    [rightAnim],
  );

  // Mutually exclusive animation recursion
  useEffect(() => {
    if (!modalVisible || isClosing || !tabReady) {
      return;
    }
    let isMounted = true;
    const minDistance = 100; // Minimum distance, unit px, can be adjusted as needed

    // The left ball is in the left half (-20%~50%), the right ball is in the right half (-10%~30%)
    function getRandomLeft() {
      return width * (-0.2 + 0.7 * Math.random());
    }
    function getRandomRight() {
      return width * (-0.1 + 0.4 * Math.random());
    }
    function getRandomBottom() {
      return height * (0 + 0.05 * Math.random());
    }

    function animateLeft() {
      if (!isMounted) return;
      let target;
      let tryCount = 0;
      do {
        target = getRandomLeft();
        tryCount++;
        const rightValue = rightTargetRef.current;
        if (
          typeof rightValue === "number" &&
          width - target - rightValue > minDistance
        )
          break;
      } while (tryCount < 10);
      leftTargetRef.current = target;
      Animated.timing(leftAnim, {
        toValue: target,
        duration: 4000 + Math.random() * 2000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!isMounted || !finished) return;
        leftAnim.setValue(target);
        setTimeout(animateLeft, 0);
      });
    }

    function animateRight() {
      if (!isMounted) return;
      let target;
      let tryCount = 0;
      do {
        target = getRandomRight();
        const leftValue = leftTargetRef.current;
        tryCount++;
        if (
          typeof leftValue === "number" &&
          width - leftValue - target > minDistance
        )
          break;
      } while (tryCount < 10);
      rightTargetRef.current = target;
      Animated.timing(rightAnim, {
        toValue: target,
        duration: 4000 + Math.random() * 2000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!isMounted || !finished) return;
        rightAnim.setValue(target);
        setTimeout(animateRight, 0);
      });
    }

    function animateLeftBottom() {
      if (!isMounted) return;
      const target = getRandomBottom();
      Animated.timing(leftBottomAnim, {
        toValue: target,
        duration: 4000 + Math.random() * 2000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!isMounted || !finished) return;
        leftBottomAnim.setValue(target);
        setTimeout(animateLeftBottom, 0);
      });
    }
    function animateRightBottom() {
      if (!isMounted) return;
      const target = getRandomBottom();
      Animated.timing(rightBottomAnim, {
        toValue: target,
        duration: 4000 + Math.random() * 2000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!isMounted || !finished) return;
        rightBottomAnim.setValue(target);
        setTimeout(animateRightBottom, 0);
      });
    }

    animateLeft();
    animateRight();
    animateLeftBottom();
    animateRightBottom();
    return () => {
      isMounted = false;
    };
  }, [
    width,
    height,
    leftAnim,
    rightAnim,
    leftBottomAnim,
    rightBottomAnim,
    modalVisible,
    isClosing,
    tabReady,
  ]);

  // Listen for hasNext changes: when it changes from true to false and there is displayable data, "No more" is displayed and fades out
  useEffect(() => {
    const prev = prevHasNextRef.current;
    if (prev !== historyHasNext) {
      if (
        historyHasNext === false &&
        !historyLoading &&
        ActivityLog.length > 0
      ) {
        setShowNoMoreTip(true);
        noMoreOpacity.setValue(0);
        Animated.sequence([
          Animated.timing(noMoreOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(10000),
          Animated.timing(noMoreOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowNoMoreTip(false);
        });
      }
      prevHasNextRef.current = historyHasNext;
    }
  }, [historyHasNext, historyLoading, ActivityLog.length]);

  useEffect(() => {
    const prev = prevHistoryRefreshingRef.current;
    if (prev && !historyRefreshing) {
      if (
        historyHasNext === false &&
        !historyLoading &&
        ActivityLog.length > 0
      ) {
        setShowNoMoreTip(true);
        noMoreOpacity.setValue(0);
        Animated.sequence([
          Animated.timing(noMoreOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(10000),
          Animated.timing(noMoreOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowNoMoreTip(false);
        });
      }
    }
    prevHistoryRefreshingRef.current = historyRefreshing;
  }, [historyRefreshing, historyHasNext, historyLoading, ActivityLog.length]);

  const updateHistoryContainerHeight = () => {
    const node = historyContainerRef.current;
    if (!node || typeof node.measureInWindow !== "function") return;
    node.measureInWindow((x, y) => {
      const bottomPadding = 60;
      const available = windowHeight - y - bottomPadding;
      if (Number.isFinite(available) && available > 0) {
        const nextHeight = Math.max(160, Math.floor(available));
        setHistoryContainerHeight(nextHeight);
      }
    });
  };

  useEffect(() => {
    if (activeTab !== "History") return;
    requestAnimationFrame(updateHistoryContainerHeight);
  }, [activeTab, windowHeight]);

  const historyEntries = useMemo(
    () =>
      ActivityLog.filter((transaction) => {
        const amount = parseFloat(transaction.amount);
        const st = String(transaction.state || "").toLowerCase();
        const hide = st === "tessuccess" || st === "tecunfunded_payment";
        return !isNaN(amount) && amount !== 0 && !hide;
      }),
    [ActivityLog],
  );

  const getHistoryKey = React.useCallback(
    (tx, index) => String(tx?.txid || tx?.transactionTime || index),
    [],
  );

  const getHistoryEntryAnim = React.useCallback((key) => {
    if (!historyEntryAnimMapRef.current.has(key)) {
      historyEntryAnimMapRef.current.set(key, new Animated.Value(0));
    }
    return historyEntryAnimMapRef.current.get(key);
  }, []);

  useEffect(() => {
    historyAnimatedKeysRef.current.clear();
    historyEntryAnimMapRef.current.clear();
  }, [selectedCrypto?.address]);

  useEffect(() => {
    if (
      activeTab !== "History" ||
      !modalVisible ||
      isClosing ||
      !tabReady ||
      historyLoading
    ) {
      return;
    }
    if (historyEntries.length === 0) {
      historyAnimatedKeysRef.current.clear();
      historyEntryAnimMapRef.current.clear();
      return;
    }
    const newKeys = historyEntries
      .map((tx, index) => getHistoryKey(tx, index))
      .filter((key) => !historyAnimatedKeysRef.current.has(key));
    if (newKeys.length === 0) return;
    const animations = newKeys.map((key) => {
      const anim = getHistoryEntryAnim(key);
      anim.stopAnimation();
      anim.setValue(0);
      return Animated.timing(anim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    });
    newKeys.forEach((key) => historyAnimatedKeysRef.current.add(key));
    Animated.stagger(70, animations).start();
  }, [
    activeTab,
    modalVisible,
    isClosing,
    historyLoading,
    historyEntries,
    getHistoryEntryAnim,
    getHistoryKey,
  ]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "History":
        return (
          <>
            <View
              ref={historyContainerRef}
              onLayout={updateHistoryContainerHeight}
              style={{
                marginTop: 16,
                borderRadius: 12,
                height: historyContainerHeight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ScrollView
                style={[
                  VaultScreenStyle.historyList,
                  { borderRadius: 12, overflow: "hidden" },
                ]}
                bounces
                alwaysBounceVertical
                overScrollMode="always"
                scrollEventThrottle={16}
                onScroll={(event) => {
                  const y = event.nativeEvent.contentOffset.y || 0;
                  historyScrollYRef.current = y;
                  handleTabPullScroll(y);
                }}
                onScrollEndDrag={handleTabPullEndDrag}
              >
                {(historyRefreshing && ActivityLog.length > 0) ||
                (historyLoading && ActivityLog.length === 0) ? (
                  // Skeleton loading list
                  <View
                    style={{
                      minHeight: historyContainerHeight,
                      justifyContent: "flex-start",
                      alignItems: "stretch",
                    }}
                  >
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <View
                        key={`history-skel-${idx}`}
                        style={{
                          borderRadius: 10,
                          backgroundColor: isDarkMode
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(0,0,0,0.03)",
                          borderLeftWidth: 3,
                          borderLeftColor: isDarkMode ? "#555" : "#ccc",
                          marginVertical: 4,
                          padding: 10,
                        }}
                      >
                        <DataSkeleton
                          width={180}
                          height={12}
                          isDarkMode={isDarkMode}
                          style={{ marginBottom: 8 }}
                        />
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <DataSkeleton
                            width={120}
                            height={16}
                            isDarkMode={isDarkMode}
                          />
                          <DataSkeleton
                            width={140}
                            height={16}
                            isDarkMode={isDarkMode}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : ActivityLog.length === 0 ? (
                  <View
                    style={{
                      height: historyContainerHeight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{ alignItems: "center", gap: 6, width: "80%" }}
                    >
                      <Text style={VaultScreenStyle.noHistoryText}>
                        {t("No actions yet")}
                      </Text>
                      <Text style={VaultScreenStyle.noHistoryText}>
                        {t(
                          "This space comes alive when you take your first action.",
                        )}
                      </Text>
                    </View>
                  </View>
                ) : (
                  historyEntries.map((transaction, index) => {
                    const entryKey = getHistoryKey(transaction, index);
                    const entryAnim = getHistoryEntryAnim(entryKey);
                    const translateY = entryAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [historyEntryOffset, 0],
                    });
                    return (
                      <Animated.View
                        key={entryKey}
                        style={{
                          transform: [{ translateY }],
                          opacity: entryAnim,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => openTransactionModal(transaction)}
                        >
                          <View
                            style={[
                              {
                                borderRadius: 10,
                                backgroundColor:
                                  transaction.state.toLowerCase() === "success"
                                    ? "rgba(71, 180, 128, 0.1)"
                                    : "rgba(210, 70, 75, 0.1)",
                                borderLeftWidth: 3,
                                borderLeftColor:
                                  transaction.state.toLowerCase() === "success"
                                    ? "#47B480"
                                    : "#D2464B",
                                marginVertical: 4,
                                padding: 10,
                              },
                            ]}
                          >
                            <Text style={VaultScreenStyle.historyItemText}>
                              {`${new Date(
                                Number(transaction.transactionTime),
                              ).toLocaleString()}`}
                            </Text>

                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={[
                                  VaultScreenStyle.historyItemText,
                                  { fontSize: 16, fontWeight: "bold" },
                                ]}
                              >
                                {transaction.transactionType === "Send"
                                  ? t("Send")
                                  : t("Receive")}
                                {"  "}
                                <Text
                                  style={{
                                    color:
                                      transaction.state.toLowerCase() ===
                                      "success"
                                        ? "#47B480"
                                        : "#D2464B",
                                    fontWeight: "normal",
                                  }}
                                >
                                  {transaction.state}
                                </Text>
                              </Text>

                              <Text
                                style={[
                                  VaultScreenStyle.historyItemText,
                                  { fontSize: 16, fontWeight: "bold" },
                                ]}
                              >
                                {(() => {
                                  const typeLc = String(
                                    transaction.transactionType || "",
                                  ).toLowerCase();
                                  const fromAddr =
                                    transaction.fromAddress ||
                                    transaction.from_address ||
                                    transaction.from ||
                                    transaction.sender ||
                                    "";
                                  const isSendTx = typeLc
                                    ? typeLc === "send"
                                    : areAddressesEquivalent(
                                        selectedCrypto?.queryChainName,
                                        fromAddr,
                                        selectedCrypto?.address,
                                      );
                                  const amtStr = String(
                                    transaction.amount ?? "",
                                  );
                                  const normalized = amtStr.startsWith("-")
                                    ? amtStr.slice(1)
                                    : amtStr;
                                  const displayAmt = truncateTail(
                                    normalized,
                                    10,
                                  );
                                  return `${isSendTx ? "-" : ""}${displayAmt} ${
                                    transaction.symbol
                                  }`;
                                })()}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })
                )}
                {ActivityLog.length > 0 && showNoMoreTip && (
                  <Animated.View
                    style={{
                      paddingVertical: 12,
                      alignItems: "center",
                      opacity: noMoreOpacity,
                    }}
                  >
                    <Text style={{ color: isDarkMode ? "#fff" : "#888" }}>
                      {t("No more records")}
                    </Text>
                  </Animated.View>
                )}
              </ScrollView>
            </View>
          </>
        );
      case "Prices": {
        const marketSymbol = resolveMarketSymbol(
          selectedCrypto?.shortName,
          selectedCrypto?.queryChainName,
        );
        const priceIconSource =
          resolveAssetIcon(selectedCrypto) ||
          resolveChainIcon(selectedCrypto?.queryChainName) ||
          (selectedCrypto?.logoUrl ? { uri: selectedCrypto.logoUrl } : null);
        return (
          <View style={VaultScreenStyle.priceContainer}>
            <PriceChartCom
              instId={marketSymbol ? `${marketSymbol}-USD` : ""}
              parentScrollviewRef={scrollViewRef}
              exchangeRates={exchangeRates}
              currencyUnit={currencyUnit}
              debugPriceIconSource={priceIconSource}
              debugPriceLabel={`${selectedCrypto?.shortName || "Unknown"}-${
                currencyUnit || "USD"
              }`}
              refreshing={priceRefreshing}
              setRefreshing={setPriceRefreshing}
              onRefreshReady={(handler) => {
                priceRefreshHandlerRef.current = handler;
              }}
              onRefreshBalance={() =>
                typeof onPriceRefresh === "function"
                  ? onPriceRefresh(selectedCrypto)
                  : null
              }
            />
          </View>
        );
      }
      default:
        return null;
    }
  };

  return (
    <>
      {!isClosing && (
        <Animated.View
          pointerEvents="none"
          style={[
            VaultScreenStyle.cardModalView,
            { opacity: backgroundAnim }, // [Step 4] Background fade: driven by parent component backgroundAnim
          ]}
        >
          {/* color value ball */}

          {Platform.OS === "ios" && showBackdrop && (
            <View
              pointerEvents="none"
              style={{
                width: "100%",
                height: "100%",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 3,
                position: "relative",
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
              >
                <Animated.View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "40%",
                    height: "20%",
                    borderRadius: 100,
                    backgroundColor: mainColor,
                    opacity: 0.4,
                    marginBottom: "-12%",
                    transform: [
                      { translateX: leftAnim },
                      { translateY: leftBottomTranslate },
                    ],
                  }}
                />
                <Animated.View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: "80%",
                    height: "30%",
                    borderRadius: 100,
                    backgroundColor: secondaryColor,
                    opacity: 0.1,
                    marginBottom: "-8%",
                    transform: [
                      { translateX: rightTranslate },
                      { translateY: rightBottomTranslate },
                    ],
                  }}
                />
              </View>
              <BlurView
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: tabContainerHeight,
                  borderRadius: 30,
                  zIndex: 3,
                  opacity: 1,
                }}
                intensity={100}
                tint={isDarkMode ? "dark" : "light"}
                pointerEvents="none"
              />
            </View>
          )}
        </Animated.View>
      )}

      {/* Tab Modal Animated Container */}
      {!isClosing && (
        <Animated.View
          pointerEvents={modalVisible ? "auto" : "none"}
          style={[
            VaultScreenStyle.aniTabCtr,
            { opacity: tabOpacity }, // [Step 4] Tab content fades out: driven by parent component tabOpacity
          ]}
        >
          <View
            style={[
              VaultScreenStyle.expActRow,
              { minHeight: ACTION_BUTTON_HEIGHT },
            ]}
          >
            <Animated.View
              style={[
                VaultScreenStyle.carActBtnL,
                {
                  flex: 1,
                  opacity: sendOpacity,
                  transform: [{ translateY: sendTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={VaultScreenStyle.cardActionButton}
                disabled={!tabReady || !selectedCrypto}
                onPress={() => {
                  if (!selectedCrypto) return;
                  if (typeof onSendPress === "function") {
                    onSendPress(selectedCrypto);
                  }
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={VaultScreenStyle.carActBtnTxt}>{t("Send")}</Text>
                  <Feather
                    name="send"
                    size={16}
                    color={isDarkMode ? "#CCB68C" : "#CFAB95"}
                    style={{ marginLeft: 6 }}
                  />
                </View>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View
              style={{
                flex: 1,
                opacity: receiveOpacity,
                transform: [{ translateY: receiveTranslateY }],
              }}
            >
              <TouchableOpacity
                style={VaultScreenStyle.cardActionButton}
                disabled={!receiveReady || !selectedCrypto}
                onPress={() => {
                  if (!selectedCrypto) return;
                  if (typeof onReceivePress === "function") {
                    onReceivePress(selectedCrypto);
                  }
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={VaultScreenStyle.carActBtnTxt}>
                    {t("Receive")}
                  </Text>
                  <MaterialIcons
                    name="qr-code"
                    size={16}
                    color={isDarkMode ? "#CCB68C" : "#CFAB95"}
                    style={{ marginLeft: 6 }}
                  />
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
          <View
            style={{ flex: 1, position: "relative" }}
            {...tabPullResponder.panHandlers}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 10,
                  left: 0,
                  right: 0,
                  alignItems: "center",
                  zIndex: 20,
                  elevation: 20,
                  justifyContent: "center",
                  alignItems: "center",
                  overflow: "hidden",
                },
                {
                  height: tabPullOffset,
                  opacity: tabPullOffset.interpolate({
                    inputRange: [0, TAB_PULL_TRIGGER],
                    outputRange: [0, 1],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            >
              <ActivityIndicator
                size="small"
                color={isDarkMode ? "#FFFFFF" : "#333333"}
                style={{ marginBottom: 6 }}
              />
              <Text style={VaultScreenStyle.refreshTipText}>
                {isTabRefreshing ? t("Refreshing…") : t("Pull down to refresh")}
              </Text>
            </Animated.View>
            {activeTab === "Prices" ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                bounces
                alwaysBounceVertical
                overScrollMode="always"
                scrollEventThrottle={16}
              >
                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ translateY: tabPullOffset }],
                  }}
                >
                  <Animated.View
                    style={{
                      flex: 1,
                      opacity: contentOpacity,
                      transform: [{ translateY: contentTranslateY }],
                    }}
                  >
                    <View style={[VaultScreenStyle.tabRow, { zIndex: 10 }]}>
                      <TouchableOpacity
                        style={[
                          VaultScreenStyle.tabButton,
                          VaultScreenStyle.tabButtonLeft,
                          activeTab === "Prices" &&
                            VaultScreenStyle.activeTabButton,
                        ]}
                        onPress={() => setActiveTab("Prices")}
                      >
                        <Text
                          style={[
                            VaultScreenStyle.tabButtonText,
                            activeTab === "Prices" &&
                              VaultScreenStyle.actTabBtnTxt,
                          ]}
                        >
                          {t("Prices")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          VaultScreenStyle.tabButton,
                          activeTab === "History" &&
                            VaultScreenStyle.activeTabButton,
                        ]}
                        onPress={() => setActiveTab("History")}
                      >
                        <Text
                          style={[
                            VaultScreenStyle.tabButtonText,
                            activeTab === "History" &&
                              VaultScreenStyle.actTabBtnTxt,
                          ]}
                        >
                          {t("History")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {modalVisible ? renderTabContent() : null}
                  </Animated.View>
                </Animated.View>
              </ScrollView>
            ) : (
              <>
                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ translateY: tabPullOffset }],
                  }}
                >
                  <Animated.View
                    style={{
                      flex: 1,
                      opacity: contentOpacity,
                      transform: [{ translateY: contentTranslateY }],
                    }}
                  >
                    <View style={[VaultScreenStyle.tabRow, { zIndex: 10 }]}>
                      <TouchableOpacity
                        style={[
                          VaultScreenStyle.tabButton,
                          VaultScreenStyle.tabButtonLeft,
                          activeTab === "Prices" &&
                            VaultScreenStyle.activeTabButton,
                        ]}
                        onPress={() => setActiveTab("Prices")}
                      >
                        <Text
                          style={[
                            VaultScreenStyle.tabButtonText,
                            activeTab === "Prices" &&
                              VaultScreenStyle.actTabBtnTxt,
                          ]}
                        >
                          {t("Prices")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          VaultScreenStyle.tabButton,
                          activeTab === "History" &&
                            VaultScreenStyle.activeTabButton,
                        ]}
                        onPress={() => setActiveTab("History")}
                      >
                        <Text
                          style={[
                            VaultScreenStyle.tabButtonText,
                            activeTab === "History" &&
                              VaultScreenStyle.actTabBtnTxt,
                          ]}
                        >
                          {t("History")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {modalVisible ? renderTabContent() : null}
                  </Animated.View>
                </Animated.View>
              </>
            )}
          </View>
        </Animated.View>
      )}
    </>
  );
};

export default TabView;
