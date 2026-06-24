/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// components/GeneralScreen/NotificationDetailScreen.js
import React, { useMemo, useContext, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
} from "react-native";
import { useTranslation } from "react-i18next";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import Clipboard from "@react-native-clipboard/clipboard";
import { useNavigation, useRoute } from "@react-navigation/native";
import { DarkModeContext, DeviceContext } from "../../utils/DeviceContext";
import { BlurView } from "../common/AppBlurView";
import { resolveTransactionIcons } from "../../utils/transactionIconLookup";

function truncateMiddle(str = "", head = 6, tail = 6) {
  if (!str || str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}

function formatTs(ts) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

function formatAmount(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") {
    // keep up to 8 decimals similar to common crypto display
    return (Math.abs(val) < 1 ? val.toFixed(8) : val.toFixed(6))
      .replace(/0+$/, "")
      .replace(/\.$/, "");
  }
  return String(val);
}

export default function NotificationDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { isDarkMode } = useContext(DarkModeContext);
  const { initialAdditionalCryptos } = useContext(DeviceContext);

  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  // The notification object fields should be as compatible as possible: { status, timestamp, chain, amount, fiatValue, unit, address, from, to, txHash, fee, feeFiat, explorerUrl, message, ... }
  const item = route?.params?.notification || {};

  // Common fields and compatible aliases
  const fromAddress = item.from || item.fromAddress || item.sender;
  const toAddress = item.to || item.toAddress || item.recipient;
  const receivedByAddress = item.address || item.receivedBy;
  const blockHeight =
    item.blockHeight ??
    item.block_height ??
    item.height ??
    item.blockNumber ??
    item.block_number;
  const nonce = item.nonce ?? item.sequence ?? item.txIndex ?? item.tx_index;
  const feeValue = item.fee ?? item.networkFee ?? item.gasFee ?? item.feeAmount;
  const feeFiat =
    item.feeFiat ?? item.networkFeeFiat ?? item.gasFeeFiat ?? item.feeUsd;

  useEffect(() => {
    navigation.setOptions({
      title: t("Notification"),
      headerShadowVisible: false,
      headerStyle: { backgroundColor: isDarkMode ? "#21201E" : "#FFFFFF" },
      headerTitleStyle: {
        color: isDarkMode ? "#FFFFFF" : "#333333",
        fontWeight: "bold",
      },
      headerTintColor: isDarkMode ? "#FFFFFF" : "#333333",
    });
  }, [navigation, t, isDarkMode]);

  const statusColor =
    item.status === "success"
      ? "#22c55e"
      : item.status === "fail"
      ? "#ef4444"
      : item.status === "timeout"
      ? "#f59e0b"
      : isDarkMode
      ? "#ddd"
      : "#666";

  const statusText =
    item.status === "success"
      ? t("Success")
      : item.status === "fail"
      ? t("Transaction Failed")
      : item.status === "timeout"
      ? t("Pending Timeout")
      : t("Notification");

  const handleCopy = async (text, label) => {
    if (!text) return;
    try {
      await Clipboard.setString(text);
      if (typeof global.__SHOW_APP_TOAST__ === "function") {
        global.__SHOW_APP_TOAST__({
          message: t("Copied") + (label ? `: ${label}` : ""),
          variant: "success",
          durationMs: 1800,
          showCountdown: true,
        });
      }
    } catch {}
  };

  const Divider = () => <View style={styles.hr} />;

  const CopyLine = ({ value, copyLabel, externalUrl }) => {
    if (!value) return null;
    return (
      <View style={styles.copyBox}>
        <Text style={styles.copyText} numberOfLines={2}>
          {value}
        </Text>
        {externalUrl ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(externalUrl).catch(() => {})}
            style={styles.iconBtn}
          >
            <Icon
              name="open-in-new"
              size={18}
              color={isDarkMode ? "#bbb" : "#666"}
            />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => handleCopy(value, copyLabel)}
          style={styles.iconBtn}
        >
          <Icon
            name="content-copy"
            size={18}
            color={isDarkMode ? "#bbb" : "#666"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const Field = ({ label, children }) => {
    if (!children) return null;
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {children}
      </View>
    );
  };

  const Header = () => {
    const amount =
      item.amount !== undefined && item.amount !== null
        ? `${item.amount} ${item.unit || item.chain || ""}`.trim()
        : null;
    const fiat =
      item.fiatValue !== undefined && item.fiatValue !== null
        ? `$${formatAmount(item.fiatValue)}`
        : null;
    const unitText = String(
      item.unit || item.symbol || item.shortName || ""
    ).toLowerCase();
    const { cryptoIcon, chainIcon } = resolveTransactionIcons({
      cryptos: initialAdditionalCryptos,
      chain: item.chain,
      symbol: item.symbol,
      unit: item.unit,
      shortName: item.shortName,
    });
    const iconFallbackColor = isDarkMode ? "#d1d5db" : "#9ca3af";

    return (
      <View style={styles.topHeader}>
        <View style={styles.assetRow}>
          <View style={styles.assetIconWrap}>
            {cryptoIcon ? (
              <Image
                source={cryptoIcon}
                style={styles.assetIcon}
                resizeMode="contain"
              />
            ) : (
              <Icon name="help-outline" size={24} color={iconFallbackColor} />
            )}
            <View style={styles.assetChainIconWrap}>
              <BlurView style={StyleSheet.absoluteFillObject} />
              {chainIcon ? (
                <Image
                  source={chainIcon}
                  style={styles.assetChainIcon}
                  resizeMode="contain"
                />
              ) : (
                <Icon name="help-outline" size={12} color={iconFallbackColor} />
              )}
            </View>
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.assetSymbol}>
              {`${item.assetName || item.unit || item.symbol || item.shortName || item.chain || t("Assets")}`.trim()}
              {item.chain ? ` (${item.chain} chain)` : ""}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {!!amount && <Text style={styles.assetAmount}>{amount}</Text>}
          {!!fiat && <Text style={styles.assetFiat}>{fiat}</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Header />

          <Field label={t("Status")}>
            <Text style={[styles.statusValue, { color: statusColor }]}>
              {statusText}
            </Text>
          </Field>

          <Field label={t("Time")}>
            <Text style={styles.valueText}>{formatTs(item.timestamp)}</Text>
          </Field>

          <Divider />

          <Field label={t("From")}>
            <CopyLine value={fromAddress} copyLabel="from" />
            {!!item.fromLabel && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.fromLabel}</Text>
              </View>
            )}
          </Field>

          <Field label={t("To")}>
            <CopyLine value={toAddress} copyLabel="to" />
            {!!item.toLabel && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.toLabel}</Text>
              </View>
            )}
          </Field>

          <Divider />

          {/* Amount */}
          {item.amount !== undefined || item.fiatValue !== undefined ? (
            <>
              {item.amount !== undefined && (
                <Field label={t("Crypto Amount")}>
                  <Text style={styles.valueText}>
                    {`${item.amount} ${item.unit || item.chain || ""}`.trim()}
                  </Text>
                </Field>
              )}
              {item.fiatValue !== undefined && (
                <Field label={t("Fiat Amount")}>
                  <Text style={styles.valueText}>
                    {`$${formatAmount(item.fiatValue)}`}
                  </Text>
                </Field>
              )}
            </>
          ) : null}

          {/* Block info */}
          {(blockHeight !== undefined && blockHeight !== null) ||
          (nonce !== undefined && nonce !== null) ? (
            <>
              <Divider />
              {blockHeight !== undefined && blockHeight !== null && (
                <Field label={t("Block Height")}>
                  <Text style={styles.valueText}>{String(blockHeight)}</Text>
                </Field>
              )}
              {nonce !== undefined && nonce !== null && (
                <Field label={t("Nonce")}>
                  <Text style={styles.valueText}>{String(nonce)}</Text>
                </Field>
              )}
            </>
          ) : null}

          <Divider />

          <Field label={t("Transaction Hash")}>
            <CopyLine
              value={
                item.txHash ||
                item.orderId ||
                item.hash ||
                item.txid ||
                item.tx_id
              }
              copyLabel="txHash"
              externalUrl={item.explorerUrl}
            />
          </Field>

          <Divider />

          <Field label={t("Network fee")}>
            {(feeValue !== undefined || feeFiat !== undefined) && (
              <Text style={styles.valueText}>
                {feeValue !== undefined
                  ? `${formatAmount(feeValue)} ${
                      item.unit || item.chain || ""
                    }`.trim()
                  : ""}
                {feeFiat !== undefined ? ` ($${formatAmount(feeFiat)})` : ""}
              </Text>
            )}
          </Field>

          {!!item.message && (
            <>
              <Divider />
              <Field label={t("Reason")}>
                <Text style={styles.valueText}>{item.message}</Text>
              </Field>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(isDark) {
  const bg = isDark ? "#21201E" : "#FFFFFF";
  const card = isDark ? "#1e1e1e" : "#ffffff";
  const text = isDark ? "#eaeaea" : "#222";
  const sub = isDark ? "#bdbdbd" : "#666";
  const border = isDark ? "#2a2a2a" : "#eee";
  const tagBg = isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.15)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    scroll: { padding: 12, paddingBottom: 24 },
    card: {
      padding: 12,
    },
    // header
    topHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    assetRow: { flexDirection: "row", alignItems: "center" },
    assetIcon: { width: 42, height: 42 },
    assetIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? "#ffffff80" : "rgba(0, 0, 0, 0.05)",

      borderWidth: 1,
      borderColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
    },
    assetChainIconWrap: {
      position: "absolute",
      top: 26,
      left: 28,
      width: 16,
      height: 16,
      borderWidth: 1,
      borderColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      backgroundColor: isDark ? "#ffffff80" : "rgba(0, 0, 0, 0.05)",
      overflow: "hidden",
    },
    assetChainIcon: { width: 14, height: 14 },
    assetSymbol: { fontSize: 16, fontWeight: "700", color: text },
    assetName: { fontSize: 12, color: sub, marginTop: 2 },
    assetAmount: { fontSize: 16, fontWeight: "600", color: text },
    assetFiat: { fontSize: 12, color: sub, marginTop: 2 },

    // fields
    field: { marginTop: 12 },
    label: { fontSize: 12, color: sub, marginBottom: 6 },
    valueText: { fontSize: 14, color: text },
    statusValue: { fontSize: 14, fontWeight: "600" },

    copyBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: isDark ? "#111" : "#fafafa",
    },
    copyText: { flex: 1, color: text },
    iconBtn: { padding: 4 },

    tag: {
      alignSelf: "flex-start",
      marginTop: 8,
      backgroundColor: tagBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    tagText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },

    hr: {
      height: 1,
      backgroundColor: border,
      marginTop: 14,
    },
  });
}
