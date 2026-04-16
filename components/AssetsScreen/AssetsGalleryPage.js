/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Image,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import ContactFormModal from "../modal/ContactFormModal";
import TransferConfirmModal from "../modal/TransferConfirmModal";
import { ActivityScreenStylesRoot } from "../../styles/styles";
import SkeletonImage from "./SkeletonImage";

const getNftListFromResponse = (payload) =>
  Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.list)
      ? payload.data.list
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];

const getNftMintValue = (nft) => String(nft?.tokenId ?? nft?.mint ?? "");

const AssetsGalleryPage = ({
  VaultScreenStyle,
  isDarkMode,
  t,
  modalVisible,
  isClosing,
  renderChainButton,
  showGalleryChainButton,
  galleryRefreshing,
  onGalleryRefresh,
  refreshing,
  nftData,
  scaleAnimsRef,
  animatePressIn,
  animatePressOut,
  handleGallerySelect,
  selectedNFT,
  sendModalVisible,
  setSendModalVisible,
  recipientAddress,
  detectedNetwork,
  isAddressValid,
  handleAddressChange,
  handlePreview,
  paymentAddressForNFT,
  buttonBackgroundColor,
  disabledButtonBackgroundColor,
  previewModalVisible,
  setPreviewModalVisible,
  availableFeeCoinBalance,
  feeTokenMeta,
  handleSendDigital,
}) => {
  const ActivityScreenStyle = ActivityScreenStylesRoot(isDarkMode);
  const nftList = nftData && nftData.code === "0" ? getNftListFromResponse(nftData) : [];
  const entryAnimsRef = React.useRef([]);

  React.useEffect(() => {
    if (nftList.length === 0) {
      entryAnimsRef.current = [];
      return;
    }

    for (let i = 0; i < nftList.length; i += 1) {
      if (!entryAnimsRef.current[i]) {
        entryAnimsRef.current[i] = {
          opacity: new Animated.Value(0),
          translateY: new Animated.Value(68),
          scale: new Animated.Value(0.92),
        };
      } else {
        entryAnimsRef.current[i].opacity.setValue(0);
        entryAnimsRef.current[i].translateY.setValue(68);
        entryAnimsRef.current[i].scale.setValue(0.92);
      }
    }
    entryAnimsRef.current.length = nftList.length;

    const animations = nftList.flatMap((_, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const delay = row * 135 + col * 80;
      const entryAnim = entryAnimsRef.current[index];

      return [
        Animated.timing(entryAnim.opacity, {
          toValue: 1,
          duration: 320,
          delay,
          useNativeDriver: true,
        }),
        Animated.spring(entryAnim.translateY, {
          toValue: 0,
          delay,
          useNativeDriver: true,
          damping: 16,
          stiffness: 140,
          mass: 0.9,
        }),
        Animated.spring(entryAnim.scale, {
          toValue: 1,
          delay,
          useNativeDriver: true,
          damping: 15,
          stiffness: 150,
          mass: 0.85,
        }),
      ];
    });

    Animated.parallel(animations).start();
  }, [
    nftList
      .map(
        (nft) =>
          `${String(nft?.queryChainName || "").toLowerCase()}:${String(
            nft?.tokenContractAddress || "",
          ).toLowerCase()}:${getNftMintValue(nft)}`,
      )
      .join("|"),
  ]);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        width: "90%",
      }}
    >
      {showGalleryChainButton && (!modalVisible || isClosing) && (
        <View
          style={{
            position: "absolute",
            top: 0,
            width: "100%",
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "flex-start",
            marginBottom: 10,
            zIndex: 10,
          }}
        >
          {renderChainButton()}
        </View>
      )}
      <ScrollView
        contentContainerStyle={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          alignItems: "center",
          paddingBottom: 10,
        }}
        style={{
          width: "100%",
          borderRadius: 8,
          zIndex: 0,
          marginTop: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={galleryRefreshing}
            onRefresh={onGalleryRefresh}
            progressViewOffset={-20}
          />
        }
      >
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
        {nftList.length > 0 ? (
          nftList.map((nft, index) =>
            (() => {
              if (!scaleAnimsRef.current[index]) {
                scaleAnimsRef.current[index] = new Animated.Value(1);
              }
              const entryAnim = entryAnimsRef.current[index] || {
                opacity: new Animated.Value(1),
                translateY: new Animated.Value(0),
                scale: new Animated.Value(1),
              };
              return (
                <Animated.View
                  key={index}
                  style={[
                    VaultScreenStyle.galleryItem,
                    {
                      opacity: entryAnim.opacity,
                      transform: [
                        { translateY: entryAnim.translateY },
                        { scale: entryAnim.scale },
                        { scale: scaleAnimsRef.current[index] },
                      ],
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPressIn={() =>
                      animatePressIn(scaleAnimsRef.current[index])
                    }
                    onPressOut={() =>
                      animatePressOut(scaleAnimsRef.current[index])
                    }
                    onPress={() => handleGallerySelect(nft)}
                    activeOpacity={1}
                    style={{ width: "100%" }}
                  >
                    <View style={VaultScreenStyle.galleryCard}>
                      <View>
                        {nft.logoUrl ? (
                          <SkeletonImage
                            source={{ uri: nft.logoUrl }}
                            style={VaultScreenStyle.galleryImage}
                            resizeMode="cover"
                            VaultScreenStyle={VaultScreenStyle}
                          />
                        ) : (
                          <View
                            style={VaultScreenStyle.galNoImgBox}
                          >
                            <Image
                              source={require("../../assets/branding/Logo@500.webp")}
                              style={VaultScreenStyle.galNoImgLog}
                            />
                            <Text
                              style={[
                                VaultScreenStyle.modalSubtitle,
                                VaultScreenStyle.galNoImgTxt,
                              ]}
                            >
                              {t("No Image")}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={VaultScreenStyle.galCarB}>
                        <Text
                          style={VaultScreenStyle.galleryCardTitle}
                          numberOfLines={3}
                          ellipsizeMode="tail"
                        >
                          {nft.name || "NFT Card"}
                        </Text>
                        <View style={VaultScreenStyle.galCarBCol}>
                          <Text
                            style={[
                              VaultScreenStyle.chainCardText,
                              { marginBottom: 4 },
                            ]}
                          >
                            {t("Chain")}: {nft.queryChainName || t("N/A")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })(),
          )
        ) : (
          <View style={VaultScreenStyle.galleryEmptyBox}>
            <Icon
              name="image-not-supported"
              size={40}
              color={isDarkMode ? "#777" : "#bbb"}
              style={{ marginBottom: 12 }}
            />
            <Text style={VaultScreenStyle.galleryEmptyText}>
              {t(
                "Your NFT gallery is empty\nNFTs you receive will appear here",
              )}
            </Text>
          </View>
        )}
      </ScrollView>
      <ContactFormModal
        visible={sendModalVisible}
        onRequestClose={() => setSendModalVisible(false)}
        ActivityScreenStyle={ActivityScreenStyle}
        t={t}
        isDarkMode={isDarkMode}
        handleAddressChange={handleAddressChange}
        inputAddress={recipientAddress}
        detectedNetwork={detectedNetwork}
        isAddressValid={isAddressValid}
        buttonBackgroundColor={buttonBackgroundColor}
        disabledButtonBackgroundColor={disabledButtonBackgroundColor}
        handleNextAfterAddress={handlePreview}
        setContactFormModalVisible={setSendModalVisible}
        selectedCrypto={selectedNFT?.name || ""}
        selectedCryptoChain={selectedNFT?.queryChainName || ""}
        selectedCryptoIcon={null}
        selectedAddress={paymentAddressForNFT}
      />
      <TransferConfirmModal
        mode="nft"
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        selectedNFT={selectedNFT}
        VaultScreenStyle={VaultScreenStyle}
        t={t}
        recipientAddress={recipientAddress}
        availableBalance={availableFeeCoinBalance}
        feeTokenSymbol={feeTokenMeta.symbol}
        feeTokenPriceUsd={feeTokenMeta.priceUsd}
        buttonBackgroundColor={buttonBackgroundColor}
        disabledButtonBackgroundColor={disabledButtonBackgroundColor}
        handleSendDigital={handleSendDigital}
        isDarkMode={isDarkMode}
      />
    </View>
  );
};

export default AssetsGalleryPage;
