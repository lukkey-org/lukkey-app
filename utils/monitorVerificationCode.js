/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { isBleDisconnectError } from "./bleErrors";
import { setSecureItem } from "./secureStorage";
import { bleCmd, parseResp } from "./bleProtocol";
import {
  getPubkeyStorageId,
  getStoredPubkey,
  setStoredPubkey,
} from "./pubkeyStorage";
import { isBchCashAddr, isBchLegacyAddress } from "../config/networkUtils";
import { RUNTIME_DEV } from "./runtimeFlags";
import { getDeviceAuthKey } from "./deviceAuth";
import { DEVICE_RESPONSES } from "./deviceProtocolConstants";

const accountNameLogCache = new Map();
const pubkeyLogCache = new Map();
const pubkeyStatusLogCache = new Map();
const syncLogDedupCache = new Map();
const SYNC_VERBOSE_TRANSPORT = false;
const ANSI_COLORS = {
  reset: "\u001b[0m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  cyan: "\u001b[36m",
};

const serializeSyncPayload = (payload) => {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const colorizeSyncLog = (text, color) => {
  const prefix = ANSI_COLORS[color];
  if (!prefix) return text;
  return `${prefix}${text}${ANSI_COLORS.reset}`;
};

const shouldSkipSyncLog = (key, ttlMs = 1500) => {
  if (!key) return false;
  const now = Date.now();
  const last = syncLogDedupCache.get(key) || 0;
  if (now - last < ttlMs) return true;
  syncLogDedupCache.set(key, now);
  return false;
};

const emitSyncLog = ({
  tag,
  message = "",
  payload,
  level = "log",
  color = null,
  dedupeKey = null,
  dedupeMs = 1500,
}) => {
  if (shouldSkipSyncLog(dedupeKey, dedupeMs)) return;
  const segments = [`[${tag}]`];
  if (message) segments.push(message);
  const serialized = serializeSyncPayload(payload);
  if (serialized) segments.push(serialized);
  const line = colorizeSyncLog(segments.join(" "), color);
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
};

function createMonitorVerificationCode({
  serviceUUID,
  notifyCharacteristicUUID,
  writeCharacteristicUUID,
  prefixToShortName,
  expectedAddressShortNames,
  updateCryptoAddress,
  setReceivedAddresses,
  setVerificationStatus,
  setAccountName,
  setAccountId,
  setMissingChainsForModal,
  parseDeviceCode,
  setReceivedVerificationCode,
  setReceivedPubKeys,
  expectedPubkeyChains,
  setVerifiedDevices,
  setIsVerificationSuccessful,
  Buffer,
  replaceVerifiedDevices,
  bleManagerRef,
  onSyncTimeoutReset,
  monitorSubscriptionRef,
  // 可选：设备端密码界面取消时的回调（设备返回 {"resp":"pwdCancel"}）
  onPwdCancel,
  onBtcPubkeySynced,
}) {
  let monitorSubscription = null;
  const REQUEST_TIMEOUT_MS = 12000;
  const BLE_ACTIVITY_GRACE_MS = 4000;
  const MAX_REQUEST_TOTAL_LIFETIME_MS = 30000;
  const pendingRequests = new Map();
  let syncTimeoutFired = false;
  let lastBleActivityAt = 0;
  let activeDevice = null;
  let lastDeviceSecureId = null;
  let lastAccountIdFromPin = null;
  let expectedAddressShortNamesSet = null;
  let disconnectSubscription = null;
  let suppressDisconnectError = false;
  let syncCompleted = false;
  let syncFinishScheduled = false;
  let currentMonitorSessionId = 0;
  let receivedAddressesSnapshot = {};
  let receivedPubkeyChains = new Set();
  let expectedPubkeyChainsSet = null;
  let pubkeysAllLogged = false;
  let pubkeysFinalLogged = false;
  let rxBuffer = "";
  let rxAccountNameBuffer = "";
  let rxAddressBuffer = "";
  let rxPubkeyBuffer = "";
  let pendingAddress = null;
  let addrStatusTimer = null;
  let lastAddrStatusSignature = "";
  let addrStatusFinalLogged = false;
  let accountNameSaved = false;
  let accountNamePending = null;
  let accountNameLogged = false;
  let lastAccountNameLogged = null;

  const persistAccountIdFromPin = async (candidate) => {
    const id = String(candidate || "").trim();
    if (!id) return;
    lastAccountIdFromPin = id;
    try {
      setAccountId?.(id);
    } catch {}
    try {
      await setSecureItem("accountId", id, ["currentAccountId"]);
    } catch (e) {
      console.log("[PIN_RX] persist accountId failed:", e?.message || e);
    }
  };
  let walletReadyScheduled = false;
  let walletReadyLogged = false;
  let btcPubkeysRefreshDone = false;
  let lastAddressStatusLines = null;
  let loggedPubkeyChains = new Set();
  let finalAddressSummaryLogged = false;
  let syncTimeoutDisabled = false;
  let pinHandled = false;
  let currentTxId = null;
  const SYNC_DEBUG = false;
  let lastProgressPercent = -1;
  const logSyncProgress = (label = "SYNC") => {
    try {
      const addrTotal = getExpectedAddressShortNames().length || 0;
      const pubTotal = expectedPubkeyChainsSet
        ? expectedPubkeyChainsSet.size
        : 0;
      const total = addrTotal + pubTotal + 1;
      const addrDone = receivedAddressesSnapshot
        ? Object.keys(receivedAddressesSnapshot).length
        : 0;
      const pubDone = receivedPubkeyChains ? receivedPubkeyChains.size : 0;
      const nameDone = accountNameSaved ? 1 : 0;
      const done = addrDone + pubDone + nameDone;
      const percent =
        total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      const step = 10;
      const rounded = Math.floor(percent / step) * step;
      if (rounded === lastProgressPercent) return;
      lastProgressPercent = rounded;
      const barLen = 20;
      const filled = Math.round((rounded / 100) * barLen);
      const bar = `${"#".repeat(filled)}${"-".repeat(barLen - filled)}`;
      emitSyncLog({
        tag: label,
        message: `${rounded}% [${bar}] (${done}/${total})`,
        color: "cyan",
        dedupeKey: `progress:${label}:${rounded}:${done}:${total}`,
        dedupeMs: 1000,
      });
    } catch {}
  };
  const parseAccountIdFromPinLine = (line) => {
    try {
      const raw = String(line || "").trim();
      if (!raw.startsWith("PIN:")) return null;
      const parts = raw
        .substring(4)
        .split(",")
        .map((s) => s.trim());
      const flag = parts[1];
      if (flag !== "Y") return null;
      for (let i = 2; i < parts.length; i += 1) {
        const token = parts[i];
        if (!token) continue;
        if (/^(HW:|BT:)/i.test(token)) continue;
        return token;
      }
      return null;
    } catch {
      return null;
    }
  };

  const isCurrentSession = (sessionId) => sessionId === currentMonitorSessionId;

  const checkReadyFromSnapshots = (device) => {
    try {
      const expectedAddresses = getExpectedAddressShortNames();
      const addrReady =
        expectedAddresses.length > 0 &&
        expectedAddresses.every(
          (shortName) => !!receivedAddressesSnapshot?.[shortName],
        );
      const expectedPubkeys = expectedPubkeyChainsSet
        ? Array.from(expectedPubkeyChainsSet)
        : [];
      const pubReady =
        expectedPubkeys.length > 0 &&
        expectedPubkeys.every((k) => receivedPubkeyChains?.has?.(k));
      if (addrReady && pubReady) {
        addressesReady = true;
        pubkeysReady = true;
        tryScheduleWalletReady(device);
        checkAndFinish(device);
      }
    } catch {}
  };

  const normalizeExpectedAddressShortNames = (list) => {
    const arr = Array.isArray(list) ? list : [];
    const normalized = arr
      .map((s) =>
        String(s || "")
          .trim()
          .toUpperCase(),
      )
      .filter((s) => s.length > 0);
    return new Set(normalized);
  };

  const getExpectedAddressShortNames = () => {
    if (expectedAddressShortNamesSet && expectedAddressShortNamesSet.size > 0) {
      return Array.from(expectedAddressShortNamesSet);
    }
    const fallback = Object.values(prefixToShortName || {}).map((s) =>
      String(s || "")
        .trim()
        .toUpperCase(),
    );
    return Array.from(new Set(fallback.filter(Boolean)));
  };

  const buildAddressStatusLines = (receivedMap) => {
    const lines = [];
    const expected = getExpectedAddressShortNames();
    for (const shortName of expected) {
      const addr = receivedMap?.[shortName];
      const ok = typeof addr === "string" && addr.trim().length > 0;
      const mark = ok ? "✅" : "❌";
      lines.push(`${mark} ${shortName}: ${ok ? addr : "-"}`);
    }
    return lines;
  };

  const isValidAddressByChain = (shortName, address) => {
    const addr = String(address || "").trim();
    if (!addr) return false;
    const evm = /^(0x)?[0-9a-fA-F]{40}$/;
    const evmStrict = /^0x[0-9a-fA-F]{40}$/;
    const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
    switch (shortName) {
      case "ETH":
      case "OP":
      case "ETC":
      case "ARB":
      case "BNB":
      case "AURORA":
      case "AVAX":
      case "FTM":
      case "HTX":
      case "IOTX":
      case "OKT":
      case "POL":
      case "ZKSYNC":
      case "GNO":
      case "LINEA":
      case "RON":
      case "CRO":
        return evmStrict.test(addr);
      case "APT":
      case "SUI":
        return /^0x[0-9a-fA-F]{64}$/.test(addr);
      case "TRX":
        return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
      case "BTC":
        return (
          (addr.startsWith("1") ||
            addr.startsWith("3") ||
            addr.startsWith("bc1")) &&
          addr.length >= 26
        );
      case "BCH":
        return isBchCashAddr(addr) || isBchLegacyAddress(addr);
      case "DOGE":
        return (
          (addr.startsWith("D") || addr.startsWith("A")) && addr.length >= 26
        );
      case "LTC":
        return (
          (addr.startsWith("L") ||
            addr.startsWith("M") ||
            addr.startsWith("3") ||
            addr.startsWith("ltc1")) &&
          addr.length >= 26
        );
      case "XRP":
        return addr.startsWith("r") && addr.length >= 25;
      case "SOL":
        return base58.test(addr) && addr.length >= 32;
      case "ATOM":
        return addr.startsWith("cosmos1") && addr.length >= 15;
      case "CEL":
        return addr.startsWith("celestia1") && addr.length >= 15;
      case "JUNO":
        return addr.startsWith("juno1") && addr.length >= 15;
      case "OSMO":
        return addr.startsWith("osmo1") && addr.length >= 15;
      case "CELO":
        return evmStrict.test(addr);
      default:
        return addr.length >= 10;
    }
  };

  const scheduleAddressStatusLog = (
    receivedMap,
    { finalOnly = false } = {},
  ) => {
    if (finalOnly && addrStatusFinalLogged) return;
    const signature = JSON.stringify(
      Object.keys(receivedMap || {})
        .sort()
        .map((k) => [k, receivedMap[k]]),
    );
    if (signature === lastAddrStatusSignature) return;
    lastAddrStatusSignature = signature;
    if (addrStatusTimer) clearTimeout(addrStatusTimer);
    addrStatusTimer = setTimeout(() => {
      const lines = buildAddressStatusLines(receivedMap);
      if (lines.length === 0) return;
      if (finalOnly) addrStatusFinalLogged = true;
    }, 300);
  };

  const buildPubkeyStatusLines = (receivedMap) => {
    const lines = [];
    const expected = expectedPubkeyChainsSet
      ? Array.from(expectedPubkeyChainsSet)
      : [];
    if (expected.length === 0) return lines;
    for (const chainKey of expected) {
      const pubkey = receivedMap?.[chainKey];
      const ok = typeof pubkey === "string" && pubkey.trim().length > 0;
      const mark = ok ? "✅" : "❌";
      lines.push(`${mark} ${chainKey.toUpperCase()}`);
    }
    return lines;
  };

  const buildFinalAddressSummaryLines = (receivedMap) => {
    const expected = getExpectedAddressShortNames();
    const receivedKeys = Object.keys(receivedMap || {});
    const orderedKeys = Array.from(
      new Set([
        ...expected,
        ...receivedKeys.sort((a, b) => String(a).localeCompare(String(b))),
      ]),
    );
    return orderedKeys.reduce((acc, shortName) => {
      const address = String(receivedMap?.[shortName] || "").trim();
      if (!address) return acc;
      acc.push(`${shortName}: ${address}`);
      return acc;
    }, []);
  };

  const logFinalAddressSummary = (receivedMap) => {
    if (finalAddressSummaryLogged) return;
    const lines = buildFinalAddressSummaryLines(receivedMap);
    const count = lines.length;
    if (count === 0) return;
    const summaryText = lines.join("\n");
    finalAddressSummaryLogged = true;
    if (shouldSkipSyncLog(`sync_summary:${summaryText}`, 10000)) return;
    console.log(
      colorizeSyncLog(
        `[SYNC_SUMMARY] addresses (${count})\n${summaryText}`,
        "green",
      ),
    );
  };

  const clearPendingRequestTimer = (entry) => {
    if (entry?.timerId) clearTimeout(entry.timerId);
  };

  const armPendingRequestTimeout = (key, entryOverrides = null) => {
    const k = String(key || "");
    if (!k) return;
    const now = Date.now();
    const existing = pendingRequests.get(k);
    const entry = entryOverrides || existing || {};
    const firstPendingAt = entry.firstPendingAt || now;
    const lastMarkedAt = entry.lastMarkedAt || now;
    clearPendingRequestTimer(existing);
    const timerId = setTimeout(() => {
      const current = pendingRequests.get(k);
      if (!current) return;
      const totalElapsed = Date.now() - current.firstPendingAt;
      const attemptElapsed = Date.now() - current.lastMarkedAt;
      if (totalElapsed >= MAX_REQUEST_TOTAL_LIFETIME_MS) {
        if (SYNC_DEBUG) {
          console.log("[PENDING] max total lifetime reached:", k, {
            attemptElapsed,
            totalElapsed,
            pending: Array.from(pendingRequests.keys()),
          });
        }
        handleSyncTimeout(`request_timeout:${k}`);
        return;
      }
      const msSinceActivity = lastBleActivityAt
        ? Date.now() - lastBleActivityAt
        : Number.POSITIVE_INFINITY;
      if (msSinceActivity <= BLE_ACTIVITY_GRACE_MS) {
        if (SYNC_DEBUG) {
          console.log("[PENDING] extend after recent BLE activity:", k, {
            attemptElapsed,
            msSinceActivity,
            totalElapsed,
          });
        }
        armPendingRequestTimeout(k);
        return;
      }
      if (SYNC_DEBUG) {
        console.log(
          "[PENDING] timeout fired:",
          k,
          "pending:",
          Array.from(pendingRequests.keys()),
        );
      }
      handleSyncTimeout(`request_timeout:${k}`);
    }, REQUEST_TIMEOUT_MS);
    pendingRequests.set(k, {
      firstPendingAt,
      lastMarkedAt,
      timerId,
    });
  };

  const markRequestPending = (key) => {
    if (!key) return;
    if (syncTimeoutDisabled || walletReadyLogged || walletReadyScheduled) {
      if (SYNC_DEBUG) {
        console.log("[PENDING] ignore mark after walletReady:", String(key));
      }
      return;
    }
    const k = String(key);
    if (SYNC_DEBUG) console.log("[PENDING] mark:", k);
    const now = Date.now();
    const existing = pendingRequests.get(k);
    armPendingRequestTimeout(k, {
      firstPendingAt: existing?.firstPendingAt || now,
      lastMarkedAt: now,
    });
    logSyncProgress("SYNC");
  };

  const resolvePendingRequest = (key) => {
    if (!key) return;
    const k = String(key);
    const entry = pendingRequests.get(k);
    if (k.startsWith("pubkey:") && entry) {
      const totalElapsed = Date.now() - (entry.firstPendingAt || Date.now());
      const attemptElapsed = Date.now() - (entry.lastMarkedAt || Date.now());
      if (SYNC_VERBOSE_TRANSPORT) {
        emitSyncLog({
          tag: "PUBKEY_RX",
          payload: {
            requestKey: k.replace(/^pubkey:/, ""),
            attemptElapsed,
            totalElapsed,
          },
          dedupeKey: `pubkey_rx:${k}:${attemptElapsed}:${totalElapsed}`,
          dedupeMs: 250,
        });
      }
    }
    clearPendingRequestTimer(entry);
    pendingRequests.delete(k);
    if (SYNC_DEBUG) {
      console.log(
        "[PENDING] resolve:",
        k,
        "remaining:",
        Array.from(pendingRequests.keys()),
      );
    }
    logSyncProgress("SYNC");
  };

  const clearPendingRequests = () => {
    if (SYNC_DEBUG && pendingRequests.size > 0) {
      console.log("[PENDING] clear all:", Array.from(pendingRequests.keys()));
    }
    for (const entry of pendingRequests.values()) {
      clearPendingRequestTimer(entry);
    }
    pendingRequests.clear();
  };

  let addressesReady = false;
  let pubkeysReady = false;
  let idSaved = false;
  let statusSaved = false;
  let disconnectedOnce = false;

  const tryScheduleWalletReady = (device) => {
    if (!addressesReady || !pubkeysReady) return;
    if (walletReadyScheduled) return;
    const sessionId = currentMonitorSessionId;
    walletReadyScheduled = true;
    setTimeout(async () => {
      if (!isCurrentSession(sessionId)) {
        if (SYNC_DEBUG) {
          emitSyncLog({
            tag: "WALLET_READY",
            message: "stale session ignored:",
            payload: {
              deviceId: device?.id || "unknown",
              sessionId,
              currentMonitorSessionId,
            },
          });
        }
        return;
      }
      syncTimeoutDisabled = true;
      clearPendingRequests();
      setVerificationStatus("walletReady");
      if (!walletReadyLogged) {
        walletReadyLogged = true;
        const expectedCount = getExpectedAddressShortNames().length;
        const receivedCount = lastAddressStatusLines?.length || expectedCount;
        emitSyncLog({
          tag: "WALLET_READY",
          message: `addresses+pubkeys synced (${receivedCount}/${expectedCount})`,
          payload: {
            deviceId: device?.id || "unknown",
          },
          color: "green",
          dedupeKey: `wallet_ready:${device?.id || "unknown"}`,
          dedupeMs: 10000,
        });
      }
      if (lastAddressStatusLines?.length) {
        scheduleAddressStatusLog(
          lastAddressStatusLines.reduce((acc, line) => {
            const match = line.match(/^\S+\s+(\S+):\s(.+)$/);
            if (match) acc[match[1]] = match[2] === "-" ? "" : match[2];
            return acc;
          }, {}),
          { finalOnly: true },
        );
      }

      try {
        if (!pubkeysFinalLogged) {
          const expected = expectedPubkeyChainsSet
            ? Array.from(expectedPubkeyChainsSet)
            : [];
          if (expected.length > 0) {
            for (const k of expected) {
              try {
                await getStoredPubkey(k);
              } catch {}
            }
            pubkeysFinalLogged = true;
          }
        }
      } catch {}

      if (!btcPubkeysRefreshDone) {
        try {
          await onBtcPubkeySynced?.();
        } catch (e) {
          console.log("BTC pubkey sync callback failed:", e?.message || e);
        } finally {
          btcPubkeysRefreshDone = true;
        }
      }

      try {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;

        if (accountNamePending) {
          try {
            await AsyncStorage.setItem("accountName", accountNamePending);
            try {
              setAccountName?.(accountNamePending);
            } catch {}
          } catch (e) {
            console.log("Error saving accountName after walletReady:", e);
          }
        }

        try {
          if (typeof setVerifiedDevices === "function") {
            setVerifiedDevices((prev) => {
              if (replaceVerifiedDevices) return [device.id];
              const arr = Array.isArray(prev) ? [...prev] : [];
              if (!arr.includes(device.id)) arr.push(device.id);
              return arr;
            });
          }
          try {
            const toPersist = lastAccountIdFromPin || lastDeviceSecureId;
            if (toPersist) {
              await setSecureItem("accountId", String(toPersist), [
                "currentAccountId",
              ]);
              try {
                setAccountId?.(String(toPersist));
              } catch {}
            }
          } catch (e) {
            console.log("Error saving accountId after walletReady:", e);
          }
          const saved = await AsyncStorage.getItem("verifiedDevices");
          let list = [];
          try {
            list = saved ? JSON.parse(saved) : [];
            if (!Array.isArray(list)) list = [];
          } catch {
            list = [];
          }
          if (replaceVerifiedDevices) {
            list = [device.id];
            await AsyncStorage.setItem("verifiedDevices", JSON.stringify(list));
          } else if (!list.includes(device.id)) {
            list.push(device.id);
            await AsyncStorage.setItem("verifiedDevices", JSON.stringify(list));
          }
          emitSyncLog({
            tag: "WALLET_PERSIST",
            message: `saved device data account=${accountNamePending || "-"} accountId=${lastAccountIdFromPin || lastDeviceSecureId || "-"}`,
            payload: {
              deviceId: device?.id || "unknown",
            },
            color: "cyan",
            dedupeKey: `wallet_persist:${device?.id || "unknown"}`,
            dedupeMs: 10000,
          });
        } catch (e) {
          console.log("Error persisting verifiedDevices:", e);
        }

        try {
          setIsVerificationSuccessful?.(true);
        } catch {}
      } catch (e) {
        console.log("Error in post-walletReady persist:", e);
      } finally {
        try {
          checkAndFinish(device);
        } catch {}
      }
    }, 200);
  };

  function checkAndFinish(device) {
    try {
      if (disconnectedOnce) return;
      if (syncFinishScheduled) return;
      if (addressesReady && pubkeysReady && idSaved && statusSaved) {
        syncCompleted = true;
        syncFinishScheduled = true;
        setTimeout(async () => {
          if (disconnectedOnce) return;
          try {
            logFinalAddressSummary(receivedAddressesSnapshot);
            try {
              suppressDisconnectError = true;
              clearPendingRequests();
              const Platform = require("react-native").Platform;
              if (monitorSubscription) {
                try {
                  if (Platform?.OS === "android") {
                  } else {
                    monitorSubscription.remove?.();
                  }
                } catch (ee) {
                  console.log(
                    "[SYNC_DONE] unsubscribe error (ignored):",
                    ee?.message || ee,
                  );
                } finally {
                  monitorSubscription = null;
                }
              }
              try {
                if (
                  monitorSubscriptionRef &&
                  typeof monitorSubscriptionRef === "object"
                ) {
                  if (Platform?.OS === "android") {
                  } else {
                    monitorSubscriptionRef.current?.remove?.();
                  }
                  monitorSubscriptionRef.current = null;
                }
              } catch {}
              try {
                disconnectSubscription?.remove?.();
              } catch {}
              disconnectSubscription = null;
              clearPendingRequests();
              await new Promise((r) => setTimeout(r, 30));
            } catch {}

            const isConnected = await device.isConnected?.();
            if (isConnected) {
              await device.cancelConnection();
              emitSyncLog({
                tag: "SYNC_DONE",
                message: `all addresses/pubkeys/id/status persisted, disconnected: ${device.id}`,
                color: "green",
                dedupeKey: `sync_done:${device?.id || "unknown"}`,
                dedupeMs: 10000,
              });
            } else {
              emitSyncLog({
                tag: "SYNC_DONE",
                message: `device already disconnected: ${device.id}`,
                color: "yellow",
                level: "warn",
                dedupeKey: `sync_done:${device?.id || "unknown"}`,
                dedupeMs: 10000,
              });
            }
          } catch (e) {
            console.log(
              "[SYNC_DONE] disconnect error (ignored):",
              e?.message || e,
            );
          } finally {
            disconnectedOnce = true;
          }
        }, 800);
      }
    } catch (e) {}
  }

  function monitorVerificationCode(device, sendparseDeviceCodeedValue) {
    const sessionId = ++currentMonitorSessionId;
    clearPendingRequests();
    syncTimeoutFired = false;
    suppressDisconnectError = false;
    syncCompleted = false;
    syncTimeoutDisabled = false;
    disconnectedOnce = false;
    syncFinishScheduled = false;
    lastAccountIdFromPin = null;
    lastProgressPercent = -1;
    walletReadyScheduled = false;
    walletReadyLogged = false;
    btcPubkeysRefreshDone = false;
    addressesReady = false;
    pubkeysReady = false;
    idSaved = false;
    statusSaved = false;
    lastAddressStatusLines = null;
    addrStatusFinalLogged = false;
    lastAddrStatusSignature = "";
    finalAddressSummaryLogged = false;
    if (addrStatusTimer) {
      clearTimeout(addrStatusTimer);
      addrStatusTimer = null;
    }
    receivedAddressesSnapshot = {};
    activeDevice = device;
    markBleActivity();
    if (monitorSubscription) {
      try {
        const Platform = require("react-native").Platform;
        if (Platform?.OS === "android") {
        } else {
          monitorSubscription.remove();
        }
      } catch (e) {
        console.log("monitorSubscription.remove ignored:", e?.message || e);
      } finally {
        monitorSubscription = null;
        try {
          if (
            monitorSubscriptionRef &&
            typeof monitorSubscriptionRef === "object"
          ) {
            monitorSubscriptionRef.current = null;
          }
        } catch {}
      }
    }

    try {
      disconnectSubscription?.remove?.();
    } catch {}
    try {
      disconnectSubscription = device.onDisconnected?.((error, dev) => {
        if (!isCurrentSession(sessionId)) return;
        if (
          disconnectedOnce ||
          suppressDisconnectError ||
          syncCompleted ||
          syncTimeoutDisabled ||
          walletReadyLogged
        )
          return;
        if (pendingRequests.size > 0) {
          if (addressesReady && pubkeysReady) {
            console.log(
              "[SYNC_DISCONNECT] ignored after walletReady:",
              dev?.id || device?.id || "unknown",
              error?.message || error,
            );
            return;
          }
          console.log(
            "[SYNC_DISCONNECT] device disconnected during sync:",
            dev?.id || device?.id || "unknown",
            error?.message || error,
          );
          handleSyncTimeout("disconnect");
        }
      });
    } catch {}
    rxBuffer = "";
    rxAccountNameBuffer = "";
    rxPubkeyBuffer = "";
    accountNameSaved = false;
    pinHandled = false;
    accountNameLogged = false;
    lastAccountNameLogged = null;
    loggedPubkeyChains = new Set();

    if (expectedAddressShortNamesSet && expectedAddressShortNamesSet.size > 0) {
    } else if (Array.isArray(expectedAddressShortNames)) {
      expectedAddressShortNamesSet = normalizeExpectedAddressShortNames(
        expectedAddressShortNames,
      );
    } else {
      expectedAddressShortNamesSet = normalizeExpectedAddressShortNames(
        Object.values(prefixToShortName || {}),
      );
    }

    expectedPubkeyChainsSet = new Set(
      (Array.isArray(expectedPubkeyChains) && expectedPubkeyChains.length > 0
        ? expectedPubkeyChains
        : [
            "bitcoin_legacy",
            "bitcoin_nested_segwit",
            "bitcoin_native_segwit",
            "bitcoin_taproot",
            "bitcoin_cash",
            "litecoin_legacy",
            "litecoin_nested_segwit",
            "litecoin_native_segwit",
            "cosmos",
            "ripple",
            "celestia",
            // "juno", // Hidden for now
            "osmosis",
            "aptos",
          ]
      ).map((s) => String(s).toLowerCase()),
    );
    receivedPubkeyChains = new Set();
    pubkeysAllLogged = false;

    currentTxId = `mon-${device?.id || "unknown"}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    monitorSubscription = device.monitorCharacteristicForService(
      serviceUUID,
      notifyCharacteristicUUID,
      async (error, characteristic) => {
        if (!isCurrentSession(sessionId)) {
          return;
        }
        markBleActivity();
        if (error) {
          if (isBleDisconnectError(error)) {
            return;
          }
          console.log("monitorVerificationCode Error:", error.message);
          return;
        }

        const receivedData = Buffer.from(characteristic.value, "base64");
        const receivedDataString = receivedData.toString("utf8");
        if (!accountNameSaved) {
          rxAccountNameBuffer += receivedDataString;
          while (true) {
            let startIdx = rxAccountNameBuffer.indexOf('{"resp":"accountName"');
            if (startIdx === -1) {
              if (rxAccountNameBuffer.length > 512) {
                rxAccountNameBuffer = rxAccountNameBuffer.slice(-256);
              }
              break;
            }
            if (startIdx > 0) {
              rxAccountNameBuffer = rxAccountNameBuffer.slice(startIdx);
            }
            let endIdx = rxAccountNameBuffer.indexOf(
              "\r\n",
              1,
            );
            if (endIdx === -1) {
              const lfIdx = rxAccountNameBuffer.indexOf(
                "\n",
                1,
              );
              if (lfIdx !== -1) endIdx = lfIdx;
            }
            if (endIdx === -1) {
              break;
            }
            const fullLine = rxAccountNameBuffer.slice(0, endIdx);
            const parsed = parseResp(fullLine);
            const accountNameValue = parsed?.name || "";
            try {
              accountNamePending = accountNameValue;
              const accountKey = device?.id || "unknown";
              const cachedName = accountNameLogCache.get(accountKey);
              if (
                !accountNameLogged ||
                lastAccountNameLogged !== accountNameValue
              ) {
                accountNameLogged = true;
                lastAccountNameLogged = accountNameValue;
                if (cachedName !== accountNameValue) {
                  accountNameLogCache.set(accountKey, accountNameValue);
                  console.log(
                    "[ACCOUNT_NAME] captured (pending until walletReady):",
                    accountNameValue,
                    "accountId:",
                    lastAccountIdFromPin || lastDeviceSecureId || "",
                  );
                }
              }
              accountNameSaved = true;
              resolvePendingRequest("accountName");
            } catch (e) {
              console.log("Error capturing accountName:", e);
            }
            const tail = rxAccountNameBuffer.slice(endIdx, endIdx + 2);
            rxAccountNameBuffer = rxAccountNameBuffer.slice(
              endIdx + (tail === "\r\n" ? 2 : 1),
            );
            break;
          }
        }

        rxAddressBuffer += receivedDataString;
        const addrLines = [];
        while (true) {
          let endIdx = rxAddressBuffer.indexOf("\r\n");
          let sepLen = 2;
          if (endIdx === -1) {
            endIdx = rxAddressBuffer.indexOf("\n");
            sepLen = 1;
          }
          if (endIdx === -1) break;
          const line = rxAddressBuffer.slice(0, endIdx);
          rxAddressBuffer = rxAddressBuffer.slice(endIdx + sepLen);
          if (line.trim().length > 0) addrLines.push(line);
        }

        for (const rawLine of addrLines) {
          const line = String(rawLine)
            .replace(/[\x00-\x1F\x7F]/g, "")
            .trim();
          const parsed = parseResp(line);
          if (!parsed || parsed.resp !== "address" || !parsed.chain || !parsed.addr) {
            if (pendingAddress && typeof line === "string" && line.length > 0) {
              pendingAddress.value += line;
              if (
                isValidAddressByChain(
                  pendingAddress.chain,
                  pendingAddress.value,
                )
              ) {
                const queryChainShortName = pendingAddress.chain;
                const newAddress = pendingAddress.value.trim();
                pendingAddress = null;
                updateCryptoAddress(queryChainShortName, newAddress);
                resolvePendingRequest(`address:${queryChainShortName}`);
                receivedAddressesSnapshot = {
                  ...(receivedAddressesSnapshot || {}),
                  [queryChainShortName]: newAddress,
                };
              } else if (pendingAddress.value.length > 128) {
                pendingAddress = null;
              }
            }
            continue;
          }
          const chainName = parsed.chain;
          const newAddress = parsed.addr.trim();
          const queryChainShortName =
            prefixToShortName[chainName + ":"] || chainName.toUpperCase();
          const chainKey = String(queryChainShortName || "").toUpperCase();
          if (
            expectedAddressShortNamesSet &&
            expectedAddressShortNamesSet.size > 0 &&
            !expectedAddressShortNamesSet.has(chainKey)
          ) {
            continue;
          }
          if (!isValidAddressByChain(queryChainShortName, newAddress)) {
            pendingAddress = { chain: queryChainShortName, value: newAddress };
            continue;
          }
          updateCryptoAddress(queryChainShortName, newAddress);
          resolvePendingRequest(`address:${queryChainShortName}`);
          receivedAddressesSnapshot = {
            ...(receivedAddressesSnapshot || {}),
            [queryChainShortName]: newAddress,
          };
          checkReadyFromSnapshots(device);

          let nextActionType = null;
          let nextMissingChains = [];
          let nextAddressStatusLines = null;
          setReceivedAddresses((prev) => {
            const updated = { ...prev, [queryChainShortName]: newAddress };
            const expectedList = getExpectedAddressShortNames();
            const expectedCount = expectedList.length;

            nextAddressStatusLines = buildAddressStatusLines(updated);
            if (Object.keys(updated).length >= expectedCount) {
              nextActionType = "addressesReady";
              nextMissingChains = [];
            } else {
              nextMissingChains = expectedList.filter(
                (shortName) => !updated.hasOwnProperty(shortName),
              );
              nextActionType = "waiting";
            }

            return updated;
          });

          if (nextActionType === "addressesReady") {
            if (addressesReady) return;
            try {
              addressesReady = true;
              lastAddressStatusLines = nextAddressStatusLines || null;
            } catch {}
            setMissingChainsForModal?.([]);
            tryScheduleWalletReady(device);
          } else if (nextActionType === "waiting") {
            const pendingChains = nextMissingChains || [];

            setTimeout(() => {
              setVerificationStatus("waiting");
              setMissingChainsForModal?.(pendingChains);
            }, 0);
          }
        }

        rxPubkeyBuffer += receivedDataString;
        const pubkeyLines = [];
        while (true) {
          let endIdx = rxPubkeyBuffer.indexOf("\r\n");
          let sepLen = 2;
          if (endIdx === -1) {
            endIdx = rxPubkeyBuffer.indexOf("\n");
            sepLen = 1;
          }
          if (endIdx === -1) break;
          const line = rxPubkeyBuffer.slice(0, endIdx);
          rxPubkeyBuffer = rxPubkeyBuffer.slice(endIdx + sepLen);
          if (line.trim().length > 0) pubkeyLines.push(line.trim());
        }
        for (const pubkeyLine of pubkeyLines) {
          const parsed = parseResp(pubkeyLine);
          if (!parsed || parsed.resp !== "pubkey" || !parsed.chain || !parsed.key) continue;
          const queryChainName = parsed.chain;
          const publicKey = parsed.key;
          const pubkeyPath = parsed.path || "";
          const storageId = getPubkeyStorageId(queryChainName, pubkeyPath);
          if (queryChainName && publicKey && storageId) {
            if (
              RUNTIME_DEV &&
              String(queryChainName).toLowerCase() === "bitcoin" &&
              [
                "m/44'/0'/0'/0/0",
                "m/49'/0'/0'/0/0",
                "m/84'/0'/0'/0/0",
                "m/86'/0'/0'/0/0",
              ].includes(pubkeyPath)
            ) {
              console.log("[SYNC_BTC_PUBKEY]", {
                chain: queryChainName,
                path: pubkeyPath,
                storageId,
              });
            }
            if (typeof setReceivedPubKeys === "function") {
              setReceivedPubKeys((prev) => ({
                ...(prev || {}),
                [storageId]: publicKey,
              }));
            }
            const deviceKey = device?.id || "unknown";
            const chainKey = String(storageId).toLowerCase();
            resolvePendingRequest(`pubkey:${chainKey}`);
            const devicePubkeySet = pubkeyLogCache.get(deviceKey) || new Set();
            if (
              !loggedPubkeyChains.has(chainKey) &&
              !devicePubkeySet.has(chainKey)
            ) {
              loggedPubkeyChains.add(chainKey);
              devicePubkeySet.add(chainKey);
              pubkeyLogCache.set(deviceKey, devicePubkeySet);
            }
            try {
              await setStoredPubkey(queryChainName, publicKey, pubkeyPath);
            } catch (e) {
              console.log("❌ Failed to save public key:", e);
            }
            try {
              if (expectedPubkeyChainsSet?.has(chainKey)) {
                receivedPubkeyChains.add(chainKey);
              }
              checkReadyFromSnapshots(device);
              const total = expectedPubkeyChainsSet
                ? expectedPubkeyChainsSet.size
                : 0;
              const count = receivedPubkeyChains
                ? receivedPubkeyChains.size
                : 0;
              if (!pubkeysAllLogged && total > 0 && count >= total) {
                pubkeysAllLogged = true;
                const receivedMap = {};
                for (const k of receivedPubkeyChains) {
                  try {
                    const val = await getStoredPubkey(k);
                    if (val) receivedMap[k] = val;
                  } catch {}
                }
                const lines = buildPubkeyStatusLines(receivedMap);
                if (!pubkeysFinalLogged && lines.length > 0) {
                  const statusLogged = pubkeyStatusLogCache.get(deviceKey);
                  if (!statusLogged) {
                    pubkeysFinalLogged = true;
                    pubkeyStatusLogCache.set(deviceKey, true);
                  }
                }
                try {
                  pubkeysReady = true;
                } catch {}
                try {
                  tryScheduleWalletReady(device);
                  checkAndFinish(device);
                } catch {}
              }
            } catch (e) {
              console.log("Pubkey progress tracker error:", e?.message || e);
            }
          }
        }

        const authIdParsed = parseResp(receivedDataString);
        if (authIdParsed?.resp === DEVICE_RESPONSES.authId && authIdParsed?.id) {
          const encryptedHex = authIdParsed.id;
          const encryptedData = hexStringToUint32Array(encryptedHex);
          const key = getDeviceAuthKey();
          parseDeviceCode(encryptedData, key);
          const parseDeviceCodeedHex = uint32ArrayToHexString(encryptedData);
          lastDeviceSecureId = parseDeviceCodeedHex;

          try {
            await setSecureItem("deviceSecureId", String(parseDeviceCodeedHex));
            console.log(
              "[DEVICE_INFO] saved deviceSecureId (pairing identifier):",
              {
                name: device?.name || "unknown",
                id: device?.id || "unknown",
                deviceSecureId: parseDeviceCodeedHex,
              },
            );
          } catch (e) {
            console.log("Error saving deviceSecureId:", e?.message || e);
          } finally {
            try {
              idSaved = true;
            } catch {}
            try {
              checkAndFinish(device);
            } catch {}
          }

          if (sendparseDeviceCodeedValue) {
            sendparseDeviceCodeedValue(parseDeviceCodeedHex);
          }
        }

        {
          try {
            const rawHexEarly = Buffer.from(
              characteristic.value,
              "base64",
            ).toString("hex");
            const probe = (rxBuffer || "") + receivedDataString;
            let startIdxEarly = probe.indexOf("PIN:");
            if (startIdxEarly !== -1) {
              let endIdxEarly = probe.indexOf(
                "\r\n",
                startIdxEarly + "PIN:".length,
              );
              if (endIdxEarly === -1) {
                const lfIdxEarly = probe.indexOf(
                  "\n",
                  startIdxEarly + "PIN:".length,
                );
                if (lfIdxEarly !== -1) endIdxEarly = lfIdxEarly;
              }
              if (endIdxEarly !== -1) {
                const fullPinLineEarly = probe.slice(
                  startIdxEarly,
                  endIdxEarly,
                );
                const sanitizedPinLineEarly = fullPinLineEarly.replace(
                  /[\x00-\x1F\x7F]/g,
                  "",
                );
                try {
                  const parsedAccountId = parseAccountIdFromPinLine(
                    sanitizedPinLineEarly,
                  );
                  if (parsedAccountId) {
                    await persistAccountIdFromPin(parsedAccountId);
                  }
                } catch {}
                try {
                  setReceivedVerificationCode(sanitizedPinLineEarly);
                } catch {}
                try {
                  const AsyncStorage =
                    require("@react-native-async-storage/async-storage").default;
                  const hwMatch = sanitizedPinLineEarly.match(
                    /(?:^|,)\s*HW:([^,\r\n"]+)/i,
                  );
                  const btMatch = sanitizedPinLineEarly.match(
                    /(?:^|,)\s*BT:([^,\r\n"]+)/i,
                  );
                  if (hwMatch && hwMatch[1]) {
                    const hw = String(hwMatch[1]).replace(/^"|"$/g, "").trim();
                    await setSecureItem("hardwareVersion", hw);
                  }
                  if (btMatch && btMatch[1]) {
                    const bt = String(btMatch[1]).replace(/^"|"$/g, "").trim();
                    await setSecureItem("bluetoothVersion", bt);
                  }
                  const baseMatch = sanitizedPinLineEarly.match(
                    /(?:^|,)\s*BASE:([^,\r\n"]+)/i,
                  );
                  if (baseMatch && baseMatch[1]) {
                    const base = String(baseMatch[1]).replace(/^"|"$/g, "").trim();
                    await setSecureItem("baseVersion", base);
                  }
                } catch (e) {}
                pinHandled = true;
                rxBuffer = "";
                // This callback will no longer be continued to avoid subsequent write/remove causing Android BleError
                return;
              } else {
                // A complete line has not yet been formed, and the detection window is accumulated first (up to 256 characters are reserved)
                rxBuffer = probe.slice(-256);
              }
            }
          } catch (e) {
            // It is safe and does not affect the main process.
          }
        }

        // [Synchronization path D] Verification status: After receiving {"resp":"VALID"}, write the validation command back to the device for confirmation
        const respParsed = parseResp(receivedDataString);
        if (respParsed?.resp === DEVICE_RESPONSES.pwdCancelJson) {
          console.log("[BLE] received pwdCancel from device");
          if (typeof onPwdCancel === "function") {
            onPwdCancel();
          }
          suppressDisconnectError = true;
          setTimeout(async () => {
            try {
              clearPendingRequests();
              try { monitorSubscription?.remove?.(); } catch {} finally { monitorSubscription = null; }
              try {
                if (monitorSubscriptionRef && typeof monitorSubscriptionRef === "object") {
                  monitorSubscriptionRef.current?.remove?.();
                  monitorSubscriptionRef.current = null;
                }
              } catch {}
              try { disconnectSubscription?.remove?.(); } catch {}
              disconnectSubscription = null;
              const isConnected = await device?.isConnected?.();
              if (isConnected) {
                await device.cancelConnection();
                console.log("[BLE] pwdCancel: device disconnected");
              }
            } catch (e) {
              console.log("[BLE] pwdCancel disconnect error (ignored):", e?.message || e);
            } finally {
              disconnectedOnce = true;
            }
          }, 80);
          return;
        }

        if (respParsed?.resp === DEVICE_RESPONSES.closePincode) {
          console.log("[BLE] received closePincode from device");
          if (typeof onPwdCancel === "function") {
            onPwdCancel();
          }
          suppressDisconnectError = true;
          setTimeout(async () => {
            try {
              clearPendingRequests();
              try { monitorSubscription?.remove?.(); } catch {} finally { monitorSubscription = null; }
              try {
                if (monitorSubscriptionRef && typeof monitorSubscriptionRef === "object") {
                  monitorSubscriptionRef.current?.remove?.();
                  monitorSubscriptionRef.current = null;
                }
              } catch {}
              try { disconnectSubscription?.remove?.(); } catch {}
              disconnectSubscription = null;
              const isConnected = await device?.isConnected?.();
              if (isConnected) {
                await device.cancelConnection();
                console.log("[BLE] closePincode: device disconnected");
              }
            } catch (e) {
              console.log("[BLE] closePincode disconnect error (ignored):", e?.message || e);
            } finally {
              disconnectedOnce = true;
            }
          }, 80);
          return;
        }

        // [同步路径D] 验证状态：收到 {"resp":"VALID"} 后写入 validation 命令回设备确认
        const isValid = respParsed?.resp === DEVICE_RESPONSES.valid;
        if (isValid && !statusSaved) {
          try {
            setVerificationStatus("VALID");

            // Persist the device verification status and mark it as ready
            try {
              const AsyncStorage =
                require("@react-native-async-storage/async-storage").default;
              await AsyncStorage.setItem("verificationStatus", "VALID");
            } catch (e) {
              console.log("Failed to save verification status (ignorable):", e?.message || e);
            } finally {
              try {
                statusSaved = true;
              } catch {}
              try {
                checkAndFinish(device);
              } catch {}
            }

            const Platform = require("react-native").Platform;
            if (Platform?.OS === "android" && pinHandled) {
              return;
            }
            const validationMessage = bleCmd.validation() + "\r\n";
            const bufferValidationMessage = Buffer.from(
              validationMessage,
              "utf-8",
            );
            const base64ValidationMessage =
              bufferValidationMessage.toString("base64");
            try {
              await device.writeCharacteristicWithResponseForService(
                serviceUUID,
                writeCharacteristicUUID,
                base64ValidationMessage,
              );
            } catch (error) {
              console.log(
                "Error sending 'validation' (ignored):",
                error?.message || error,
              );
            }
          } catch (error) {
            console.log("Error while processing VALID:", error?.message || error);
          }
        }

        // Handle PIN packetization: only send status after receiving a complete line to avoid the previous round or half packet
        // Print high-fidelity logs (raw hex and text) at the same time to facilitate comparison of sticky packets/end-of-line exceptions
        // [Sync path E] PIN parsing: JSON format {"resp":"pin","code":1234,"hasAccount":true,"accountId":"accId","hw":"1.0","bt":"2.0","base":"3.0"}
        if (receivedDataString.includes('"resp":"pin"') || rxBuffer.includes('"resp":"pin"')) {
          rxBuffer += receivedDataString;
          // Allows attempts to extract accountId when end of line not received
          try {
            const partialParsed = parseResp(rxBuffer);
            if (partialParsed?.resp === "pin" && partialParsed.accountId) {
              const candidate = String(partialParsed.accountId).trim();
              if (candidate && candidate !== lastAccountIdFromPin) {
                await persistAccountIdFromPin(candidate);
              }
            }
          } catch {}
          while (true) {
            const startIdx = rxBuffer.indexOf('{"resp":"pin"');
            if (startIdx === -1) {
              rxBuffer = rxBuffer.slice(-256);
              break;
            }
            if (startIdx > 0) {
              rxBuffer = rxBuffer.slice(startIdx);
            }
            let endIdx = rxBuffer.indexOf("\r\n", 1);
            if (endIdx === -1) {
              const lfIdx = rxBuffer.indexOf("\n", 1);
              if (lfIdx !== -1) endIdx = lfIdx;
            }
            if (endIdx === -1) {
              break;
            }
            const fullPinLine = rxBuffer.slice(0, endIdx);
            const pinParsed = parseResp(fullPinLine);
            if (pinParsed?.resp === "pin") {
              try {
                if (pinParsed.accountId) {
                  await persistAccountIdFromPin(String(pinParsed.accountId).trim());
                }
              } catch {}
              // Constructs an old format compatible PIN row for use by the UI
              const pinCode = pinParsed.code ?? "";
              const hasAccount = pinParsed.hasAccount ? "Y" : "N";
              const accountId = pinParsed.accountId || "";
              const hwStr = pinParsed.hw ? `,HW:${pinParsed.hw}` : "";
              const btStr = pinParsed.bt ? `,BT:${pinParsed.bt}` : "";
              const baseStr = pinParsed.base ? `,BASE:${pinParsed.base}` : "";
              const compatPinLine = `PIN:${pinCode},${hasAccount},${accountId}${hwStr}${btStr}${baseStr}`;
              setReceivedVerificationCode(compatPinLine);
              try {
                if (pinParsed.hw) {
                  await setSecureItem("hardwareVersion", String(pinParsed.hw).trim());
                  console.log("Saved hardwareVersion:", pinParsed.hw);
                }
                if (pinParsed.bt) {
                  await setSecureItem("bluetoothVersion", String(pinParsed.bt).trim());
                  console.log("Saved bluetoothVersion:", pinParsed.bt);
                }
                if (pinParsed.base) {
                  await setSecureItem("baseVersion", String(pinParsed.base).trim());
                  console.log("Saved baseVersion:", pinParsed.base);
                }
              } catch (e) {
                console.log("Persist version info failed:", e?.message || e);
              }
              pinHandled = true;
              rxBuffer = "";
              break;
            }
            // Unable to parse, skip this line
            rxBuffer = rxBuffer.slice(endIdx + 2);
          }
        }
      },
      // Explicitly pass transactionId to the native side to avoid the internal default value being null
      currentTxId,
    );
  }

  // Tool function: Convert hexadecimal string to Uint32Array
  function hexStringToUint32Array(hexString) {
    return new Uint32Array([
      parseInt(hexString.slice(0, 8), 16),
      parseInt(hexString.slice(8, 16), 16),
    ]);
  }

  // Tool function: Uint32Array to hexadecimal string
  function uint32ArrayToHexString(uint32Array) {
    return (
      uint32Array[0].toString(16).toUpperCase().padStart(8, "0") +
      uint32Array[1].toString(16).toUpperCase().padStart(8, "0")
    );
  }

  // Provide an unsubscription method for external calls before disconnection
  function cancelMonitor() {
    try {
      suppressDisconnectError = true;
      clearPendingRequests();
      const Platform = require("react-native").Platform;
      if (Platform?.OS === "android") {
        // The Android platform skips remove, and the monitoring will be cleared after subsequent disconnections.
      } else {
        monitorSubscription?.remove?.();
      }
    } catch (e) {
      console.log("monitorVerificationCode.cancel ignored:", e?.message || e);
    } finally {
      monitorSubscription = null;
      try {
        if (
          monitorSubscriptionRef &&
          typeof monitorSubscriptionRef === "object"
        ) {
          monitorSubscriptionRef.current = null;
        }
      } catch {}
      try {
        disconnectSubscription?.remove?.();
      } catch {}
      disconnectSubscription = null;
    }
  }

  // Attach the cancellation method to the listening function object to facilitate external calls
  monitorVerificationCode.cancel = cancelMonitor;
  monitorVerificationCode.setExpectedAddressShortNames = (list) => {
    expectedAddressShortNamesSet = normalizeExpectedAddressShortNames(list);
  };
  // Request-response timeout: Exposed to the outside world "Register after sending request"
  monitorVerificationCode.markRequestPending = (key) => {
    markRequestPending(key);
  };

  // Return the actual listening function
  return monitorVerificationCode;

  function markBleActivity() {
    lastBleActivityAt = Date.now();
  }

  async function handleSyncTimeout(reason) {
    if (syncTimeoutDisabled || walletReadyLogged) {
      console.log("[SYNC_TIMEOUT] ignored after walletReady:", reason);
      return;
    }
    if (syncTimeoutFired) return;
    syncTimeoutFired = true;
    console.log("[SYNC_TIMEOUT] fired:", reason);
    try {
      const expectedAddresses = getExpectedAddressShortNames();
      const missingAddresses = expectedAddresses.filter(
        (shortName) => !receivedAddressesSnapshot?.[shortName],
      );
      if (missingAddresses.length > 0) {
        console.log("[SYNC_TIMEOUT] missing addresses:");
        for (const shortName of missingAddresses) {
          console.log(`❌ ${shortName}`);
        }
      }
    } catch {}
    try {
      const expectedPubkeys = expectedPubkeyChainsSet
        ? Array.from(expectedPubkeyChainsSet)
        : [];
      const missingPubkeys = expectedPubkeys.filter(
        (k) => !receivedPubkeyChains?.has?.(k),
      );
      if (missingPubkeys.length > 0) {
        console.log("[SYNC_TIMEOUT] missing pubkeys:");
        for (const k of missingPubkeys) {
          console.log(`❌ ${String(k).toUpperCase()}`);
        }
      }
    } catch {}
    // Timeout: If you have obtained the accountName, place the order directly to avoid permanent loss.
    if (accountNamePending && !accountNameSaved) {
      try {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        await AsyncStorage.setItem("accountName", accountNamePending);
        accountNameSaved = true;
      } catch (e) {
        console.log("Error saving accountName on timeout:", e?.message || e);
      }
    }
    try {
      setVerificationStatus("syncTimeout");
    } catch {}
    try {
      await onSyncTimeoutReset?.();
    } catch (e) {
      console.log("[SYNC_TIMEOUT] reset failed:", e?.message || e);
    }
    try {
      cancelMonitor();
    } catch {}
    try {
      const device = activeDevice;
      const deviceId = device?.id;
      if (device?.cancelConnection) {
        try {
          await device.cancelConnection();
        } catch {}
      }
      if (deviceId && bleManagerRef?.current?.cancelDeviceConnection) {
        try {
          await bleManagerRef.current.cancelDeviceConnection(deviceId);
        } catch {}
      }
    } catch (e) {
      console.log(
        "[SYNC_TIMEOUT] disconnect failed (ignored):",
        e?.message || e,
      );
    }
  }
}

export default createMonitorVerificationCode;
