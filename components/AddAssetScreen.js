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
  KeyboardAvoidingView,
  Platform,
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
import { fetchWalletBalance } from "./AssetsScreen/AssetsDataFetcher";
import { getNetworkImage, networks } from "../config/networkConfig";
import { resolveGasFeeSymbolForChain } from "../config/gasFeeToken";
import { ensureCryptoCardRuntimeFields } from "../utils/assetRuntimeFields";
import { resolveCardImage } from "../utils/cardImageResolver";
import {
  resolveAssetIcon,
  resolveChainIcon,
} from "../utils/assetIconResolver";
import AnimatedWebP from "./common/AnimatedWebP";

let cachedSearchQuery = "";
let cachedSelectedChain = "All";

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
  const [selectedChain, setSelectedChain] = useState(cachedSelectedChain);
  const [selectedCryptos, setSelectedCryptos] = useState([]);
  const [searchQuery, setSearchQuery] = useState(cachedSearchQuery);

  const [searchNetwork, setSearchNetwork] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [networkDropdownVisible, setNetworkDropdownVisible] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [searchBoxHeight, setSearchBoxHeight] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  const [contractError, setContractError] = useState(false);
  const shakeNetworkAnim = useRef(new Animated.Value(0)).current;
  const shakeContractAnim = useRef(new Animated.Value(0)).current;
  const networkInputRef = useRef(null);

  useEffect(() => {
    cachedSearchQuery = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    cachedSelectedChain = selectedChain;
  }, [selectedChain]);

  useEffect(() => {
    if (step !== "custom") {
      setNetworkDropdownVisible(false);
    }
  }, [step]);

  useEffect(() => {
    const title =
      step === "custom"
        ? t("Add Custom Token")
        : step === "unsupported"
        ? t("Token Not Supported")
        : t("Search Asset");
    navigation.setOptions({ title });
  }, [navigation, step, t]);

  useEffect(() => {
    if (networkError) runShake(shakeNetworkAnim);
  }, [networkError, shakeNetworkAnim]);

  useEffect(() => {
    if (contractError) runShake(shakeContractAnim);
  }, [contractError, shakeContractAnim]);

  const chainCategories = useMemo(
    () =>
      (initialAdditionalCryptos || []).map((crypto) => ({
        name: crypto.queryChainName,
        ...crypto,
      })),
    [initialAdditionalCryptos]
  );

  const displayChainName = (name) => {
    if (!name) return "";
    const lower = String(name).toLowerCase();
    if (lower === "binance") return "BNB Chain";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const displayShortName = (shortName) =>
    String(shortName || "").replace(/\.e$/i, "");
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

  const searchedCryptos = useMemo(() => {
    const normalizedQuery = String(searchQuery || "")
      .trim()
      .toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    const list = Array.isArray(additionalCryptos) ? additionalCryptos : [];
    if (queryTerms.length === 0) return list;
    return list.filter((crypto) => {
      const name = String(crypto.name || "").toLowerCase();
      const shortName = String(crypto.shortName || "").toLowerCase();
      const chainShort = String(crypto.queryChainShortName || "").toLowerCase();
      const chainName = String(crypto.queryChainName || "").toLowerCase();
      return queryTerms.every((term) =>
        [name, shortName, chainShort, chainName].some((field) =>
          field.includes(term)
        )
      );
    });
  }, [additionalCryptos, searchQuery]);

  const filteredByChain =
    selectedChain === "All"
      ? searchedCryptos
      : searchedCryptos.filter(
          (crypto) => crypto.queryChainName === selectedChain
        );

  const noSearchResults =
    String(searchQuery || "").trim().length > 0 && filteredByChain.length === 0;

  const gasFeeSymbolByChain = useMemo(() => {
    const map = new Map();
    const chainSet = new Set(
      (additionalCryptos || [])
        .map((c) =>
          String(c?.queryChainName || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
    );
    chainSet.forEach((chain) => {
      const feeSymbol = resolveGasFeeSymbolForChain(chain, additionalCryptos || []);
      if (feeSymbol) map.set(chain, feeSymbol);
    });
    return map;
  }, [additionalCryptos]);

  useFocusEffect(
    useCallback(() => {
      const addedCryptos = (Array.isArray(cryptoCards) ? cryptoCards : []).map(
        (crypto) => `${crypto.name}-${crypto.queryChainName}`
      );
      const initiallySelected = searchedCryptos.filter((crypto) =>
        addedCryptos.includes(`${crypto.name}-${crypto.queryChainName}`)
      );
      setSelectedCryptos(initiallySelected);
    }, [cryptoCards, searchedCryptos])
  );

  const toggleSelectCrypto = (crypto) => {
    const cryptoIdentifier = `${crypto.name}-${crypto.queryChainName}`;
    if (
      selectedCryptos.some(
        (selected) =>
          `${selected.name}-${selected.queryChainName}` === cryptoIdentifier
      )
    ) {
      setSelectedCryptos(
        selectedCryptos.filter(
          (c) => `${c.name}-${c.queryChainName}` !== cryptoIdentifier
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
              (card) =>
                card.name === crypto.name &&
                card.queryChainName === crypto.queryChainName
            )
        )
        .map((crypto) => {
          const matchedCrypto = (initialAdditionalCryptos || []).find(
            (item) => item.queryChainShortName === crypto.queryChainShortName
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
    if (selectedCryptos.length === 0) return;
    await handleAddCrypto(selectedCryptos);
    setSelectedCryptos([]);
    safeGoBack();
  };

  const openCustomToken = () => {
    setSearchNetwork("");
    setSelectedNetwork("");
    setContractAddress("");
    setNetworkDropdownVisible(false);
    setNetworkError(false);
    setContractError(false);
    setStep("custom");
  };

  const closeCustomToken = () => {
    setNetworkDropdownVisible(false);
    setStep("list");
  };

  const openNotSupported = () => {
    setStep("unsupported");
  };

  const closeNotSupported = () => {
    setStep("custom");
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
        <View
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
                style={{
                  borderRadius: 16,
                  height: 60,
                }}
                contentContainerStyle={{ alignItems: "center", height: "100%" }}
                showsHorizontalScrollIndicator={false}
              >
                <TouchableOpacity
                  key="All"
                  style={[
                    VaultScreenStyle.chainTag,
                    { borderRadius: 16, height: 32 },
                    selectedChain === "All" &&
                      VaultScreenStyle.selectedChainTag,
                    selectedChain !== "All" && {
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                    },
                  ]}
                  onPress={() => setSelectedChain("All")}
                >
                  <Text
                    style={[
                      VaultScreenStyle.chainTagText,
                      selectedChain === "All" &&
                        VaultScreenStyle.selChnTagTxt,
                      selectedChain !== "All" && {
                        color: isDarkMode ? "#cfcfcf" : "#444",
                      },
                    ]}
                  >
                    {t("All")}
                  </Text>
                </TouchableOpacity>
                {Array.from(
                  new Set(
                    chainCategories
                      .map((chain) => chain?.queryChainName)
                      .filter(Boolean)
                  )
                )
                  .sort((a, b) =>
                    a.localeCompare(b, undefined, { sensitivity: "base" })
                  )
                  .map((queryChainName) => {
                    const isSelected = selectedChain === queryChainName;
                    return (
                      <TouchableOpacity
                        key={queryChainName}
                        style={[
                          VaultScreenStyle.chainTag,
                          { borderRadius: 16, height: 32 },
                          isSelected && VaultScreenStyle.selectedChainTag,
                          !isSelected && {
                            backgroundColor: isDarkMode
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.06)",
                          },
                        ]}
                        onPress={() => setSelectedChain(queryChainName)}
                      >
                        {chainCategories.some(
                          (category) =>
                            category.queryChainName === queryChainName
                        ) && (
                          <>
                {chainCategories.filter(
                  (category) =>
                    category.queryChainName === queryChainName
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
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>

            <ScrollView
              style={{
                borderRadius: 16,
                flex: 1,
              }}
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
                    (card) =>
                      card.name === crypto.name &&
                      card.queryChainName === crypto.queryChainName
                  );
                  const chainKey = String(crypto?.queryChainName || "")
                    .trim()
                    .toLowerCase();
                  const shortNameKey = String(crypto?.shortName || "")
                    .trim()
                    .toLowerCase();
                  const showGasFeeIcon =
                    !!chainKey &&
                    !!shortNameKey &&
                    gasFeeSymbolByChain.get(chainKey) === shortNameKey;
                  return (
                    <TouchableOpacity
                      key={`${crypto.name}-${crypto.queryChainName}`}
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
                          <Text style={VaultScreenStyle.addCrypImgTxt}>
                            {displayShortName(crypto.shortName)}
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
                          flexDirection: "row",
                          flex: 1,
                          flexWrap: "wrap",
                          justifyContent: "center",
                          alignItems: "center",
                          rowGap: 4,
                        }}
                      >
                        <Text style={VaultScreenStyle.addCryptoText}>
                          {crypto.name}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <View style={VaultScreenStyle.chainContainer}>
                            <Text style={VaultScreenStyle.chainCardText}>
                              {crypto.queryChainName
                                ? displayChainName(crypto.queryChainName)
                                : ""}
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
        </View>
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
                      const missingNetwork =
                        String(selectedNetwork || "").trim() === "";
                      const missingContract =
                        String(contractAddress || "").trim() === "";
                      if (missingNetwork || missingContract) {
                        setNetworkError(missingNetwork);
                        setContractError(missingContract);
                        return;
                      }
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

      {step === "unsupported" && (
        <View style={styles.fullHeight}>
          <View style={styles.flexGrow}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={VaultScreenStyle.modalTitle}>
                {t("Token Not Supported")}
              </Text>
              <AnimatedWebP
                source={require("../assets/animations/Fail.webp")}
                style={{ width: 120, height: 120, marginTop: 16 }}
              />
              <Text
                style={[
                  VaultScreenStyle.modalSubtitle,
                  { marginTop: 10, textAlign: "center" },
                ]}
              >
                {t(
                  "This token type is not supported at this time. Please verify the contract details or contact support for assistance."
                )}
              </Text>
            </ScrollView>

            <View style={styles.footerSingle}>
              <TouchableOpacity
                style={[
                  VaultScreenStyle.cancelButton,
                  {
                    borderRadius: 16,
                    height: 60,
                    width: "100%",
                  },
                ]}
                onPress={closeNotSupported}
              >
                <Text style={VaultScreenStyle.cancelButtonText}>{t("OK")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    height: "100%",
    paddingVertical: 0,
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
});

export default AddAssetScreen;
