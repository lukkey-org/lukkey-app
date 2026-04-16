/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// utils/handlePinSubmit.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import { bleCmd, frameBle } from "./bleProtocol";
import { getPubkeyStorageId, getStoredPubkey } from "./pubkeyStorage";

const SYNC_VERBOSE_TRANSPORT = false;

/**
  * Factory function generates handlePinSubmit, and all dependencies are injected through parameters.
  * @param {Object} deps - dependencies
 * @param {function} deps.setSecurityCodeModalVisible
 * @param {function} deps.setCheckStatusModalVisible
 * @param {function} deps.setVerificationStatus
 * @param {function} deps.setVerifiedDevices
 * @param {function} deps.setIsVerificationSuccessful
 * @param {function} deps.setPinCode
 * @param {function} [deps.setPinErrorMessage]
 * @param {string} [deps.debugSource]
 * @param {function} deps.setReceivedAddresses
 * @param {Object} deps.prefixToShortName
 * @param {function} deps.monitorVerificationCode
 * @param {string} deps.serviceUUID
 * @param {string} deps.writeCharacteristicUUID
 * @param {Array} [deps.verifiedDevices]
 * @param {Array} [deps.devices]
 * @param {Object} [deps.bleManagerRef]
 * @param {boolean} [deps.attemptDisconnectCurrentDevice]
 * @returns {function} handlePinSubmit
 */
export function createHandlePinSubmit({
  setSecurityCodeModalVisible,
  setCheckStatusModalVisible,
  setVerificationStatus,
  setVerifiedDevices,
  setIsVerificationSuccessful,
  setPinCode,
  setPinErrorMessage,
  debugSource,
  setReceivedAddresses,
  prefixToShortName,
  monitorVerificationCode,
  serviceUUID,
  writeCharacteristicUUID,
  verifiedDevices,
  devices,
  bleManagerRef,
  attemptDisconnectCurrentDevice,
  openExclusiveModal,
}) {
  /**
   * @param {Object} params
   * @param {string} params.receivedVerificationCode
   * @param {string} params.pinCode
   * @param {Object} params.selectedDevice
   * @param {Object} params.receivedAddresses
   */
  return async function handlePinSubmit({
    receivedVerificationCode,
    pinCode,
    selectedDevice,
    receivedAddresses,
  }) {
    setCheckStatusModalVisible(false);
    if (typeof setPinErrorMessage === "function") {
      setPinErrorMessage("");
    }
    const verificationCodeValue = receivedVerificationCode.trim();
    const pinCodeValue = pinCode.trim();

    const [prefix, rest] = verificationCodeValue.split(":");
    if (prefix !== "PIN" || !rest) {
      if (typeof setPinErrorMessage === "function") {
        setPinErrorMessage(`pin_mismatch:${Date.now()}`);
      }
      console.log("Invalid verification format:", verificationCodeValue);
      return;
    }

    const [receivedPinRaw, flagRaw, accountIdRaw] = rest.split(",");
    const receivedPin = receivedPinRaw && receivedPinRaw.trim();
    const flag = flagRaw && flagRaw.trim();
    const accountId = accountIdRaw && accountIdRaw.trim();
    if (!receivedPin || (flag !== "Y" && flag !== "N")) {
      console.log("Invalid verification format:", verificationCodeValue);
      if (typeof setPinErrorMessage === "function") {
        setPinErrorMessage(`pin_mismatch:${Date.now()}`);
      }
      return;
    }

    // Consistency interception before sending: If the mobile phone input is inconsistent with the device PIN, it will be directly determined to fail to prevent mis-sending.
    if (pinCodeValue !== receivedPin) {
      console.log(
        `PIN mismatch, block sending. pinCodeValue="${pinCodeValue}", receivedPin="${receivedPin}"`
      );
      if (typeof setPinErrorMessage === "function") {
        const errorStamp = `pin_mismatch:${Date.now()}`;
        console.log("[PIN_ERROR_UI] set pinErrorMessage ->", errorStamp);
        setPinErrorMessage(errorStamp);
      } else {
        console.log("[PIN_ERROR_UI] setPinErrorMessage not provided");
      }
      if (typeof setSecurityCodeModalVisible === "function") {
        if (typeof openExclusiveModal === "function") {
          openExclusiveModal(() => setSecurityCodeModalVisible(true));
        } else {
          setSecurityCodeModalVisible(true);
        }
      }
      try {
        console.log(
          `[PIN_FAIL] sending -> device:${selectedDevice?.id || "unknown"}`
        );
        const failMessage = bleCmd.pinFail() + "\r\n";
        const bufferFail = Buffer.from(failMessage, "utf-8");
        const base64Fail = bufferFail.toString("base64");
        await selectedDevice.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64Fail
        );
      } catch (error) {
        console.log("[PIN_FAIL] send failed (mismatch):", error);
      }
      // PIN inconsistent branch: also follow the standard disconnection process to ensure the device can be re-paired
      try {
        monitorVerificationCode?.cancel?.();
      } catch {}
      try {
        await selectedDevice.cancelConnection();
        console.log("Device connection cancelled due to PIN mismatch");
      } catch (error) {
        console.log("Error cancelling device connection:", error);
      }
      setPinCode("");
      return;
    }

    if (pinCodeValue === receivedPin) {
      setSecurityCodeModalVisible(false);
      setVerificationStatus("success");
      // Defer persistence of verifiedDevices to walletReady (implemented within monitorVerificationCode)
      // Do not mark it as paired immediately when the PIN is successful to avoid an error state when the wallet is not synchronized successfully.

      // The accountId persistence is moved to walletReady to avoid being displayed incorrectly when timeout/failure occurs.

      // Defer setting isVerificationSuccessful to walletReady (implemented within monitorVerificationCode)
      // Consistent with the device PIN: send pinCodeValue and receivedPin at this time
      try {
        const pinData = bleCmd.pinOk() + "\r\n";
        const bufferPinData = Buffer.from(pinData, "utf-8");
        const base64PinData = bufferPinData.toString("base64");
        await selectedDevice.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64PinData
        );
      } catch (error) {
        console.log("Error sending pin data:", error);
      }

      try {
        const confirmationMessage = bleCmd.pinOk() + "\r\n";
        const bufferConfirmation = Buffer.from(confirmationMessage, "utf-8");
        const base64Confirmation = bufferConfirmation.toString("base64");
        await selectedDevice.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64Confirmation
        );
      } catch (error) {
        console.log("Error sending confirmation message:", error);
      }

      const tryDisconnectCurrentDevice = async () => {
        try {
          if (!attemptDisconnectCurrentDevice) return;
          if (!Array.isArray(verifiedDevices) || verifiedDevices.length === 0) {
            return;
          }
          const currentId = verifiedDevices.find(
            (id) => id && id !== selectedDevice?.id
          );
          if (!currentId) return;

          console.log(
            `[PAIRING] Try disconnect current device before sync: ${currentId}`
          );

          const currentDevice =
            devices?.find?.((d) => d?.id === currentId) || null;
          if (currentDevice?.isConnected) {
            const isConn = await currentDevice.isConnected();
            if (isConn) {
              await currentDevice.cancelConnection();
              console.log(
                `[PAIRING] Current device disconnected: ${currentId}`
              );
            } else {
              console.log(
                `[PAIRING] Current device already disconnected: ${currentId}`
              );
            }
            return;
          }

          if (bleManagerRef?.current?.cancelDeviceConnection) {
            await bleManagerRef.current.cancelDeviceConnection(currentId);
            console.log(
              `[PAIRING] cancelDeviceConnection invoked for: ${currentId}`
            );
          }
        } catch (error) {
          console.log(
            "[PAIRING] Failed to disconnect current device (ignored):",
            error?.message || error
          );
        }
      };

      if (flag === "Y") {
        await tryDisconnectCurrentDevice();
        monitorVerificationCode(selectedDevice);
        // Clarify the set of address chains expected for this synchronization (can be overridden by the caller)
        try {
          const expected = Array.from(
            new Set(Object.values(prefixToShortName || {}))
          );
          monitorVerificationCode?.setExpectedAddressShortNames?.(expected);
        } catch {}

        // After the listening is ready, send the accountName command and request the device to return "accountName:%s\r\n"
        try {
          const accountNameCmd = bleCmd.accountName() + "\r\n";
          const base64AccountNameCmd = Buffer.from(
            accountNameCmd,
            "utf-8"
          ).toString("base64");
          try {
            monitorVerificationCode?.markRequestPending?.("accountName");
          } catch {}
          await selectedDevice.writeCharacteristicWithResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            base64AccountNameCmd
          );
        } catch (error) {
          try {
            monitorVerificationCode?.markRequestPending?.("accountName");
          } catch {}
          console.log("Error sending accountName command:", error);
        }

        if (typeof openExclusiveModal === "function") {
          openExclusiveModal(() => setCheckStatusModalVisible(true));
        } else {
          setCheckStatusModalVisible(true);
        }
        setVerificationStatus("waiting");

        // 1. Issue all address:<chainName> commands in batches
        for (const prefix of Object.keys(prefixToShortName)) {
          const chainName = prefix.replace(":", "");
          const shortName = prefixToShortName[prefix];
          const getMessage = bleCmd.address(chainName) + "\r\n";
          const bufferGetMessage = Buffer.from(getMessage, "utf-8");
          const base64GetMessage = bufferGetMessage.toString("base64");
          try {
            monitorVerificationCode?.markRequestPending?.(
              `address:${shortName}`
            );
          } catch {}
          await selectedDevice.writeCharacteristicWithResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            base64GetMessage
          );
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        // 2. Check all missing chain addresses with a unified delay of 200ms, and poll for reissue within the timeout window.
        const retryStartAt = Date.now();
        const MAX_RETRY_WINDOW_MS = 4500;
        const RETRY_INTERVAL_MS = 700;
        const retryMissingAddresses = async () => {
          const elapsed = Date.now() - retryStartAt;
          if (elapsed > MAX_RETRY_WINDOW_MS) return;

          // Automatic reissue up to 7 times (use local cache to record the number of reissues)
          const retryCountKey = "bluetoothMissingChainRetryCount";
          let retryCountObj = {};
          try {
            const retryStr = await AsyncStorage.getItem(retryCountKey);
            if (retryStr) retryCountObj = JSON.parse(retryStr);
          } catch (e) {}
          if (!retryCountObj) retryCountObj = {};

          // Check the address collection of all chains
          const addresses = receivedAddresses || {};
          const expectedShortNames = Array.from(
            new Set(Object.values(prefixToShortName || {}))
          );
          const missingChains = expectedShortNames.filter(
            (shortName) => !addresses[shortName]
          );

          if (missingChains.length > 0) {
            // console.log(
            // "🚨 Uniform replenishment missing chain address request:",
            //   missingChains.join(", ")
            // );
            for (let i = 0; i < missingChains.length; i++) {
              const shortName = missingChains[i];
              // Read the number of reissues
              if (!retryCountObj[shortName]) retryCountObj[shortName] = 0;
              if (retryCountObj[shortName] >= 7) {
                continue; // Each chain can be reissued up to 7 times
              }
              retryCountObj[shortName] += 1;

              const prefixEntry = Object.entries(prefixToShortName).find(
                ([k, v]) => v === shortName
              );
              if (prefixEntry) {
                const prefix = prefixEntry[0];
                const chainName = prefix.replace(":", "");
                const getMessage = bleCmd.address(chainName) + "\r\n";
                const bufferGetMessage = Buffer.from(getMessage, "utf-8");
                const base64GetMessage = bufferGetMessage.toString("base64");
                try {
                  monitorVerificationCode?.markRequestPending?.(
                    `address:${shortName}`
                  );
                } catch {}
                await selectedDevice.writeCharacteristicWithResponseForService(
                  serviceUUID,
                  writeCharacteristicUUID,
                  base64GetMessage
                );
                // console.log(
                //   `🔁 Retry request address:${chainName} (${retryCountObj[shortName]}/7)`
                // );
                await new Promise((resolve) => setTimeout(resolve, 200));
              }
            }
            // Save the number of reissues
            await AsyncStorage.setItem(
              retryCountKey,
              JSON.stringify(retryCountObj)
            );
            // If all is not received, polling will continue for reissue.
            setTimeout(() => {
              retryMissingAddresses().catch(() => {});
            }, RETRY_INTERVAL_MS);
          } else {
            // console.log("✅ All addresses received, no missing chains");
          }
        };
        setTimeout(() => {
          retryMissingAddresses().catch(() => {});
        }, 200);

        // 3. Send pubkey command
        setTimeout(async () => {
          // Step 3.1: Send all pubkey commands with 250ms interval between each command
          const pubkeyRequestAttempts = new Map();
          const pubkeyMessages = [
            { chain: "bitcoin", path: "m/44'/0'/0'/0/0" },
            { chain: "bitcoin", path: "m/49'/0'/0'/0/0" },
            { chain: "bitcoin", path: "m/84'/0'/0'/0/0" },
            { chain: "bitcoin", path: "m/86'/0'/0'/0/0" },
            { chain: "bitcoin_cash", path: "m/44'/145'/0'/0/0" },
            { chain: "litecoin", path: "m/44'/2'/0'/0/0" },
            { chain: "litecoin", path: "m/49'/2'/0'/0/0" },
            { chain: "litecoin", path: "m/84'/2'/0'/0/0" },
            { chain: "cosmos", path: "m/44'/118'/0'/0/0" },
            { chain: "ripple", path: "m/44'/144'/0'/0/0" },
            { chain: "celestia", path: "m/44'/118'/0'/0/0" },
            // { chain: "juno", path: "m/44'/118'/0'/0/0" }, // Hidden for now
            { chain: "osmosis", path: "m/44'/118'/0'/0/0" },
            { chain: "aptos", path: "m/44'/637'/0'/0'/0'" },
          ];

          for (const message of pubkeyMessages) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            try {
              const messageWithNewline = bleCmd.pubkey(message.chain, message.path) + "\r\n";
              const bufferMessage = Buffer.from(messageWithNewline, "utf-8");
              const base64Message = bufferMessage.toString("base64");
              try {
                const requestKey = getPubkeyStorageId(
                  message.chain,
                  message.path
                );
                if (requestKey) {
                  const attempt = (pubkeyRequestAttempts.get(requestKey) || 0) + 1;
                  pubkeyRequestAttempts.set(requestKey, attempt);
                  if (SYNC_VERBOSE_TRANSPORT) {
                    console.log("[PUBKEY_TX]", {
                      requestKey,
                      phase: "initial",
                      attempt,
                      chain: message.chain,
                      path: message.path,
                    });
                  }
                  monitorVerificationCode?.markRequestPending?.(
                    `pubkey:${requestKey}`
                  );
                }
              } catch {}
              await selectedDevice.writeCharacteristicWithResponseForService(
                serviceUUID,
                writeCharacteristicUUID,
                base64Message
              );
              // console.log(`Sent message: ${messageWithNewline}`);
            } catch (error) {
              console.log(`Error sending pubkey "${message.chain}":`, error);
            }
          }

          // Step 3.2: Retry if public key is missing (up to 7 times, each interval is 250ms)
          const pubkeyTargets = pubkeyMessages.map((msg) => ({
            ...msg,
            storageId: getPubkeyStorageId(msg.chain, msg.path),
          }));
          for (const target of pubkeyTargets) {
            for (let attempt = 1; attempt <= 7; attempt++) {
              let exists = false;
              try {
                const val = await getStoredPubkey(target.chain, target.path);
                exists = !!val;
              } catch {}
              if (exists) break;

              try {
                const messageWithNewline =
                  bleCmd.pubkey(target.chain, target.path) + "\r\n";
                const bufferMessage = Buffer.from(messageWithNewline, "utf-8");
                const base64Message = bufferMessage.toString("base64");
                try {
                  const attempt =
                    (pubkeyRequestAttempts.get(target.storageId) || 0) + 1;
                  pubkeyRequestAttempts.set(target.storageId, attempt);
                  if (SYNC_VERBOSE_TRANSPORT) {
                    console.log("[PUBKEY_TX]", {
                      requestKey: target.storageId,
                      phase: "retry",
                      attempt,
                      chain: target.chain,
                      path: target.path,
                    });
                  }
                  monitorVerificationCode?.markRequestPending?.(
                    `pubkey:${target.storageId}`
                  );
                } catch {}
                await selectedDevice.writeCharacteristicWithResponseForService(
                  serviceUUID,
                  writeCharacteristicUUID,
                  base64Message
                );
              } catch (error) {
                console.log(
                  `Error resending pubkey "${target.storageId}":`,
                  error
                );
              }
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          }
        }, 100);
        if (typeof openExclusiveModal === "function") {
          openExclusiveModal(() => setCheckStatusModalVisible(true));
        } else {
          setCheckStatusModalVisible(true);
        }
      } else if (flag === "N") {
        console.log("Flag N received; no 'address' sent");
        setSecurityCodeModalVisible(false);
        if (typeof openExclusiveModal === "function") {
          openExclusiveModal(() => setCheckStatusModalVisible(true));
        } else {
          setCheckStatusModalVisible(true);
        }
        setVerificationStatus("noWalletInHardware");

        // When Flag is "N": cancel the subscription first and then disconnect the device
        try {
          monitorVerificationCode?.cancel?.();
        } catch {}
        try {
          await selectedDevice.cancelConnection();
          console.log("Device connection cancelled due to flag N");
        } catch (error) {
          console.log("Error cancelling device connection:", error);
        }
      }
    } else {
      console.log("PIN verification failed");
      setSecurityCodeModalVisible(false);
      if (typeof openExclusiveModal === "function") {
        openExclusiveModal(() => setCheckStatusModalVisible(true));
      } else {
        setCheckStatusModalVisible(true);
      }
      setVerificationStatus("fail");

      try {
        console.log(
          `[PIN_FAIL] sending -> device:${selectedDevice?.id || "unknown"}`
        );
        const failMessage = bleCmd.pinFail() + "\r\n";
        const bufferFail = Buffer.from(failMessage, "utf-8");
        const base64Fail = bufferFail.toString("base64");
        await selectedDevice.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          base64Fail
        );
      } catch (error) {
        console.log("[PIN_FAIL] send failed (verify fail):", error);
      }

      // Failure branch: cancel the subscription first and then disconnect the device
      try {
        monitorVerificationCode?.cancel?.();
      } catch {}
      try {
        await selectedDevice.cancelConnection();
        console.log("Device connection cancelled due to PIN mismatch");
      } catch (error) {
        console.log("Error cancelling device connection:", error);
      }
    }

    setPinCode("");
  };
}
