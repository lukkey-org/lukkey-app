/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import TabViewPanel from "./TabViewPanel";

const AssetsTabView = ({
  activeTab,
  setActiveTab,
  closeModal,
  VaultScreenStyle,
  ActivityScreenStyle,
  t,
  tabOpacity,
  tabReady,
  ActivityLog,
  scrollViewRef,
  selectedCrypto,
  exchangeRates,
  currencyUnit,
  isDarkMode,
  modalVisible,
  backgroundAnim,
  darkColorsDown,
  lightColorsDown,
  mainColor,
  secondaryColor,
  isClosing,
  onSendPress,
  onReceivePress,
  onPriceRefresh,
  setTabRefreshLoading,
}) => (
  <TabViewPanel
    activeTab={activeTab}
    setActiveTab={setActiveTab}
    closeModal={closeModal}
    VaultScreenStyle={VaultScreenStyle}
    ActivityScreenStyle={ActivityScreenStyle}
    t={t}
    tabOpacity={tabOpacity}
    tabReady={tabReady}
    ActivityLog={ActivityLog}
    scrollViewRef={scrollViewRef}
    selectedCrypto={selectedCrypto}
    exchangeRates={exchangeRates}
    currencyUnit={currencyUnit}
    isDarkMode={isDarkMode}
    modalVisible={modalVisible}
    backgroundAnim={backgroundAnim}
    darkColorsDown={darkColorsDown}
    lightColorsDown={lightColorsDown}
    mainColor={mainColor}
    secondaryColor={secondaryColor}
    isClosing={isClosing}
    onSendPress={onSendPress}
    onReceivePress={onReceivePress}
    onPriceRefresh={onPriceRefresh}
    setTabRefreshLoading={setTabRefreshLoading}
  />
);

export default AssetsTabView;
