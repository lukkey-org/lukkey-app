/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useContext, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Clipboard from "@react-native-clipboard/clipboard";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { ActivityScreenStylesRoot } from "../styles/styles";
import { DarkModeContext } from "../utils/DeviceContext";
import { areAddressesEquivalent } from "../config/networkUtils";

const LogDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { isDarkMode } = useContext(DarkModeContext);
  const ActivityScreenStyle = ActivityScreenStylesRoot(isDarkMode);
  const transaction = route.params?.transaction || null;
  const [expandedFields, setExpandedFields] = React.useState({});

  useEffect(() => {
    if (!transaction) {
      navigation.goBack();
    }
  }, [transaction, navigation]);

  if (!transaction) return null;

  const txTime = new Date(Number(transaction.transactionTime));
  const iso = Number.isFinite(txTime.getTime()) ? txTime.toISOString() : null;
  const confirmedAtText = iso
    ? `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`
    : "-";
  const fromAddress =
    transaction.fromAddress ||
    transaction.from_address ||
    transaction.from ||
    transaction.sender ||
    "";
  const toAddress =
    transaction.toAddress ||
    transaction.to_address ||
    transaction.to ||
    transaction.recipient ||
    "";
  const txTypeLc = String(transaction.transactionType || "")
    .trim()
    .toLowerCase();
  const hasTxType = txTypeLc === "send" || txTypeLc === "receive";
  const txChain = String(
    transaction?.chain ||
      (typeof transaction?.chainKey === "string"
        ? transaction.chainKey.split(":")[0]
        : ""),
  )
    .trim()
    .toLowerCase();
  const isReceiveTx = hasTxType
    ? txTypeLc === "receive"
    : areAddressesEquivalent(txChain, transaction.address, fromAddress);

  const handleCopy = async (value) => {
    if (!value) return;
    await Clipboard.setString(String(value));
    if (typeof global.__SHOW_APP_TOAST__ === "function") {
      global.__SHOW_APP_TOAST__({
        message: t("Copied to clipboard"),
        variant: "success",
        durationMs: 1800,
        showCountdown: true,
      });
    }
  };

  const truncateMiddle = (value, maxChars) => {
    const str = String(value || "");
    if (!str) return "-";
    if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
    if (str.length <= maxChars) return str;
    if (maxChars <= 6) return str.slice(0, maxChars);
    const remaining = maxChars - 6;
    const head = Math.max(1, Math.floor(remaining / 2));
    const tail = Math.max(1, remaining - head);
    return `${str.slice(0, head)}......${str.slice(-tail)}`;
  };

  const toggleExpand = (key) => {
    setExpandedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const baseBg = StyleSheet.flatten(ActivityScreenStyle?.bgContainer || {});
  const screenBg =
    baseBg?.backgroundColor || (isDarkMode ? "#121212" : "#F2F2F7");

  const CopyLine = ({ label, value, expandKey }) => {
    const [rowWidth, setRowWidth] = React.useState(0);
    const [labelWidth, setLabelWidth] = React.useState(0);
    const isExpanded = !!expandedFields[expandKey];
    const baseTextStyle = StyleSheet.flatten(
      ActivityScreenStyle.historyItemText
    );
    const fontSize = Number(baseTextStyle?.fontSize) || 16;
    const approxCharWidth = fontSize * 0.6;
    const availableWidth = Math.max(0, rowWidth - labelWidth);
    const maxChars = Math.floor(availableWidth / approxCharWidth);
    const displayValue = isExpanded
      ? value || "-"
      : truncateMiddle(value, maxChars);
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onLayout={(event) => {
            setRowWidth(event.nativeEvent.layout.width);
          }}
          onPress={() => toggleExpand(expandKey)}
        >
          <Text
            style={[
              ActivityScreenStyle.historyItemText,
              { lineHeight: 24, textAlign: "left" },
            ]}
            numberOfLines={isExpanded ? undefined : 1}
          >
            <Text
              style={{ fontWeight: "bold" }}
              onLayout={(event) => {
                setLabelWidth(event.nativeEvent.layout.width);
              }}
            >{`${label}: `}</Text>
            <Text>{displayValue}</Text>
          </Text>
        </Pressable>
        <TouchableOpacity
          onPress={() => handleCopy(value)}
          style={{ padding: 6 }}
          disabled={!value}
        >
          <MaterialIcons
            name="content-copy"
            size={18}
            color={value ? "#666" : "#aaa"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: screenBg }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          accessibilityRole="button"
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={22}
            color={isDarkMode ? "#fff" : "#111"}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              width: "100%",
            }}
          >
            <Text
              style={[
                ActivityScreenStyle.historyItemText,
                { fontSize: 16, fontWeight: "bold", textAlign: "left" },
              ]}
            >
              {isReceiveTx ? t("Receive") : t("Send")}
              {"  "}
              <Text
                style={{
                  color:
                    transaction.state.toLowerCase() === "success"
                      ? "#47B480"
                      : "#D2464B",
                  fontWeight: "normal",
                }}
              >
                {transaction.state}
              </Text>
            </Text>
            <Text
              style={[
                ActivityScreenStyle.historyItemText,
                {
                  fontSize: 16,
                  fontWeight: "bold",
                  textAlign: "right",
                  flexShrink: 1,
                },
              ]}
            >
              {isReceiveTx ? `${transaction.amount}` : `-${transaction.amount}`}{" "}
              {transaction.symbol}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text
            style={[ActivityScreenStyle.historyItemText, { textAlign: "left" }]}
          >
            <Text style={{ fontWeight: "bold" }}>{`Confirmed at`}</Text>
            {"\n"}
            {confirmedAtText}
          </Text>
        </View>

        <View style={styles.section}>
          <CopyLine label={t("From")} value={fromAddress} expandKey="from" />
          <CopyLine label={t("To")} value={toAddress} expandKey="to" />
          <CopyLine
            label={t("Transaction hash")}
            value={transaction.txid}
            expandKey="txid"
          />
        </View>

        <View style={styles.section}>
          <Text
            style={[ActivityScreenStyle.historyItemText, { textAlign: "left" }]}
          >
            <Text style={{ fontWeight: "bold" }}>{`Network Fee: `}</Text>
            {transaction.txFee}
          </Text>
          <Text
            style={[ActivityScreenStyle.historyItemText, { textAlign: "left" }]}
          >
            <Text style={{ fontWeight: "bold" }}>{`Block Height: `}</Text>
            {transaction.height}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            ActivityScreenStyle.cancelButton,
            {
              borderRadius: 16,
              height: 60,
              borderColor: isDarkMode ? "#CCB68C" : "#CFAB95",
            },
          ]}
        >
          <Text style={ActivityScreenStyle.cancelButtonText}>{t("Done")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});

export default LogDetailScreen;
