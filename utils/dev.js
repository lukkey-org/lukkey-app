/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  FlatList,
  Dimensions,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
const ICON_SIZE = 50;

import {
  accountAPI,
  metricsAPII,
  galleryAPI,
  meridianAPI,
  chartAPI,
  firmwareAPI,
  signAPI,
} from "../env/apiEndpoints";

export const FloatingDev = {
  api: {
    getMonitorApiList: async () => {
      try {
        const defaultApis = [
          ...Object.entries(accountAPI).map(([name, url]) => ({
            name,
            url,
            totalCount: 0,
          })),
          ...Object.entries(metricsAPII).map(([name, url]) => ({
            name,
            url,
            totalCount: 0,
          })),
          ...Object.entries(galleryAPI).map(([name, url]) => ({
            name,
            url,
            totalCount: 0,
          })),
          ...Object.entries(meridianAPI).map(([name, url]) => ({
            name,
            url,
            totalCount: 0,
          })),
          ...Object.entries(chartAPI).map(([name, url]) => ({
            name,
            url,
            totalCount: 0,
          })),
          ...Object.entries(firmwareAPI).map(([name, url]) => ({
            name,
            url,
            totalCount: 0,
          })),
          ...Object.entries(signAPI).map(([name, url]) => ({
            name,
            url,
            totalCount: 0,
          })),
        ];

        const currentData = await AsyncStorage.getItem("apiMonitorStats");
        const storedApis = currentData ? JSON.parse(currentData) : [];

        const mergedApisMap = new Map();
        defaultApis.forEach((api) => mergedApisMap.set(api.url, api));
        storedApis.forEach((api) => mergedApisMap.set(api.url, api));

        return Array.from(mergedApisMap.values());
      } catch (error) {
        console.error("Failed to get monitor API list:", error);
        return [];
      }
    },
    addRecord: async (record) => {
      try {
        const currentData = await AsyncStorage.getItem("apiData");
        const apiData = currentData ? JSON.parse(currentData) : [];
        apiData.push(record);
        await AsyncStorage.setItem("apiData", JSON.stringify(apiData));
      } catch (error) {
        console.error("Failed to save API record:", error);
      }
    },
    removeOneRecord: async (timestamp) => {
      try {
        const currentData = await AsyncStorage.getItem("apiData");
        const apiData = currentData ? JSON.parse(currentData) : [];
        const apiDataFilter = apiData.filter(
          (item) => item.timestamp !== timestamp
        );
        await AsyncStorage.setItem("apiData", JSON.stringify(apiDataFilter));
      } catch (error) {
        console.error("Failed to remove API record:", error);
      }
    },
    removeRecord: async (name) => {
      try {
        const currentData = await AsyncStorage.getItem("apiData");
        const apiData = currentData ? JSON.parse(currentData) : [];
        apiData.filter((item) => item.name !== name);
        await AsyncStorage.setItem("apiData", JSON.stringify(apiData));
      } catch (error) {
        console.error("Failed to remove API record:", error);
      }
    },
  },
};

export default React.memo(function FloatingWindow() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPanEnabled, setPanelPanEnabled] = useState(true);
  const [address, setAddress] = useState("");
  const screen = Dimensions.get("window");

  const [showFetchErrorLog, setShowFetchErrorLog] = useState(
    typeof global !== "undefined" &&
      typeof global.__SHOW_FETCH_ERROR_LOG__ !== "undefined"
      ? global.__SHOW_FETCH_ERROR_LOG__
      : false
  );

  useEffect(() => {
    if (typeof global !== "undefined") {
      global.__SHOW_FETCH_ERROR_LOG__ = showFetchErrorLog;
    }
  }, [showFetchErrorLog]);

  const [mainTab, setMainTab] = useState(0);
  const [apiSubTab, setApiSubTab] = useState(0);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [recordList, setRecordList] = useState([]);
  const [bleLogList, setBleLogList] = useState([]);
  const [bleSearchQuery, setBleSearchQuery] = useState("");
  const [bleSearchScope, setBleSearchScope] = useState("all");
  const [apiMonitorStatsList, setApiMonitorStatsList] = useState([]);

  const iconX = useRef(
    new Animated.Value(screen.width - ICON_SIZE - 20)
  ).current;
  const iconY = useRef(
    new Animated.Value(screen.height - ICON_SIZE - 100)
  ).current;

  const startX = useRef(0);
  const startY = useRef(0);
  const panOffsetX = useRef(0);
  const panOffsetY = useRef(0);

  const lastPosition = useRef({
    x: screen.width - ICON_SIZE - 20,
    y: screen.height - ICON_SIZE - 100,
  });

  const slideAnim = useRef(new Animated.Value(1000)).current;

  const filteredBleLogList = useMemo(() => {
    const query = bleSearchQuery.trim().toLowerCase();
    return bleLogList.filter((item) => {
      const direction = (item.direction || "").toLowerCase();
      if (bleSearchScope !== "all" && direction !== bleSearchScope) {
        return false;
      }
      if (!query) {
        return true;
      }
      const searchable = [
        item.text,
        item.op,
        item.deviceId,
        item.serviceUUID,
        item.characteristicUUID,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [bleLogList, bleSearchQuery, bleSearchScope]);

  const panelY = useRef(new Animated.Value(screen.height / 2)).current;
  const panelStartY = useRef(0);
  const panelPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, gestureState) => {
        return panelPanEnabled && Math.abs(gestureState.dy) > 5;
      },
      onStartShouldSetPanResponder: () => panelPanEnabled,
      onPanResponderGrant: (e, gestureState) => {
        panelStartY.current = panelY.__getValue();
        panelY.stopAnimation();
      },
      onPanResponderMove: (e, gestureState) => {
        let newY = panelStartY.current + gestureState.dy;
        newY = Math.max(0, Math.min(newY, screen.height - 200));
        panelY.setValue(newY);
      },
      onPanResponderRelease: (e, gestureState) => {
        let newY = panelStartY.current + gestureState.dy;
        newY = Math.max(0, Math.min(newY, screen.height - 200));
        panelY.setValue(newY);
      },
      onPanResponderTerminate: (e, gestureState) => {
        let newY = panelStartY.current + gestureState.dy;
        newY = Math.max(0, Math.min(newY, screen.height - 200));
        panelY.setValue(newY);
      },
    })
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (e, gestureState) => {
        startX.current = iconX.__getValue();
        startY.current = iconY.__getValue();
        panOffsetX.current = gestureState.dx;
        panOffsetY.current = gestureState.dy;
        iconX.stopAnimation();
        iconY.stopAnimation();
      },

      onPanResponderMove: (e, gestureState) => {
        const newX = startX.current + gestureState.dx - panOffsetX.current;
        const newY = startY.current + gestureState.dy - panOffsetY.current;

        const boundedX = Math.max(0, Math.min(newX, screen.width - ICON_SIZE));
        const boundedY = Math.max(
          0,
          Math.min(newY, screen.height - ICON_SIZE - 100)
        );

        iconX.setValue(boundedX);
        iconY.setValue(boundedY);
      },

      onPanResponderRelease: (e, gestureState) => {
        const newX = startX.current + gestureState.dx - panOffsetX.current;
        const newY = startY.current + gestureState.dy - panOffsetY.current;

        const boundedX = Math.max(0, Math.min(newX, screen.width - ICON_SIZE));
        const boundedY = Math.max(
          0,
          Math.min(newY, screen.height - ICON_SIZE - 100)
        );

        lastPosition.current = { x: boundedX, y: boundedY };

        const distance = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        if (distance < 5) {
          togglePanel();
        }
      },

      onPanResponderTerminate: (e, gestureState) => {
        const newX = startX.current + gestureState.dx - panOffsetX.current;
        const newY = startY.current + gestureState.dy - panOffsetY.current;

        const boundedX = Math.max(0, Math.min(newX, screen.width - ICON_SIZE));
        const boundedY = Math.max(
          0,
          Math.min(newY, screen.height - ICON_SIZE - 100)
        );

        lastPosition.current = { x: boundedX, y: boundedY };
      },
    })
  ).current;

  const togglePanel = () => {
    setIsOpen((prev) => {
      const next = !prev;
      Animated.spring(slideAnim, {
        toValue: next ? 0 : 1000,
        useNativeDriver: true,
        bounciness: 3,
        speed: 5,
      }).start();
      return next;
    });
  };

  const addApiToMonitor = async () => {
    if (!name || !url) {
      if (typeof global.__SHOW_APP_TOAST__ === "function") {
        global.__SHOW_APP_TOAST__({
          message: "Please provide valid API details.",
          variant: "cancel",
          durationMs: 2200,
          showCountdown: true,
        });
      }
      setName("");
      setUrl("");
      return;
    }

    const newMonitorStats = { name, url, totalCount: 0 };
    await AsyncStorage.setItem(
      "apiMonitorStats",
      JSON.stringify([...apiMonitorStatsList, newMonitorStats])
    );
    setApiMonitorStatsList([...apiMonitorStatsList, newMonitorStats]);
    setAddress(`${name} is now being monitored.`);
    console.log(`${name} is now being monitored.`);
  };

  const loadData = async () => {
    try {
      const recentData = await AsyncStorage.getItem("apiData");
      if (showFetchErrorLog) {
        console.log("Recent Data:", recentData);
      }
      const apiData = recentData
        ? JSON.parse(recentData).reverse().slice(0, 30)
        : [];
      setRecordList(apiData);

      const statsData = await AsyncStorage.getItem("apiMonitorStats");
      const apiStats = statsData ? JSON.parse(statsData) : [];
      setApiMonitorStatsList(apiStats);
      updateApiMonitorStats(apiStats, apiData);

      const bleData = await AsyncStorage.getItem("bleCommLog");
      const bleLogs = bleData ? JSON.parse(bleData).slice().reverse() : [];
      setBleLogList(bleLogs);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const removeApiFromMonitor = async (name) => {
    const updatedStats = apiMonitorStatsList.filter(
      (monitor) => monitor.name !== name
    );
    await AsyncStorage.setItem("apiMonitorStats", JSON.stringify(updatedStats));
    setApiMonitorStatsList(updatedStats);
    setAddress(`${name} has been removed from monitoring.`);
  };

  const updateApiMonitorStats = (monitorStats, records) => {
    const updatedStats = monitorStats.map((monitor) => {
      let totalCount = 0;
      let lastUsedTime = "";
      let lastResponse = "";
      records.forEach((record) => {
        if (record.url.includes(monitor.url)) {
          totalCount++;
          lastUsedTime = record.time;
          lastResponse = record.response;
          monitor.lastStatus = record.status;
        }
      });
      return {
        ...monitor,
        totalCount,
        lastUsedTime,
        lastResponse,
      };
    });
    AsyncStorage.setItem("apiMonitorStats", JSON.stringify(updatedStats));
    setApiMonitorStatsList(updatedStats);
  };

  const recordItem = ({ item }) => {
    return (
      <View
        style={[
          styles.recordItem,
          {
            flexDirection: "row",
            justifyContent: "space-between",
            height: 300,
            alignItems: "flex-start",
            padding: 20,
            borderRadius: 16,
            borderColor: "#E5E5EA",
            backgroundColor: "#F2F2F7",
          },
        ]}
      >
        <View style={{ maxWidth: "90%" }}>
          <Text style={styles.recordItemTitle}>Time: {item.time}</Text>
          <Text
            style={[styles.recordItemText, { overflow: "hidden" }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            URL: {item.url.replace("https://", "")}
          </Text>

          <Text style={styles.recordItemText}>API Name: {item.name}</Text>
          <Text style={styles.recordItemText}>Method: {item.method}</Text>
          <Text style={styles.recordItemText}>Status: {item.status}</Text>
          <Text
            style={[
              styles.recordItemText,
              {
                maxHeight: 100,
                overflow: "scroll",
                fontSize: 11,
                backgroundColor: "#fff",
                borderRadius: 8,
                padding: 8,
                color: "#3C3C43",
                marginTop: 6,
              },
            ]}
          >
            Response: {item.response}
          </Text>
          <Pressable
            style={{
              backgroundColor: "#007AFF",
              paddingVertical: 6,
              paddingHorizontal: 16,
              width: "100%",
              height: 36,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
              marginVertical: 8,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
            onPress={() => {
              setMainTab(0);
              setApiSubTab(2);
              setName(item.name);
              setUrl(item.url);
            }}
          >
            <Text
              style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
              numberOfLines={1}
            >
              + Add Monitor
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={{
            marginLeft: 8,
            padding: 4,
            borderRadius: 8,
            backgroundColor: "#fff",
            alignSelf: "flex-start",
          }}
          onPress={() => {
            FloatingDev.api.removeOneRecord(item.timestamp);
            setTimeout(() => {
              loadData();
            }, 100);
          }}
        >
          <Text style={{ color: "#FF5252", fontSize: 18 }}>❌</Text>
        </Pressable>
      </View>
    );
  };

  const bleRecordItem = ({ item }) => {
    return (
      <View
        style={[
          styles.recordItem,
          {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: 16,
            borderRadius: 12,
            borderColor: "#E5E5EA",
            backgroundColor: "#F2F2F7",
          },
        ]}
      >
        <View style={{ maxWidth: "90%" }}>
          <Text style={styles.recordItemTitle}>
            [{item.direction}] {item.op} • {item.time}
          </Text>
          {!!item.deviceId && (
            <Text style={styles.recordItemText}>Device: {item.deviceId}</Text>
          )}
          {!!item.serviceUUID && (
            <Text style={styles.recordItemText} numberOfLines={1}>
              Service: {item.serviceUUID}
            </Text>
          )}
          {!!item.characteristicUUID && (
            <Text style={styles.recordItemText} numberOfLines={1}>
              Char: {item.characteristicUUID}
            </Text>
          )}
          {!!item.size && (
            <Text style={styles.recordItemText}>Size: {item.size} bytes</Text>
          )}
          {!!item.text && (
            <Text
              style={[
                styles.recordItemText,
                {
                  maxHeight: 100,
                  overflow: "scroll",
                  fontSize: 11,
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  padding: 8,
                  color: "#3C3C43",
                  marginTop: 6,
                },
              ]}
            >
              {item.text}
            </Text>
          )}
        </View>
        <Pressable
          style={{
            marginLeft: 8,
            padding: 4,
            borderRadius: 8,
            backgroundColor: "#fff",
            alignSelf: "flex-start",
          }}
          onPress={async () => {
            try {
              const stored = await AsyncStorage.getItem("bleCommLog");
              const list = stored ? JSON.parse(stored) : [];
              const next = list.filter((x) => x.id !== item.id);
              await AsyncStorage.setItem("bleCommLog", JSON.stringify(next));
              setTimeout(() => loadData(), 100);
            } catch (e) {}
          }}
        >
          <Text style={{ color: "#FF5252", fontSize: 18 }}>❌</Text>
        </Pressable>
      </View>
    );
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, mainTab]);

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.floatingIcon, { left: iconX, top: iconY }]}
      >
        <MaterialCommunityIcons
          name={isOpen ? "close" : "menu"}
          size={22}
          color="#fff"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateY: Animated.add(slideAnim, panelY) }],
          },
        ]}
      >
        <View {...panelPanResponder.panHandlers}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, mainTab === 0 && styles.activeTab]}
              onPress={() => setMainTab(0)}
            >
              <Text style={styles.tabButtonText}>API</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, mainTab === 1 && styles.activeTab]}
              onPress={() => setMainTab(1)}
            >
              <Text style={styles.tabButtonText}>BLE Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton]}
              onPress={() => {
                if (
                  typeof global !== "undefined" &&
                  typeof global.__SHOW_APP_TOAST__ === "function"
                ) {
                  global.__SHOW_APP_TOAST__();
                } else {
                  setAddress("Dev toast is not registered or the app is not in development mode");
                }
              }}
            >
              <Text style={styles.tabButtonText}>Toast</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton]}
              onPress={() => loadData()}
            >
              <Text style={styles.tabButtonText}>🔄</Text>
            </TouchableOpacity>
          </View>

          {mainTab === 0 && (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 12,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    fontWeight: "600",
                    fontSize: 15,
                    color: "#1C1C1E",
                    marginRight: 12,
                  }}
                >
                  Fetch error logs
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: showFetchErrorLog ? "#34C759" : "#FF5252",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 7,
                    marginRight: 12,
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                  onPress={() => setShowFetchErrorLog((v) => !v)}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                  >
                    {showFetchErrorLog ? "On" : "Off"}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: "#8E8E93", fontSize: 12 }}>
                  {showFetchErrorLog
                    ? "Print fetch error logs"
                    : "Do not print fetch error logs"}
                </Text>
              </View>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    apiSubTab === 0 && styles.activeTab,
                  ]}
                  onPress={() => setApiSubTab(0)}
                >
                  <Text style={styles.tabButtonText}>Recent API</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    apiSubTab === 1 && styles.activeTab,
                  ]}
                  onPress={() => setApiSubTab(1)}
                >
                  <Text style={styles.tabButtonText}>API Stats</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    apiSubTab === 2 && styles.activeTab,
                  ]}
                  onPress={() => setApiSubTab(2)}
                >
                  <Text style={styles.tabButtonText}>Add API</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: "#FF5252",
                    marginBottom: 12,
                    borderRadius: 12,
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 1,
                  },
                ]}
                onPress={async () => {
                  try {
                    await AsyncStorage.removeItem("ActivityLog");
                    const afterClear = await AsyncStorage.getItem(
                      "ActivityLog"
                    );
                    setAddress(
                      "ActivityLog cleared. Current content: " + (afterClear || "null")
                    );
                    console.log("ActivityLog has been cleared, current content:", afterClear);
                  } catch (e) {
                    setAddress("Failed to clear ActivityLog");
                    console.warn("Failed to clear ActivityLog", e);
                  }
                }}
              >
                <Text style={[styles.buttonText, { fontWeight: "600" }]}>
                  Clear ActivityLog
                </Text>
              </TouchableOpacity>
            </>
          )}

          {mainTab === 1 && (
            <>
              <View style={styles.bleSearchWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Search BLE logs"
                  placeholderTextColor="#8E8E93"
                  value={bleSearchQuery}
                  onChangeText={setBleSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                <View style={styles.searchScopeContainer}>
                  {[
                    { key: "all", label: "All" },
                    { key: "tx", label: "App TX" },
                    { key: "rx", label: "Device TX" },
                  ].map((option) => {
                    const selected = bleSearchScope === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.searchScopeOption,
                          selected && styles.searchScopeOptionActive,
                        ]}
                        onPress={() => setBleSearchScope(option.key)}
                      >
                        <View style={styles.radioOuter}>
                          {selected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.searchScopeLabel}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: "#5856D6",
                    marginBottom: 12,
                    borderRadius: 12,
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 1,
                  },
                ]}
                onPress={async () => {
                  try {
                    await AsyncStorage.removeItem("bleCommLog");
                    const afterClear = await AsyncStorage.getItem("bleCommLog");
                    setAddress(
                      "BLE Log cleared. Current content: " + (afterClear || "null")
                    );
                    console.log("BLE Log has been cleared, current content:", afterClear);
                    setTimeout(() => loadData(), 100);
                  } catch (e) {
                    setAddress("Failed to clear BLE Log");
                    console.warn("Failed to clear BLE Log", e);
                  }
                }}
              >
                <Text style={[styles.buttonText, { fontWeight: "600" }]}>
                  Clear All Log
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {mainTab === 0 && apiSubTab === 0 && (
          <>
            <Text style={{ paddingBottom: 10 }}>
              Calls Count: {recordList.length}, Time:{" "}
              {new Date().toLocaleString()}
            </Text>
            <FlatList
              getItemLayout={(_, index) => ({
                length: 300,
                offset: 300 * index,
                index,
              })}
              initialNumToRender={30}
              maxToRenderPerBatch={30}
              keyExtractor={(item) => item.timestamp}
              extraData={recordList}
              ListFooterComponent={
                <Text style={{ textAlign: "center", marginVertical: 10 }}>
                  Max 30 records
                </Text>
              }
              style={{ maxHeight: 300 }}
              data={recordList}
              renderItem={recordItem}
              onTouchStart={() => setPanelPanEnabled(false)}
              onScrollBeginDrag={() => setPanelPanEnabled(false)}
              onTouchEnd={() => setPanelPanEnabled(true)}
              onScrollEndDrag={() => setPanelPanEnabled(true)}
            />
          </>
        )}
        {mainTab === 0 && apiSubTab === 1 && (
          <View style={styles.tableContainer}>
            {apiMonitorStatsList.map((item, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: "#fff",
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#E5E5EA",
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginVertical: 6,
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <View style={{ maxWidth: "90%" }}>
                  <Text style={styles.tableHeaderText}>API:{item.name}</Text>
                  <Text style={styles.tableHeaderText} numberOfLines={1}>
                    URL:{item.url}
                  </Text>
                  <Text style={{ ...styles.tableHeaderText }}>
                    Call Count:{item.totalCount}
                  </Text>
                  <Text style={{}}>Last Request:{item.lastUsedTime}</Text>
                  <Text>Last Status:{item.lastStatus}</Text>
                </View>
                <Pressable
                  style={{
                    marginLeft: 8,
                    padding: 4,
                    borderRadius: 8,
                    backgroundColor: "#fff",
                    alignSelf: "flex-start",
                  }}
                  onPress={() => {
                    removeApiFromMonitor(item.name);
                  }}
                >
                  <Text style={{ color: "#FF5252", fontSize: 18 }}>❌</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {mainTab === 0 && apiSubTab === 2 && (
          <View style={styles.addApiContainer}>
            <TextInput
              style={styles.input}
              placeholder="API Name"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="API URL (short-link regex)"
              value={url}
              onChangeText={setUrl}
            />
            {/* Regex matching: the full API URL is expected to include this short pattern */}
            <TouchableOpacity style={styles.button} onPress={addApiToMonitor}>
              <Text style={styles.buttonText}>Add API to Monitor</Text>
            </TouchableOpacity>

            <Text style={styles.address}>{address}</Text>
          </View>
        )}
        {mainTab === 1 && (
          <>
            <Text style={{ paddingBottom: 10 }}>
              BLE Records: {filteredBleLogList.length} / {bleLogList.length},
              Time: {new Date().toLocaleString()}
            </Text>
            <FlatList
              keyExtractor={(item) => item.id}
              data={filteredBleLogList}
              renderItem={bleRecordItem}
              initialNumToRender={30}
              maxToRenderPerBatch={30}
              style={{ maxHeight: 300 }}
              onTouchStart={() => setPanelPanEnabled(false)}
              onScrollBeginDrag={() => setPanelPanEnabled(false)}
              onTouchEnd={() => setPanelPanEnabled(true)}
              onScrollEndDrag={() => setPanelPanEnabled(true)}
              ListFooterComponent={
                <Text style={{ textAlign: "center", marginVertical: 10 }}>
                  Max 300 records
                </Text>
              }
            />
          </>
        )}
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  address: {
    color: "#007AFF", // iOS primary color
    fontSize: 17, // iOS body text
    marginTop: 12,
    fontWeight: "500",
  },
  floatingIcon: {
    backgroundColor: "#007AFF", // iOS primary color
    borderRadius: ICON_SIZE / 2,
    position: "absolute",
    height: ICON_SIZE,
    width: ICON_SIZE,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 1000,
  },
  iconText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  panel: {
    position: "absolute",
    width: Dimensions.get("screen").width - 32,
    left: 16,
    right: 16,
    minHeight: 220,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 999,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    paddingHorizontal: 4,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#007AFF",
    backgroundColor: "#F2F2F7",
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  recordItem: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  recordItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  recordItemText: {
    fontSize: 13,
    color: "#3C3C43",
    marginTop: 4,
  },
  tableContainer: {
    marginTop: 8,
    maxHeight: 300,
    overflow: "scroll",
  },
  tableHeaderText: {
    flex: 1,
    fontWeight: "600",
    fontSize: 14,
    color: "#1C1C1E",
  },
  addApiContainer: {
    flex: 1,
    paddingTop: 8,
  },
  input: {
    height: 44,
    borderColor: "#C7C7CC",
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    paddingLeft: 16,
    fontSize: 17,
    backgroundColor: "#fff",
    color: "#1C1C1E",
  },
  bleSearchWrapper: {
    marginBottom: 12,
  },
  searchScopeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  searchScopeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: "#F2F2F7",
  },
  searchScopeOptionActive: {
    backgroundColor: "#E0E0F8",
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#5856D6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5856D6",
  },
  searchScopeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
