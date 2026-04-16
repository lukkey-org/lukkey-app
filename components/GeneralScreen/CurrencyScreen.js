/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

// removed LinearGradient import
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { DeviceContext, DarkModeContext } from "../../utils/DeviceContext";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
const CurrencyScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { isDarkMode } = useContext(DarkModeContext);
  const { currencies, currencyUnit, setCurrencyUnit } =
    useContext(DeviceContext);
  const styles = SecureDeviceScreenStylesRoot(isDarkMode);

  const [searchCurrency, setSearchCurrency] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState(currencyUnit);

  // const darkColors = ["#21201E", "#0E0D0D"]; // removed: use solid header color
  // const lightColors = ["#FFFFFF", "#EDEBEF"]; // removed: use solid header color

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("Default Currency"),
      headerStyle: {
        backgroundColor: isDarkMode ? "#21201E" : "#FFFFFF",
      },
      headerTintColor: isDarkMode ? "#FFFFFF" : "#000000",
      headerTitleStyle: {
        color: isDarkMode ? "#FFFFFF" : "#000000",
        fontWeight: "bold",
      },
      headerShadowVisible: false,
      headerBackTitle: t("Back"),
    });
  }, [navigation, isDarkMode, t]);

  useEffect(() => {
    setSelectedCurrency(currencyUnit);
  }, [currencyUnit]);

  const filteredCurrencies = useMemo(
    () =>
      (currencies || []).filter((c) => {
        const keyword = (searchCurrency || "").toLowerCase();
        return (
          c.name.toLowerCase().includes(keyword) ||
          (c.shortName || "").toLowerCase().includes(keyword)
        );
      }),
    [currencies, searchCurrency]
  );

  const handleCurrencyChange = (currency) => {
    setSelectedCurrency(currency.shortName);
    setCurrencyUnit(currency.shortName);
    navigation.goBack();
  };

  return (
    <View
      style={[
        styles.container,
        {
          justifyContent: "flex-start",
          backgroundColor: isDarkMode ? "#21201E" : "#FFFFFF",
        },
      ]}
    >
      {/* Fixed top search bar */}
      <View
        style={[
          styles.searchContainer,
          {
            marginHorizontal: 16,
            // iOS style: The light gray background and height are controlled by the style system, and the background is not covered here.
            borderWidth: 0,
            zIndex: 1,
            elevation: 0,
          },
        ]}
      >
        <Icon name="search" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("Search Currency")}
          placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
          onChangeText={setSearchCurrency}
          value={searchCurrency}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Scrollable currency list */}
      <ScrollView
        style={{ width: "100%" }}
        contentContainerStyle={{ paddingBottom: 24, marginHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
      >
        {filteredCurrencies.map((currency) => {
          const isSelected = selectedCurrency === currency.shortName;
          return (
            <TouchableOpacity
              key={currency.shortName}
              style={[
                styles.settingsItem,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? "#363639" : "#ccc",
                  justifyContent: "space-between",
                },
              ]}
              onPress={() => handleCurrencyChange(currency)}
            >
              <Text
                style={[
                  styles.langMdlTxt,
                  { textAlign: "left", marginBottom: 0 },
                ]}
              >
                {currency.name} ({currency.shortName})
              </Text>
              {isSelected && (
                <Icon
                  name="check"
                  size={20}
                  color={isDarkMode ? "#fff" : "#000"}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default CurrencyScreen;
