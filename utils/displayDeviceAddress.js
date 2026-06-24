/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// displayDeviceAddress.js

import { Buffer } from "buffer";
import { Platform } from "react-native";
import assetRouteDefs, { chainMap } from "../config/assetRouteDefs";
import { bluetoothConfig } from "../env/bluetoothConfig";
import { isBleDisconnectError } from "./bleErrors";
import { getSecureItem } from "./secureStorage";
import {
  createBleTransactionId,
  safeRemoveSubscription,
} from "./bleSubscription";
import { parseResp, bleCmd } from "./bleProtocol";
import { ensureScreenUnlocked } from "./ensureScreenUnlocked";
import { normalizeBtcAddressType } from "./btcAddress";
import { normalizeLtcAddressType } from "./ltcAddress";

const serviceUUID = bluetoothConfig.serviceUUID;
const writeCharacteristicUUID = bluetoothConfig.writeCharacteristicUUID;
const notifyCharacteristicUUID = bluetoothConfig.notifyCharacteristicUUID;

let _verifyInFlight = false;

const resolveVerifyAddrFormat = (
  coinType,
  bchAddressType = "",
  btcAddressType = "",
  ltcAddressType = "",
) => {
  const chainName = chainMap[coinType] || "";
  if (chainName === "bitcoin_cash") {
    const normalizedType = String(bchAddressType || "").trim().toLowerCase();
    return normalizedType === "legacy" ? "legacy" : "cashaddr";
  }
  if (chainName === "bitcoin") {
    return normalizeBtcAddressType(btcAddressType);
  }
  if (chainName === "litecoin") {
    return normalizeLtcAddressType(ltcAddressType);
  }
  return "";
};

/**
 * Sends a command to display an address on the device and monitors its response.
 *
 * @param {object} device - The Bluetooth device.
 * @param {string} coinType - Coin type to determine the command.
 * @param {function} setIsVerifyingAddress - Updates the verifying state.
 * @param {function} setAddressVerificationMessage - Updates the verification message.
 * @param {function} t - Translation function.
 * @param {function=} setAddressModalVisible - Control address Modal display (optional)
 * @returns {Promise<object|undefined>} - The subscription object or undefined on error.
 */
const displayDeviceAddress = async (
  device,
  coinType,
  bchAddressType,
  btcAddressType,
  ltcAddressType,
  setIsVerifyingAddress,
  setAddressVerificationMessage,
  t,
  setVerificationStatus,
  setCheckStatusModalVisible,
  setAddressModalVisible,
  openCheckStatusModal
) => {
  if (_verifyInFlight) {
    console.log("[VERIFY_ADDR] already in flight, skipping duplicate call");
    return;
  }
  _verifyInFlight = true;
  try {
    console.log("[VERIFY_ADDR][DISPLAY] start", {
      ts: Date.now(),
      deviceId: device?.id || null,
      coinType,
      bchAddressType,
      btcAddressType,
      ltcAddressType,
    });
    if (typeof device !== "object" || !device.isConnected) {
      console.log("Invalid device:", device);
      return;
    }

    // Make sure the connection is established (to avoid repeated connections causing Operation was canceled)
    const ensureConnected = async () => {
      try {
        const connected = await device.isConnected?.();
        if (!connected) {
          await device.connect();
        }
        await device.discoverAllServicesAndCharacteristics();
        console.log(
          "Show address function Device connected and services discovered."
        );
      } catch (e) {
        const msg = e?.message || String(e);
        if (/cancelled/i.test(msg) || /Operation was cancelled/i.test(msg)) {
          // It may be caused by the remnants of the previous session. Please try again.
          try {
            const connected2 = await device.isConnected?.();
            if (!connected2) {
              await device.connect();
            }
            await device.discoverAllServicesAndCharacteristics();
            console.log("Reconnected after cancellation.");
          } catch (ee) {
            throw ee;
          }
        } else {
          throw e;
        }
      }
    };
    // Safe Write: Automatically verify connections, reconnect if necessary, and retry if errors are recoverable
    const safeWrite = async (base64Payload, label = "write") => {
      try {
        const connected = await device.isConnected?.();
        if (!connected) {
          await device.connect();
          await device.discoverAllServicesAndCharacteristics();
        }
      } catch (_) {}
      try {
        await device.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64Payload
        );
      } catch (e) {
        const msg = e?.message || String(e);
        console.log(`[safeWrite] ${label} failed:`, msg);
        if (
          /cancelled/i.test(msg) ||
          /operation was cancelled/i.test(msg) ||
          /not connected/i.test(msg)
        ) {
          try {
            await new Promise((r) => setTimeout(r, 120));
            const connected2 = await device.isConnected?.();
            if (!connected2) {
              await device.connect();
              await device.discoverAllServicesAndCharacteristics();
            }
            await device.writeCharacteristicWithResponseForService(
              serviceUUID,
              writeCharacteristicUUID,
              base64Payload
            );
            console.log(`[safeWrite] ${label} retry succeed.`);
          } catch (ee) {
            console.log(
              `[safeWrite] ${label} retry failed:`,
              ee?.message || ee
            );
            throw ee;
          }
        } else {
          throw e;
        }
      }
    };

    await ensureConnected();
    console.log("[VERIFY_ADDR][DISPLAY] ensureConnected:ok", {
      ts: Date.now(),
      deviceId: device?.id || null,
    });

    if (
      typeof device.writeCharacteristicWithResponseForService !== "function"
    ) {
      console.log(
        "Device does not support writeCharacteristicWithResponseForService."
      );
      return;
    }

    // Read accountId (verify command will carry this field, device side verification)
    const storedAccountId =
      (await getSecureItem("accountId", ["currentAccountId"])) ?? "";

    const expectedChainName = chainMap[coinType] || null;
    if (!expectedChainName) {
      console.log("Unsupported coin type:", coinType);
      return;
    }

    const verifyAddrFormat = resolveVerifyAddrFormat(
      coinType,
      bchAddressType,
      btcAddressType,
      ltcAddressType,
    );
    const commandString =
      bleCmd.verify(expectedChainName, storedAccountId, verifyAddrFormat) + "\r\n";
    const encodedCommand = Buffer.from(commandString, "utf-8").toString(
      "base64"
    );
    console.log("[VERIFY_ADDR][DISPLAY] command-ready", {
      ts: Date.now(),
      deviceId: device?.id || null,
      expectedChainName,
      verifyAddrFormat,
      storedAccountId,
    });

    // Screen lock check: query lock state before sending verify
    try {
      await ensureScreenUnlocked(device, { label: "VERIFY_ADDR" });
    } catch (screenErr) {
      const msg = String(screenErr?.message || screenErr);
      console.log("[VERIFY_ADDR] screen check failed:", msg);
      if (msg === "SCREEN_PWD_CANCEL" || msg === "SCREEN_CHECK_TIMEOUT") {
        if (msg === "SCREEN_PWD_CANCEL") {
          try {
            if (typeof global !== "undefined" && typeof global.__SHOW_APP_TOAST__ === "function") {
              setTimeout(() => {
                global.__SHOW_APP_TOAST__({
                  message: t ? t("Address verification canceled") : "Address verification canceled",
                  variant: "cancel",
                  durationMs: 3000,
                  showCountdown: true,
                });
              }, 200);
            }
          } catch {}
        }
        try {
          const isConn = await device?.isConnected?.();
          if (isConn) await device.cancelConnection();
        } catch {}
        return;
      }
      throw screenErr;
    }

    // Enable monitoring first, and then send the verify command to avoid packet loss caused by rapid return of the device.
    let didCancel = false;
    // Explicit transactionId to avoid the default value being null on the native side
    const verifyTxId = createBleTransactionId("addr", device?.id);
    let addressMonitorSubscription = device.monitorCharacteristicForService(
      serviceUUID,
      notifyCharacteristicUUID,
      (error, characteristic) => {
        if (error) {
          if (isBleDisconnectError(error)) {
            try {
              const sub = addressMonitorSubscription;
              addressMonitorSubscription = null;
              sub?.remove?.();
            } catch {}
            return;
          }
          console.log("Error monitoring response:", error);
          return;
        }
        if (!characteristic || !characteristic.value) {
          console.log("No valid data received.");
          return;
        }
        const receivedDataString = Buffer.from(
          characteristic.value,
          "base64"
        ).toString("utf8");
        const receivedDataHex = Buffer.from(characteristic.value, "base64")
          .toString("hex")
          .toUpperCase();
        console.log("Received string:", receivedDataString);
        console.log("Received hex:", receivedDataHex);

        // Clean up control characters for easier matching
        const sanitizedLine = receivedDataString
          .replace(/[\x00-\x1F\x7F]/g, "")
          .trim();

        // Try parsing JSON format {"resp":"address","chain":"ethereum","addr":"0x..."}
        const addrParsed = parseResp(sanitizedLine);
        const isJsonAddress = addrParsed?.resp === "address" && addrParsed?.chain && addrParsed?.addr;
        const matchesExpectedChain = isJsonAddress &&
          expectedChainName && addrParsed.chain.toLowerCase() === expectedChainName;

        // Detect accountIdFail: Device-side verification accountId does not match
        const isAccountIdFail = addrParsed?.resp === "accountIdFail" || sanitizedLine.includes("ACCOUNT_ID_FAIL");
        if (!didCancel && isAccountIdFail) {
          didCancel = true;
          try {
            setVerificationStatus && setVerificationStatus("accountMismatch");
          } catch {}
          try {
            if (typeof setAddressModalVisible === "function") {
              setAddressModalVisible(false);
            }
          } catch {}
          try {
            if (typeof openCheckStatusModal === "function") {
              Platform.OS === "ios"
                ? setTimeout(() => openCheckStatusModal(), 50)
                : openCheckStatusModal();
            } else if (typeof setCheckStatusModalVisible === "function") {
              Platform.OS === "ios"
                ? setTimeout(() => setCheckStatusModalVisible(true), 50)
                : setCheckStatusModalVisible(true);
            }
          } catch {}
          (async () => {
            try {
              const sub = addressMonitorSubscription;
              addressMonitorSubscription = null;
              safeRemoveSubscription(sub);
            } catch {}
            try {
              await new Promise((r) => setTimeout(r, 30));
              const isConnected = await device.isConnected?.();
              if (isConnected) await device.cancelConnection();
            } catch {}
          })();
          return;
        }

        if (!didCancel && (matchesExpectedChain || isJsonAddress)) {
          didCancel = true;
          try {
            setAddressVerificationMessage(t("addressShown"));
          } catch {}
          (async () => {
            try {
              // Unsubscribe first to avoid continued triggering of callbacks during the disconnection process
              try {
                const sub = addressMonitorSubscription;
                addressMonitorSubscription = null;
                safeRemoveSubscription(sub);
              } catch (_) {}
              // Delay slightly to ensure that the underlying monitoring has been released
              await new Promise((r) => setTimeout(r, 30));

              const isConnected = await device.isConnected?.();
              if (isConnected) {
                await device.cancelConnection();
                console.log(
                  `[VERIFY_ADDR] Received address "${sanitizedLine}", subscription removed, connection cancelled for device: ${device.id}`
                );
              } else {
                console.log(
                  `[VERIFY_ADDR] Device already disconnected after address: ${device.id}`
                );
              }
            } catch (e) {
              console.log(
                "[VERIFY_ADDR] cancelConnection error:",
                e?.message || e
              );
            }
          })();
        }

        if (sanitizedLine === "Address_OK") {
          console.log("Address displayed successfully.");
          try {
            setAddressVerificationMessage(t("addressShown"));
          } catch {}
        }
      },
      // Pass in an explicit transactionId
      verifyTxId
    );

    // Make sure the listener is established before sending the command
    try {
      setIsVerifyingAddress(true);
      setAddressVerificationMessage("Verifying address on your device...");
    } catch {}
    console.log("Listener ready, will send verify:", commandString.trim());

    // Make sure the listener is established before sending the verify command (use safeWrite encapsulation to try again)
    try {
      await new Promise((r) => setTimeout(r, 80));
      await safeWrite(encodedCommand, "verify command");
      console.log("[VERIFY_ADDR][DISPLAY] command-sent", {
        ts: Date.now(),
        deviceId: device?.id || null,
      });
      console.log(
        "Verify command sent after listener setup:",
        commandString.trim()
      );
    } catch (e) {
      console.log("Verify write failed:", e?.message || e);
      // Does not interrupt the overall process: if the device has received previous instructions, it may still continue to return packets
    }

    return addressMonitorSubscription;
  } catch (error) {
    console.log("Failed to send display address command:", error);
  } finally {
    _verifyInFlight = false;
  }
};

export default displayDeviceAddress;
