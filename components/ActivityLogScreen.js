/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { ActivityScreenStylesRoot } from "../styles/styles";
import { DeviceContext, DarkModeContext } from "../utils/DeviceContext";
import ChainSelectorModal from "./modal/ChainSelectorModal";
import DataSkeleton from "./AssetsScreen/DataSkeleton";
import {
  fetchAllActivityLog,
  fetchNextActivityLogPage,
} from "../utils/activityLog";
import { accountAPI } from "../env/apiEndpoints";
import { RUNTIME_DEV } from "../utils/runtimeFlags";
import { resolveTransactionIcons } from "../utils/transactionIconLookup";
import { resolveChainIcon } from "../utils/assetIconResolver";
import { areAddressesEquivalent } from "../config/networkUtils";

const LOG_RED = "\x1b[31m";
const LOG_YELLOW = "\x1b[33m";
const LOG_RESET = "\x1b[0m";

const ActivityLogScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isDarkMode } = useContext(DarkModeContext);
  const ActivityScreenStyle = ActivityScreenStylesRoot(isDarkMode);
  const { ActivityLog, setActivityLog, cryptoCards, initialAdditionalCryptos } =
    useContext(DeviceContext);
  const skeletonWidth = Math.round(Dimensions.get("window").width * 0.9);
  const forceSkeleton = false;
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activityLogPages, setActivityLogPages] = useState({});
  const [selectedChain, setSelectedChain] = useState("All");
  const [isChainFilterModalVisible, setChainFilterModalVisible] =
    useState(false);
  const iconFallbackColor = isDarkMode ? "#B0B0B0" : "#8A8A8A";

  const [showNoMoreTip, setShowNoMoreTip] = useState(false);
  const noMoreOpacity = useRef(new Animated.Value(0)).current;
  const prevHasMoreRef = useRef(hasMore);
  const prevRefreshingRef = useRef(refreshing);
  const entryAnimMapRef = useRef(new Map());
  const entryAnimatedKeysRef = useRef(new Set());
  const entryOffset = Math.min(
    120,
    Math.round(Dimensions.get("window").height * 0.2),
  );

  const darkColors = ["#21201E", "#0E0D0D"];
  const lightColors = ["#FFFFFF", "#EDEBEF"];

  useEffect(() => {
    try {
      const pages = Object.values(activityLogPages || {});
      if (pages.length === 0) return;
      const allFinished = pages.every((p) => p && p.finished === true);
      setHasMore(!allFinished);
    } catch {}
  }, [activityLogPages]);

  useEffect(() => {
    const loadActivityLog = async () => {
      setIsLoading(true);
      try {
        const historyJson = await AsyncStorage.getItem("ActivityLog");
        if (historyJson !== null) {
          const history = JSON.parse(historyJson);
          setActivityLog(history);
        }
      } catch (error) {
        console.error(
          "Failed to load transaction history from storage:",
          error,
        );
      }
      setIsLoading(false);
    };

    loadActivityLog();
  }, [setActivityLog]);

  const onRefresh = async () => {
    if (!cryptoCards || cryptoCards.length === 0) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    await fetchAllActivityLog({
      addressSourceCards: cryptoCards,
      setActivityLog,
      setActivityLogPages,
      accountAPI,
    });
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!hasMore || isFetching) return;
    setIsFetching(true);
    await fetchNextActivityLogPage({
      addressSourceCards: cryptoCards,
      activityLogPages,
      ActivityLog,
      setActivityLog,
      setActivityLogPages,
      accountAPI,
    });
    setTimeout(() => {
      setIsFetching(false);
    }, 3000);
  };

  const matchCrypto = (item, tx) => {
    const address =
      item.address && typeof item.address === "string"
        ? item.address.trim()
        : "";
    const shortName =
      item.shortName && typeof item.shortName === "string"
        ? item.shortName.trim()
        : "";
    if (address === "") {
      return shortName.toLowerCase() === tx.symbol?.trim().toLowerCase();
    }
    return areAddressesEquivalent(item.queryChainName, address, tx?.address);
  };

  const getChainNameFromTx = (tx) => {
    const raw = (tx?.chain || "").toString().trim().toLowerCase();
    if (raw) return raw;
    const ck =
      typeof tx?.chainKey === "string" ? tx.chainKey.split(":")[0] : "";
    return (ck || "").toString().trim().toLowerCase();
  };

  const transactionChainCards = useMemo(() => {
    const map = new Map();

    ActivityLog.filter(
      (tx) =>
        Number(tx.amount) > 0 &&
        ["tessuccess", "tecunfunded_payment"].includes(
          String(tx.state || "").toLowerCase(),
        ) === false,
    ).forEach((tx) => {
      const chainNameLc = getChainNameFromTx(tx);
      if (!chainNameLc) return;
      const card = initialAdditionalCryptos.find(
        (item) =>
          String(item.queryChainName || "")
            .trim()
            .toLowerCase() === chainNameLc,
      );
      if (card && !map.has(card.queryChainShortName)) {
        map.set(card.queryChainShortName, card);
      }
    });

    return Array.from(map.values());
  }, [ActivityLog]);

  const filteredActivityLog =
    selectedChain === "All"
      ? ActivityLog.filter(
          (tx) =>
            Number(tx.amount) > 0 &&
            ["tessuccess", "tecunfunded_payment"].includes(
              String(tx.state || "").toLowerCase(),
            ) === false,
        )
      : ActivityLog.filter((tx) => {
          const chainNameLc = getChainNameFromTx(tx);
          if (!chainNameLc) return false;
          const hit = initialAdditionalCryptos.find(
            (item) =>
              item.queryChainShortName === selectedChain &&
              String(item.queryChainName || "")
                .trim()
                .toLowerCase() === chainNameLc,
          );
          return (
            Boolean(hit) &&
            Number(tx.amount) > 0 &&
            ["tessuccess", "tecunfunded_payment"].includes(
              String(tx.state || "").toLowerCase(),
            ) === false
          );
        });

  const shouldDisplayChainFilterModal = transactionChainCards.length > 0;
  const sortedActivityLog = useMemo(
    () =>
      [...filteredActivityLog].sort(
        (a, b) => Number(b.transactionTime) - Number(a.transactionTime),
      ),
    [filteredActivityLog],
  );

  useEffect(() => {
    if (!RUNTIME_DEV) return;
    sortedActivityLog.forEach((transaction, index) => {
      const chainNameLc = getChainNameFromTx(transaction);
      const txSym = String(transaction.symbol || "").trim();
      const {
        cryptoItem,
        cryptoIcon,
        cryptoMatchMethod,
        normalizedSymbol,
        chainMatched,
        chainIcon,
      } = resolveTransactionIcons({
        cryptos: initialAdditionalCryptos,
        chain: chainNameLc,
        symbol: txSym,
      });

      if (chainIcon && cryptoIcon) return;

      const txid = String(
        transaction?.txid || transaction?.txId || transaction?.hash || "",
      );
      const shortTxid = txid ? `${txid.slice(0, 10)}...${txid.slice(-6)}` : "";
      const lineBase =
        `#${index} chain=${transaction?.chain || ""} ` +
        `derived=${chainNameLc || "-"} symbol=${txSym || "-"} ` +
        `txid=${shortTxid || "-"}`;

      if (!chainMatched || !chainIcon) {
        console.log(
          `${LOG_RED}[ActivityLog][ICON] CHAIN_MISS${LOG_RESET} ${lineBase}`,
        );
        return;
      }

      if (!cryptoIcon) {
        console.log(
          `${LOG_YELLOW}[ActivityLog][ICON] CRYPTO_MISS${LOG_RESET} ` +
            `${lineBase} lookup(symbol=${normalizedSymbol || "-"})`,
        );
      } else {
        console.log(
          `[ActivityLog][ICON] crypto matched by ${cryptoMatchMethod || "unknown"} ` +
            `symbol=${normalizedSymbol || "-"} txid=${shortTxid || "-"}`,
        );
      }
    });
  }, [sortedActivityLog, initialAdditionalCryptos]);

  const effectiveLoading = isLoading || forceSkeleton;
  const listData = effectiveLoading ? [] : sortedActivityLog;
  const getTxKey = React.useCallback(
    (tx, index) => String(tx?.txid || tx?.transactionTime || index),
    [],
  );
  const getEntryAnim = React.useCallback((key) => {
    if (!entryAnimMapRef.current.has(key)) {
      entryAnimMapRef.current.set(key, new Animated.Value(0));
    }
    return entryAnimMapRef.current.get(key);
  }, []);

  const truncateTail = (value, maxLen = 16) => {
    const s = (value ?? "").toString();
    if (s.length <= maxLen) return s;
    if (maxLen <= 1) return "…";
    return s.slice(0, maxLen - 1) + "…";
  };

  useEffect(() => {
    const prev = prevHasMoreRef.current;
    if (prev !== hasMore) {
      if (hasMore === false && !isLoading && filteredActivityLog.length > 0) {
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
      prevHasMoreRef.current = hasMore;
    }
  }, [hasMore, isLoading, filteredActivityLog.length, noMoreOpacity]);

  useEffect(() => {
    if (sortedActivityLog.length === 0) {
      entryAnimatedKeysRef.current.clear();
      entryAnimMapRef.current.clear();
      return;
    }
    if (isLoading) return;
    const newKeys = sortedActivityLog
      .map((tx, index) => getTxKey(tx, index))
      .filter((key) => !entryAnimatedKeysRef.current.has(key));
    if (newKeys.length === 0) return;
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
  }, [sortedActivityLog, isLoading, getEntryAnim, getTxKey]);

  useEffect(() => {
    const prev = prevRefreshingRef.current;
    if (prev && !refreshing) {
      if (hasMore === false && !isLoading && filteredActivityLog.length > 0) {
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
    prevRefreshingRef.current = refreshing;
  }, [
    refreshing,
    hasMore,
    isLoading,
    filteredActivityLog.length,
    noMoreOpacity,
  ]);

  return (
    <LinearGradient
      colors={isDarkMode ? darkColors : lightColors}
      style={ActivityScreenStyle.bgContainer}
    >
      <View style={[ActivityScreenStyle.container, { width: "90%" }]}>
        <View style={ActivityScreenStyle.historyContainer}>
          <View style={ActivityScreenStyle.chainSelectRow}>
            <View style={ActivityScreenStyle.chainButtonWrap}>
              <TouchableOpacity
                onPress={() =>
                  shouldDisplayChainFilterModal &&
                  setChainFilterModalVisible(true)
                }
                style={ActivityScreenStyle.chainButton}
              >
                {selectedChain === "All" ? (
                  <Image
                    source={require("../assets/branding/AssetsScreenLogo.webp")}
                    style={ActivityScreenStyle.chainIconDefault}
                  />
                ) : (
                  transactionChainCards.length > 0 &&
                  transactionChainCards
                    .filter(
                      (card) => card.queryChainShortName === selectedChain,
                    )
                    .map((card, index) => (
                      <Image
                        key={`${card.queryChainShortName}-${index}`}
                        source={resolveChainIcon(card?.queryChainName)}
                        style={ActivityScreenStyle.chainIconSel}
                      />
                    ))
                )}
                <Text
                  style={{
                    color: isDarkMode ? "#FFFFFF" : "#000000",
                    textAlign: "right",
                    flexShrink: 1,
                  }}
                >
                  {selectedChain === "All"
                    ? t("All Chains")
                    : (() => {
                        const name = transactionChainCards.find(
                          (card) => card.queryChainShortName === selectedChain,
                        )?.queryChainName;
                        return name
                          ? name.charAt(0).toUpperCase() + name.slice(1)
                          : "";
                      })()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={listData}
            keyExtractor={(item, index) => getTxKey(item, index)}
            style={ActivityScreenStyle.flatList}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent:
                !filteredActivityLog ||
                filteredActivityLog.length === 0 ||
                cryptoCards.length === 0 ||
                effectiveLoading
                  ? "center"
                  : "flex-start",
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                progressViewOffset={-20}
              />
            }
            ListHeaderComponent={
              <View
                style={{
                  position: "absolute",
                  top: -30,
                  left: 0,
                  right: 0,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: isDarkMode ? "#fff" : "#888" }}>
                  {refreshing ? t("Refreshing…") : t("Pull down to refresh")}
                </Text>
              </View>
            }
            renderItem={({ item: transaction, index }) => {
              const chainNameLc = getChainNameFromTx(transaction);
              const txSym = String(transaction.symbol || "").trim();
              const { cryptoIcon, chainIcon } = resolveTransactionIcons({
                cryptos: initialAdditionalCryptos,
                chain: chainNameLc,
                symbol: txSym,
              });
              const addrLc = String(transaction.address || "").trim();
              const fromLc = String(transaction.fromAddress || "").trim();
              const typeLc = String(transaction.transactionType || "")
                .trim()
                .toLowerCase();
              const isSendTx = typeLc
                ? typeLc === "send"
                : areAddressesEquivalent(chainNameLc, addrLc, fromLc);

              const entryKey = getTxKey(transaction, index);
              const entryAnim = getEntryAnim(entryKey);
              const translateY = entryAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [entryOffset, 0],
              });
              return (
                <Animated.View
                  style={{
                    transform: [{ translateY }],
                    opacity: entryAnim,
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("LogDetail", {
                        transaction,
                      })
                    }
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
                      <Text style={ActivityScreenStyle.historyItemText}>
                        {`${new Date(
                          Number(transaction.transactionTime),
                        ).toLocaleString()}`}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View
                          style={{
                            position: "relative",
                            width: 50,
                            height: 50,
                          }}
                        >
                          {["carIcnCtr", "carChnIcnWra"].map(
                            (_, i) => (
                              <View
                                key={i}
                                style={
                                  i === 0
                                    ? {
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: 42,
                                        height: 42,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: 21,
                                        backgroundColor: "#ffffff80",
                                        overflow: "hidden",
                                        borderWidth: 1,
                                        borderColor: "#ffffff",
                                      }
                                    : {
                                        position: "absolute",
                                        top: 26,
                                        left: 28,
                                        width: 16,
                                        height: 16,
                                        borderWidth: 1,
                                        borderColor: "#ffffff",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: 15,
                                        backgroundColor: "#ffffff",
                                        overflow: "hidden",
                                      }
                                }
                              >
                                {i === 0 ? (
                                  cryptoIcon ? (
                                    <Image
                                      source={cryptoIcon}
                                      style={{ width: 42, height: 42 }}
                                      resizeMode="contain"
                                    />
                                  ) : (
                                    <MaterialIcons
                                      name="help-outline"
                                      size={24}
                                      color={iconFallbackColor}
                                    />
                                  )
                                ) : chainIcon ? (
                                  <Image
                                    source={chainIcon}
                                    style={{ width: 14, height: 14 }}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <MaterialIcons
                                    name="help-outline"
                                    size={12}
                                    color={iconFallbackColor}
                                  />
                                )}
                              </View>
                            ),
                          )}
                        </View>
                        <View style={ActivityScreenStyle.LogInfo}>
                          <View style={ActivityScreenStyle.logInfoHeader}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={[
                                  ActivityScreenStyle.historyItemText,
                                  { fontSize: 16, fontWeight: "bold" },
                                ]}
                              >
                                {isSendTx ? t("Send") : t("Receive")}
                              </Text>
                              <Text
                                style={[
                                  ActivityScreenStyle.historyItemText,
                                  { marginLeft: 8 },
                                ]}
                              >
                                <Text
                                  style={{
                                    color:
                                      transaction.state.toLowerCase() ===
                                      "success"
                                        ? "#47B480"
                                        : "#D2464B",
                                  }}
                                >
                                  {transaction.state}
                                </Text>
                              </Text>
                            </View>
                            <Text
                              style={[
                                ActivityScreenStyle.historyItemText,
                                {
                                  fontSize: 16,
                                  fontWeight: "bold",
                                  marginBottom: 0,
                                },
                              ]}
                            >
                              {isSendTx ? "-" : ""}
                              {truncateTail(transaction.amount, 16)}{" "}
                              {transaction.symbol}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
            ListEmptyComponent={
              effectiveLoading ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: "stretch",
                    justifyContent: "flex-start",
                    paddingHorizontal: 10,
                    paddingTop: 4,
                  }}
                >
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <View
                      key={`activity-skel-${idx}`}
                      style={{
                        width: skeletonWidth,
                        alignSelf: "center",
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
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View
                          style={{
                            position: "relative",
                            width: 50,
                            height: 50,
                            marginRight: 10,
                          }}
                        >
                          <DataSkeleton
                            width={42}
                            height={42}
                            isDarkMode={isDarkMode}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              borderRadius: 21,
                            }}
                          />
                          <DataSkeleton
                            width={14}
                            height={14}
                            isDarkMode={isDarkMode}
                            style={{
                              position: "absolute",
                              top: 26,
                              left: 28,
                              borderRadius: 7,
                            }}
                          />
                        </View>
                        <View
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 6,
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
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <View style={{ alignItems: "center", gap: 6, width: "80%" }}>
                    <Text style={ActivityScreenStyle.noHistoryText}>
                      {t("No actions yet")}
                    </Text>
                    <Text style={ActivityScreenStyle.noHistoryText}>
                      {t(
                        "This space comes alive when you take your first action.",
                      )}
                    </Text>
                  </View>
                </View>
              )
            }
            ListFooterComponent={
              <>
                {isFetching && filteredActivityLog.length > 0 ? (
                  <View style={{ padding: 16 }}>
                    <ActivityIndicator size="small" />
                  </View>
                ) : showNoMoreTip ? (
                  <Animated.View
                    style={{
                      padding: 16,
                      alignItems: "center",
                      opacity: noMoreOpacity,
                    }}
                  >
                    <Text style={{ color: isDarkMode ? "#fff" : "#888" }}>
                      {t("No more records")}
                    </Text>
                  </Animated.View>
                ) : null}
              </>
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
          />
          {shouldDisplayChainFilterModal && (
            <ChainSelectorModal
              isVisible={isChainFilterModalVisible}
              onClose={() => setChainFilterModalVisible(false)}
              selectedChain={selectedChain}
              handleSelectChain={(chain) => {
                setSelectedChain(chain);
                setChainFilterModalVisible(false);
              }}
              cards={transactionChainCards}
              isDarkMode={isDarkMode}
              t={t}
              mode="activity"
            />
          )}
        </View>
      </View>
    </LinearGradient>
  );
};

export default ActivityLogScreen;
