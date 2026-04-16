/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useContext, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { VaultScreenStylesRoot } from "../styles/styles";
import { DarkModeContext } from "../utils/DeviceContext";

const SkeletonImage = ({ source, style, VaultScreenStyle }) => {
  const [loaded, setLoaded] = React.useState(false);
  const skeletonOpacity = React.useState(new Animated.Value(1))[0];
  const imageOpacity = React.useState(new Animated.Value(0))[0];
  const shimmerTranslate = React.useState(new Animated.Value(-200))[0];

  React.useEffect(() => {
    if (!loaded) {
      Animated.loop(
        Animated.timing(shimmerTranslate, {
          toValue: 200,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [loaded, shimmerTranslate]);

  const handleLoad = () => {
    setLoaded(true);
    Animated.timing(skeletonOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={style}>
      {!loaded && (
        <Animated.View
          style={[
            VaultScreenStyle.phWra,
            { opacity: skeletonOpacity, borderRadius: style.borderRadius || 0 },
          ]}
        >
          <Animated.View
            style={[
              VaultScreenStyle.shimmerBar,
              { transform: [{ translateX: shimmerTranslate }] },
            ]}
          />
        </Animated.View>
      )}
      <Animated.View
        style={{
          opacity: imageOpacity,
          borderRadius: 16,
          overflow: "hidden",
          flex: 1,
        }}
      >
        <WebView
          originWhitelist={["*"]}
          source={{
            html: `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>body,html{margin:0;padding:0;}</style>
        </head>
        <body>
          <img src="${source.uri}" style="
            width:100%;
            height:auto;
            object-fit:contain;
            display:block;
          "/>
        </body>
      </html>
    `,
          }}
          scrollEnabled={false}
          style={{ flex: 1 }}
          onLoadEnd={handleLoad}
        />
      </Animated.View>
    </View>
  );
};

const NFTDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { isDarkMode } = useContext(DarkModeContext);
  const VaultScreenStyle = useMemo(
    () => VaultScreenStylesRoot(isDarkMode),
    [isDarkMode]
  );
  const selectedNFT = route.params?.nftPayload || route.params?.nft || null;
  const nftIdValue = String(selectedNFT?.tokenId ?? selectedNFT?.mint ?? "");

  useEffect(() => {
    if (!selectedNFT) {
      navigation.goBack();
    }
  }, [selectedNFT, navigation]);

  if (!selectedNFT) return null;

  const handleSend = () => {
    navigation.navigate({
      name: "Back",
      params: {
        screen: "Assets",
        params: {
          nftAction: "openSend",
          nftPayload: selectedNFT,
        },
      },
      merge: true,
    });
  };

  const handleSave = () => {
    navigation.navigate({
      name: "Back",
      params: {
        screen: "Assets",
        params: {
          nftAction: "saveToDevice",
          nftPayload: selectedNFT,
        },
      },
      merge: true,
    });
  };

  const darkColors = ["#21201E", "#0E0D0D"];
  const lightColors = ["#ffffff", "#EDEBEF"];

  return (
    <LinearGradient
      colors={isDarkMode ? darkColors : lightColors}
      style={styles.fullScreen}
    >
      <SafeAreaView style={styles.fullScreen}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
          >
            <MaterialIcons
              name="arrow-back-ios-new"
              size={22}
              color={isDarkMode ? "#fff" : "#111"}
            />
          </TouchableOpacity>
          <Text
            style={[VaultScreenStyle.modalTitle, styles.topTitle]}
            numberOfLines={1}
          >
            {selectedNFT?.name || t("NFT Card")}
          </Text>
          <View style={styles.topSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {selectedNFT ? (
            <View style={styles.section}>
              {selectedNFT.logoUrl ? (
                <SkeletonImage
                  source={{ uri: selectedNFT.logoUrl }}
                  style={VaultScreenStyle.nftModalImage}
                  VaultScreenStyle={VaultScreenStyle}
                />
              ) : (
                <View style={VaultScreenStyle.nftNoImgCtr}>
                  <Image
                    source={require("../assets/branding/Logo@500.webp")}
                    style={VaultScreenStyle.nftNoImageLogo}
                  />
                  <Text
                    style={[
                      VaultScreenStyle.modalSubtitle,
                      VaultScreenStyle.nftNoImageText,
                    ]}
                  >
                    {t("No Image")}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {selectedNFT ? (
            <View style={styles.section}>
              <Text style={[VaultScreenStyle.modalTitle, styles.sectionTitle]}>
                {selectedNFT.name || t("NFT Card")}
              </Text>
              <View style={styles.fieldRow}>
                <Text
                  style={[VaultScreenStyle.chainCardText, styles.fieldLabel]}
                >
                  {t("Contract")}:
                </Text>
                <Text style={VaultScreenStyle.chainCardText}>
                  {selectedNFT.tokenContractAddress}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text
                  style={[VaultScreenStyle.chainCardText, styles.fieldLabel]}
                >
                  {t("Token ID")}:
                </Text>
                <Text style={VaultScreenStyle.chainCardText}>
                  {nftIdValue}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text
                  style={[VaultScreenStyle.chainCardText, styles.fieldLabel]}
                >
                  {t("Protocol")}:
                </Text>
                <Text style={VaultScreenStyle.chainCardText}>
                  {selectedNFT.protocolType || t("N/A")}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text
                  style={[VaultScreenStyle.chainCardText, styles.fieldLabel]}
                >
                  {t("Description")}:
                </Text>
                <Text style={VaultScreenStyle.chainCardText}>
                  {selectedNFT.des || t("N/A")}
                </Text>
              </View>
              {selectedNFT.lastPrice && (
                <View style={styles.fieldRow}>
                  <Text
                    style={[VaultScreenStyle.chainCardText, styles.fieldLabel]}
                  >
                    {t("Price")}:
                  </Text>
                  <Text style={VaultScreenStyle.chainCardText}>
                    {selectedNFT.lastPrice}{" "}
                    {selectedNFT.lastPriceUnit || t("N/A")}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text
                style={[
                  VaultScreenStyle.modalSubtitle,
                  { textAlign: "center" },
                ]}
              >
                {t(
                  "Your NFT gallery is empty\nNFTs you receive will appear here"
                )}
              </Text>
            </View>
          )}
        </ScrollView>

        {selectedNFT ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                VaultScreenStyle.cancelButtonNoMt,
                styles.actionButton,
                styles.actionButtonLeft,
              ]}
              onPress={handleSend}
            >
              <Text style={VaultScreenStyle.cancelButtonText}>{t("Send")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                VaultScreenStyle.saveToDeviceBtn,
                styles.actionButton,
                styles.actionButtonRight,
              ]}
              onPress={handleSave}
            >
              <Text style={VaultScreenStyle.confirmText}>
                {t("Save to Device")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
    minHeight: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
  },
  topSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  fieldRow: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    alignSelf: "center",
    paddingTop: 20,
    paddingBottom: 20,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    height: 60,
  },
  actionButtonLeft: {
    marginRight: 4,
  },
  actionButtonRight: {
    marginLeft: 4,
  },
});

export default NFTDetailScreen;
