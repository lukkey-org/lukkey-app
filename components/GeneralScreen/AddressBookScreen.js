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
  FlatList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  callNavigationCallback,
  clearNavigationCallback,
} from "../../utils/navigationCallbacks";
import { getNetworkImage, networks } from "../../config/networkConfig";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
import { DarkModeContext } from "../../utils/DeviceContext";
import ConfirmActionModal from "../modal/ConfirmActionModal";

const networkSearchAliases = {
  arb: "Arbitrum",
  avax: "Avalanche",
  btc: "Bitcoin",
  bch: "Bitcoin Cash",
  bnb: "Binance Smart Chain",
  bsc: "Binance Smart Chain",
  eth: "Ethereum",
  etc: "Ethereum Classic",
  ftm: "Fantom",
  heco: "Huobi ECO Chain",
  ht: "Huobi ECO Chain",
  iotx: "IoTeX Network Mainnet",
  ltc: "Litecoin",
  // okt: "OKX Chain", // OKB/OKX Chain support disabled.
  // okx: "OKX Chain", // OKB/OKX Chain support disabled.
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
  const [dropdownVisible, setDropdownVisible] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [searchNetwork, setSearchNetwork] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const networkInputRef = useRef(null);
  const shakeNetworkAnim = useRef(new Animated.Value(0)).current;
  const shakeNameAnim = useRef(new Animated.Value(0)).current;
  const shakeAddressAnim = useRef(new Animated.Value(0)).current;

  const sanitizeAddressValue = useCallback(
    (value) => String(value || "").replace(/\s+/g, "").trim(),
    []
  );

  const handleClose = useCallback(() => {
    if (didCompleteRef.current) return;
    didCompleteRef.current = true;
    callNavigationCallback(onCloseId);
    navigation.goBack();
  }, [navigation, onCloseId]);

  const handleSelect = useCallback(
    (item) => {
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

  const filteredAddresses = savedAddresses.filter(
    (address) =>
      address.network.toLowerCase().includes(searchAddress.toLowerCase()) ||
      address.name.toLowerCase().includes(searchAddress.toLowerCase()) ||
      address.address.toLowerCase().includes(searchAddress.toLowerCase())
  );

  const toggleDropdown = (id) => {
    setDropdownVisible(dropdownVisible === id ? null : id);
  };

  const handleCopy = (address) => {
    Clipboard.setString(address);
    if (typeof global.__SHOW_APP_TOAST__ === "function") {
      global.__SHOW_APP_TOAST__({
        message: t("Address copied to clipboard"),
        variant: "success",
        durationMs: 1800,
        showCountdown: true,
      });
    }
    setDropdownVisible(null);
  };

  const handleDelete = (id) => {
    setPendingDeleteId(id);
    setDropdownVisible(null);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const updatedAddresses = savedAddresses.filter(
      (item) => item.id !== pendingDeleteId
    );
    setSavedAddresses(updatedAddresses);
    saveAddressesToStorage(updatedAddresses);
    setPendingDeleteId(null);
  };

  const handleEdit = (id) => {
    const addressToEdit = savedAddresses.find((item) => item.id === id);
    if (addressToEdit) {
      setEditingId(id);
      setNewNetwork(addressToEdit.network);
      setNewName(addressToEdit.name);
      setNewAddress(sanitizeAddressValue(addressToEdit.address));
      setIsAddingAddress(true);
      setDropdownVisible(null);
    }
  };

  const handleSaveAddress = () => {
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
  };

  const filteredNetworks = networks.filter((network) =>
    (() => {
      const query = searchNetwork.trim().toLowerCase();
      if (!query) return true;
      const aliasTarget = networkSearchAliases[query];
      return (
        network.toLowerCase().includes(query) ||
        aliasTarget === network ||
        Object.entries(networkSearchAliases).some(
          ([alias, target]) => target === network && alias.includes(query)
        )
      );
    })()
  );

  const getBestNetworkMatch = (text) => {
    const query = text.trim().toLowerCase();
    if (!query) {
      return "";
    }
    const aliasMatch = networkSearchAliases[query];
    if (aliasMatch) {
      return aliasMatch;
    }
    const exactMatch = networks.find(
      (network) => network.toLowerCase() === query
    );
    if (exactMatch) {
      return exactMatch;
    }
    const prefixMatch = networks.find((network) =>
      network.toLowerCase().startsWith(query)
    );
    if (prefixMatch) {
      return prefixMatch;
    }
    return (
      networks.find((network) => network.toLowerCase().includes(query)) || ""
    );
  };

  const applySelectedNetwork = useCallback(
    (network) => {
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
    if (onSelectId) {
      handleSelect(item);
      return;
    }
    handleEdit(item.id);
  };

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
        cancelButtonStyle={styles.cancelButton}
        confirmButtonStyle={styles.confirmButton}
        cancelTextStyle={styles.cancelButtonText}
        confirmTextStyle={styles.addrBtnText}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.addrBookFlex}
        pointerEvents="box-none"
        enabled={Platform.OS === "ios" || keyboardVisible}
      >
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(null)}>
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
                  <FlatList
                    data={filteredAddresses}
                    keyExtractor={(item) => item.id}
                    style={styles.addrBookMb20}
                    renderItem={({ item }) => (
                      <View style={styles.addrBookRel8}>
                        <Swipeable
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
                                width: 184,
                                marginLeft: 8,
                                gap: 8,
                              }}
                            >
                              <TouchableOpacity
                                onPress={() => {
                                  console.log(
                                    "[AddressBook] Edit pressed for id:",
                                    item.id
                                  );
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
                              <TouchableOpacity
                                onPress={() => {
                                  console.log(
                                    "[AddressBook] Delete pressed for id:",
                                    item.id
                                  );
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
                          <TouchableOpacity
                            onPress={() => handleListItemPress(item)}
                            onLongPress={() => {
                              console.log(
                                "[AddressBook] Long press copy for id:",
                                item.id
                              );
                              handleCopy(item.address);
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
                              onPress={() => toggleDropdown(item.id)}
                              style={[styles.addrBookMl10, { flexShrink: 0 }]}
                            >
                              <Icon
                                name="more-vert"
                                size={24}
                                color={isDarkMode ? "#fff" : "#000"}
                              />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        </Swipeable>
                        {dropdownVisible === item.id && (
                          <View
                            style={[
                              styles.dropdown,
                              {
                                backgroundColor: isDarkMode
                                  ? "#4B4642"
                                  : "#ffffff",
                              },
                              {
                                paddingVertical: 8,
                                paddingHorizontal: 8,
                                borderRadius: 12,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={() => handleEdit(item.id)}
                              style={{
                                minHeight: 44,
                                justifyContent: "center",
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                marginBottom: 8,
                              }}
                            >
                              <Text
                                style={[
                                  styles.droBtnTxt,
                                  {
                                    color: isDarkMode ? "#FFFFFF" : "#7F7F84",
                                  },
                                ]}
                              >
                                {t("Edit")}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleCopy(item.address)}
                              style={{
                                minHeight: 44,
                                justifyContent: "center",
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                marginBottom: 8,
                              }}
                            >
                              <Text
                                style={[
                                  styles.droBtnTxt,
                                  {
                                    color: isDarkMode ? "#FFFFFF" : "#7F7F84",
                                  },
                                ]}
                              >
                                {t("Copy")}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDelete(item.id)}
                              style={{
                                minHeight: 44,
                                justifyContent: "center",
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                              }}
                            >
                              <Text
                                style={[
                                  styles.droBtnTxt,
                                  {
                                    color: "#FF5252",
                                  },
                                ]}
                              >
                                {t("Delete")}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
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
                      { flex: 1, marginRight: 4, borderRadius: 16 },
                    ]}
                  >
                    <Text style={styles.cancelButtonText}>{t("Close")}</Text>
                  </AnimatedTouchableOpacity>
                  <AnimatedTouchableOpacity
                    onPress={() => setIsAddingAddress(true)}
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
                        onPress={() =>
                          setNetworkDropdownVisible(!networkDropdownVisible)
                        }
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
                              requestAnimationFrame(() => {
                                networkInputRef.current?.focus();
                              });
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
                          },
                        ]}
                        placeholder="Name Required"
                        placeholderTextColor={isDarkMode ? "#ccc" : "#7F7F84"}
                        onChangeText={setNewName}
                        value={newName}
                        autoFocus={true}
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
                      }}
                    >
                      <TextInput
                        style={[
                          styles.addressInput,
                          {
                            backgroundColor: inputBackgroundColor,
                            color: isDarkMode ? "#fff" : "#000",
                            borderWidth: 1,
                            borderColor: newAddressError
                              ? "#FF5252"
                              : "transparent",
                            textAlignVertical: "top",
                            borderRadius: 16,
                          },
                        ]}
                        placeholder="Address Required"
                        placeholderTextColor={isDarkMode ? "#ccc" : "#7F7F84"}
                        onChangeText={setNewAddress}
                        value={newAddress}
                        multiline
                      />
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
                    onPress={() => setIsAddingAddress(false)}
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
