/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React from "react";
import { Animated, View, Text, TouchableOpacity } from "react-native";
import CountUpText from "../common/CountUpText";
import DataSkeleton from "./DataSkeleton";

const TotalBalanceHeader = ({
  VaultScreenStyle,
  opacityAnim,
  isOpening,
  isInitialLoading,
  isBalanceSyncing,
  isPriceLoading,
  modalVisible,
  isClosing,
  hideNumbers,
  setHideNumbers,
  totalBalanceRaw,
  totalBalanceValue,
  totalBalanceDecimals,
  totalBalanceDisplayText,
  totalBalanceUseScientific,
  currencyUnit,
  allowTotalCountUp,
  maskAmountStr,
  isDarkMode,
  renderChainButton,
  t,
}) => {
  const safeDecimals = Number.isFinite(totalBalanceDecimals)
    ? Math.max(0, totalBalanceDecimals)
    : 0;
  const totalBalanceText = Number.isFinite(totalBalanceValue)
    ? totalBalanceValue.toFixed(safeDecimals)
    : "0";
  const displayTotalText =
    totalBalanceUseScientific && totalBalanceDisplayText
      ? totalBalanceDisplayText
      : totalBalanceText;

  return (
    <Animated.View
      pointerEvents={isOpening ? "none" : "auto"}
      style={[
        VaultScreenStyle.totalBalanceWrap,
        { opacity: opacityAnim },
        isOpening && {
          position: "absolute",
          top: 0,
          left: "5%",
          right: "5%",
          marginBottom: 0,
          zIndex: 30,
          elevation: 30,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            try {
              setHideNumbers && setHideNumbers(!hideNumbers);
            } catch {}
          }}
        >
          <Text style={VaultScreenStyle.totalBalanceText}>
            {t("Total Value")}
          </Text>
          {(isBalanceSyncing || isInitialLoading || isPriceLoading) &&
          !isClosing ? (
            <View style={VaultScreenStyle.ttlBalAmo}>
              <DataSkeleton width={150} height={40} isDarkMode={isDarkMode} />
            </View>
          ) : (
            <>
              {hideNumbers ? (
                <Text style={VaultScreenStyle.ttlBalAmo}>
                  {`${maskAmountStr(totalBalanceRaw, {
                    min: 5,
                    max: 8,
                  })} `}
                  <Text style={VaultScreenStyle.currencyUnit}>
                    {currencyUnit}
                  </Text>
                </Text>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                  }}
                >
                  {allowTotalCountUp && !totalBalanceUseScientific ? (
                    <CountUpText
                      value={totalBalanceValue}
                      decimals={safeDecimals}
                      style={VaultScreenStyle.ttlBalAmo}
                    />
                  ) : (
                    <Text style={VaultScreenStyle.ttlBalAmo}>
                      {displayTotalText}
                    </Text>
                  )}
                  <Text style={VaultScreenStyle.currencyUnit}>
                    {currencyUnit}
                  </Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
        {renderChainButton()}
      </View>
    </Animated.View>
  );
};

export default TotalBalanceHeader;
