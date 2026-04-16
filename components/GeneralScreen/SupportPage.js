/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useContext, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Image,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { DarkModeContext } from "../../utils/DeviceContext";
import { SUPPORT_EMAIL } from "../../env/support";

const SupportPage = () => {
  const { isDarkMode } = useContext(DarkModeContext);
  const navigation = useNavigation();
  const { t } = useTranslation();

  const darkColors = ["#21201E", "#0E0D0D"];
  const lightColors = ["#FFFFFF", "#EDEBEF"];
  const borderColor = isDarkMode ? "#3C3C3C" : "#EDEBEF";
  // Support email link (subject/body prefilled)
  const email = SUPPORT_EMAIL;
  const subject = encodeURIComponent("LUKKEY feedback");
  const body = encodeURIComponent("Hi support team");
  const emailUrl = `mailto:${email}?subject=${subject}&body=${body}`;

  // Configure header options dynamically based on dark mode
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: isDarkMode ? "#21201E" : "#FFFFFF",
      },
      headerTintColor: isDarkMode ? "#FFFFFF" : "#000000",
      headerBackTitle: t("Back"),
    });
  }, [isDarkMode, navigation, t]);

  // Social media links with corresponding icons and URLs
  const socialMediaLinks = [
    {
      name: "Twitter",
      icon: isDarkMode
        ? require("../../assets/icon/Twitter.webp")
        : require("../../assets/icon/TwitterDark.webp"),
      url: "https://x.com/LukkeyAG",
    },
    /*   {
      name: "Telegram",
      icon: isDarkMode
        ? require("../../assets/icon/Telegram.webp")
        : require("../../assets/icon/TelegramDark.webp"),
      url: "https://t.me/+q9j351SAY8hlMDJl",
    }, */
    {
      name: "Discord",
      icon: isDarkMode
        ? require("../../assets/icon/Discord.webp")
        : require("../../assets/icon/DiscordDark.webp"),
      url: "https://discord.gg/uvyYyAjdNM",
    },
    {
      name: "Reddit",
      icon: isDarkMode
        ? require("../../assets/icon/Reddit.webp")
        : require("../../assets/icon/RedditDark.webp"),
      url: "https://www.reddit.com/user/Ok_Bass_6829/",
    },
    {
      name: "Facebook",
      icon: isDarkMode
        ? require("../../assets/icon/Facebook.webp")
        : require("../../assets/icon/FacebookDark.webp"),
      url: "https://www.facebook.com/profile.php?id=61578769227902",
    },
    {
      name: "YouTube",
      icon: isDarkMode
        ? require("../../assets/icon/Youtube.webp")
        : require("../../assets/icon/YoutubeDark.webp"),
      url: "https://www.youtube.com/@LukkeySwiss",
    },
    {
      name: "Instagram",
      icon: isDarkMode
        ? require("../../assets/icon/Instagram.webp")
        : require("../../assets/icon/InstagramDark.webp"),
      url: "https://www.instagram.com/lukkey_swiss/",
    },
    {
      name: "Tiktok",
      icon: isDarkMode
        ? require("../../assets/icon/Tiktok.webp")
        : require("../../assets/icon/TiktokDark.webp"),
      url: "https://www.tiktok.com/@lukkeyag",
    },
    {
      name: t("Email Support"),
      icon: isDarkMode
        ? require("../../assets/icon/Email.webp")
        : require("../../assets/icon/EmailDark.webp"),
      url: emailUrl,
    },
  ];

  return (
    <LinearGradient
      style={styles.container}
      colors={isDarkMode ? darkColors : lightColors}
    >
      {socialMediaLinks.map((link, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.settingsItem, { borderBottomColor: borderColor }]}
          onPress={() => Linking.openURL(link.url)}
        >
          {link.icon ? (
            <Image
              source={link.icon}
              style={{ width: 20, height: 20 }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ width: 20, height: 20 }} />
          )}
          <Text
            style={[
              styles.linkText,
              { color: isDarkMode ? "#FFFFFF" : "#000000" },
            ]}
          >
            {link.name}
          </Text>
        </TouchableOpacity>
      ))}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
    paddingLeft: 20,
    paddingRight: 20,
  },
  settingsItem: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    width: "100%",
  },
  linkText: {
    marginLeft: 20,
    fontSize: 18,
  },
});

export default SupportPage;
