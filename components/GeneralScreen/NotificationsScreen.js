/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// components/GeneralScreen/NotificationsScreen.js
import React, { useMemo, useContext, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import Clipboard from "@react-native-clipboard/clipboard";
import { useNavigation } from "@react-navigation/native";
import { DeviceContext, DarkModeContext } from "../../utils/DeviceContext";

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

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { notifications, clearNotifications, markNotificationRead } =
    useContext(DeviceContext);
  const { isDarkMode } = useContext(DarkModeContext);

  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  const data = useMemo(() => {
    // new to old
    return [...(notifications || [])].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
  }, [notifications]);

  // Reprint the Language stack header: only the title and hidden shadow; remove the trash can button on the right; synchronize dark and light colors
  useEffect(() => {
    navigation.setOptions({
      title: t("Notifications"),
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: isDarkMode ? "#21201E" : "#FFFFFF",
      },
      headerTitleStyle: {
        color: isDarkMode ? "#FFFFFF" : "#333333",
        fontWeight: "bold",
      },
      headerTintColor: isDarkMode ? "#FFFFFF" : "#333333",
      headerRight: undefined,
    });
  }, [navigation, t, isDarkMode]);

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

  const renderIcon = (status) => {
    if (status === "success")
      return <Icon name="check-circle" size={22} color="#22c55e" />;
    if (status === "fail")
      return <Icon name="error" size={22} color="#ef4444" />;
    if (status === "timeout")
      return <Icon name="schedule" size={22} color="#f59e0b" />;
    return (
      <Icon
        name="notifications"
        size={22}
        color={isDarkMode ? "#ddd" : "#666"}
      />
    );
    // pending/others
  };

  const statusTitle = (item) => {
    if (item.status === "success") return t("Transaction Successful");
    if (item.status === "fail") return t("Transaction Failed");
    if (item.status === "timeout") return t("Pending Timeout");
    return t("Notification");
  };

  const Item = ({ item }) => {
    // Direction inference: item.direction is used first, and the default transaction type is sent.
    const direction =
      item.direction || (item.type === "transaction" ? "sent" : undefined);

    // Title color depends on status
    const color =
      item.status === "success"
        ? "#22c55e"
        : item.status === "fail"
        ? "#ef4444"
        : item.status === "timeout"
        ? "#f59e0b"
        : isDarkMode
        ? "#ddd"
        : "#666";

    // Localized titles and action words
    const isZh = (i18n?.language || "").toLowerCase().startsWith("zh");
    const titleText =
      direction === "received"
        ? isZh
          ? "Receive"
          : "Received"
        : direction === "sent"
        ? isZh
          ? "Send"
          : "Sent"
        : statusTitle(item);

    const dirWord =
      direction === "received"
        ? isZh
          ? "Received"
          : "received"
        : direction === "sent"
        ? isZh
          ? "Sent"
          : "sent"
        : "";

    // The second line of copy (wallet/account/address + action + amount or message)
    const wallet = item.walletName || item.wallet || item.chain || "";
    const account = item.accountName || item.account || "";
    const addr = item.address ? truncateMiddle(item.address, 6, 4) : "";
    const amountStr = item.amount
      ? `${item.amount} ${item.symbol || item.queryChainShortName || ""}`
      : "";
    const subline = `${wallet}${account ? ` / ${account}` : ""}${
      addr ? ` ${addr}` : ""
    }${dirWord ? ` ${dirWord}` : ""}${
      amountStr ? ` ${amountStr}` : item.message ? ` ${item.message}` : ""
    }`.trim();

    // Relative time (<1min, X minutes/minutes, about X hours/hours)
    const timeLabel = (() => {
      const ts = item.timestamp || Date.now();
      const diff = Math.max(0, Date.now() - ts);
      if (diff < 60 * 1000) {
        return isZh ? "less than a minute ago" : "less than a minute ago";
      }
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) {
        return isZh ? `${minutes} minutes ago` : `${minutes} minutes ago`;
      }
      const hours = Math.max(1, Math.floor(minutes / 60));
      return isZh ? `about ${hours} hours ago` : `about ${hours} hours ago`;
    })();

    // Icon: direction priority, otherwise press status
    const iconName =
      direction === "received"
        ? "arrow-downward"
        : direction === "sent"
        ? "arrow-upward"
        : item.status === "success"
        ? "check-circle"
        : item.status === "fail"
        ? "error"
        : item.status === "timeout"
        ? "schedule"
        : "notifications";
    const iconClr =
      item.status === "success"
        ? "#22c55e"
        : item.status === "fail"
        ? "#ef4444"
        : direction === "received" || direction === "sent"
        ? isDarkMode
          ? "#ddd"
          : "#666"
        : color;

    const circleStyle = (() => {
      if (item.status === "success") {
        return {
          backgroundColor: "rgba(34, 197, 94, 0.14)",
          borderColor: "rgba(34, 197, 94, 0.8)",
          borderWidth: 1,
        };
      }
      if (item.status === "fail") {
        return {
          backgroundColor: "rgba(239, 68, 68, 0.14)",
          borderColor: "rgba(239, 68, 68, 0.8)",
          borderWidth: 1,
        };
      }
      return {
        backgroundColor: isDarkMode
          ? "rgba(255, 255, 255, 0.06)"
          : "rgba(0, 0, 0, 0.06)",
        borderWidth: 0,
      };
    })();

    const unread = item.read !== true;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => {
          try {
            if (markNotificationRead && item.id) {
              markNotificationRead(item.id);
            }
          } catch (e) {}
          navigation.navigate("NotificationDetail", { notification: item });
        }}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <View style={[styles.iconCircle, circleStyle]} />
              <Icon name={iconName} size={22} color={iconClr} />
              {unread ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={[styles.title, { color }]} numberOfLines={1}>
              {titleText}
            </Text>
          </View>
        </View>

        {!!subline && (
          <Text style={styles.subline} numberOfLines={2}>
            {subline}
          </Text>
        )}

        <Text style={styles.timeText}>{timeLabel}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {data.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon
            name="notifications-off"
            size={40}
            color={isDarkMode ? "#777" : "#bbb"}
          />
          <Text style={styles.emptyText}>{t("No notifications yet")}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) =>
            item.id || String(item.timestamp) || Math.random().toString(16)
          }
          renderItem={Item}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function getStyles(isDark) {
  const bg = isDark ? "#21201E" : "#FFFFFF"; // match header colors (Language stack style)
  const card = isDark ? "#1e1e1e" : "#ffffff";
  const text = isDark ? "#eaeaea" : "#222";
  const sub = isDark ? "#bdbdbd" : "#666";
  const border = isDark ? "#2a2a2a" : "#eee";
  const btn = isDark ? "#CCB68C" : "#CFAB95";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    topBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    screenTitle: { fontSize: 18, fontWeight: "600", color: text },
    clearBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: btn,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    clearBtnText: { color: "#fff", fontWeight: "600" },
    listContent: { padding: 12, paddingBottom: 24 },
    card: {
      //   backgroundColor: card,

      padding: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: border,
      borderBottomColor: border,
      marginBottom: 0,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconWrap: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    iconCircle: {
      position: "absolute",
      top: 0,
      left: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    unreadDot: {
      position: "absolute",
      top: -2,
      left: -2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#ef4444",
    },
    title: { fontSize: 16, fontWeight: "600" },
    timeText: { fontSize: 12, color: sub },
    message: { fontSize: 14, color: text, marginTop: 2 },
    subline: { fontSize: 14, color: sub, marginTop: 2 },
    metaRow: {
      marginTop: 8,
      flexDirection: "row",
      gap: 16,
    },
    metaCol: { flex: 1 },
    metaLabel: { fontSize: 12, color: sub },
    metaValue: { fontSize: 13, color: text, marginTop: 2 },
    copyRow: { marginTop: 10 },
    copyBox: {
      marginTop: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: isDark ? "#111" : "#fafafa",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    copyText: { flex: 1, color: text },
    iconBtn: { padding: 4 },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    emptyText: { color: sub },
  });
}
