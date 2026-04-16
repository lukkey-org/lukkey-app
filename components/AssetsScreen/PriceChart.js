/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// PriceChart.js
import React, { useState, useEffect, useRef, useContext } from "react";
import {
  View,
  Text,
  Pressable,
  PanResponder,
  ActivityIndicator,
  InteractionManager,
  Image,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import * as Haptics from "expo-haptics";
import { DarkModeContext } from "../../utils/DeviceContext";
import { useTranslation } from "react-i18next";
import { VaultScreenStylesRoot } from "../../styles/styles";
import { chartAPI } from "../../env/apiEndpoints";
import DataSkeleton from "./DataSkeleton";
import ChartSkeleton from "./ChartSkeleton";
import CountUpText from "../common/CountUpText";
import { BlurView } from "../common/AppBlurView";

export default function PriceChartCom({
  instId = "BTC-USD",
  parentScrollviewRef,
  priceFla = "$",
  exchangeRates,
  currencyUnit,
  debugPriceIconSource,
  debugPriceLabel,
  onRefreshBalance,
  refreshing: externalRefreshing,
  setRefreshing: externalSetRefreshing,
  onRefreshReady,
}) {
  const { t } = useTranslation();
  const { isDarkMode } = useContext(DarkModeContext);
  const VaultScreenStyle = VaultScreenStylesRoot(isDarkMode);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenWidth = windowWidth;

  const [refreshingState, setRefreshingState] = useState(false);
  const refreshing =
    typeof externalRefreshing === "boolean"
      ? externalRefreshing
      : refreshingState;
  const setRefreshing =
    typeof externalSetRefreshing === "function"
      ? externalSetRefreshing
      : setRefreshingState;
  const load = useState(true);
  const showSkeleton = load[0];
  const [hasData, setHasData] = useState(true);
  const _selectPointData = useState();
  const _selectIndex = useState(0);
  const _chartData = useState([0]);
  const _sourceData = useState([]);
  const maxAndMin = useState([]);
  const priceIncrease = useState([0, 0]);
  const priceFlag = currencyUnit ? `${currencyUnit} ` : priceFla;
  const fxRate = Number(exchangeRates?.[currencyUnit] ?? 0);
  const effectiveRate = Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 1;
  const chartSectionRef = useRef(null);
  const [chartSectionHeight, setChartSectionHeight] = useState(300);
  const [rangeBarHeight, setRangeBarHeight] = useState(44);
  const chartHeight = Math.max(160, chartSectionHeight - rangeBarHeight - 32);
  const minLabelTop = Math.max(0, chartHeight - 48);

  const formatPriceValue = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    return (num * effectiveRate).toFixed(2);
  };

  const textColor = isDarkMode ? "#fff" : "#000";
  const textTabColor = isDarkMode ? "#6E6E7F" : "#8C8C9C";
  const activeBackgroundColor = isDarkMode ? "#21201E" : "#fff";
  const inactiveBackgroundColor = "transparent";
  const smallIconBgColor = isDarkMode ? "#ffffff80" : "rgba(0, 0, 0, 0.05)";

  // Compute the maximum and minimum closing prices and their indices.
  const _getMaxAndMinPrice = (data) => {
    const values = data.map((item) => parseFloat(item[4]));
    const max = Math.max(...values);
    const min = Math.min(...values);
    const maxIndex = values.indexOf(max);
    const minIndex = values.indexOf(min);
    maxAndMin[1]([max, min, maxIndex, minIndex]);
  };

  // Calculate price change and percentage.
  const calcPointPrice = (
    _index,
    is_default = true,
    _dataPoints = null,
    _dataSource = null,
  ) => {
    let perStr = "";
    let priceStr = "";
    if (is_default && _dataPoints) {
      priceStr = parseFloat(_dataPoints.last[4] - _dataPoints.start[1]).toFixed(
        2,
      );
      perStr = parseFloat((priceStr / _dataPoints.start[1]) * 100).toFixed(2);
    } else {
      if (!_sourceData[0][_index] && !_dataSource) return;
      const _parseData = _dataSource ?? _sourceData[0];
      priceStr = parseFloat(_parseData[_index][4] - _parseData[0][1]).toFixed(
        2,
      );
      perStr = parseFloat((priceStr / _parseData[0][1]) * 100).toFixed(2);
    }
    priceIncrease[1]([priceStr, perStr]);
  };

  // Initialize PanResponder for horizontal touch interactions.
  const panResponder = useState(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
    }),
  );

  // Update PanResponder to track touch movements and update selected point.
  const updatePanResponder = (_sdata) => {
    panResponder[1](
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (e, gestureState) =>
          Math.abs(gestureState.dx > 5) || Math.abs(gestureState.dy > 5)
            ? true
            : false,
        onPanResponderMove: (evt, gestureState) => {
          const chartWidth = screenWidth;
          const numPoints = _sdata.length;
          const singlePointWidth = chartWidth / numPoints;
          const xPosition = gestureState.moveX;
          const index = Math.floor(xPosition / singlePointWidth);
          if (index >= 0 && index <= numPoints) {
            _selectPointData[1](_sdata[index]);
            _selectIndex[1](index);
            calcPointPrice(index, false, null, _sdata);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
      }),
    );
  };

  const updateChartSectionHeight = () => {
    const node = chartSectionRef.current;
    if (!node || typeof node.measureInWindow !== "function") return;
    node.measureInWindow((x, y) => {
      const bottomPadding = 60;
      const available = windowHeight - y - bottomPadding;
      if (Number.isFinite(available) && available > 0) {
        const nextHeight = Math.max(240, Math.floor(available));
        setChartSectionHeight(nextHeight);
      }
    });
  };

  // Fetch data from the API.
  const _getData = async (_nd = "30m") => {
    load[1](true);
    if (!chartAPI.enabled) {
      setHasData(false);
      load[1](false);
      return;
    }
    let _rd = await fetch(
      `${chartAPI.indexCandles}?instId=${instId}&bar=${_nd}`,
    )
      .then((res) => res.json())
      .catch((er) => {
        // Handle error if needed.
      });

    if (!_rd || _rd.data.length === 0) {
      setHasData(false);
      load[1](false);
      return;
    }
    setHasData(true);
    const _cdata = _rd.data.map((r) => parseFloat(r[4]));
    _getMaxAndMinPrice(_rd.data);
    _chartData[1](_cdata);
    _sourceData[1](_rd.data);
    load[1](false);
    updatePanResponder(_rd.data);
    calcPointPrice(0, true, {
      start: _rd.data[0],
      last: _rd.data[_rd.data.length - 1],
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        _getData(),
        typeof onRefreshBalance === "function" ? onRefreshBalance() : null,
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (typeof onRefreshReady === "function") {
      onRefreshReady(onRefresh);
    }
  }, [onRefresh, onRefreshReady]);

  // Initialize the date selection and fetch data.
  const selectDate = useState("30m");

  useEffect(() => {
    const invalid =
      !instId ||
      String(instId).startsWith("undefined") ||
      String(instId).startsWith("null");
    if (invalid) return;
    _selectIndex[1](0);
    _selectPointData[1](null);
    _chartData[1]([0]);
    _sourceData[1]([]);
    _getData(selectDate[0]).catch(() => null);
  }, [instId]);

  useEffect(() => {
    requestAnimationFrame(updateChartSectionHeight);
  }, [windowHeight]);

  // Change the data interval and refresh data.
  const changeDate = (_nd) => {
    _selectIndex[1](0);
    _selectPointData[1](null);
    selectDate[1](_nd);
    _getData(_nd);
  };

  return (
    <View {...panResponder[0]?.panHandlers} pointerEvents="box-none">
      <View style={{ marginVertical: 10 }}>
        <View style={{ height: 298 }}>
          {!hasData && !showSkeleton && (
            <View
              style={{
                height: 298,
                justifyContent: "center",
                alignItems: "center",
                display: "flex",
                textAlign: "center",
              }}
            >
              <Text style={VaultScreenStyle.modalSubtitle}>
                {t("No data available")}
              </Text>
            </View>
          )}

          {hasData && (
            <View>
              {/* Price header: current price and optional token label */}
              <View style={{ marginLeft: 20 }}>
                <View>
                  {showSkeleton ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        width: 340,
                      }}
                    >
                      <DataSkeleton
                        width={100}
                        height={36}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                  ) : (
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {_selectPointData[0] ? (
                        <Text
                          style={{
                            fontWeight: "bold",
                            fontSize: 30,
                            color: textColor,
                          }}
                        >
                          {formatPriceValue(_selectPointData[0][4])}
                        </Text>
                      ) : (
                        <CountUpText
                          value={
                            _chartData[0]?.length
                              ? Number(_chartData[0][0]) * effectiveRate
                              : 0
                          }
                          decimals={2}
                          style={{
                            fontWeight: "bold",
                            fontSize: 30,
                            color: textColor,
                          }}
                        />
                      )}
                      {(debugPriceIconSource || debugPriceLabel) && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginLeft: 8,
                          }}
                        >
                          {debugPriceIconSource && (
                            <View
                              style={{
                                width: 16,
                                height: 16,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 15,
                                backgroundColor: smallIconBgColor,
                                overflow: "hidden",
                                marginRight: 6,
                              }}
                            >
                              <BlurView style={StyleSheet.absoluteFillObject} />
                              <Image
                                source={debugPriceIconSource}
                                style={{ width: 14, height: 14 }}
                              />
                            </View>
                          )}
                          <Text style={{ color: textTabColor, fontSize: 12 }}>
                            {debugPriceLabel || instId || "Unknown"}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 5,
                  }}
                >
                  {showSkeleton ? (
                    <DataSkeleton
                      width={100}
                      height={18}
                      isDarkMode={isDarkMode}
                      style={{ marginRight: 10 }}
                    />
                  ) : (
                    <Text
                      style={{
                        fontWeight: "bold",
                        color: priceIncrease[0][0] > 0 ? "#47B480" : "#D2464B",
                      }}
                    >
                      {`${priceIncrease[0][0] > 0 ? "+" : ""}${formatPriceValue(
                        priceIncrease[0][0],
                      )}`}
                      ({priceIncrease[0][1] > 0 ? "+" : ""}
                      {priceIncrease[0][1]}%)
                    </Text>
                  )}
                  {showSkeleton ? (
                    <DataSkeleton
                      width={110}
                      height={14}
                      isDarkMode={isDarkMode}
                      style={{ marginLeft: 5, opacity: 0.6 }}
                    />
                  ) : (
                    <Text style={{ marginLeft: 5, color: "gray" }}>
                      {_selectPointData[0]
                        ? new Date(
                            parseFloat(_selectPointData[0][0]),
                          ).toDateString() +
                          "," +
                          new Date(
                            parseFloat(_selectPointData[0][0]),
                          ).toLocaleTimeString()
                        : selectDate[0] === "30m"
                          ? t("past 24 hours")
                          : selectDate[0] === "1H"
                            ? t("past 7 days")
                            : selectDate[0] === "1W"
                              ? t("past 1 year")
                              : selectDate[0] === "1D"
                                ? t("past 30 days")
                                : ""}
                    </Text>
                  )}
                </View>
              </View>

              <View
                ref={chartSectionRef}
                onLayout={updateChartSectionHeight}
                style={{ height: chartSectionHeight }}
              >
                {showSkeleton ? (
                  <View>
                    <ChartSkeleton
                      width={windowWidth}
                      height={chartHeight}
                      isDarkMode={isDarkMode}
                    />
                  </View>
                ) : (
                  <>
                    <LineChart
                      data={{ datasets: [{ data: _chartData[0] }] }}
                      width={windowWidth}
                      height={chartHeight}
                      getDotColor={(data, index) => {
                        if (!_selectPointData[0]) return "transparent";
                        return data === parseFloat(_selectPointData[0][4]) &&
                          index === _selectIndex[0]
                          ? "green"
                          : "transparent";
                      }}
                      renderDotContent={({ x, y, indexData, index }) => {
                        if (!_selectPointData[0]) return null;
                        return indexData ===
                          parseFloat(_selectPointData[0][4]) &&
                          index === _selectIndex[0] ? (
                          <View
                            key={index}
                            style={{
                              width: 80,
                              height: 80,
                              backgroundColor: "rgba(80,208,63,0.1)",
                              borderRadius: 50,
                              position: "absolute",
                              top: y - 40,
                              left: x - 40,
                            }}
                          />
                        ) : null;
                      }}
                      decorator={() => {
                        if (!maxAndMin[0][0]) return null;
                        const screenCenter = screenWidth / 2;
                        const chartDataLength = _chartData[0].length;
                        const minLeft =
                          (screenWidth / chartDataLength) * maxAndMin[0][3] >
                          screenCenter
                            ? (screenWidth / chartDataLength) *
                                maxAndMin[0][3] -
                              45
                            : (screenWidth / chartDataLength) *
                                maxAndMin[0][3] +
                              32;
                        const maxLeft =
                          (screenWidth / chartDataLength) * maxAndMin[0][2] >
                          screenCenter
                            ? (screenWidth / chartDataLength) *
                                maxAndMin[0][2] -
                              45
                            : (screenWidth / chartDataLength) *
                                maxAndMin[0][2] +
                              32;

                        return (
                          <>
                            <View
                              key={"maxPoint"}
                              style={{
                                position: "absolute",
                                top: -10,
                                left: maxLeft,
                              }}
                            >
                              <Text style={{ color: "#2A9737" }}>
                                {formatPriceValue(maxAndMin[0][0])} {priceFlag}
                              </Text>
                            </View>
                            <View
                              key={"minPoint"}
                              style={{
                                position: "absolute",
                                top: minLabelTop,
                                left: minLeft,
                              }}
                            >
                              <Text style={{ color: "#2A9737" }}>
                                {formatPriceValue(maxAndMin[0][1])} {priceFlag}
                              </Text>
                            </View>
                          </>
                        );
                      }}
                      withInnerLines={false}
                      bezier
                      withVerticalLabels={false}
                      withHorizontalLabels={false}
                      withOuterLines={false}
                      onDataPointClick={({ value, data, color, index }) => {
                        // Use requestAnimationFrame to ensure UI updates have the highest priority
                        requestAnimationFrame(() => {
                          // tactile feedback
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );

                          // Update UI related status immediately
                          _selectPointData[1](_sourceData[0][index]);
                          _selectIndex[1](index);

                          // Use InteractionManager to ensure calculations don't block the UI
                          InteractionManager.runAfterInteractions(() => {
                            calcPointPrice(index);
                          });
                        });
                      }}
                      yAxisInterval={1}
                      chartConfig={{
                        fillShadowGradientFrom: "#fff",
                        fillShadowGradientToOpacity: 0,
                        backgroundGradientFrom: "#fff",
                        fillShadowGradientOpacity: 0,
                        useShadowColorFromDataset: false,
                        backgroundGradientFromOpacity: 0,
                        backgroundGradientToOpacity: 0,
                        backgroundGradientTo: "#fff",
                        decimalPlaces: 2,
                        color: () => `rgb(80,168.63)`,
                      }}
                      style={{ marginTop: 20, marginLeft: -32 }}
                    />

                    <View
                      onLayout={(event) => {
                        const nextHeight = Math.ceil(
                          event?.nativeEvent?.layout?.height || 0,
                        );
                        if (nextHeight > 0) setRangeBarHeight(nextHeight);
                      }}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-around",
                        backgroundColor: isDarkMode ? "#4B4642" : "#DEDEE1",
                        padding: 2,
                        borderRadius: 8,
                        marginTop: "0%",
                        width: "90%",
                        marginHorizontal: "5%",
                      }}
                    >
                      <View
                        style={{
                          backgroundColor:
                            selectDate[0] === "30m"
                              ? activeBackgroundColor
                              : inactiveBackgroundColor,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          flex: 1,
                          marginRight: 5,
                        }}
                      >
                        <Pressable onPress={() => changeDate("30m")}>
                          <Text
                            style={{ textAlign: "center", color: textColor }}
                          >
                            1D
                          </Text>
                        </Pressable>
                      </View>
                      <View
                        style={{
                          backgroundColor:
                            selectDate[0] === "1H"
                              ? activeBackgroundColor
                              : inactiveBackgroundColor,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          flex: 1,
                          marginRight: 5,
                        }}
                      >
                        <Pressable onPress={() => changeDate("1H")}>
                          <Text
                            style={{ textAlign: "center", color: textColor }}
                          >
                            1W
                          </Text>
                        </Pressable>
                      </View>
                      <View
                        style={{
                          backgroundColor:
                            selectDate[0] === "1D"
                              ? activeBackgroundColor
                              : inactiveBackgroundColor,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          flex: 1,
                          marginRight: 5,
                        }}
                      >
                        <Pressable onPress={() => changeDate("1D")}>
                          <Text
                            style={{ textAlign: "center", color: textColor }}
                          >
                            1M
                          </Text>
                        </Pressable>
                      </View>
                      <View
                        style={{
                          backgroundColor:
                            selectDate[0] === "1W"
                              ? activeBackgroundColor
                              : inactiveBackgroundColor,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          flex: 1,
                        }}
                      >
                        <Pressable onPress={() => changeDate("1W")}>
                          <Text
                            style={{ textAlign: "center", color: textColor }}
                          >
                            1Y
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
