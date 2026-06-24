/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// AddAssetScreen.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ImageBackground,
  TextInput,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { MaterialIcons as Icon, FontAwesome6 } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { VaultScreenStylesRoot } from "../styles/styles";
import { DeviceContext, DarkModeContext } from "../utils/DeviceContext";
import { tokenAPI } from "../env/apiEndpoints";
import { fetchWalletBalance } from "./AssetsScreen/AssetsDataFetcher";
import { getNetworkImage, networks } from "../config/networkConfig";
import { resolveGasFeeSymbolForChain } from "../config/gasFeeToken";
import { ensureCryptoCardRuntimeFields } from "../utils/assetRuntimeFields";
import { resolveCardImage } from "../utils/cardImageResolver";
import {
  resolveAssetIcon,
  resolveChainIcon,
} from "../utils/assetIconResolver";
import { displayChainName } from "../utils/assetDisplayFormat";
import {
  getAssetChainShortName,
  getAssetChainFullName,
  getAssetDisplayName,
  getAssetSymbol,
  getAssetType,
} from "../config/assetInfo";
import AnimatedWebP from "./common/AnimatedWebP";
import { BlurView } from "./common/AppBlurView";

const normalizeAssetSearchText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");

const compactAssetSearchText = (value) =>
  normalizeAssetSearchText(value).replace(/\s+/g, "");

const normalizeAssetIdentityPart = (value) =>
  String(value || "").trim().toLowerCase();

const buildAssetIdentityKey = (asset) => {
  const chain = normalizeAssetIdentityPart(
    getAssetChainFullName(asset) || getAssetChainShortName(asset),
  );
  const symbol = normalizeAssetIdentityPart(getAssetSymbol(asset));
  const contract = normalizeAssetIdentityPart(
    asset?.contractAddress ||
      asset?.contract_address ||
      asset?.tokenContractAddress,
  );
  const tokenId = normalizeAssetIdentityPart(asset?.tokenId || asset?.mint);
  const coinType = normalizeAssetIdentityPart(getAssetType(asset));
  return `${chain}:${symbol}:${contract}:${tokenId}:${coinType}`;
};

const uniqueAssetsByIdentity = (assets) => {
  const seen = new Set();
  return (Array.isArray(assets) ? assets : []).filter((asset) => {
    const key = buildAssetIdentityKey(asset);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildSearchAcronym = (value) =>
  normalizeAssetSearchText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("");

const ASSET_SEARCH_ALIASES_BY_CHAIN = {
  bitcoin: ["bit", "btc", "bitcoin"],
  bitcoin_cash: ["bit", "bch", "bitcoin cash", "bitcoincash", "cashaddr"],
  binance: ["bnb", "bsc", "bnb chain", "binance smart chain"],
  ethereum: ["eth", "ether", "ethereum mainnet"],
  ethereum_classic: ["etc", "ethereum classic"],
  gnosis: ["gno", "xdai", "gnosis chain"],
  linea: ["linea"],
  celestia: ["tia", "celestia"],
  polygon: ["pol", "matic"],
  zksync: ["zk", "zks", "zk sync", "zksync era"],
};

const buildAssetSearchFields = (crypto) => {
  const chainName = getAssetChainFullName(crypto) || "";
  const displayChain = displayChainName(chainName);
  const normalizedChain = normalizeAssetSearchText(chainName);
  const shortName = String(getAssetSymbol(crypto) || "").trim().toUpperCase();
  const shortNameAliases = [];
  if (/^X[A-Z0-9]{3,}$/.test(shortName)) {
    shortNameAliases.push(`${shortName.charAt(0)} ${shortName.slice(1)}`);
  }
  if (/^WX[A-Z0-9]{3,}$/.test(shortName)) {
    shortNameAliases.push(`W ${shortName.slice(1)}`);
    shortNameAliases.push(`X ${shortName.slice(2)}`);
  }
  const rawFields = [
    { value: getAssetDisplayName(crypto), weight: 90 },
    { value: getAssetSymbol(crypto), weight: 100 },
    { value: getAssetChainShortName(crypto), weight: 95 },
    { value: chainName, weight: 88 },
    { value: displayChain, weight: 88 },
    { value: `${getAssetDisplayName(crypto) || ""} ${getAssetSymbol(crypto) || ""}`, weight: 82 },
    { value: `${displayChain} ${getAssetSymbol(crypto) || ""}`, weight: 80 },
    { value: `${chainName} ${getAssetSymbol(crypto) || ""}`, weight: 80 },
    { value: buildSearchAcronym(getAssetDisplayName(crypto)), weight: 76 },
    { value: buildSearchAcronym(displayChain), weight: 74 },
    ...shortNameAliases.map((value) => ({ value, weight: 86 })),
    ...(ASSET_SEARCH_ALIASES_BY_CHAIN[normalizedChain] || []).map((value) => ({
      value,
      weight: 92,
    })),
  ];

  return rawFields
    .flatMap(({ value, weight }) => [
      { value: normalizeAssetSearchText(value), weight },
      { value: compactAssetSearchText(value), weight },
    ])
    .filter((field) => field.value);
};

const matchesAssetSearchTerm = (field, term) => {
  if (!field?.value || !term) return false;
  return field.value.includes(term);
};

const scoreAssetSearchTerm = (field, term) => {
  if (!field?.value || !term || !field.value.includes(term)) return 0;
  if (field.value === term) return field.weight + 300;
  if (field.value.startsWith(term)) return field.weight + 200;
  return field.weight + 100 - Math.min(field.value.indexOf(term), 40);
};

const scoreAssetSearch = (
  fields,
  searchTerms,
  compactQuery,
  preferCompactQuery = false,
) => {
  const termScore =
    searchTerms.length > 0
      ? searchTerms.reduce((sum, term) => {
          const best = Math.max(
            0,
            ...fields.map((field) => scoreAssetSearchTerm(field, term)),
          );
          return sum + best;
        }, 0)
      : 0;
  const compactScore = compactQuery
    ? Math.max(
        0,
        ...fields.map((field) => scoreAssetSearchTerm(field, compactQuery)),
      ) + (preferCompactQuery ? 50 : 0)
    : 0;
  return Math.max(termScore, compactScore);
};

const AddAssetScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { isDarkMode } = React.useContext(DarkModeContext);
  const VaultScreenStyle = VaultScreenStylesRoot(isDarkMode);
  const {
    additionalCryptos,
    initialAdditionalCryptos,
    cryptoCards,
    setCryptoCards,
    setCryptoCount,
    setAddedCryptos,
  } = React.useContext(DeviceContext);

  const [step, setStep] = useState("list");
  const [selectedChain, setSelectedChain] = useState("All");
  const [selectedCryptos, setSelectedCryptos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [searchNetwork, setSearchNetwork] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [networkDropdownVisible, setNetworkDropdownVisible] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [searchBoxHeight, setSearchBoxHeight] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  const [contractError, setContractError] = useState(false);
  const [unsupportedModalVisible, setUnsupportedModalVisible] = useState(false);
  const shakeNetworkAnim = useRef(new Animated.Value(0)).current;
  const shakeContractAnim = useRef(new Animated.Value(0)).current;
  const networkInputRef = useRef(null);

  useEffect(() => {
    if (step !== "custom") {
      setNetworkDropdownVisible(false);
    }
  }, [step]);

  useEffect(() => {
    const title =
      step === "custom"
        ? t("Add Custom Token")
        : t("Search Asset");
    navigation.setOptions({ title });
  }, [navigation, step, t]);

  useEffect(() => {
    if (networkError) runShake(shakeNetworkAnim);
  }, [networkError, shakeNetworkAnim]);

  useEffect(() => {
    if (contractError) runShake(shakeContractAnim);
  }, [contractError, shakeContractAnim]);

  const dedupedAdditionalCryptos = useMemo(
    () => uniqueAssetsByIdentity(additionalCryptos),
    [additionalCryptos],
  );

  const dedupedInitialAdditionalCryptos = useMemo(
    () => uniqueAssetsByIdentity(initialAdditionalCryptos),
    [initialAdditionalCryptos],
  );

  const chainCategories = useMemo(
    () =>
      dedupedInitialAdditionalCryptos.map((crypto) => ({
        name: getAssetChainFullName(crypto),
        ...crypto,
      })),
    [dedupedInitialAdditionalCryptos]
  );

  const displayShortName = (shortName) => String(shortName || "").trim();
  const normalizeCustomTokenChain = (networkName) => {
    const normalized = String(networkName || "")
      .trim()
      .toLowerCase();
    const aliases = {
      "bitcoin cash": "bitcoin_cash",
      "binance smart chain": "binance",
      "ethereum classic": "ethereum_classic",
      "iotex network mainnet": "iotex",
      "zksync era mainnet": "zksync",
      sui: "sui",
    };
    return aliases[normalized] || normalized.replace(/\s+/g, "_");
  };
  const getCryptoCardImage = React.useCallback(
    (crypto) => resolveCardImage(crypto),
    [],
  );
  const getCryptoIcon = React.useCallback((crypto) => resolveAssetIcon(crypto), []);
  const getChainIcon = React.useCallback(
    (queryChainName, fallbackIcon = null) =>
      resolveChainIcon(queryChainName, fallbackIcon),
    [],
  );
  const handleSelectChain = React.useCallback((chain) => {
    Keyboard.dismiss();
    setSelectedChain(chain);
  }, []);
  const dismissSearchInput = React.useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const searchedCryptos = useMemo(() => {
    const normalizedQuery = normalizeAssetSearchText(searchQuery);
    const queryTerms = normalizedQuery
      .split(/\s+/)
      .filter((term) => term.length > 1);
    const compactQuery = compactAssetSearchText(searchQuery);
    const searchTerms = Array.from(
      new Set(queryTerms.filter(Boolean)),
    );
    const list = dedupedAdditionalCryptos;
    if (searchTerms.length === 0 && !compactQuery) return list;
    return list
      .map((crypto, index) => {
        const fields = buildAssetSearchFields(crypto);
        const preferCompactQuery =
          !!compactQuery && compactQuery !== searchTerms.join("");
        const termMatch =
          searchTerms.length > 0 &&
          searchTerms.every((term) =>
            fields.some((field) => matchesAssetSearchTerm(field, term)),
          );
        const compactMatch =
          !!compactQuery &&
          fields.some((field) => matchesAssetSearchTerm(field, compactQuery));
        return {
          crypto,
          index,
          score: termMatch || compactMatch
            ? scoreAssetSearch(
                fields,
                searchTerms,
                compactQuery,
                preferCompactQuery,
              )
            : 0,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.crypto);
  }, [dedupedAdditionalCryptos, searchQuery]);

  const filteredByChain =
    selectedChain === "All"
      ? searchedCryptos
      : searchedCryptos.filter(
          (crypto) => getAssetChainFullName(crypto) === selectedChain
        );

  const noSearchResults =
    String(searchQuery || "").trim().length > 0 && filteredByChain.length === 0;

  const gasFeeSymbolByChain = useMemo(() => {
    const map = new Map();
    const chainSet = new Set(
      dedupedAdditionalCryptos
        .map((c) =>
          String(getAssetChainFullName(c) || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
      );
    chainSet.forEach((chain) => {
      const feeSymbol = resolveGasFeeSymbolForChain(chain, dedupedAdditionalCryptos);
      if (feeSymbol) map.set(chain, feeSymbol);
    });
    return map;
  }, [dedupedAdditionalCryptos]);

  useFocusEffect(
    useCallback(() => {
      Keyboard.dismiss();
      setSearchQuery("");
      setSelectedChain("All");
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const addedCryptos = (Array.isArray(cryptoCards) ? cryptoCards : []).map(
        buildAssetIdentityKey,
      );
      const initiallySelected = searchedCryptos.filter((crypto) =>
        addedCryptos.includes(buildAssetIdentityKey(crypto)),
      );
      setSelectedCryptos(initiallySelected);
    }, [cryptoCards, searchedCryptos])
  );

  const toggleSelectCrypto = (crypto) => {
    Keyboard.dismiss();
    const cryptoIdentifier = buildAssetIdentityKey(crypto);
    if (
      selectedCryptos.some(
        (selected) => buildAssetIdentityKey(selected) === cryptoIdentifier,
      )
    ) {
      setSelectedCryptos(
        selectedCryptos.filter(
          (c) => buildAssetIdentityKey(c) !== cryptoIdentifier,
        )
      );
    } else {
      setSelectedCryptos([...selectedCryptos, crypto]);
    }
  };

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    // When AddItem is opened as the first screen, the back stack is empty, and instead the home page asset Tab is explicitly returned.
    navigation.navigate("Back", { screen: "Assets" });
  }, [navigation]);

  const handleClose = () => {
    Keyboard.dismiss();
    safeGoBack();
  };

  const handleAddCrypto = async (cryptos) => {
    const cards = Array.isArray(cryptoCards) ? cryptoCards : [];
    const nextCards = [
      ...cards,
      ...cryptos
        .filter(
          (crypto) =>
            !cards.find(
              (card) => buildAssetIdentityKey(card) === buildAssetIdentityKey(crypto),
            )
        )
        .map((crypto) => {
          const cryptoIdentityKey = buildAssetIdentityKey(crypto);
          const matchedCrypto = dedupedInitialAdditionalCryptos.find(
            (item) => buildAssetIdentityKey(item) === cryptoIdentityKey,
          );
          return ensureCryptoCardRuntimeFields({
            ...crypto,
            address: matchedCrypto ? matchedCrypto.address : "",
          });
        }),
    ];
    setCryptoCards(nextCards);
    setCryptoCount(nextCards.length);
    setAddedCryptos(nextCards);
    try {
      await fetchWalletBalance(nextCards, setCryptoCards, {
        source: "addAsset",
      });
    } catch {}
  };

  const handleConfirm = async () => {
    Keyboard.dismiss();
    if (selectedCryptos.length === 0) return;
    await handleAddCrypto(selectedCryptos);
    setSelectedCryptos([]);
    safeGoBack();
  };

  const openCustomToken = () => {
    Keyboard.dismiss();
    setSearchNetwork("");
    setSelectedNetwork("");
    setContractAddress("");
    setNetworkDropdownVisible(false);
    setNetworkError(false);
    setContractError(false);
    setStep("custom");
  };

  const closeCustomToken = () => {
    Keyboard.dismiss();
    setNetworkDropdownVisible(false);
    setStep("list");
  };

  const openNotSupported = () => {
    Keyboard.dismiss();
    setNetworkDropdownVisible(false);
    setUnsupportedModalVisible(true);
  };

  const closeNotSupported = () => {
    setUnsupportedModalVisible(false);
  };

  const handleAddCustomToken = async () => {
    const normalizedNetwork =
      getBestNetworkMatch(selectedNetwork) || selectedNetwork;
    const payload = {
      chain: normalizeCustomTokenChain(normalizedNetwork),
      tokenAddress: String(contractAddress || "").trim(),
    };

    try {
      if (!tokenAPI?.enabled || !tokenAPI?.addToken) {
        console.log("[AddCustomToken][SKIP]", {
          reason: "token API is not configured",
          body: payload,
        });
        return;
      }

      console.log("[AddCustomToken][REQUEST]", {
        url: tokenAPI.addToken,
        method: "POST",
        body: payload,
      });

      const response = await fetch(tokenAPI.addToken, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseData = responseText;
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {}

      console.log("[AddCustomToken][RESPONSE]", {
        status: response.status,
        ok: response.ok,
        data: responseData,
      });
    } catch (error) {
      console.log("[AddCustomToken][ERROR]", error);
    }
  };

  const filteredNetworks = networks.filter((name) =>
    name.toLowerCase().includes(searchNetwork.toLowerCase())
  );

  const runShake = (anim) => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: -6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getBestNetworkMatch = (text) => {
    const query = text.trim().toLowerCase();
    if (!query) return "";
    const exactMatch = networks.find(
      (network) => network.toLowerCase() === query
    );
    if (exactMatch) return exactMatch;
    const prefixMatch = networks.find((network) =>
      network.toLowerCase().startsWith(query)
    );
    if (prefixMatch) return prefixMatch;
    return (
      networks.find((network) => network.toLowerCase().includes(query)) || ""
    );
  };

  const isConfirmDisabled = selectedCryptos.length === 0;
  if (__DEV__ && typeof isConfirmDisabled !== "boolean") {
    throw new Error("disabled must be boolean");
  }

  const isAddDisabled = false;
  if (__DEV__ && typeof isAddDisabled !== "boolean") {
    throw new Error("disabled must be boolean");
  }

  const darkColors = ["#21201E", "#0E0D0D"];
  const lightColors = ["#ffffff", "#EDEBEF"];

  return (
    <LinearGradient
      colors={isDarkMode ? darkColors : lightColors}
      style={VaultScreenStyle.linearGradient}
    >
      {step === "list" && (
        <Pressable
          onPress={dismissSearchInput}
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <View style={styles.listBody}>
            <View
              style={[
                VaultScreenStyle.searchContainer,
                { height: 48, borderRadius: 16, marginBottom: 8 },
              ]}
            >
              <Icon
                name="search"
                size={20}
                style={VaultScreenStyle.searchIcon}
              />
              <TextInput
                style={[VaultScreenStyle.searchInput, styles.searchInputFix]}
                placeholder={t("Search Asset")}
                placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
                onChangeText={(text) => setSearchQuery(text)}
                value={searchQuery}
              />
            </View>
            <View
              style={{
                borderRadius: 16,
                height: 60,
              }}
            >
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="always"
                style={{
                  borderRadius: 16,
                  height: 60,
                }}
                contentContainerStyle={{ alignItems: "center", height: "100%" }}
                showsHorizontalScrollIndicator={false}
              >
                <Pressable
                  key="All"
                  style={[
                    VaultScreenStyle.chainTag,
                    {
                      borderRadius: 16,
                      height: 32,
                      width: 64,
                      paddingHorizontal: 0,
                      justifyContent: "center",
                      alignItems: "center",
                    },
                    selectedChain === "All" &&
                      VaultScreenStyle.selectedChainTag,
                    selectedChain !== "All" && {
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleSelectChain("All")}
                >
                  <Text
                    style={[
                      VaultScreenStyle.chainTagText,
                      { textAlign: "center" },
                      selectedChain === "All" &&
                        VaultScreenStyle.selChnTagTxt,
                      selectedChain !== "All" && {
                        color: isDarkMode ? "#cfcfcf" : "#444",
                      },
                    ]}
                  >
                    {t("All")}
                  </Text>
                </Pressable>
                {Array.from(
                  new Set(
                    chainCategories
                      .map((chain) => getAssetChainFullName(chain))
                      .filter(Boolean)
                  )
                )
                  .sort((a, b) =>
                    a.localeCompare(b, undefined, { sensitivity: "base" })
                  )
                  .map((queryChainName) => {
                    const isSelected = selectedChain === queryChainName;
                    return (
                      <Pressable
                        key={queryChainName}
                        style={[
                          VaultScreenStyle.chainTag,
                          { borderRadius: 16, height: 32, minWidth: 64 },
                          isSelected && VaultScreenStyle.selectedChainTag,
                          !isSelected && {
                            backgroundColor: isDarkMode
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.06)",
                          },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => handleSelectChain(queryChainName)}
                      >
                        {chainCategories.some(
                          (category) =>
                            getAssetChainFullName(category) === queryChainName
                        ) && (
                          <>
                {chainCategories.filter(
                  (category) =>
                    getAssetChainFullName(category) === queryChainName
                )[0] && (
                  <Image
                    source={getChainIcon(queryChainName)}
                    style={VaultScreenStyle.TagChainIcon}
                  />
                )}
                            <Text
                              style={[
                                VaultScreenStyle.chainTagText,
                                isSelected &&
                                  VaultScreenStyle.selChnTagTxt,
                                !isSelected && {
                                  color: isDarkMode ? "#cfcfcf" : "#444",
                                },
                              ]}
                            >
                              {displayChainName(queryChainName)}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    );
                  })}
              </ScrollView>
            </View>

            <ScrollView
              style={{
                borderRadius: 16,
                flex: 1,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                noSearchResults
                  ? {
                      flexGrow: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }
                  : undefined
              }
            >
              {noSearchResults ? (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    marginVertical: 16,
                  }}
                >
                  <Text
                    style={{
                      color: isDarkMode ? "#FFFFFF" : "#21201E",
                      fontSize: 16,
                      textAlign: "center",
                      marginBottom: 6,
                    }}
                  >
                    {t("No matching tokens found")}
                  </Text>
                  <Text
                    onPress={openCustomToken}
                    style={{
                      color: isDarkMode ? "#97979C" : "#7F7F84",
                      fontSize: 12,
                      textAlign: "center",
                      width: "100%",
                    }}
                  >
                    <Text style={{ color: isDarkMode ? "#97979C" : "#7F7F84" }}>
                      {t("Token not listed?")}
                    </Text>
                    {"\u00A0\u00A0"}
                    <Text
                      style={{
                        color: isDarkMode ? "#CCB68C" : "#CFAB95",
                        marginLeft: 8,
                      }}
                    >
                      {t("Add Custom Token")}
                    </Text>
                  </Text>
                </View>
              ) : (
                filteredByChain.map((crypto) => {
                  const isSelected = selectedCryptos.includes(crypto);
                  const isAdded = (cryptoCards || []).some(
                    (card) => buildAssetIdentityKey(card) === buildAssetIdentityKey(crypto),
                  );
                  const chainKey = String(getAssetChainFullName(crypto) || "")
                    .trim()
                    .toLowerCase();
                  const shortNameKey = String(getAssetSymbol(crypto) || "")
                    .trim()
                    .toLowerCase();
                  const showGasFeeIcon =
                    !!chainKey &&
                    !!shortNameKey &&
                    gasFeeSymbolByChain.get(chainKey) === shortNameKey;
                  const displayName = getAssetDisplayName(crypto);
                  const displayChain = getAssetChainFullName(crypto)
                    ? displayChainName(getAssetChainFullName(crypto))
                    : "";
                  const shouldStackAssetMeta =
                    isAdded ||
                    showGasFeeIcon ||
                    `${displayName} ${displayChain}`.trim().length > 22;
                  return (
                    <TouchableOpacity
                      key={buildAssetIdentityKey(crypto)}
                      style={[
                        VaultScreenStyle.addCryptoButton,
                        {
                          padding: 6,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor:
                            isSelected || isAdded ? "#CFAB95" : "transparent",
                          backgroundColor: !isSelected
                            ? isDarkMode
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(0,0,0,0.04)"
                            : "transparent",
                        },
                      ]}
                      onPress={() => toggleSelectCrypto(crypto)}
                    >
                      <ImageBackground
                        source={getCryptoCardImage(crypto)}
                        style={VaultScreenStyle.addCryptoImage}
                        imageStyle={{
                          borderRadius: 10,
                          backgroundColor: "#ffffff50",
                        }}
                      >
                        <View style={VaultScreenStyle.addCryptoOverlay} />
                        <View style={VaultScreenStyle.icnAndTxtCtr}>
                        <View
                          style={{
                            width: 30,
                            height: 30,
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 15,
                              backgroundColor: "#ffffff50",
                              overflow: "hidden",
                            }}
                          >
                            <Image
                              source={getCryptoIcon(crypto)}
                              style={VaultScreenStyle.addCardIcon}
                            />
                          </View>
                          <Text
                            style={VaultScreenStyle.addCrypImgTxt}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            allowFontScaling={false}
                          >
                            {displayShortName(getAssetSymbol(crypto))}
                          </Text>
                        </View>
                      </ImageBackground>

                      {isAdded && (
                        <View
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            backgroundColor: "#CFAB9540",
                            paddingVertical: 2,
                            paddingHorizontal: 8,
                            borderRadius: 30,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDarkMode ? "#ffffff" : "#21201E",
                            }}
                          >
                            {t("Added")}
                          </Text>
                        </View>
                      )}

                      <View
                        style={{
                          flex: 1,
                          minWidth: 0,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            width: "100%",
                            paddingHorizontal: isAdded ? 42 : 0,
                            flexDirection: "row",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            alignItems: "center",
                            columnGap: 6,
                            rowGap: 4,
                          }}
                        >
                          <Text
                            style={[
                              VaultScreenStyle.addCryptoText,
                              {
                                marginRight: 0,
                                textAlign: "center",
                                flexShrink: 1,
                                maxWidth: shouldStackAssetMeta ? "100%" : "58%",
                              },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {displayName}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              maxWidth: shouldStackAssetMeta ? "100%" : "40%",
                              alignSelf: "center",
                            }}
                          >
                            <View
                              style={[
                                VaultScreenStyle.chainContainer,
                                { maxWidth: showGasFeeIcon ? "88%" : "100%" },
                              ]}
                            >
                              <Text
                                style={VaultScreenStyle.chainCardText}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                              >
                                {displayChain}
                              </Text>
                            </View>
                            {showGasFeeIcon ? (
                              <FontAwesome6
                                name="gas-pump"
                                size={12}
                                color={isDarkMode ? "#C9CDD4" : "#9AA1AD"}
                                style={{ marginLeft: 6 }}
                              />
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {!noSearchResults && (
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  marginTop: 16,
                }}
              >
                <Text
                  onPress={openCustomToken}
                  style={{
                    color: isDarkMode ? "#97979C" : "#7F7F84",
                    fontSize: 12,
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  <Text style={{ color: isDarkMode ? "#97979C" : "#7F7F84" }}>
                    {t("Token not listed?")}
                  </Text>
                  {"\u00A0\u00A0"}
                  <Text
                    style={{
                      color: isDarkMode ? "#CCB68C" : "#CFAB95",
                      marginLeft: 8,
                    }}
                  >
                    {t("Add Custom Token")}
                  </Text>
                </Text>
              </View>
            )}

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[
                  VaultScreenStyle.cancelButton,
                  { flex: 1, marginRight: 4, borderRadius: 16 },
                ]}
                onPress={handleClose}
              >
                <Text style={VaultScreenStyle.cancelButtonText}>
                  {t("Close")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  selectedCryptos.length > 0
                    ? VaultScreenStyle.addModalButton
                    : VaultScreenStyle.disabledButton,
                  { flex: 1, marginLeft: 4, borderRadius: 16 },
                ]}
                onPress={handleConfirm}
                disabled={!!isConfirmDisabled}
              >
                <Text
                  style={[
                    selectedCryptos.length > 0
                      ? VaultScreenStyle.confirmText
                      : VaultScreenStyle.disabledText,
                  ]}
                >
                  {t("Confirm")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      )}

      {step === "custom" && (
        <View style={styles.fullHeight}>
          <TouchableWithoutFeedback
            onPress={() => setNetworkDropdownVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.flexGrow}
            >
              <View style={styles.flexGrow}>
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.formContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    style={{
                      marginTop: 20,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    <Animated.View
                      style={{ transform: [{ translateX: shakeNetworkAnim }] }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          setNetworkDropdownVisible(!networkDropdownVisible)
                        }
                        onLayout={(e) =>
                          setSearchBoxHeight(e.nativeEvent.layout.height)
                        }
                        style={[
                          VaultScreenStyle.passwordInput || {
                            padding: 12,
                            borderRadius: 10,
                          },
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: isDarkMode ? "#21201E" : "#E3E3E8",
                            borderWidth: 1,
                            borderColor: networkError
                              ? "#FF5252"
                              : "transparent",
                            borderRadius: 16,
                          },
                          { paddingVertical: 0 },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          {selectedNetwork &&
                            filteredNetworks.includes(selectedNetwork) && (
                              <Image
                                source={getNetworkImage(selectedNetwork)}
                                style={[
                                  VaultScreenStyle.addrBookIcon24 || {
                                    width: 24,
                                    height: 24,
                                    marginRight: 10,
                                    borderRadius: 12,
                                  },
                                  {
                                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                                    borderRadius: 12,
                                  },
                                ]}
                              />
                            )}
                          <TextInput
                            ref={networkInputRef}
                            style={{
                              color: isDarkMode ? "#ddd" : "#000",
                              flex: 1,
                              paddingVertical: 0,
                            }}
                            value={selectedNetwork}
                            onChangeText={(text) => {
                              setSelectedNetwork(text);
                              setSearchNetwork(text);
                              setNetworkDropdownVisible(true);
                              if (networkError) setNetworkError(false);
                            }}
                            onEndEditing={() => {
                              const bestMatch =
                                getBestNetworkMatch(selectedNetwork);
                              if (bestMatch && bestMatch !== selectedNetwork) {
                                setSelectedNetwork(bestMatch);
                                setSearchNetwork(bestMatch);
                                setNetworkDropdownVisible(false);
                              }
                            }}
                            onSubmitEditing={() => {
                              const bestMatch =
                                getBestNetworkMatch(selectedNetwork);
                              if (bestMatch && bestMatch !== selectedNetwork) {
                                setSelectedNetwork(bestMatch);
                                setSearchNetwork(bestMatch);
                              }
                              setNetworkDropdownVisible(false);
                            }}
                            placeholder={t("Search Network")}
                            placeholderTextColor={
                              isDarkMode ? "#ccc" : "#7F7F84"
                            }
                          />
                        </View>
                        <Icon
                          name={
                            networkDropdownVisible
                              ? "expand-less"
                              : "expand-more"
                          }
                          size={24}
                          color={isDarkMode ? "#ddd" : "#676776"}
                        />
                      </TouchableOpacity>
                    </Animated.View>

                    {networkDropdownVisible && (
                      <View
                        style={{
                          position: "absolute",
                          top: searchBoxHeight + 8,
                          left: 0,
                          right: 0,
                          zIndex: 1000,
                          elevation: 12,
                        }}
                      >
                        <ScrollView
                          style={
                            VaultScreenStyle.addrBookMaxH200 || {
                              maxHeight: 200,
                              borderRadius: 10,
                            }
                          }
                          showsVerticalScrollIndicator
                          showsHorizontalScrollIndicator={false}
                        >
                          {filteredNetworks.map((network) => (
                            <TouchableOpacity
                              key={network}
                              onPress={() => {
                                setSelectedNetwork(network);
                                setSearchNetwork(network);
                                setNetworkDropdownVisible(false);
                                requestAnimationFrame(() => {
                                  networkInputRef.current?.focus();
                                });
                              }}
                              style={{
                                padding: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor:
                                  network === selectedNetwork
                                    ? isDarkMode
                                      ? "#4B4642"
                                      : "#f5f5f5"
                                    : isDarkMode
                                    ? "#21201E"
                                    : "#E3E3E8",
                              }}
                            >
                              <Image
                                source={getNetworkImage(network)}
                                style={{
                                  width: 24,
                                  height: 24,
                                  marginRight: 8,
                                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                                  borderRadius: 12,
                                }}
                              />
                              <Text
                                style={[
                                  VaultScreenStyle.Text || { fontSize: 16 },
                                  { color: isDarkMode ? "#97979C" : "#7F7F84" },
                                ]}
                              >
                                {network}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={{ width: "100%", marginTop: 16 }}>
                    <Animated.View
                      style={{ transform: [{ translateX: shakeContractAnim }] }}
                    >
                      <TextInput
                        style={[
                          VaultScreenStyle.passwordInput || {
                            padding: 12,
                            borderRadius: 10,
                          },
                          {
                            backgroundColor: isDarkMode ? "#21201E" : "#E3E3E8",
                            color: isDarkMode ? "#fff" : "#000",
                            borderWidth: 1,
                            borderColor: contractError
                              ? "#FF5252"
                              : "transparent",
                            borderRadius: 16,
                          },
                        ]}
                        placeholder={t("Contract Address")}
                        placeholderTextColor={isDarkMode ? "#ccc" : "#7F7F84"}
                        onChangeText={(text) => {
                          setContractAddress(text);
                          if (contractError) setContractError(false);
                        }}
                        value={contractAddress}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </Animated.View>
                  </View>
                </ScrollView>

                <View style={styles.footerRow}>
                  <TouchableOpacity
                    onPress={closeCustomToken}
                    style={[
                      VaultScreenStyle.cancelButton,
                      { flex: 1, marginRight: 4, borderRadius: 16 },
                    ]}
                  >
                    <Text style={VaultScreenStyle.cancelButtonText}>
                      {t("Close")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!!isAddDisabled}
                    style={[
                      isAddDisabled
                        ? VaultScreenStyle.disabledButton
                        : VaultScreenStyle.addModalButton,
                      { flex: 1, marginLeft: 4, borderRadius: 16 },
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      const missingNetwork =
                        String(selectedNetwork || "").trim() === "";
                      const missingContract =
                        String(contractAddress || "").trim() === "";
                      if (missingNetwork || missingContract) {
                        setNetworkError(missingNetwork);
                        setContractError(missingContract);
                        return;
                      }
                      handleAddCustomToken();
                      openNotSupported();
                    }}
                  >
                    <Text
                      style={
                        isAddDisabled
                          ? VaultScreenStyle.disabledText
                          : VaultScreenStyle.confirmText
                      }
                    >
                      {t("Add")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      )}

      <Modal
        animationType="none"
        transparent
        visible={unsupportedModalVisible}
        onRequestClose={closeNotSupported}
      >
        <View style={styles.modalOverlayRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPressIn={closeNotSupported}>
            <BlurView style={StyleSheet.absoluteFillObject} />
          </Pressable>
          <View style={VaultScreenStyle.centeredView} pointerEvents="box-none">
            <View
              style={[
                VaultScreenStyle.modalView,
                styles.unsupportedModalView,
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.unsupportedContent}>
                <AnimatedWebP
                  source={require("../assets/animations/Fail.webp")}
                  style={styles.unsupportedIcon}
                />
                <Text
                  style={[
                    VaultScreenStyle.modalTitle,
                    styles.unsupportedTitle,
                  ]}
                >
                  {t("Token Not Supported")}
                </Text>
                <Text
                  style={[
                    VaultScreenStyle.modalSubtitle,
                    styles.unsupportedMessage,
                  ]}
                >
                  {t(
                    "This token type is not supported at this time. Please verify the contract details or contact support for assistance."
                  )}
                </Text>
              </View>

              <View style={styles.unsupportedFooter}>
                <TouchableOpacity
                  style={[
                    VaultScreenStyle.cancelButton,
                    styles.unsupportedButton,
                  ]}
                  onPress={closeNotSupported}
                >
                  <Text style={VaultScreenStyle.cancelButtonText}>{t("OK")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  fullHeight: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  flexGrow: {
    flex: 1,
  },
  formContent: {
    paddingBottom: 24,
  },
  listBody: {
    flex: 1,
    width: "100%",
  },
  scroll: {
    flex: 1,
  },
  searchInputFix: {
    height: 48,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
    textAlignVertical: "center",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
  footerRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingBottom: 40,
  },
  footerSingle: {
    width: "100%",
    marginTop: 20,
    paddingBottom: 40,
  },
  modalOverlayRoot: {
    flex: 1,
  },
  unsupportedModalView: {
    maxWidth: 380,
    minHeight: 360,
    justifyContent: "space-between",
  },
  unsupportedContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  unsupportedIcon: {
    width: 120,
    height: 120,
    marginBottom: 16,
    alignSelf: "center",
  },
  unsupportedTitle: {
    width: "100%",
    textAlign: "center",
    marginBottom: 10,
  },
  unsupportedMessage: {
    width: "100%",
    textAlign: "center",
  },
  unsupportedFooter: {
    width: "100%",
    marginTop: 24,
  },
  unsupportedButton: {
    borderRadius: 16,
    height: 60,
    width: "100%",
  },
});

export default AddAssetScreen;
