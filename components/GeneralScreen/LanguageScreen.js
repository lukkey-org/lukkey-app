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
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
 
// removed LinearGradient import
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { DarkModeContext } from "../../utils/DeviceContext";
import { SecureDeviceScreenStylesRoot } from "../../styles/styles";
import { languages } from "../../config/languages";
import i18n from "../../config/i18n";

const LanguageScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { isDarkMode } = useContext(DarkModeContext);
  const styles = SecureDeviceScreenStylesRoot(isDarkMode);
  const [searchLanguage, setSearchLanguage] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  // const darkColors = ["#21201E", "#0E0D0D"]; // removed: use solid header color
  // const lightColors = ["#FFFFFF", "#EDEBEF"]; // removed: use solid header color

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("Language"),
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
    const onLangChange = (lng) => setSelectedLanguage(lng);
    i18n.on("languageChanged", onLangChange);
    return () => {
      i18n.off("languageChanged", onLangChange);
    };
  }, []);

  const filteredLanguages = useMemo(
    () =>
      languages.filter((language) =>
        language.name.toLowerCase().includes(searchLanguage.toLowerCase())
      ),
    [searchLanguage]
  );

  const handleLanguageChange = async (language) => {
    setSelectedLanguage(language.code);
    i18n.changeLanguage(language.code);
    await AsyncStorage.setItem("language", language.code);
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
      {/* Fixed search bar at top (outside the scroll list) */}
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
          placeholder={t("Search Language")}
          placeholderTextColor={isDarkMode ? "#97979C" : "#7F7F84"}
          onChangeText={setSearchLanguage}
          value={searchLanguage}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Scrollable language list below */}
      <ScrollView
        style={{ width: "100%" }}
        contentContainerStyle={{ paddingBottom: 24, marginHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
      >
        {filteredLanguages.map((language) => {
          const hasExactMatch = languages.some(
            (l) => l.code === selectedLanguage
          );
          const isSelected =
            selectedLanguage === language.code ||
            (!hasExactMatch &&
              (selectedLanguage || "").startsWith(language.code));
          return (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.settingsItem,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? "#363639" : "#ccc",
                  justifyContent: "space-between",
                },
              ]}
              onPress={() => handleLanguageChange(language)}
            >
              <Text
                style={[
                  styles.langMdlTxt,
                  { textAlign: "left", marginBottom: 0 },
                ]}
              >
                {language.name}
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

export default LanguageScreen;
