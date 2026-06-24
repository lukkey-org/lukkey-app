/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  View,
  Image,
  Text,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { FontAwesome6, MaterialIcons as Icon } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import DraggableFlatList, {
  ShadowDecorator,
} from "react-native-draggable-flatlist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  callNavigationCallback,
  clearNavigationCallback,
} from "../../utils/navigationCallbacks";
import { getNetworkImage, networks } from "../../config/networkConfig";
import { prefixToShortName } from "../../config/chainPrefixes";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
import { DarkModeContext } from "../../utils/DeviceContext";
import ConfirmActionModal from "../modal/ConfirmActionModal";
import { BlurView } from "../common/AppBlurView";
import DevToast from "../common/DevToast";

const networkSearchAliases = {
  arb: "Arbitrum",
  avax: "Avalanche",
  btc: "Bitcoin",
  bch: "Bitcoin Cash",
  bnb: "Binance Smart Chain",
  bsc: "Binance Smart Chain",
  eth: "Ethereum",
  etc: "Ethereum Classic",
  iotx: "IoTeX Network Mainnet",
  ltc: "Litecoin",
  // okt: "OKX Chain", // OKB is no longer supported.
  // okx: "OKX Chain", // OKB is no longer supported.
  op: "Optimism",
  matic: "Polygon",
  poly: "Polygon",
  xrp: "Ripple",
  sol: "Solana",
  trx: "Tron",
  zks: "zkSync Era Mainnet",
  zksync: "zkSync Era Mainnet",
  atom: "Cosmos",
  tia: "Celestia",
  cro: "Cronos",
  osmo: "Osmosis",
  gno: "Gnosis",
  sui: "SUI",
};

const networkChainNameByDisplayName = {
  Arbitrum: "arbitrum",
  Aurora: "aurora",
  Avalanche: "avalanche",
  Bitcoin: "bitcoin",
  "Bitcoin Cash": "bitcoin_cash",
  "Binance Smart Chain": "binance",
  Celo: "celo",
  Dogecoin: "dogecoin",
  Ethereum: "ethereum",
  "Ethereum Classic": "ethereum_classic",
  "IoTeX Network Mainnet": "iotex",
  Litecoin: "litecoin",
  Optimism: "optimism",
  Polygon: "polygon",
  Ripple: "ripple",
  Solana: "solana",
  Tron: "tron",
  "zkSync Era Mainnet": "zksync",
  Cosmos: "cosmos",
  Celestia: "celestia",
  Cronos: "cronos",
  Juno: "juno",
  Osmosis: "osmosis",
  Gnosis: "gnosis",
  Linea: "linea",
  Ronin: "ronin",
  Aptos: "aptos",
  SUI: "sui",
};

const normalizeSearchValue = (value) =>
  String(value || "").trim().toLowerCase();

const getNetworkSearchTerms = (network) => {
  const normalizedNetwork = normalizeSearchValue(network);
  if (!normalizedNetwork) return [];

  const displayName = networks.find(
    (item) => normalizeSearchValue(item) === normalizedNetwork
  );
  const resolvedNetwork = displayName || String(network || "").trim();
  const chainName = networkChainNameByDisplayName[resolvedNetwork];
  const shortName = chainName ? prefixToShortName[`${chainName}:`] : "";
  const aliases = Object.entries(networkSearchAliases)
    .filter(([, target]) => target === resolvedNetwork)
    .map(([alias]) => alias);

  return [
    resolvedNetwork,
    chainName,
    shortName,
    ...aliases,
  ].filter(Boolean);
};

const matchesSearchQuery = (value, query) =>
  normalizeSearchValue(value).includes(query);

const matchesNetworkSearchQuery = (network, query) =>
  getNetworkSearchTerms(network).some((term) => matchesSearchQuery(term, query));

const AnimatedTouchableOpacity = ({
  children,
  style,
  onPress,
  onPressIn: propOnPressIn,
  onPressOut: propOnPressOut,
  activeOpacity = 0.2,
  triggerOnPressIn = false,
  hitSlop = { top: 6, bottom: 6, left: 6, right: 6 },
  disabled = false,
  ...rest
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDisabled = !!disabled;
  if (__DEV__ && typeof disabled !== "boolean") {
    throw new Error("disabled must be boolean");
  }

  const handlePressIn = (e) => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
    if (propOnPressIn) propOnPressIn(e);
    if (triggerOnPressIn && onPress) {
      onPress(e);
    }
  };

  const handlePressOut = (e) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
    if (propOnPressOut) propOnPressOut(e);
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
        activeOpacity={activeOpacity}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={hitSlop}
        disabled={!!isDisabled}
        onPress={triggerOnPressIn ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const AddressBookScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { onSelectId, onCloseId } = route.params || {};
  const { isDarkMode } = useContext(DarkModeContext);
  const styles = SecureDeviceScreenStylesRoot(isDarkMode);
  const { t } = useTranslation();
  const didCompleteRef = useRef(false);
  const inputBackgroundColor = isDarkMode ? "#121212" : "#E3E3E8";
  const pageBackgroundColor = isDarkMode ? "#21201E" : "#FFFFFF";
  const dropdownPanelColor = isDarkMode ? "#2C2A27" : "#E3E3E8";
  const dropdownItemColor = isDarkMode ? "#34312E" : "#E3E3E8";
  const dropdownSelectedColor = isDarkMode ? "#4B4642" : "#F5F5F5";

  const [searchAddress, setSearchAddress] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newNetwork, setNewNetwork] = useState("");
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNetworkError, setNewNetworkError] = useState("");
  const [newNameError, setNewNameError] = useState("");
  const [newAddressError, setNewAddressError] = useState("");
  const [networkDropdownVisible, setNetworkDropdownVisible] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [searchNetwork, setSearchNetwork] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [addressActionMenuVisible, setAddressActionMenuVisible] =
    useState(false);
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [copyToastMessage, setCopyToastMessage] = useState("");
  const [copyToastKey, setCopyToastKey] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const networkInputRef = useRef(null);
  const addressInputRef = useRef(null);
  const shakeNetworkAnim = useRef(new Animated.Value(0)).current;
  const shakeNameAnim = useRef(new Animated.Value(0)).current;
  const shakeAddressAnim = useRef(new Animated.Value(0)).current;

  const sanitizeAddressValue = useCallback(
    (value) => String(value || "").replace(/\s+/g, "").trim(),
    []
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    if (didCompleteRef.current) return;
    didCompleteRef.current = true;
    callNavigationCallback(onCloseId);
    navigation.goBack();
  }, [navigation, onCloseId]);

  const handleSelect = useCallback(
    (item) => {
      Keyboard.dismiss();
      if (didCompleteRef.current) return;
      didCompleteRef.current = true;
      callNavigationCallback(onSelectId, item);
      navigation.goBack();
    },
    [navigation, onSelectId]
  );

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      if (didCompleteRef.current) return;
      callNavigationCallback(onCloseId);
    });
    return unsub;
  }, [navigation, onCloseId]);

  useEffect(() => {
    return () => {
      clearNavigationCallback(onSelectId);
      clearNavigationCallback(onCloseId);
    };
  }, [onSelectId, onCloseId]);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const storedAddresses = await AsyncStorage.getItem("savedAddresses");
        if (storedAddresses) {
          setSavedAddresses(JSON.parse(storedAddresses));
        }
      } catch (error) {
        console.error("Failed to load addresses", error);
      }
    };

    loadAddresses();
  }, []);

  useEffect(() => {
    const onShow = (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height || 0);
    };
    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const actionRowBottomSpacing = keyboardVisible ? Math.max(40, 120) : 40;
  const iosKeyboardButtonGap =
    Platform.OS === "ios" && keyboardVisible ? 14 : 0;
  const addressListFooterSpace = keyboardVisible ? 24 : 8;

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

  useEffect(() => {
    if (newNetworkError) {
      runShake(shakeNetworkAnim);
    }
  }, [newNetworkError, shakeNetworkAnim]);

  useEffect(() => {
    if (newNameError) {
      runShake(shakeNameAnim);
    }
  }, [newNameError, shakeNameAnim]);

  useEffect(() => {
    if (newAddressError) {
      runShake(shakeAddressAnim);
    }
  }, [newAddressError, shakeAddressAnim]);

  const saveAddressesToStorage = async (addresses) => {
    try {
      await AsyncStorage.setItem("savedAddresses", JSON.stringify(addresses));
    } catch (error) {
      console.error("Failed to save addresses", error);
    }
  };

  const showSuccessToast = (message) => {
    setCopyToastMessage(message);
    setCopyToastVisible(true);
    setCopyToastKey((value) => value + 1);
  };

  const addressSearchQuery = normalizeSearchValue(searchAddress);
  const filteredAddresses = savedAddresses.filter((address) => {
    if (!addressSearchQuery) return true;
    return (
      matchesNetworkSearchQuery(address.network, addressSearchQuery) ||
      matchesSearchQuery(address.name, addressSearchQuery) ||
      matchesSearchQuery(address.address, addressSearchQuery)
    );
  });

  const commitVisibleAddressOrder = useCallback(
    (orderedVisibleAddresses) => {
      const visibleIds = filteredAddresses.map((item) => item.id);
      const visibleIdSet = new Set(visibleIds);
      const nextVisibleByPosition = orderedVisibleAddresses.filter((item) =>
        visibleIdSet.has(item.id)
      );
      if (nextVisibleByPosition.length !== visibleIds.length) return;

      let nextVisibleIndex = 0;
      const nextAddresses = savedAddresses.map((item) => {
        if (!visibleIdSet.has(item.id)) return item;
        const nextItem = nextVisibleByPosition[nextVisibleIndex];
        nextVisibleIndex += 1;
        return nextItem || item;
      });

      setSavedAddresses(nextAddresses);
      saveAddressesToStorage(nextAddresses);
    },
    [filteredAddresses, savedAddresses]
  );

  const handleCopy = (address) => {
    Keyboard.dismiss();
    Clipboard.setString(address);
    showSuccessToast(t("Address copied to clipboard"));
  };

  const handleDelete = (id) => {
    Keyboard.dismiss();
    setAddressActionMenuVisible(false);
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const updatedAddresses = savedAddresses.filter(
      (item) => item.id !== pendingDeleteId
    );
    setSavedAddresses(updatedAddresses);
    saveAddressesToStorage(updatedAddresses);
    if (editingId === pendingDeleteId) {
      setIsAddingAddress(false);
      setEditingId(null);
      setNewNetwork("");
      setNewName("");
      setNewAddress("");
      setNewNetworkError("");
      setNewNameError("");
      setNewAddressError("");
      setNetworkDropdownVisible(false);
    }
    setPendingDeleteId(null);
  };

  const handleEdit = (id) => {
    Keyboard.dismiss();
    const addressToEdit = savedAddresses.find((item) => item.id === id);
    if (addressToEdit) {
      setEditingId(id);
      setNewNetwork(addressToEdit.network);
      setNewName(addressToEdit.name);
      setNewAddress(sanitizeAddressValue(addressToEdit.address));
      setAddressActionMenuVisible(false);
      setIsAddingAddress(true);
    }
  };

  const handleNewAddressChange = (text) => {
    setNewAddress(sanitizeAddressValue(text));
  };

  const handleClearNewAddress = () => {
    Keyboard.dismiss();
    setNewAddress("");
  };

  const handlePasteNewAddress = async () => {
    try {
      const text = await Clipboard.getString();
      const nextAddress = sanitizeAddressValue(text);
      if (!nextAddress) return;
      setNewAddress(nextAddress);
      requestAnimationFrame(() => {
        addressInputRef.current?.focus?.();
      });
    } catch {}
  };

  const handleSaveAddress = () => {
    Keyboard.dismiss();
    let hasError = false;
    const sanitizedAddress = sanitizeAddressValue(newAddress);

    if (!newNetwork) {
      setNewNetworkError(t("Network is required"));
      runShake(shakeNetworkAnim);
      hasError = true;
    } else {
      setNewNetworkError("");
    }

    if (!newName) {
      setNewNameError(t("Name is required"));
      runShake(shakeNameAnim);
      hasError = true;
    } else {
      setNewNameError("");
    }

    if (!sanitizedAddress) {
      setNewAddressError(t("Address is required"));
      runShake(shakeAddressAnim);
      hasError = true;
    } else {
      setNewAddressError("");
    }

    if (hasError) {
      return;
    }

    let updatedAddresses = [];
    if (editingId) {
      updatedAddresses = savedAddresses.map((item) => {
        if (item.id === editingId) {
          return {
            id: editingId,
            network: newNetwork,
            name: newName,
            address: sanitizedAddress,
          };
        }
        return item;
      });
    } else {
      const newEntry = {
        id: Date.now().toString(),
        network: newNetwork,
        name: newName,
        address: sanitizedAddress,
      };
      updatedAddresses = [...savedAddresses, newEntry];
    }

    setSavedAddresses(updatedAddresses);
    saveAddressesToStorage(updatedAddresses);
    setNewNetwork("");
    setNewName("");
    setNewAddress("");
    setNewNetworkError("");
    setNewNameError("");
    setNewAddressError("");
    setEditingId(null);
    setIsAddingAddress(false);
    showSuccessToast(t("Address saved successfully"));
  };

  const filteredNetworks = networks.filter((network) => {
    const query = normalizeSearchValue(searchNetwork);
    if (!query) return true;
    return matchesNetworkSearchQuery(network, query);
  });

  const getBestNetworkMatch = (text) => {
    const query = normalizeSearchValue(text);
    if (!query) {
      return "";
    }
    const aliasMatch = networkSearchAliases[query];
    if (aliasMatch) {
      return aliasMatch;
    }
    const exactMatch = networks.find(
      (network) => normalizeSearchValue(network) === query
    );
    if (exactMatch) {
      return exactMatch;
    }
    const prefixMatch = networks.find((network) =>
      getNetworkSearchTerms(network).some((term) =>
        normalizeSearchValue(term).startsWith(query)
      )
    );
    if (prefixMatch) {
      return prefixMatch;
    }
    return (
      networks.find((network) => matchesNetworkSearchQuery(network, query)) || ""
    );
  };

  const applySelectedNetwork = useCallback(
    (network) => {
      Keyboard.dismiss();
      setNewNetwork(network);
      setSearchNetwork(network);
      setNetworkDropdownVisible(false);
      if (!String(newName || "").trim()) {
        setNewName(network);
      }
    },
    [newName]
  );

  const handleListItemPress = (item) => {
    Keyboard.dismiss();
    if (onSelectId) {
      handleSelect(item);
      return;
    }
    handleEdit(item.id);
  };

  const showAddressActionButton = isAddingAddress && !!editingId;

  useEffect(() => {
    navigation.setOptions({
      headerRight: showAddressActionButton
        ? () => (
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setAddressActionMenuVisible(true);
              }}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              activeOpacity={0.7}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FontAwesome6
                  name="ellipsis"
                  size={24}
                  color={isDarkMode ? "#FFFFFF" : "#333333"}
                  style={{
                    width: 30,
                    height: 30,
                    lineHeight: 30,
                    textAlign: "center",
                    textAlignVertical: "center",
                    includeFontPadding: false,
                    transform: [{ translateY: -3 }],
                  }}
                />
              </View>
            </TouchableOpacity>
          )
      : () => null,
    });
  }, [isDarkMode, navigation, showAddressActionButton]);

  useEffect(() => {
    if (!isAddingAddress) return undefined;

    const focusTimer = setTimeout(() => {
      networkInputRef.current?.focus?.();
    }, 120);

    return () => clearTimeout(focusTimer);
  }, [isAddingAddress]);

  return (
    <View
      style={[
        styles.addrBookFlex,
        { backgroundColor: pageBackgroundColor },
      ]}
    >
      <ConfirmActionModal
        visible={!!pendingDeleteId}
        onRequestClose={() => setPendingDeleteId(null)}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        styles={styles}
        title={t("Confirm Delete")}
        message={t("Are you sure you want to delete this address?")}
        cancelText={t("Cancel")}
        confirmText={t("Delete")}
        containerStyle={styles.modalView}
        subtitleStyle={{ marginBottom: 20 }}
        cancelButtonStyle={[
          styles.cancelButton,
          { flex: 1, marginRight: 4, borderRadius: 15 },
        ]}
        confirmButtonStyle={[
          styles.confirmButton,
          { flex: 1, marginLeft: 4, borderRadius: 15, marginBottom: 0 },
        ]}
        cancelTextStyle={styles.cancelButtonText}
        confirmTextStyle={styles.buttonTextWhite}
      />
      <Modal
        visible={copyToastVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setCopyToastVisible(false)}
      >
        <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
          <DevToast
            key={`address-book-copy-toast-${copyToastKey}`}
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
      <Modal
        visible={addressActionMenuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setAddressActionMenuVisible(false)}
      >
        <View style={StyleSheet.absoluteFillObject}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPressIn={() => setAddressActionMenuVisible(false)}
          >
            <BlurView style={StyleSheet.absoluteFillObject} />
          </Pressable>
          <View
            pointerEvents="box-none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                alignItems: "flex-end",
                paddingTop: 92,
                paddingRight: 24,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                if (editingId) {
                  handleDelete(editingId);
                }
              }}
              activeOpacity={0.82}
              style={{
                minWidth: 124,
                minHeight: 64,
                paddingHorizontal: 24,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDarkMode ? "#5A544F" : "#FFFFFF",
                shadowColor: "#000000",
                shadowOpacity: 0.24,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <Text
                style={{
                  color: isDarkMode ? "#FFFFFF" : "#21201E",
                  fontSize: 18,
                  fontWeight: "600",
                }}
              >
                {t("Delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.addrBookFlex}
        pointerEvents="box-none"
        enabled={Platform.OS === "ios" || keyboardVisible}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setNetworkDropdownVisible(false);
          }}
          accessible={false}
        >
          <View
            style={[
              { justifyContent: "space-between" },
              { flex: 1, width: "90%", borderRadius: 0, alignSelf: "center" },
            ]}
          >
            {!isAddingAddress ? (
              <>
                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor: inputBackgroundColor,
                      height: 48,
                      borderRadius: 16,
                    },
                  ]}
                >
                  <Icon
                    name="search"
                    size={20}
                    style={[
                      styles.searchIcon,
                      { color: isDarkMode ? "#97979C" : "#7F7F84" },
                    ]}
                  />
                  <TextInput
                    style={[styles.searchInput, { borderRadius: 16 }]}
                    placeholder={t("Search Address")}
                    placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
                    onChangeText={setSearchAddress}
                    value={searchAddress}
                  />
                </View>
                <View style={styles.addrBookFlex}>
                  <DraggableFlatList
                    data={filteredAddresses}
                    keyExtractor={(item) => item.id}
                    style={styles.addrBookMb20}
                    containerStyle={{ overflow: "hidden" }}
                    contentContainerStyle={{
                      paddingBottom: addressListFooterSpace,
                    }}
                    showsVerticalScrollIndicator={false}
                    dragItemOverflow
                    activationDistance={8}
                    autoscrollThreshold={80}
                    autoscrollSpeed={120}
                    onDragEnd={({ data }) => {
                      commitVisibleAddressOrder(data);
                    }}
                    renderItem={({ item, drag, isActive }) => {
                      const showSwipeEdit = !!onSelectId;
                      return (
                        <ShadowDecorator
                          elevation={8}
                          radius={12}
                          opacity={0.18}
                        >
                          <View
                            style={[
                              styles.addrBookRel8,
                              isActive && {
                                zIndex: 20,
                                elevation: 12,
                                opacity: 0.96,
                              },
                            ]}
                          >
                        <Swipeable
                          enabled={!isActive}
                          overshootRight={false}
                          onSwipeableOpen={(direction) => {
                            if (direction === "right") {
                              console.log(
                                "[AddressBook] Swipe opened to right (left swipe) for id:",
                                item.id
                              );
                            }
                          }}
                          renderRightActions={() => (
                            <View
                              style={{
                                flexDirection: "row",
                                width: showSwipeEdit ? 184 : 88,
                                marginLeft: 8,
                                gap: 8,
                              }}
                            >
                              {showSwipeEdit ? (
                                <TouchableOpacity
                                  onPress={() => {
                                    console.log(
                                      "[AddressBook] Edit pressed for id:",
                                      item.id
                                    );
                                    Keyboard.dismiss();
                                    handleEdit(item.id);
                                  }}
                                  accessibilityLabel="Edit address"
                                  style={{
                                    justifyContent: "center",
                                    alignItems: "center",
                                    width: 88,
                                  }}
                                >
                                  <View
                                    style={{
                                      height: "100%",
                                      width: "100%",
                                      backgroundColor: isDarkMode
                                        ? "#4B4642"
                                        : "#D9D4DE",
                                      justifyContent: "center",
                                      alignItems: "center",
                                      borderRadius: 12,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: isDarkMode ? "#FFFFFF" : "#333333",
                                        fontWeight: "700",
                                      }}
                                    >
                                      {t("Edit")}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity
                                onPress={() => {
                                  console.log(
                                    "[AddressBook] Delete pressed for id:",
                                    item.id
                                  );
                                  Keyboard.dismiss();
                                  handleDelete(item.id);
                                }}
                                accessibilityLabel="Delete address"
                                style={{
                                  justifyContent: "center",
                                  alignItems: "center",
                                  width: 88,
                                }}
                              >
                                <View
                                  style={{
                                    height: "100%",
                                    width: "100%",
                                    backgroundColor: "#FF5252",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderRadius: 12,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#FFFFFF",
                                      fontWeight: "700",
                                    }}
                                  >
                                    {t("Delete")}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          )}
                        >
                          <Pressable
                            onPress={() => {
                              if (isActive) return;
                              handleListItemPress(item);
                            }}
                            onLongPress={() => {
                              console.log(
                                "[AddressBook] Long press reorder for id:",
                                item.id
                              );
                              Keyboard.dismiss();
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Medium,
                              ).catch(() => {});
                              drag();
                            }}
                            delayLongPress={400}
                            style={[
                              styles.addrBookItem,
                              {
                                backgroundColor: isDarkMode
                                  ? "#2B2A28"
                                  : "#E5E1E980",
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.addrBookCol,
                                { flex: 1, minWidth: 0 },
                              ]}
                            >
                              <View style={styles.addrBookRow}>
                                <Text
                                  style={[
                                    styles.addrBookNetTxt,
                                    {
                                      color: isDarkMode ? "#97979C" : "#7F7F84",
                                    },
                                  ]}
                                >
                                  {t("Network")}:&nbsp;
                                </Text>
                                <Image
                                  source={getNetworkImage(item.network)}
                                  style={styles.addrBookNetImg}
                                />
                                <Text
                                  style={[
                                    styles.addrBookNetName,
                                    { color: isDarkMode ? "#ccc" : "#333" },
                                  ]}
                                >
                                  {item.network}
                                </Text>
                              </View>
                              <View style={styles.addrBookNameRow}>
                                <Text
                                  style={[
                                    styles.addrBookNameTxt,
                                    {
                                      color: isDarkMode ? "#97979C" : "#7F7F84",
                                    },
                                  ]}
                                >
                                  {t("Name")}:&nbsp;
                                </Text>
                                <View
                                  style={{ flex: 1, minWidth: 0 }}
                                >
                                  <Text
                                    style={[
                                      styles.addrBookNameVal,
                                      { color: isDarkMode ? "#ccc" : "#333" },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {item.name}
                                  </Text>
                                </View>
                              </View>
                              <Text
                                style={[
                                  styles.addrBookAddrTxt,
                                  {
                                    color: isDarkMode ? "#97979C" : "#7F7F84",
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="middle"
                              >
                                {t("Address")}:&nbsp;
                                <Text
                                  style={[
                                    styles.addrBookAddrVal,
                                    { color: isDarkMode ? "#ccc" : "#333" },
                                  ]}
                                >
                                  {item.address}
                                </Text>
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={(event) => {
                                event?.stopPropagation?.();
                                handleCopy(item.address);
                              }}
                              onPressIn={(event) => {
                                event?.stopPropagation?.();
                              }}
                              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                              style={[
                                styles.addrBookMl10,
                                {
                                  height: 42,
                                  width: 42,
                                  borderRadius: 21,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  backgroundColor: isDarkMode
                                    ? "rgba(255, 255, 255, 0.08)"
                                    : "rgba(0, 0, 0, 0.06)",
                                  borderWidth: 1,
                                  borderColor: isDarkMode
                                    ? "rgba(255, 255, 255, 0.16)"
                                    : "rgba(0, 0, 0, 0.08)",
                                },
                              ]}
                            >
                              <Icon
                                name="content-copy"
                                size={22}
                                color={isDarkMode ? "#ffffff" : "#676776"}
                              />
                            </TouchableOpacity>
                          </Pressable>
                        </Swipeable>
                          </View>
                        </ShadowDecorator>
                      );
                    }}
                  />
                </View>
                <View
                  style={{
                    marginTop: 0,
                    marginBottom: actionRowBottomSpacing,
                    width: "100%",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <AnimatedTouchableOpacity
                    onPress={handleClose}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.cancelButton,
                      {
                        flex: 1,
                        marginRight: 4,
                        borderRadius: 16,
                        backgroundColor: pageBackgroundColor,
                      },
                    ]}
                  >
                    <Text style={styles.cancelButtonText}>{t("Close")}</Text>
                  </AnimatedTouchableOpacity>
                  <AnimatedTouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsAddingAddress(true);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.confirmButton,
                      { flex: 1, marginLeft: 4, borderRadius: 16 },
                    ]}
                  >
                    <Text style={styles.addrBtnText}>
                      {t("Add Address")}
                    </Text>
                  </AnimatedTouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.addrBookMb10,
                    styles.addrBookW100,
                    { position: "relative" },
                  ]}
                >
                  <Animated.View
                    style={{
                      transform: [{ translateX: shakeNetworkAnim }],
                    }}
                  >
                    <View
                      style={[
                        styles.searchContainer,
                        {
                          backgroundColor: inputBackgroundColor,
                          height: 48,
                          borderRadius: 16,
                          marginBottom: 10,
                          borderWidth: 1,
                          borderColor: newNetworkError
                            ? "#FF5252"
                            : "transparent",
                          paddingHorizontal: 12,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 1,
                        }}
                      >
                        {newNetwork &&
                          filteredNetworks.includes(newNetwork) && (
                            <Image
                              source={getNetworkImage(newNetwork)}
                              style={styles.addrBookIcon24}
                            />
                          )}
                        <TextInput
                          ref={networkInputRef}
                          style={[
                            styles.searchInput,
                            {
                              color: isDarkMode ? "#ddd" : "#000",
                              borderRadius: 16,
                            },
                          ]}
                          value={newNetwork}
                          onChangeText={(text) => {
                            setNewNetwork(text);
                            setSearchNetwork(text);
                            setNetworkDropdownVisible(true);
                          }}
                          onEndEditing={() => {
                            const bestMatch = getBestNetworkMatch(newNetwork);
                            if (bestMatch && bestMatch !== newNetwork) {
                              applySelectedNetwork(bestMatch);
                            }
                          }}
                          placeholder="Search Network"
                          placeholderTextColor={isDarkMode ? "#ccc" : "#7F7F84"}
                        />
                      </View>
                      <Pressable
                        onPress={() => {
                          Keyboard.dismiss();
                          setNetworkDropdownVisible(!networkDropdownVisible);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                          height: "100%",
                          paddingLeft: 8,
                        }}
                      >
                        <Icon
                          name={
                            networkDropdownVisible ? "expand-less" : "expand-more"
                          }
                          size={24}
                          color={isDarkMode ? "#ddd" : "#676776"}
                        />
                      </Pressable>
                    </View>
                  </Animated.View>
                  {newNetworkError ? (
                    <Text style={[styles.addrBookErrTxt, styles.addrBookMb10]}>
                      {newNetworkError}
                    </Text>
                  ) : null}
                  {networkDropdownVisible && (
                    <View
                      style={[
                        styles.addrBookW100,
                        styles.addrBookMb10,
                        {
                          position: "absolute",
                          top: 56,
                          left: 0,
                          right: 0,
                          zIndex: 10,
                          elevation: 10,
                          backgroundColor: dropdownPanelColor,
                          borderRadius: 16,
                          overflow: "hidden",
                        },
                      ]}
                    >
                      <ScrollView
                        style={[
                          styles.addrBookMaxH200,
                          { backgroundColor: dropdownPanelColor },
                        ]}
                        showsVerticalScrollIndicator
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                      >
                        {filteredNetworks.map((network) => (
                          <TouchableOpacity
                            key={network}
                            onPress={() => {
                              applySelectedNetwork(network);
                            }}
                            style={{
                              padding: 10,
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor:
                                network === newNetwork
                                  ? dropdownSelectedColor
                                  : dropdownItemColor,
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
                                styles.Text,
                                {
                                  color: isDarkMode ? "#97979C" : "#7F7F84",
                                },
                              ]}
                            >
                              {network}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  <>
                    <Animated.View
                      style={{
                        transform: [{ translateX: shakeNameAnim }],
                      }}
                    >
                      <TextInput
                        style={[
                          styles.passwordInput,
                          {
                            backgroundColor: inputBackgroundColor,
                            color: isDarkMode ? "#fff" : "#000",
                            borderWidth: 1,
                            borderColor: newNameError
                              ? "#FF5252"
                              : "transparent",
                            borderRadius: 16,
                            paddingTop: 0,
                            paddingBottom: 0,
                            paddingVertical: 0,
                            lineHeight: 20,
                            textAlignVertical: "center",
                            includeFontPadding: false,
                          },
                        ]}
                        placeholder="Name Required"
                        placeholderTextColor={isDarkMode ? "#ccc" : "#7F7F84"}
                        onChangeText={setNewName}
                        value={newName}
                      />
                    </Animated.View>
                    {newNameError ? (
                      <Text
                        style={[styles.addrBookErrTxt, styles.addrBookMb10]}
                      >
                        {newNameError}
                      </Text>
                    ) : null}
                    <Animated.View
                      style={{
                        transform: [{ translateX: shakeAddressAnim }],
                        position: "relative",
                      }}
                    >
                      {!newAddress ? (
                        <Text
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            left: 15,
                            right: 48,
                            top: 15,
                            height: 22,
                            zIndex: 1,
                            color: isDarkMode ? "#ccc" : "#7F7F84",
                            fontSize: 15,
                            lineHeight: 22,
                            includeFontPadding: false,
                          }}
                        >
                          {t("Address Required")}
                        </Text>
                      ) : null}
                      <TextInput
                        ref={addressInputRef}
                        style={[
                          styles.addressInput,
                          {
                            backgroundColor: inputBackgroundColor,
                            color: newAddress
                              ? isDarkMode
                                ? "#fff"
                                : "#000"
                              : "transparent",
                            borderWidth: 1,
                            borderColor: newAddressError
                              ? "#FF5252"
                              : "transparent",
                            paddingRight: 48,
                            paddingTop: 15,
                            paddingBottom: 0,
                            paddingVertical: 0,
                            lineHeight: 22,
                            textAlignVertical: "top",
                            includeFontPadding: false,
                            borderRadius: 16,
                          },
                        ]}
                        onChangeText={handleNewAddressChange}
                        value={newAddress}
                        multiline
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                      />
                      {!newAddress ? (
                        <TouchableOpacity
                          style={{
                            position: "absolute",
                            right: 8,
                            top: 0,
                            bottom: 0,
                            justifyContent: "center",
                            paddingHorizontal: 4,
                            zIndex: 2,
                          }}
                          onPress={handlePasteNewAddress}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={t("Paste address")}
                        >
                          <Icon name="content-paste" size={24} color="#9E9E9E" />
                        </TouchableOpacity>
                      ) : null}
                      {newAddress ? (
                        <TouchableOpacity
                          style={{
                            position: "absolute",
                            right: 8,
                            top: 0,
                            bottom: 0,
                            justifyContent: "center",
                            paddingHorizontal: 4,
                            zIndex: 2,
                          }}
                          onPress={handleClearNewAddress}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={t("Clear address input")}
                        >
                          <Icon name="delete-outline" size={24} color="#9E9E9E" />
                        </TouchableOpacity>
                      ) : null}
                    </Animated.View>
                    {newAddressError ? (
                      <Text
                        style={{
                          color: "red",
                          marginTop: 10,
                        }}
                      >
                        {newAddressError}
                      </Text>
                    ) : null}
                  </>
                </View>
                <View
                  style={{
                    marginTop: 20,
                    marginBottom: actionRowBottomSpacing,
                    paddingBottom: iosKeyboardButtonGap,
                    width: "100%",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <AnimatedTouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setAddressActionMenuVisible(false);
                      setEditingId(null);
                      setNewNetwork("");
                      setNewName("");
                      setNewAddress("");
                      setNewNetworkError("");
                      setNewNameError("");
                      setNewAddressError("");
                      setNetworkDropdownVisible(false);
                      setIsAddingAddress(false);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.cancelButton,
                      { flex: 1, marginRight: 4, borderRadius: 16 },
                    ]}
                  >
                    <Text style={styles.cancelButtonText}>{t("Back")}</Text>
                  </AnimatedTouchableOpacity>
                  <AnimatedTouchableOpacity
                    onPress={handleSaveAddress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.confirmButton,
                      { flex: 1, marginLeft: 4, borderRadius: 16 },
                    ]}
                  >
                    <Text style={styles.buttonTextWhite}>{t("Save")}</Text>
                  </AnimatedTouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AddressBookScreen;
