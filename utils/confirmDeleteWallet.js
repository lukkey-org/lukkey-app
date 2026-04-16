/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
 * confirmDeleteWallet tool function
 * Used to confirm and perform wallet deletion operation, all dependencies need to be passed in
 *
 * @param {Object} params
 * @param {Function} params.setVerifiedDevices
 * @param {Function} params.setDeleteWalletModalVisible
 * @param {Array} params.cryptoCards
 * @param {Function} params.setCryptoCards
 * @param {Function} [params.setAddedCryptos]
 * @param {Function} [params.setInitialAdditionalCryptos]
 * @param {Object} params.navigation
 * @param {Function} params.t
 * @param {Object} params.AsyncStorage
 * @param {Array} params.devices
 * @param {Object} [params.bleManagerRef] - Optional: BleManager reference, used for covert disconnection
 * @param {Array} params.verifiedDevices
 * @param {Function} [params.setModalMessage] - Optional: used to set modal prompt information
 * @param {Function} [params.setSuccessModalVisible] - optional: used to display success modal
 * @param {Function} [params.setSuccessStatus] - Optional: used to set the status of the success modal
 * @param {Function} [params.setErrorModalVisible] - optional: used to display error modal
 * @param {Function} [params.setAccountId] - Optional: used to clear the accountId in memory
 * @param {Function} [params.setAccountName] - optional: used to clear accountName in memory
 * @param {Function} [params.clearNotifications] - Optional: clear the notification center (protect privacy)
 * @param {Function} [params.setIsVerificationSuccessful] - Optional: reset the verification success flag
 * @param {Function} [params.toggleSelfDestruct] - Optional: synchronously turn off the self-destruct password switch
 */
import { deleteSecureItems } from "./secureStorage";
import { deleteAllStoredPubkeys, PUBKEY_CHAINS } from "./pubkeyStorage";
import { stripRuntimeAssetMetrics } from "./assetRuntimeFields";

export async function confirmDeleteWallet({
  setVerifiedDevices,
  setDeleteWalletModalVisible,
  cryptoCards,
  setCryptoCards,
  setAddedCryptos,
  setInitialAdditionalCryptos,
  navigation,
  t,
  AsyncStorage,
  devices,
  bleManagerRef,
  verifiedDevices,
  setModalMessage,
  setSuccessModalVisible,
  setSuccessStatus,
  setErrorModalVisible,
  setAccountId,
  setAccountName,
  clearNotifications,
  setIsVerificationSuccessful,
  // Optional: Enable screen lock switch to synchronously turn off the UI layer
  toggleScreenLock,
  // Optional: Used to synchronously turn off the self-destruct password switch
  toggleSelfDestruct,
}) {
  const { initialAdditionalCryptos } = require("../config/assetInfo");
  const { RUNTIME_DEV } = require("./runtimeFlags");
  // Unification: do a final disconnection "after the deletion process ends" (idempotent, only executed once)
  let finalDisconnectScheduled = false;
  const scheduleFinalBleDisconnect = (
    cause = "wallet_delete_done",
    delayMs = 800
  ) => {
    if (finalDisconnectScheduled) return;
    finalDisconnectScheduled = true;
    setTimeout(
      async () => {
        try {
          const idSet = new Set();
          try {
            if (Array.isArray(verifiedDevices)) {
              for (const id of verifiedDevices) if (id) idSet.add(id);
            }
          } catch {}
          try {
            if (Array.isArray(devices)) {
              for (const d of devices || []) if (d?.id) idSet.add(d.id);
            }
          } catch {}

          // Try disconnecting through the instance again
          try {
            if (Array.isArray(devices)) {
              for (const d of devices || []) {
                try {
                  if (d?.isConnected) {
                    const isConn = await d.isConnected();
                    if (isConn) {
                      await d.cancelConnection();
                      if (RUNTIME_DEV) {
                        console.log(
                          `[WALLET_DELETE_END] Instance disconnect ok: ${d.id}`
                        );
                      }
                    } else {
                      if (RUNTIME_DEV) {
                        console.log(
                          `[WALLET_DELETE_END] Instance already disconnected: ${d?.id}`
                        );
                      }
                    }
                  }
                } catch (e) {
                  if (RUNTIME_DEV) {
                    console.log(
                      `[WALLET_DELETE_END] Instance disconnect error: ${d?.id}`,
                      e?.message || e
                    );
                  }
                }
              }
            }
          } catch {}

          // The bottom line: disconnect one by one through BleManager
          try {
            if (bleManagerRef?.current?.cancelDeviceConnection) {
              for (const id of idSet) {
                try {
                  await bleManagerRef.current.cancelDeviceConnection(id);
                  if (RUNTIME_DEV) {
                    console.log(
                      `[WALLET_DELETE_END] BleManager disconnect ok: ${id}`
                    );
                  }
                } catch (e2) {
                  if (RUNTIME_DEV) {
                    console.log(
                      `[WALLET_DELETE_END] BleManager disconnect err: ${id}`,
                      e2?.message || e2
                    );
                  }
                }
              }
            }
          } catch {}

          if (RUNTIME_DEV) {
            console.log(
              `[WALLET_DELETE_END] Final BLE disconnect done, cause=${cause}`
            );
          }
        } catch (e) {
          if (RUNTIME_DEV) {
            console.log(
              "[WALLET_DELETE_END] Final disconnect wrapper error:",
              e?.message || e
            );
          }
        }
      },
      Number.isFinite(delayMs) ? delayMs : 0
    );
  };

  // Disconnect all authenticated devices before clearing the authenticated device list (instance first, BleManager takes care of everything)
  if (Array.isArray(verifiedDevices) && verifiedDevices.length > 0) {
    try {
      for (const id of verifiedDevices) {
        try {
          const inst = Array.isArray(devices)
            ? devices.find((d) => d?.id === id)
            : null;
          if (inst) {
            try {
              const isConnected = await inst.isConnected();
              if (isConnected) {
                await inst.cancelConnection();
                if (RUNTIME_DEV) {
                  console.log(
                    `[WALLET_DELETE] Device ${id} disconnected via instance`
                  );
                }
              } else {
                if (RUNTIME_DEV) {
                  console.log(
                    `[WALLET_DELETE] Device ${id} already disconnected (instance)`
                  );
                }
              }
            } catch (e) {
              if (RUNTIME_DEV) {
                console.log(
                  `[WALLET_DELETE] Instance disconnect failed for ${id}:`,
                  e?.message || e
                );
              }
            }
          }
          // Bottom line: Cancel the connection by id through BleManager (even if it is disconnected, try again to ensure complete release)
          if (bleManagerRef?.current?.cancelDeviceConnection) {
            try {
              await bleManagerRef.current.cancelDeviceConnection(id);
              if (RUNTIME_DEV) {
                console.log(
                  `[WALLET_DELETE] Fallback disconnect via BleManager ok: ${id}`
                );
              }
            } catch (e2) {
              if (RUNTIME_DEV) {
                console.log(
                  `[WALLET_DELETE] Fallback disconnect via BleManager failed: ${id}`,
                  e2?.message || e2
                );
              }
            }
          }
        } catch {}
      }
      // Give the system some time to release GATT resources to prevent the device from being rescanned in a short period of time.
      await new Promise((r) => setTimeout(r, 250));
    } catch (error) {
      if (RUNTIME_DEV) {
        console.log(
          "[WALLET_DELETE] Error while disconnecting devices:",
          error
        );
      }
    }
  }

  setVerifiedDevices([]);
  if (typeof setIsVerificationSuccessful === "function") {
    try {
      setIsVerificationSuccessful(false);
    } catch {}
  }
  setDeleteWalletModalVisible(false);
  try {
    // Print state and AsyncStorage before deletion
    const [asCryptoCards, asAddedCryptos, asInitialAdditionalCryptos] =
      await Promise.all([
        AsyncStorage.getItem("cryptoCards"),
        AsyncStorage.getItem("addedCryptos"),
        AsyncStorage.getItem("initialAdditionalCryptos"),
      ]);
    if (RUNTIME_DEV) {
      console.log("==== Before deletion ====");
      console.log("state.cryptoCards:", cryptoCards);
      if (typeof setAddedCryptos !== "undefined")
        console.log(
          "state.addedCryptos:",
          typeof setAddedCryptos === "function" ? "function" : setAddedCryptos
        );
      if (typeof setInitialAdditionalCryptos !== "undefined")
        console.log(
          "state.initialAdditionalCryptos:",
          typeof setInitialAdditionalCryptos === "function"
            ? "function"
            : setInitialAdditionalCryptos
        );
    }
    /*     console.log("AS.cryptoCards:", asCryptoCards);
    console.log("AS.addedCryptos:", asAddedCryptos);
    console.log("AS.initialAdditionalCryptos:", asInitialAdditionalCryptos); */

    const cryptoCardsData = asCryptoCards;
    const parsedCryptoCards = JSON.parse(cryptoCardsData);
    if (parsedCryptoCards && parsedCryptoCards.length > 0) {
      await AsyncStorage.multiRemove([
        "cryptoCards",
        "addedCryptos",
        "initialAdditionalCryptos",
        "ActivityLog",
        "accountName",
        "accountId",
        "verifiedDevices",
        "selfDestructEnabled",
        "selfDestructPassword",
        "selfDestructType",
      ]);
      await deleteSecureItems([
        "screenLockPassword",
        "selfDestructPassword",
        { key: "accountId", legacyKeys: ["currentAccountId"] },
        "deviceSecureId",
        "hardwareVersion",
        "bluetoothVersion",
        "baseVersion",
      ]);
      await deleteAllStoredPubkeys(PUBKEY_CHAINS);
      setCryptoCards([]);
      setVerifiedDevices([]);
      if (typeof setAddedCryptos === "function") setAddedCryptos([]);
      if (typeof setInitialAdditionalCryptos === "function") {
        const resetInitialCryptos = (initialAdditionalCryptos || []).map(
          (item) => ({
            ...stripRuntimeAssetMetrics(item),
            address: "",
          })
        );
        setInitialAdditionalCryptos(resetInitialCryptos);
        try {
          await AsyncStorage.setItem(
            "initialAdditionalCryptos",
            JSON.stringify(resetInitialCryptos)
          );
        } catch (e0) {
          if (RUNTIME_DEV) {
            console.log(
              "Failed to reset initialAdditionalCryptos:",
              e0?.message || e0
            );
          }
        }
      }

      // Extra Cleanup: Notification Center (Protect Privacy)
      try {
        if (typeof clearNotifications === "function") {
          await clearNotifications();
        } else {
          // Bottom line: only remove notifications from local storage
          await AsyncStorage.removeItem("notifications");
        }
      } catch (e) {
        if (RUNTIME_DEV) {
          console.log("Error clearing notification center:", e);
        }
      }

      try {
        await AsyncStorage.setItem(
          "screenLockEnabled",
          JSON.stringify(false)
        );
      } catch (e1) {
        if (RUNTIME_DEV) {
          console.log(
            "Failed to set screenLockEnabled=false:",
            e1?.message || e1
          );
        }
      }
      // Synchronously turn off the old version UI switch (if a callback is provided, use the callback, otherwise the old key value will be dropped directly)
      try {
        if (typeof toggleScreenLock === "function") {
          await toggleScreenLock(false);
        } else {
          await AsyncStorage.setItem(
            "screenLockEnabled",
            JSON.stringify(false)
          );
        }
      } catch (e2) {
        if (RUNTIME_DEV) {
          console.log("Failed to turn off screen lock switch:", e2?.message || e2);
        }
      }

      try {
        if (typeof toggleSelfDestruct === "function") {
          await toggleSelfDestruct(false);
        }
      } catch (e3) {
        if (RUNTIME_DEV) {
          console.log("Failed to turn off the self-destruct password switch:", e3?.message || e3);
        }
      }

      // Print the deleted state and AsyncStorage
      const [
        asCryptoCards2,
        asAddedCryptos2,
        asInitialAdditionalCryptos2,
        asActivityLog2,
      ] = await Promise.all([
        AsyncStorage.getItem("cryptoCards"),
        AsyncStorage.getItem("addedCryptos"),
        AsyncStorage.getItem("initialAdditionalCryptos"),
        AsyncStorage.getItem("ActivityLog"),
      ]);
      if (RUNTIME_DEV) {
        console.log("==== After deletion ====");
        console.log("state.cryptoCards:", []);
        if (typeof setAddedCryptos === "function")
          console.log("state.addedCryptos:", []);
        if (typeof setInitialAdditionalCryptos === "function")
          console.log("state.initialAdditionalCryptos:", []);
        console.log("AS.cryptoCards:", asCryptoCards2);
        console.log("AS.addedCryptos:", asAddedCryptos2);
        console.log(
          "AS.initialAdditionalCryptos:",
          asInitialAdditionalCryptos2
        );
        console.log("AS.ActivityLog:", asActivityLog2);
      }

      if (typeof setAccountId === "function") setAccountId("");
      if (typeof setAccountName === "function") setAccountName("");

      if (
        typeof setModalMessage === "function" &&
        typeof setSuccessModalVisible === "function"
      ) {
        if (typeof setSuccessStatus === "function") {
          setSuccessStatus("walletDeleted");
        }
        setModalMessage(t("Deleted successfully."));
        setSuccessModalVisible(true);
      }
      // After the deletion process is completed (successful), disconnect BLE uniformly again
      try {
        scheduleFinalBleDisconnect("wallet_delete_success", 800);
      } catch {}
    } else {
      if (
        typeof setModalMessage === "function" &&
        typeof setErrorModalVisible === "function"
      ) {
        setModalMessage(t("No wallet available to delete."));
        setErrorModalVisible(true);
      }
      // If there is no way to delete the wallet, it will be deemed as the end of the process → unified disconnection
      try {
        scheduleFinalBleDisconnect("wallet_delete_noop", 800);
      } catch {}
    }
  } catch (error) {
    if (RUNTIME_DEV) {
      console.log("Error deleting wallet:", error);
    }
    if (
      typeof setModalMessage === "function" &&
      typeof setErrorModalVisible === "function"
    ) {
      setModalMessage(t("An error occurred while deleting your wallet."));
      setErrorModalVisible(true);
    }
    // Exception branches also ensure that the ending is disconnected
    try {
      scheduleFinalBleDisconnect("wallet_delete_error", 800);
    } catch {}
  }
}
